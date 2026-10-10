import { describe, expect, it } from "vitest";
import {
  buildImageDataUrl,
  buildWechatHtmlDocument,
  matchesWechatTheme,
  WECHAT_CLIPBOARD_MARKER,
  WECHAT_SECTION_STYLE_LABELS,
  WECHAT_THEME_PRESETS
} from "../src/wechat-layout";

describe("WeChat layout export", () => {
  it("wraps styled body HTML in a parseable HTML document", () => {
    const html = buildWechatHtmlDocument(
      'A <title> & "quote"',
      '<h1 style="color:red">Hello</h1>'
    );

    expect(html).toContain("<!doctype html>");
    expect(html).toContain(
      "<title>A &lt;title&gt; &amp; &quot;quote&quot;</title>"
    );
    expect(html).toContain('<h1 style="color:red">Hello</h1>');
    expect(html).toContain('style="max-width:720px');
  });

  it("marks clipboard HTML and encodes local images as data URLs", () => {
    const html = buildWechatHtmlDocument(
      "Clipboard",
      '<p style="color:#123456">Body</p>',
      { clipboard: true }
    );
    const dataUrl = buildImageDataUrl(
      "images/sample.png",
      new Uint8Array([137, 80, 78, 71])
    );

    expect(html).toContain(
      'data-obsidian-publisher-copy="' + WECHAT_CLIPBOARD_MARKER + '"'
    );
    expect(html).toContain('style="color:#123456"');
    expect(dataUrl).toBe("data:image/png;base64,iVBORw==");
    expect(
      buildImageDataUrl("images/sample.xyz", new Uint8Array([1]))
    ).toBeUndefined();
  });

  it("exposes the four MVP section presets", () => {
    expect(Object.keys(WECHAT_SECTION_STYLE_LABELS)).toEqual([
      "underline",
      "left-bar",
      "boxed",
      "bracket"
    ]);
  });

  it("provides four complete theme presets with distinct accents", () => {
    expect(WECHAT_THEME_PRESETS).toHaveLength(4);
    expect(new Set(WECHAT_THEME_PRESETS.map((preset) => preset.id)).size).toBe(4);
    expect(
      new Set(
        WECHAT_THEME_PRESETS.map((preset) =>
          preset.layout.accentColor.toLowerCase()
        )
      ).size
    ).toBe(4);

    for (const preset of WECHAT_THEME_PRESETS) {
      expect(matchesWechatTheme(preset.layout, preset)).toBe(true);
      expect(preset.layout.fontSize).toBeGreaterThanOrEqual(14);
      expect(preset.layout.lineHeight).toBeGreaterThanOrEqual(1.4);
      expect(preset.layout.bodyColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.layout.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
