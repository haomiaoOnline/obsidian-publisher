import { App, PluginSettingTab, Setting } from "obsidian";
import type ObsidianPublisherPlugin from "./main";

export class PublisherSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ObsidianPublisherPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Publisher Workbench" });

    new Setting(containerEl)
      .setName("Dry run")
      .setDesc(
        "Recommended for initial setup. Prepares content and command previews without running external publishers."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.dryRun)
          .onChange(async (value) => {
            this.plugin.settings.dryRun = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Wechatsync command")
      .setDesc("Executable path or command name, for example: wechatsync")
      .addText((text) =>
        text
          .setPlaceholder("wechatsync")
          .setValue(this.plugin.settings.wechatsyncCommand)
          .onChange(async (value) => {
            this.plugin.settings.wechatsyncCommand = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Wechatsync bridge token")
      .setDesc(
        "Local token from the Wechatsync Chrome extension MCP connection settings. It is passed only as WECHATSYNC_TOKEN to the child process."
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("Local bridge token")
          .setValue(this.plugin.settings.wechatsyncToken)
          .onChange(async (value) => {
            this.plugin.settings.wechatsyncToken = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("WeChat platform code")
      .setDesc("Wechatsync platform identifier used for WeChat.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.wechatsyncWechatPlatform)
          .onChange(async (value) => {
            this.plugin.settings.wechatsyncWechatPlatform = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Xiaohongshu platform code")
      .setDesc("Wechatsync platform identifier used for Xiaohongshu.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.wechatsyncXiaohongshuPlatform)
          .onChange(async (value) => {
            this.plugin.settings.wechatsyncXiaohongshuPlatform = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("X Articles strategy")
      .setDesc(
        "X Bridge is the default: copy the current note into the bundled xPoster-based Chrome extension handoff. Prepare-only and external-command remain fallbacks."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("xposter-clipboard", "Bundled X Bridge")
          .addOption("prepare-only", "Prepare only")
          .addOption("external-command", "External command")
          .setValue(this.plugin.settings.xArticlesStrategy)
          .onChange(async (value) => {
            this.plugin.settings.xArticlesStrategy =
              value === "external-command"
                ? "external-command"
                : value === "prepare-only"
                  ? "prepare-only"
                  : "xposter-clipboard";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Open X Articles after handoff")
      .setDesc(
        "When enabled, publishing to X opens the X Articles composer after the clipboard handoff is prepared."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.xArticlesOpenAfterHandoff)
          .onChange(async (value) => {
            this.plugin.settings.xArticlesOpenAfterHandoff = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("X Articles URL")
      .setDesc("Page opened after a successful X Bridge handoff.")
      .addText((text) =>
        text
          .setPlaceholder("https://x.com/compose/articles")
          .setValue(this.plugin.settings.xArticlesOpenUrl)
          .onChange(async (value) => {
            this.plugin.settings.xArticlesOpenUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("X Articles command")
      .setDesc(
        "Dedicated adapter executable. Do not point this at a generic X post command."
      )
      .addText((text) =>
        text
          .setPlaceholder("/path/to/x-articles-adapter")
          .setValue(this.plugin.settings.xArticlesCommand)
          .onChange(async (value) => {
            this.plugin.settings.xArticlesCommand = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("X Articles arguments")
      .setDesc(
        "One argument per line. Use {file} where the staged Markdown path should be inserted."
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("--input\n{file}")
          .setValue(this.plugin.settings.xArticlesArgs)
          .onChange(async (value) => {
            this.plugin.settings.xArticlesArgs = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
      });
  }
}
