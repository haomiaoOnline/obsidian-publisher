import type {
  NormalizedArticle,
  PlatformId,
  PlatformPublisher,
  PublishContext,
  PublishResult
} from "../types";
import type { ProcessRunner } from "../services/process-runner";
import { stageArticle, stageContent } from "../services/staging";
import { get } from "node:http";

export type BridgeHealth = "connected" | "disconnected" | "not-running";

export async function probeWechatsyncBridge(
  port = Number(process.env.SYNC_WS_PORT || 9527) + 1
): Promise<BridgeHealth> {
  return new Promise((resolve) => {
    const request = get(
      { hostname: "127.0.0.1", port, path: "/status", timeout: 1500 },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk.slice(0, 512);
        });
        response.on("end", () => {
          try {
            const status = JSON.parse(body);
            resolve(status.connected === true ? "connected" : "disconnected");
          } catch {
            resolve("not-running");
          }
        });
      }
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve("not-running"));
  });
}

export interface WechatsyncProviderOptions {
  platform: Extract<PlatformId, "wechat" | "xiaohongshu">;
  displayName: string;
  command: string;
  token: string;
  platformCode: string;
  runner: ProcessRunner;
  checkBridge?: () => Promise<BridgeHealth>;
}

export function buildWechatsyncArgs(
  stagedFile: string,
  platformCode: string
): string[] {
  return ["sync", stagedFile, "-p", platformCode];
}

export class WechatsyncPublisher implements PlatformPublisher {
  readonly platform: Extract<PlatformId, "wechat" | "xiaohongshu">;
  readonly displayName: string;

  private readonly command: string;
  private readonly token: string;
  private readonly platformCode: string;
  private readonly runner: ProcessRunner;
  private readonly checkBridge: () => Promise<BridgeHealth>;

  constructor(options: WechatsyncProviderOptions) {
    this.platform = options.platform;
    this.displayName = options.displayName;
    this.command = options.command.trim() || "wechatsync";
    this.token = options.token.trim();
    this.platformCode = options.platformCode.trim();
    this.runner = options.runner;
    this.checkBridge = options.checkBridge ?? probeWechatsyncBridge;
  }

  async publish(
    article: NormalizedArticle,
    context: PublishContext
  ): Promise<PublishResult> {
    const stagedFile =
      this.platform === "wechat" && article.wechatHtml
        ? await stageContent(article.title, article.wechatHtml, ".html")
        : await stageArticle(article);
    const args = buildWechatsyncArgs(stagedFile, this.platformCode);

    if (context.dryRun) {
      return {
        platform: this.platform,
        status: "prepared",
        message: "Dry run: prepared " + this.displayName + " draft input.",
        details: [this.command, ...args].join(" ")
      };
    }

    if (!this.platformCode) {
      return {
        platform: this.platform,
        status: "failure",
        message: this.displayName + " platform code is empty."
      };
    }

    if (!this.token) {
      return {
        platform: this.platform,
        status: "failure",
        message: this.displayName + " bridge token is missing.",
        details:
          "Open Publisher Workbench settings and paste the local Wechatsync MCP token before retrying."
      };
    }

    const bridge = await this.checkBridge();
    if (bridge === "disconnected") {
      return {
        platform: this.platform,
        status: "failure",
        message: this.displayName + " bridge is disconnected.",
        details:
          "Wechatsync is already listening on ports 9527/9528, but /status reports connected:false. " +
          "Open the Wechatsync Chrome extension, enable 同步桥接, confirm it connects to the local server, then Retry this destination. " +
          "No draft was sent."
      };
    }

    const result = await this.runner.run({
      command: this.command,
      args,
      env: this.token
        ? { WECHATSYNC_TOKEN: this.token }
        : undefined,
      timeoutMs: 240000
    });

    if (result.code !== 0) {
      return {
        platform: this.platform,
        status: "failure",
        message: this.displayName + " draft creation failed.",
        details:
          "Exit code " +
          String(result.code) +
          (result.stderr.trim() ? "\n" + result.stderr.trim() : "") +
          (result.stdout.trim() ? "\n" + result.stdout.trim() : "")
      };
    }

    return {
      platform: this.platform,
      status: "success",
      message: this.displayName + " draft handoff completed.",
      details: result.stdout.trim() || undefined
    };
  }
}
