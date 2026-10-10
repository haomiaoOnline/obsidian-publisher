import { describe, expect, it } from "vitest";
import {
  BrowserRichClipboardWriter,
  ElectronRichClipboardWriter,
  type ElectronClipboardRuntime
} from "../src/services/desktop";

function createClipboard(formats: string[] = ["text/plain", "text/html"]) {
  let written: { html?: string; text?: string } = {};
  let writeOrder: string[] = [];
  const clipboard: ElectronClipboardRuntime = {
    writeText: (text) => {
      written = { text };
    },
    write: (data) => {
      writeOrder = Object.keys(data);
      written = { ...data };
    },
    availableFormats: () => formats,
    readHTML: () => written.html ?? "",
    readText: () => written.text ?? ""
  };
  return {
    clipboard,
    getWritten: () => written,
    getWriteOrder: () => writeOrder
  };
}

describe("rich clipboard writer", () => {
  it("writes and verifies HTML and plain text in one clipboard payload", async () => {
    const fake = createClipboard();
    const writer = new ElectronRichClipboardWriter(fake.clipboard);

    const result = await writer.writeHtml(
      '<p style="font-size:16px"><strong>Hello</strong></p>',
      "Hello"
    );

    expect(fake.getWritten()).toEqual({
      html: '<p style="font-size:16px"><strong>Hello</strong></p>',
      text: "Hello"
    });
    expect(fake.getWriteOrder()).toEqual(["text", "html"]);
    expect(result.htmlVerified).toBe(true);
    expect(result.textVerified).toBe(true);
    expect(result.formats).toContain("text/html");
  });

  it("uses the browser rich-copy channel before Electron verification", async () => {
    const html = '<p style="color:red"><strong>Browser rich</strong></p>';
    const text = "Browser rich";
    const calls: Array<{ html: string; text: string }> = [];
    const verifier: ElectronClipboardRuntime = {
      writeText: () => undefined,
      write: () => undefined,
      availableFormats: () => ["text/plain", "text/html"],
      readHTML: () => html,
      readText: () => text
    };
    const writer = new BrowserRichClipboardWriter(
      verifier,
      async (seenHtml, seenText) => {
        calls.push({ html: seenHtml, text: seenText });
        return "clipboard-item";
      },
      async () => ({
        hasHtml: true, hasText: true, imageCount: 0,
        styleCount: 1, htmlLength: html.length
      })
    );

    const result = await writer.writeHtml(html, text);

    expect(calls).toEqual([{ html, text }]);
    expect(result.htmlVerified).toBe(true);
    expect(result.textVerified).toBe(true);
  });

  it("uses a real native clipboard probe instead of trusting execCommand return alone", async () => {
    const html = '<section style="color:red"><strong>Exec rich</strong></section>';
    const text = "Exec rich";
    const verifier: ElectronClipboardRuntime = {
      writeText: () => undefined,
      write: () => undefined,
      availableFormats: () => ["text/plain"],
      readHTML: () => "",
      readText: () => text
    };
    const writer = new BrowserRichClipboardWriter(
      verifier,
      async () => "exec-command",
      async () => ({
        hasHtml: true, hasText: true, imageCount: 0,
        styleCount: 1, htmlLength: html.length
      })
    );

    const result = await writer.writeHtml(html, text);

    expect(result.method).toBe("exec-command");
    expect(result.formats).toEqual(["text/plain", "text/html"]);
    expect(result.html).toBe(html);
    expect(result.htmlVerified).toBe(true);
    expect(result.textVerified).toBe(true);
  });

  it("rejects a reported successful execCommand when macOS only has plain text", async () => {
    const fake = createClipboard(["text/plain"]);
    const writer = new BrowserRichClipboardWriter(
      fake.clipboard,
      async () => "exec-command",
      async () => ({
        hasHtml: false, hasText: true, imageCount: 0,
        styleCount: 0, htmlLength: 0
      })
    );
    const result = await writer.writeHtml("<b>Rich</b>", "Rich");
    expect(result.htmlVerified).toBe(false);
    expect(result.formats).not.toContain("text/html");
  });

  it("does not report rich copy success when the system exposes only plain text", async () => {
    const fake = createClipboard(["text/plain"]);
    const writer = new ElectronRichClipboardWriter(fake.clipboard);

    const result = await writer.writeHtml("<b>Hello</b>", "Hello");

    expect(result.htmlVerified).toBe(false);
    expect(result.textVerified).toBe(true);
  });
});
