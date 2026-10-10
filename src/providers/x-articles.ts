import type {
  NormalizedArticle,
  PlatformPublisher,
  PublishContext,
  PublishResult,
  PublisherSettings
} from "../types";
import type { ProcessRunner } from "../services/process-runner";
import { stageArticle } from "../services/staging";
import type { ClipboardWriter, ExternalOpener } from "../services/desktop";
import { buildXPosterHandoff } from "../services/x-handoff";

export function parseArgumentLines(
  value: string,
  filePath: string
): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((arg) => arg.split("{file}").join(filePath));
}

export class XArticlesPublisher implements PlatformPublisher {
  readonly platform = "x-articles" as const;
  readonly displayName = "X Articles";

  constructor(
    private readonly settings: PublisherSettings,
    private readonly runner: ProcessRunner,
    private readonly clipboard: ClipboardWriter,
    private readonly opener: ExternalOpener
  ) {}

  async publish(
    article: NormalizedArticle,
    context: PublishContext
  ): Promise<PublishResult> {
    if (this.settings.xArticlesStrategy === "xposter-clipboard") {
      const handoff = buildXPosterHandoff(article);

      if (context.dryRun) {
        return {
          platform: this.platform,
          status: "prepared",
          message: "Dry run: prepared Obsidian Publisher X Bridge handoff.",
          details: article.filePath
        };
      }

      await this.clipboard.writeText(handoff);
      if (this.settings.xArticlesOpenAfterHandoff) {
        const url = this.settings.xArticlesOpenUrl.trim()
          || "https://x.com/compose/articles";
        await this.opener.open(url);
      }

      return {
        platform: this.platform,
        status: "prepared",
        message:
          "Copied this article to the X Bridge handoff. Open the Obsidian Publisher X Bridge side panel, then check and write the X Article draft.",
        details: article.filePath
      };
    }

    const stagedFile = await stageArticle(article);

    if (this.settings.xArticlesStrategy === "prepare-only") {
      return {
        platform: this.platform,
        status: "prepared",
        message:
          "Prepared X Articles Markdown. No X Articles-capable adapter is configured, so nothing was posted.",
        details: stagedFile
      };
    }

    const command = this.settings.xArticlesCommand.trim();
    if (!command) {
      return {
        platform: this.platform,
        status: "failure",
        message:
          "X Articles external-command mode is enabled, but no command is configured.",
        details: stagedFile
      };
    }

    const args = parseArgumentLines(
      this.settings.xArticlesArgs,
      stagedFile
    );

    if (context.dryRun) {
      return {
        platform: this.platform,
        status: "prepared",
        message: "Dry run: prepared X Articles adapter invocation.",
        details: [command, ...args].join(" ")
      };
    }

    const result = await this.runner.run({ command, args });
    if (result.code !== 0) {
      return {
        platform: this.platform,
        status: "failure",
        message: "X Articles adapter failed.",
        details:
          result.stderr.trim() ||
          result.stdout.trim() ||
          "Exit code " + String(result.code)
      };
    }

    return {
      platform: this.platform,
      status: "success",
      message:
        "X Articles adapter completed. Review the resulting X draft before publishing.",
      details: result.stdout.trim() || undefined
    };
  }
}
