import { execFile } from "node:child_process";

export interface NativeClipboardSnapshot {
  hasHtml: boolean;
  hasText: boolean;
  imageCount: number;
  styleCount: number;
  htmlLength: number;
}

export function probeMacNativeClipboard(): Promise<NativeClipboardSnapshot> {
  const script = `ObjC.import("AppKit");
var board=$.NSPasteboard.generalPasteboard;
var html=board.stringForType($.NSPasteboardTypeHTML);
var plain=board.stringForType($.NSPasteboardTypeString);
var value=html.isNil()?"":ObjC.unwrap(html);
JSON.stringify({hasHtml:!html.isNil(),hasText:!plain.isNil(),
imageCount:value.split("data:image/").length-1,
styleCount:value.split("style=").length-1,htmlLength:value.length});`;
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-l", "JavaScript", "-e", script],
      { timeout: 5000, maxBuffer: 4096 },
      (error, stdout) => {
        if (error) {
          reject(error instanceof Error ? error : new Error("Native clipboard probe failed."));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()) as NativeClipboardSnapshot);
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error(String(parseError)));
        }
      }
    );
  });
}

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export interface RichClipboardWriteResult {
  method?: string;
  nativeSnapshot?: NativeClipboardSnapshot;
  formats: string[];
  html: string;
  text: string;
  htmlVerified: boolean;
  textVerified: boolean;
}

export interface RichClipboardWriter {
  writeHtml(
    html: string,
    text: string
  ): Promise<RichClipboardWriteResult>;
}

export interface ExternalOpener {
  open(url: string): Promise<void>;
}

export interface ElectronClipboardRuntime {
  writeText(text: string): void;
  write(data: { html?: string; text?: string }): void;
  availableFormats(): string[];
  readHTML(): string;
  readText(): string;
}

interface ElectronRuntime {
  clipboard: ElectronClipboardRuntime;
  shell: {
    openExternal(url: string): Promise<void>;
  };
}

function electronRuntime(): ElectronRuntime {
  return require("electron") as ElectronRuntime;
}

export class ElectronClipboardWriter implements ClipboardWriter {
  async writeText(text: string): Promise<void> {
    electronRuntime().clipboard.writeText(text);
  }
}

export type BrowserClipboardWriteMethod =
  | "clipboard-item"
  | "exec-command";

function tryExecCommandRichCopy(html: string): boolean {
  const host = document.createElement("div");
  host.contentEditable = "true";
  host.classList.add("obsidian-publisher-clipboard-copy-host");
  // DOMParser creates an inert document and avoids assigning copied article
  // markup through innerHTML on an element in Obsidian's document.
  const parsed = new DOMParser().parseFromString(html, "text/html");
  host.replaceChildren(...Array.from(parsed.body.childNodes));
  document.body.appendChild(host);

  const range = document.createRange();
  range.selectNodeContents(host);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand("copy");
  } finally {
    selection?.removeAllRanges();
    host.remove();
  }
}

export async function writeBrowserRichClipboard(
  html: string,
  text: string
): Promise<BrowserClipboardWriteMethod> {
  // This path must execute synchronously inside the user's click handler.
  // In Electron/Chromium it preserves rich HTML flavors without waiting for
  // any asynchronous permission round-trip.
  if (tryExecCommandRichCopy(html)) {
    return "exec-command";
  }

  const ClipboardItemCtor =
    typeof ClipboardItem !== "undefined" ? ClipboardItem : undefined;

  if (navigator.clipboard?.write && ClipboardItemCtor) {
    await navigator.clipboard.write([
      new ClipboardItemCtor({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" })
      })
    ]);
    return "clipboard-item";
  }

  throw new Error(
    "Browser rich-text clipboard write failed for both execCommand and ClipboardItem."
  );
}

export class BrowserRichClipboardWriter implements RichClipboardWriter {
  constructor(
    private readonly verifier: ElectronClipboardRuntime =
      electronRuntime().clipboard,
    private readonly browserWrite = writeBrowserRichClipboard,
    private readonly nativeProbe = probeMacNativeClipboard
  ) {}

  async writeHtml(
    html: string,
    text: string
  ): Promise<RichClipboardWriteResult> {
    const method = await this.browserWrite(html, text);

    if (process.platform === "darwin") {
      // Electron readHTML() sometimes disagrees with Chromium's native
      // Pasteboard HTML flavor. Verify the actual macOS board instead of
      // falsely calling the input HTML a verified clipboard readback.
      try {
        const nativeSnapshot = await this.nativeProbe();
        return {
          method,
          nativeSnapshot,
          formats: [
            ...(nativeSnapshot.hasText ? ["text/plain"] : []),
            ...(nativeSnapshot.hasHtml ? ["text/html"] : [])
          ],
          html,
          text,
          htmlVerified: nativeSnapshot.hasHtml &&
            nativeSnapshot.htmlLength > 0 && nativeSnapshot.styleCount > 0,
          textVerified: nativeSnapshot.hasText
        };
      } catch {
        return {
          method,
          formats: this.verifier.availableFormats(),
          html: "",
          text: this.verifier.readText(),
          htmlVerified: false,
          textVerified: Boolean(this.verifier.readText())
        };
      }
    }

    const formats = this.verifier.availableFormats();
    const readBackHtml = this.verifier.readHTML();
    const readBackText = this.verifier.readText();
    const hasHtmlFormat = formats.some((format) =>
      format.toLowerCase().includes("html")
    );
    const hasTextFormat = formats.some((format) =>
      format.toLowerCase().includes("text")
    );

    return {
      method,
      formats,
      html: readBackHtml,
      text: readBackText,
      htmlVerified:
        hasHtmlFormat &&
        readBackHtml.trim().length > 0 &&
        /<[^>]+>/.test(readBackHtml),
      textVerified:
        hasTextFormat &&
        readBackText.trim().length > 0
    };
  }
}

export class ElectronRichClipboardWriter implements RichClipboardWriter {
  constructor(
    private readonly clipboard: ElectronClipboardRuntime =
      electronRuntime().clipboard
  ) {}

  async writeHtml(
    html: string,
    text: string
  ): Promise<RichClipboardWriteResult> {
    // Electron 37 on macOS is order-sensitive here: text must be
    // inserted before html or NSPasteboard may expose only plain text.
    this.clipboard.write({ text, html });

    const formats = this.clipboard.availableFormats();
    const readBackHtml = this.clipboard.readHTML();
    const readBackText = this.clipboard.readText();
    const hasHtmlFormat = formats.some((format) =>
      format.toLowerCase().includes("html")
    );
    const hasTextFormat = formats.some((format) =>
      format.toLowerCase().includes("text")
    );

    return {
      method: "electron",
      formats,
      html: readBackHtml,
      text: readBackText,
      htmlVerified:
        hasHtmlFormat &&
        readBackHtml.trim().length > 0 &&
        /<[^>]+>/.test(readBackHtml),
      textVerified:
        hasTextFormat &&
        readBackText.trim().length > 0
    };
  }
}

export class ElectronExternalOpener implements ExternalOpener {
  async open(url: string): Promise<void> {
    await electronRuntime().shell.openExternal(url);
  }
}
