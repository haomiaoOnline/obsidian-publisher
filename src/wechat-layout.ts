import type {
  ArticleImage,
  WechatLayoutSettings,
  WechatSectionStyle
} from "./types";

const FONT_STACKS: Record<WechatLayoutSettings["fontFamily"], string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif',
  "source-han":
    '"Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", sans-serif',
  "microsoft-yahei":
    '"Microsoft YaHei", "PingFang SC", Arial, sans-serif'
};

export const WECHAT_SECTION_STYLE_LABELS: Record<
  WechatSectionStyle,
  string
> = {
  underline: "粗下划线",
  "left-bar": "左竖线",
  boxed: "方框",
  bracket: "方括号"
};

export type WechatThemePresetId =
  | "editorial"
  | "tech"
  | "warm"
  | "forest";

export interface WechatThemePreset {
  id: WechatThemePresetId;
  label: string;
  description: string;
  layout: WechatLayoutSettings;
}

export const WECHAT_THEME_PRESETS: readonly WechatThemePreset[] = [
  {
    id: "editorial",
    label: "Editorial",
    description: "Black, quiet and article-first",
    layout: {
      fontSize: 16,
      lineHeight: 1.9,
      fontFamily: "system",
      bodyColor: "#262626",
      accentColor: "#171717",
      sectionStyle: "underline"
    }
  },
  {
    id: "tech",
    label: "Tech Blue",
    description: "Clear hierarchy for AI and product writing",
    layout: {
      fontSize: 16,
      lineHeight: 1.85,
      fontFamily: "source-han",
      bodyColor: "#253044",
      accentColor: "#2f6feb",
      sectionStyle: "left-bar"
    }
  },
  {
    id: "warm",
    label: "Warm Paper",
    description: "Softer rhythm for long-form reading",
    layout: {
      fontSize: 17,
      lineHeight: 2,
      fontFamily: "system",
      bodyColor: "#44362f",
      accentColor: "#c46a3a",
      sectionStyle: "bracket"
    }
  },
  {
    id: "forest",
    label: "Forest",
    description: "Calm contrast with structured sections",
    layout: {
      fontSize: 16,
      lineHeight: 1.95,
      fontFamily: "source-han",
      bodyColor: "#26352e",
      accentColor: "#2f7a5b",
      sectionStyle: "boxed"
    }
  }
];

export function matchesWechatTheme(
  layout: WechatLayoutSettings,
  preset: WechatThemePreset
): boolean {
  return (
    layout.fontSize === preset.layout.fontSize &&
    layout.lineHeight === preset.layout.lineHeight &&
    layout.fontFamily === preset.layout.fontFamily &&
    layout.bodyColor.toLowerCase() === preset.layout.bodyColor.toLowerCase() &&
    layout.accentColor.toLowerCase() ===
      preset.layout.accentColor.toLowerCase() &&
    layout.sectionStyle === preset.layout.sectionStyle
  );
}

function setStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>
): void {
  Object.assign(element.style, styles);
}

function sectionStyle(
  heading: HTMLElement,
  style: WechatSectionStyle,
  accentColor: string
): void {
  heading.style.border = "";
  heading.style.borderLeft = "";
  heading.style.borderBottom = "";
  heading.style.borderRadius = "";
  heading.style.padding = "";
  heading.style.paddingLeft = "";
  heading.style.paddingBottom = "";
  heading.style.background = "";

  if (style === "left-bar") {
    setStyles(heading, {
      borderLeft: "5px solid " + accentColor,
      paddingLeft: "12px"
    });
    return;
  }

  if (style === "boxed") {
    setStyles(heading, {
      border: "2px solid " + accentColor,
      borderRadius: "8px",
      padding: "8px 12px"
    });
    return;
  }

  if (style === "bracket") {
    if (!heading.dataset.publisherOriginalText) {
      heading.dataset.publisherOriginalText = heading.textContent ?? "";
    }
    const original = heading.dataset.publisherOriginalText ?? "";
    heading.textContent = "［" + original + "］";
    return;
  }

  setStyles(heading, {
    borderBottom: "3px solid " + accentColor,
    paddingBottom: "8px"
  });
}

function restoreHeadingText(heading: HTMLElement): void {
  const original = heading.dataset.publisherOriginalText;
  if (original !== undefined) {
    heading.textContent = original;
  }
}

export function applyWechatLayout(
  root: HTMLElement,
  settings: WechatLayoutSettings
): void {
  setStyles(root, {
    fontFamily: FONT_STACKS[settings.fontFamily],
    fontSize: settings.fontSize + "px",
    lineHeight: String(settings.lineHeight),
    color: settings.bodyColor,
    letterSpacing: "0.02em",
    wordBreak: "break-word"
  });

  root.querySelectorAll<HTMLElement>("p").forEach((element) => {
    setStyles(element, {
      margin: "0 0 1.05em",
      lineHeight: String(settings.lineHeight),
      color: settings.bodyColor
    });
  });

  root.querySelectorAll<HTMLElement>("h1").forEach((element) => {
    setStyles(element, {
      margin: "0 0 1.2em",
      fontSize: "1.75em",
      lineHeight: "1.35",
      fontWeight: "700",
      color: "#111111",
      textAlign: "left"
    });
  });

  root.querySelectorAll<HTMLElement>("h2").forEach((element) => {
    restoreHeadingText(element);
    setStyles(element, {
      margin: "2em 0 1em",
      fontSize: "1.35em",
      lineHeight: "1.45",
      fontWeight: "700",
      color: "#111111"
    });
    sectionStyle(element, settings.sectionStyle, settings.accentColor);
  });

  root.querySelectorAll<HTMLElement>("h3").forEach((element) => {
    setStyles(element, {
      margin: "1.6em 0 0.75em",
      paddingLeft: "10px",
      borderLeft: "4px solid " + settings.accentColor,
      fontSize: "1.12em",
      lineHeight: "1.45",
      fontWeight: "700",
      color: "#222222"
    });
  });

  root.querySelectorAll<HTMLElement>("strong").forEach((element) => {
    setStyles(element, {
      color: settings.accentColor,
      fontWeight: "700"
    });
  });

  root.querySelectorAll<HTMLElement>("blockquote").forEach((element) => {
    setStyles(element, {
      margin: "1.2em 0",
      padding: "0.8em 1em",
      borderLeft: "4px solid " + settings.accentColor,
      background: "rgba(127, 127, 127, 0.08)",
      color: settings.bodyColor
    });
  });

  root.querySelectorAll<HTMLElement>("ul, ol").forEach((element) => {
    setStyles(element, {
      margin: "0.8em 0 1.2em",
      paddingLeft: "1.6em"
    });
  });

  root.querySelectorAll<HTMLElement>("li").forEach((element) => {
    setStyles(element, {
      margin: "0.35em 0",
      lineHeight: String(settings.lineHeight)
    });
  });

  root.querySelectorAll<HTMLElement>("a").forEach((element) => {
    setStyles(element, {
      color: settings.accentColor,
      textDecoration: "underline"
    });
  });

  root.querySelectorAll<HTMLElement>("code").forEach((element) => {
    setStyles(element, {
      padding: "0.12em 0.35em",
      borderRadius: "4px",
      background: "rgba(127, 127, 127, 0.12)",
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: "0.9em"
    });
  });

  root.querySelectorAll<HTMLElement>("pre").forEach((element) => {
    setStyles(element, {
      margin: "1.2em 0",
      padding: "1em",
      overflow: "auto",
      borderRadius: "10px",
      background: "#1f2329",
      color: "#f3f4f6",
      lineHeight: "1.6"
    });
  });

  root.querySelectorAll<HTMLElement>("pre code").forEach((element) => {
    setStyles(element, {
      padding: "0",
      background: "transparent",
      color: "inherit"
    });
  });

  root.querySelectorAll<HTMLElement>("table").forEach((element) => {
    setStyles(element, {
      width: "100%",
      margin: "1.2em 0",
      borderCollapse: "collapse",
      fontSize: "0.94em"
    });
  });

  root.querySelectorAll<HTMLElement>("th, td").forEach((element) => {
    setStyles(element, {
      padding: "8px 10px",
      border: "1px solid #d9d9d9",
      textAlign: "left"
    });
  });

  root.querySelectorAll<HTMLImageElement>("img").forEach((element) => {
    setStyles(element, {
      display: "block",
      maxWidth: "100%",
      height: "auto",
      margin: "1.4em auto",
      borderRadius: "8px"
    });
  });

  root.querySelectorAll<HTMLElement>("hr").forEach((element) => {
    setStyles(element, {
      margin: "2em 0",
      border: "0",
      borderTop: "1px solid #e8e8e8"
    });
  });
}

export function restoreLocalImageSources(
  root: HTMLElement,
  images: ArticleImage[]
): void {
  const unresolved = images.filter((image) => Boolean(image.absolutePath));
  const renderedImages = Array.from(
    root.querySelectorAll<HTMLImageElement>("img")
  ).filter((element) => {
    const src = element.getAttribute("src") ?? "";
    return !/^(https?:|data:)/i.test(src);
  });

  for (const image of unresolved) {
    if (!image.absolutePath) {
      continue;
    }

    const fileName = image.vaultPath.split("/").pop() ?? "";
    const match = renderedImages.find((element) => {
      const src = element.getAttribute("src") ?? "";
      const alt = element.getAttribute("alt") ?? "";
      return (
        (fileName && decodeURIComponent(src).includes(fileName)) ||
        (fileName && alt.includes(fileName.replace(/\.[^.]+$/, "")))
      );
    });

    if (match) {
      match.setAttribute("src", image.absolutePath);
      renderedImages.splice(renderedImages.indexOf(match), 1);
      continue;
    }

    const fallback = renderedImages.shift();
    fallback?.setAttribute("src", image.absolutePath);
  }
}

export const WECHAT_CLIPBOARD_MARKER = "rich-v1";
export const WECHAT_CLIPBOARD_MAX_HTML_CHARS = 10_000_000;

export type LocalImageBinaryReader = (
  vaultPath: string
) => Promise<ArrayBuffer | Uint8Array | undefined>;

export function imageMimeTypeForPath(filePath: string): string | undefined {
  const extension = filePath.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp"
  };
  return extension ? types[extension] : undefined;
}

export function buildImageDataUrl(
  filePath: string,
  bytes: ArrayBuffer | Uint8Array
): string | undefined {
  const mime = imageMimeTypeForPath(filePath);
  if (!mime) {
    return undefined;
  }
  const buffer = bytes instanceof Uint8Array
    ? Buffer.from(bytes)
    : Buffer.from(new Uint8Array(bytes));
  return "data:" + mime + ";base64," + buffer.toString("base64");
}

function loadClipboardImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode local image."));
    image.src = source;
  });
}

export async function buildClipboardImageDataUrl(
  filePath: string,
  bytes: ArrayBuffer | Uint8Array
): Promise<string | undefined> {
  const original = buildImageDataUrl(filePath, bytes);
  const mime = imageMimeTypeForPath(filePath);
  if (!original || !mime) {
    return undefined;
  }

  if (!/^image\/(?:png|jpe?g|webp)$/i.test(mime)) {
    return original;
  }

  const image = await loadClipboardImage(original);
  const maxDimension = 1280;
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return original;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export async function embedLocalImagesAsDataUrls(
  root: HTMLElement,
  images: ArticleImage[],
  readBinary: LocalImageBinaryReader
): Promise<number> {
  const renderedImages = Array.from(
    root.querySelectorAll<HTMLImageElement>("img")
  ).filter((element) => {
    const src = element.getAttribute("src") ?? "";
    return !/^(https?:|data:)/i.test(src);
  });

  let embedded = 0;
  for (const image of images) {
    const bytes = await readBinary(image.vaultPath);
    if (!bytes) {
      continue;
    }

    const dataUrl = await buildClipboardImageDataUrl(
      image.vaultPath,
      bytes
    );
    if (!dataUrl) {
      continue;
    }

    const fileName = image.vaultPath.split("/").pop() ?? "";
    const match = renderedImages.find((element) => {
      const src = element.getAttribute("src") ?? "";
      const alt = element.getAttribute("alt") ?? "";
      return (
        (fileName && decodeURIComponent(src).includes(fileName)) ||
        (fileName && alt.includes(fileName.replace(/\.[^.]+$/, "")))
      );
    });

    const target = match ?? renderedImages[0];
    if (!target) {
      continue;
    }

    target.setAttribute("src", dataUrl);
    const targetIndex = renderedImages.indexOf(target);
    if (targetIndex >= 0) {
      renderedImages.splice(targetIndex, 1);
    }
    embedded += 1;
  }

  return embedded;
}

const WECHAT_COMPUTED_STYLE_PROPERTIES = [
  "display",
  "margin",
  "padding",
  "color",
  "backgroundColor",
  "border",
  "borderLeft",
  "borderRadius",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "wordBreak",
  "whiteSpace",
  "overflowX",
  "listStyleType",
  "listStylePosition",
  "objectFit",
  "boxShadow",
  "borderTop",
  "borderRight",
  "borderBottom",
  "overflow",
  "verticalAlign",
  "backgroundImage",
  "borderCollapse",
  "borderSpacing",
  "tableLayout"
] as const;

function cssPropertyName(name: string): string {
  return name.replace(/[A-Z]/g, (character) =>
    "-" + character.toLowerCase()
  );
}

export function cloneWechatFragmentWithComputedStyles(
  source: HTMLElement
): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const sourceNodes = [
    source,
    ...Array.from(source.querySelectorAll<HTMLElement>("*"))
  ];
  const cloneNodes = [
    clone,
    ...Array.from(clone.querySelectorAll<HTMLElement>("*"))
  ];

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) {
      return;
    }

    const computed = window.getComputedStyle(sourceNode);
    for (const property of WECHAT_COMPUTED_STYLE_PROPERTIES) {
      const value = computed[property];
      if (typeof value !== "string" || !value) {
        continue;
      }
      cloneNode.style.setProperty(cssPropertyName(property), value);
    }
    cloneNode.style.boxSizing = "border-box";
    cloneNode.removeAttribute("class");
    cloneNode.removeAttribute("id");

    const text = (sourceNode.textContent ?? "").replace(/\u00a0/g, " ").trim();
    const isCode = sourceNode.closest("pre") !== null;
    if (
      /^(H1|H2|H3|H4|H5|H6|P|LI|BLOCKQUOTE|TD|TH|DIV)$/.test(
        sourceNode.tagName
      ) &&
      text &&
      !isCode
    ) {
      const fontSize = Number.parseFloat(computed.fontSize);
      const lineHeight = Number.parseFloat(computed.lineHeight);
      if (
        Number.isFinite(fontSize) &&
        Number.isFinite(lineHeight) &&
        lineHeight < fontSize
      ) {
        cloneNode.style.lineHeight = String(Math.max(1.5, lineHeight / fontSize));
      }
      cloneNode.style.minWidth = "0";
      cloneNode.style.maxWidth = "100%";
      cloneNode.style.whiteSpace = "normal";
      cloneNode.style.wordBreak = "break-word";
      cloneNode.style.overflowWrap = "anywhere";
    }

    if (
      /^(SPAN|STRONG|B|EM|I|A|DEL|S|MARK|SMALL|BIG|FONT)$/.test(
        sourceNode.tagName
      ) &&
      !isCode
    ) {
      const parentTextBlock =
        sourceNode.closest<HTMLElement>(
          "h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th"
        ) ?? sourceNode.parentElement;
      if (parentTextBlock) {
        cloneNode.style.fontSize =
          window.getComputedStyle(parentTextBlock).fontSize;
      }
      cloneNode.style.removeProperty("line-height");
      cloneNode.style.removeProperty("white-space");
      cloneNode.style.wordBreak = "break-word";
      cloneNode.style.overflowWrap = "anywhere";
      cloneNode.removeAttribute("size");
    }

    if (
      sourceNode instanceof HTMLImageElement &&
      cloneNode instanceof HTMLImageElement
    ) {
      const rootWidth = Math.max(1, source.getBoundingClientRect().width);
      const renderedWidth = sourceNode.getBoundingClientRect().width;
      const isFullWidth =
        !renderedWidth || renderedWidth >= rootWidth * 0.9;

      cloneNode.removeAttribute("width");
      cloneNode.removeAttribute("height");
      cloneNode.removeAttribute("align");
      cloneNode.removeAttribute("hspace");
      cloneNode.removeAttribute("vspace");
      cloneNode.style.display = "block";
      cloneNode.style.position = "static";
      cloneNode.style.float = "none";
      cloneNode.style.clear = "both";
      cloneNode.style.left = "auto";
      cloneNode.style.right = "auto";
      cloneNode.style.top = "auto";
      cloneNode.style.bottom = "auto";
      cloneNode.style.objectFit = "contain";
      cloneNode.style.objectPosition = "center center";
      cloneNode.style.width = isFullWidth
        ? "100%"
        : Math.ceil(renderedWidth) + "px";
      cloneNode.style.height = "auto";
      cloneNode.style.maxWidth = "100%";
      cloneNode.style.marginLeft = "auto";
      cloneNode.style.marginRight = "auto";
    }
  });

  clone.style.display = "block";
  clone.style.width = "100%";
  clone.style.maxWidth = "100%";
  clone.style.margin = "0";
  clone.style.padding = "0";
  clone.dataset.obsidianPublisherCopy = WECHAT_CLIPBOARD_MARKER;

  return clone;
}

export function validateWechatClipboardFragment(
  fragment: HTMLElement
): void {
  const unsafeLineHeights = Array.from(
    fragment.querySelectorAll<HTMLElement>("[style]")
  ).filter((element) => {
    const lineHeight = element.style.lineHeight;
    const fontSize = element.style.fontSize;
    if (!lineHeight || lineHeight === "0" || !fontSize) {
      return false;
    }
    if (/^\d+(?:\.\d+)?$/.test(lineHeight)) {
      return false;
    }
    const lineHeightPx = lineHeight.endsWith("px")
      ? Number.parseFloat(lineHeight)
      : NaN;
    const fontSizePx = fontSize.endsWith("px")
      ? Number.parseFloat(fontSize)
      : NaN;
    return (
      Number.isFinite(lineHeightPx) &&
      Number.isFinite(fontSizePx) &&
      lineHeightPx < fontSizePx
    );
  });

  const unsafeImages = Array.from(
    fragment.querySelectorAll<HTMLImageElement>("img")
  ).filter(
    (image) =>
      !image.style.width ||
      image.style.width === "auto" ||
      !image.style.maxWidth ||
      image.style.maxWidth === "none"
  );

  if (unsafeLineHeights.length || unsafeImages.length) {
    throw new Error(
      "WeChat fragment safety check failed (line-height " +
        String(unsafeLineHeights.length) +
        ", images " +
        String(unsafeImages.length) +
        ")."
    );
  }
}

export function serializeWechatClipboardFragment(
  fragment: HTMLElement
): string {
  validateWechatClipboardFragment(fragment);
  return fragment.outerHTML;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWechatHtmlDocument(
  title: string,
  bodyHtml: string,
  options: { clipboard?: boolean } = {}
): string {
  const marker = options.clipboard
    ? ' data-obsidian-publisher-copy="' + WECHAT_CLIPBOARD_MARKER + '"'
    : "";
  return (
    "<!doctype html>\n" +
    '<html><head><meta charset="utf-8">' +
    "<title>" +
    escapeHtml(title) +
    "</title></head><body>" +
    '<section' + marker + ' style="max-width:720px;margin:0 auto;padding:0 4px;">' +
    bodyHtml +
    "</section></body></html>"
  );
}
