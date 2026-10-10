import { describe, expect, it } from "vitest";
import {
  buildWechatsyncArgs,
  WechatsyncPublisher
} from "../src/providers/wechatsync";
import {
  parseArgumentLines,
  XArticlesPublisher
} from "../src/providers/x-articles";
import { XPOSTER_HANDOFF_PREFIX } from "../src/services/x-handoff";
import { DEFAULT_SETTINGS } from "../src/types";
import {
  buildProcessEnvironment,
  type ProcessRequest,
  type ProcessRunner
} from "../src/services/process-runner";
import type { NormalizedArticle } from "../src/types";

describe("provider command construction", () => {
  it("builds Wechatsync argv without shell interpolation", () => {
    expect(
      buildWechatsyncArgs("/tmp/a b.md", "weixin")
    ).toEqual([
      "sync",
      "/tmp/a b.md",
      "-p",
      "weixin"
    ]);
  });

  it("expands X Articles file placeholder per argument line", () => {
    expect(
      parseArgumentLines(
        "--input\n{file}\n--draft",
        "/tmp/article.md"
      )
    ).toEqual([
      "--input",
      "/tmp/article.md",
      "--draft"
    ]);
  });

  it("augments macOS GUI PATH for Node-based CLIs", () => {
    const env = buildProcessEnvironment(
      "/usr/local/bin/wechatsync",
      { WECHATSYNC_TOKEN: "secret" },
      { PATH: "/usr/bin:/bin" },
      "darwin"
    );

    expect(env.PATH?.split(":")).toEqual([
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/opt/homebrew/bin",
      "/usr/sbin",
      "/sbin"
    ]);
    expect(env.WECHATSYNC_TOKEN).toBe("secret");
  });

  it("hands X Articles to the bundled X Bridge without claiming success", async () => {
    const clipboardWrites: string[] = [];
    const openedUrls: string[] = [];
    const runner: ProcessRunner = {
      run: async () => ({
        code: 0,
        stdout: "",
        stderr: ""
      })
    };
    const article: NormalizedArticle = {
      title: "X Article",
      filePath: "posts/x-article.md",
      rawMarkdown: "# X Article\n![[images/a.png]]",
      normalizedMarkdown: "# X Article\n![a](</vault/posts/images/a.png>)",
      xMarkdown: "# X Article\n![a](images/a.png)",
      images: []
    };
    const publisher = new XArticlesPublisher(
      {
        ...DEFAULT_SETTINGS,
        dryRun: false,
        xArticlesStrategy: "xposter-clipboard",
        xArticlesOpenAfterHandoff: true
      },
      runner,
      {
        writeText: async (text) => {
          clipboardWrites.push(text);
        }
      },
      {
        open: async (url) => {
          openedUrls.push(url);
        }
      }
    );

    const result = await publisher.publish(article, { dryRun: false });

    expect(result.status).toBe("prepared");
    expect(clipboardWrites).toHaveLength(1);
    expect(clipboardWrites[0]?.startsWith(XPOSTER_HANDOFF_PREFIX)).toBe(true);
    const payload = JSON.parse(
      clipboardWrites[0]!.slice(XPOSTER_HANDOFF_PREFIX.length)
    );
    expect(payload.markdown).toBe(article.xMarkdown);
    expect(payload.filePath).toBe(article.filePath);
    expect(openedUrls).toEqual(["https://x.com/compose/articles"]);
  });

  it("stages styled WeChat content as HTML when available", async () => {
    let seen: ProcessRequest | undefined;
    const runner: ProcessRunner = {
      run: async (request) => {
        seen = request;
        return { code: 0, stdout: "ok", stderr: "" };
      }
    };
    const article: NormalizedArticle = {
      title: "Styled WeChat",
      filePath: "test.md",
      rawMarkdown: "# Styled WeChat",
      normalizedMarkdown: "# Styled WeChat",
      xMarkdown: "# Styled WeChat",
      wechatHtml: "<html><body><h1>Styled WeChat</h1></body></html>",
      images: []
    };
    const publisher = new WechatsyncPublisher({
      platform: "wechat",
      displayName: "WeChat",
      command: "wechatsync",
      token: "token",
      platformCode: "weixin",
      runner,
      checkBridge: async () => "connected"
    });

    const result = await publisher.publish(article, { dryRun: false });

    expect(result.status).toBe("success");
    expect(seen?.args[0]).toBe("sync");
    expect(seen?.args[1]?.endsWith(".html")).toBe(true);
  });

  it("fails early with an actionable message when the Wechatsync token is missing", async () => {
    let invoked = false;
    const runner: ProcessRunner = {
      run: async () => {
        invoked = true;
        return { code: 0, stdout: "", stderr: "" };
      }
    };
    const article: NormalizedArticle = {
      title: "Token check",
      filePath: "test.md",
      rawMarkdown: "# Test",
      normalizedMarkdown: "# Test",
      xMarkdown: "# Test",
      images: []
    };
    const publisher = new WechatsyncPublisher({
      platform: "wechat",
      displayName: "WeChat",
      command: "wechatsync",
      token: "",
      platformCode: "weixin",
      runner,
      checkBridge: async () => "connected"
    });

    const result = await publisher.publish(article, { dryRun: false });

    expect(result.status).toBe("failure");
    expect(result.message).toContain("token is missing");
    expect(result.details).toContain("Publisher Workbench settings");
    expect(invoked).toBe(false);
  });

  it("fails early when an existing Wechatsync bridge is disconnected", async () => {
    let invoked = false;
    const runner: ProcessRunner = {
      run: async () => {
        invoked = true;
        return { code: 0, stdout: "", stderr: "" };
      }
    };
    const article: NormalizedArticle = {
      title: "Bridge down",
      filePath: "test.md",
      rawMarkdown: "# Bridge down",
      normalizedMarkdown: "# Bridge down",
      xMarkdown: "# Bridge down",
      images: []
    };
    const publisher = new WechatsyncPublisher({
      platform: "wechat",
      displayName: "WeChat",
      command: "wechatsync",
      token: "configured-token",
      platformCode: "weixin",
      runner,
      checkBridge: async () => "disconnected"
    });

    const result = await publisher.publish(article, { dryRun: false });
    expect(result.status).toBe("failure");
    expect(result.details).toContain("connected:false");
    expect(result.details).toContain("同步桥接");
    expect(invoked).toBe(false);
  });

  it("passes the bridge token only through the child environment", async () => {
    let seen: ProcessRequest | undefined;
    const runner: ProcessRunner = {
      run: async (request) => {
        seen = request;
        return {
          code: 0,
          stdout: "",
          stderr: ""
        };
      }
    };
    const article: NormalizedArticle = {
      title: "Bridge token test",
      filePath: "test.md",
      rawMarkdown: "# Test",
      normalizedMarkdown: "# Test",
      xMarkdown: "# Test",
      images: []
    };
    const publisher = new WechatsyncPublisher({
      platform: "wechat",
      displayName: "WeChat",
      command: "wechatsync",
      token: "local-secret",
      platformCode: "weixin",
      runner,
      checkBridge: async () => "connected"
    });

    await publisher.publish(article, { dryRun: false });

    expect(seen?.env).toEqual({
      WECHATSYNC_TOKEN: "local-secret"
    });
    expect(seen?.args).not.toContain("local-secret");
  });
});
