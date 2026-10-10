import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  resolvePublisherSettings
} from "../src/types";

describe("publisher settings migration", () => {
  it("migrates legacy prepare-only X settings to the bundled X Bridge", () => {
    const settings = resolvePublisherSettings({
      xArticlesStrategy: "prepare-only"
    });

    expect(settings.xArticlesStrategy).toBe("xposter-clipboard");
    expect(settings.xArticlesOpenAfterHandoff).toBe(true);
  });

  it("preserves an explicit v0.2 prepare-only choice", () => {
    const settings = resolvePublisherSettings({
      xArticlesStrategy: "prepare-only",
      xArticlesOpenAfterHandoff: false,
      xArticlesOpenUrl: DEFAULT_SETTINGS.xArticlesOpenUrl
    });

    expect(settings.xArticlesStrategy).toBe("prepare-only");
    expect(settings.xArticlesOpenAfterHandoff).toBe(false);
  });

  it("merges persisted WeChat layout settings with new defaults", () => {
    const settings = resolvePublisherSettings({
      wechatLayout: {
        fontSize: 18,
        accentColor: "#ff3366"
      }
    });

    expect(settings.wechatLayout.fontSize).toBe(18);
    expect(settings.wechatLayout.accentColor).toBe("#ff3366");
    expect(settings.wechatLayout.lineHeight).toBe(
      DEFAULT_SETTINGS.wechatLayout.lineHeight
    );
    expect(settings.wechatLayout.sectionStyle).toBe(
      DEFAULT_SETTINGS.wechatLayout.sectionStyle
    );
  });
});
