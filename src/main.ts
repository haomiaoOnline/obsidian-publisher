import { Notice, Plugin, TFile } from "obsidian";
import { PublishModal } from "./publish-modal";
import { PublisherSettingTab } from "./settings-tab";
import { NodeProcessRunner } from "./services/process-runner";
import { PublisherRouter } from "./services/publisher-router";
import {
  BrowserRichClipboardWriter,
  ElectronClipboardWriter,
  ElectronExternalOpener
} from "./services/desktop";
import { WechatsyncPublisher } from "./providers/wechatsync";
import { XArticlesPublisher } from "./providers/x-articles";
import {
  DEFAULT_SETTINGS,
  resolvePublisherSettings,
  type PublisherSettings
} from "./types";

export default class ObsidianPublisherPlugin extends Plugin {
  settings: PublisherSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("send", "Publish current note", () => {
      this.openPublisher();
    });

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const allowed =
          file instanceof TFile && file.extension === "md";
        if (allowed && !checking) {
          this.openPublisher();
        }
        return allowed;
      }
    });

    this.addSettingTab(new PublisherSettingTab(this.app, this));
  }

  private buildRouter(): PublisherRouter {
    const runner = new NodeProcessRunner();

    return new PublisherRouter([
      new WechatsyncPublisher({
        platform: "wechat",
        displayName: "WeChat Official Account",
        command: this.settings.wechatsyncCommand,
        token: this.settings.wechatsyncToken,
        platformCode: this.settings.wechatsyncWechatPlatform,
        runner
      }),
      new WechatsyncPublisher({
        platform: "xiaohongshu",
        displayName: "Xiaohongshu",
        command: this.settings.wechatsyncCommand,
        token: this.settings.wechatsyncToken,
        platformCode: this.settings.wechatsyncXiaohongshuPlatform,
        runner
      }),
      new XArticlesPublisher(
        this.settings,
        runner,
        new ElectronClipboardWriter(),
        new ElectronExternalOpener()
      )
    ]);
  }

  private openPublisher(): void {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") {
      new Notice("Open a Markdown note before publishing.");
      return;
    }

    new PublishModal(
      this.app,
      file,
      this.settings,
      this.buildRouter(),
      new BrowserRichClipboardWriter(),
      async (layout) => {
        this.settings.wechatLayout = { ...layout };
        await this.saveSettings();
      }
    ).open();
  }

  async loadSettings(): Promise<void> {
    const loaded =
      (await this.loadData()) as Partial<PublisherSettings> | null;
    this.settings = resolvePublisherSettings(loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
