import {
  ButtonComponent,
  Component,
  MarkdownRenderer,
  Modal,
  Notice,
  Setting,
  TFile,
  ToggleComponent
} from "obsidian";
import type { App } from "obsidian";
import { normalizeArticle } from "./article";
import {
  buildPreviewMarkdown,
  previewDescription,
  type PreviewPlatform
} from "./preview";
import {
  applyWechatLayout,
  buildWechatHtmlDocument,
  cloneWechatFragmentWithComputedStyles,
  embedLocalImagesAsDataUrls,
  matchesWechatTheme,
  restoreLocalImageSources,
  WECHAT_CLIPBOARD_MAX_HTML_CHARS,
  serializeWechatClipboardFragment,
  WECHAT_SECTION_STYLE_LABELS,
  WECHAT_THEME_PRESETS,
  type WechatThemePreset,
  type WechatThemePresetId
} from "./wechat-layout";
import type {
  NormalizedArticle,
  PlatformId,
  PlatformProgress,
  PublishLifecycleStatus,
  PublishResult,
  PublisherSettings,
  WechatLayoutSettings,
  WechatSectionStyle
} from "./types";
import { DEFAULT_WECHAT_LAYOUT } from "./types";
import type { PublisherRouter } from "./services/publisher-router";
import type { RichClipboardWriter } from "./services/desktop";

const PLATFORM_LABELS: Record<PlatformId, string> = {
  wechat: "WeChat Official Account",
  xiaohongshu: "Xiaohongshu",
  "x-articles": "X Articles"
};

const PLATFORM_DESCRIPTIONS: Record<PlatformId, string> = {
  wechat: "Styled HTML draft",
  xiaohongshu: "Markdown + images",
  "x-articles": "X Bridge handoff"
};

const PREVIEW_LABELS: Record<PreviewPlatform, string> = {
  wechat: "WeChat",
  xiaohongshu: "Xiaohongshu"
};

interface PlatformStatusView {
  root: HTMLElement;
  badge: HTMLElement;
  message: HTMLElement;
  details: HTMLElement;
  retryButton: HTMLButtonElement;
}

interface PreparedWechatClipboardPayload {
  html: string;
  text: string;
  imageCount: number;
}

export class PublishModal extends Modal {
  private readonly selected = new Set<PlatformId>([
    "wechat",
    "x-articles"
  ]);
  private readonly statusViews = new Map<PlatformId, PlatformStatusView>();
  private readonly previewButtons = new Map<PreviewPlatform, HTMLButtonElement>();
  private readonly themeButtons = new Map<
    WechatThemePresetId,
    HTMLButtonElement
  >();
  private readonly sectionStyleButtons = new Map<
    WechatSectionStyle,
    HTMLButtonElement
  >();
  private readonly busyPlatforms = new Set<PlatformId>();

  private publishButton?: ButtonComponent;
  private copyButton?: HTMLButtonElement;
  private copyResultEl?: HTMLElement;
  private preparedWechatClipboard?: PreparedWechatClipboardPayload;
  private clipboardPreparationError?: string;
  private clipboardPreparationVersion = 0;
  private clipboardPreparationTimer?: number;
  private previewBody?: HTMLElement;
  private previewDescriptionEl?: HTMLElement;
  private designPanel?: HTMLElement;
  private previewPlatform: PreviewPlatform = "wechat";
  private article?: NormalizedArticle;
  private articlePromise?: Promise<NormalizedArticle>;
  private previewRenderComponent?: Component;
  private layout: WechatLayoutSettings;
  private focusPreview = false;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly settings: PublisherSettings,
    private readonly router: PublisherRouter,
    private readonly richClipboard: RichClipboardWriter,
    private readonly onLayoutChange: (
      layout: WechatLayoutSettings
    ) => Promise<void>
  ) {
    super(app);
    this.layout = { ...settings.wechatLayout };
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass("obsidian-publisher-workbench-modal");
    modalEl.removeClass("is-focus-preview");

    this.statusViews.clear();
    this.previewButtons.clear();
    this.themeButtons.clear();
    this.sectionStyleButtons.clear();

    this.buildHeader(contentEl);

    const workbench = contentEl.createDiv({
      cls: "obsidian-publisher-workbench"
    });

    const inspector = workbench.createDiv({
      cls: "obsidian-publisher-inspector"
    });
    this.designPanel = inspector.createDiv({
      cls: "obsidian-publisher-design-panel"
    });
    this.renderDesignControls();
    this.buildPlatformControls(inspector);

    const preview = workbench.createDiv({
      cls: "obsidian-publisher-preview"
    });
    this.buildPreviewPanel(preview);

    void this.refreshPreview();
    this.scheduleWechatClipboardPreparation(0);
  }

  private buildHeader(container: HTMLElement): void {
    const header = container.createDiv({
      cls: "obsidian-publisher-workbench-header"
    });

    const context = header.createDiv({
      cls: "obsidian-publisher-header-context"
    });
    context.createDiv({
      cls: "obsidian-publisher-eyebrow",
      text: "OBSIDIAN PUBLISHER · 0.4.5"
    });
    context.createEl("h2", {
      cls: "obsidian-publisher-document-title",
      text: this.file.basename
    });
    context.createDiv({
      cls: "obsidian-publisher-note-path",
      text: this.file.path
    });

    const actions = header.createDiv({
      cls: "obsidian-publisher-header-actions"
    });
    actions.createDiv({
      cls: "obsidian-publisher-mode-pill",
      text: this.settings.dryRun ? "Dry run" : "Draft mode"
    });

    this.publishButton = new ButtonComponent(actions);
    this.publishButton.setCta();
    this.publishButton.onClick(() => {
      void this.startPublishing();
    });
    this.updatePublishButtonLabel();
  }

  private updatePublishButtonLabel(): void {
    if (!this.publishButton) {
      return;
    }

    const count = this.selected.size;
    if (this.settings.dryRun) {
      this.publishButton.setButtonText(
        count === 0 ? "Select a destination" : "Run dry preview"
      );
      this.publishButton.setDisabled(
        count === 0 || this.busyPlatforms.size > 0
      );
      return;
    }

    this.publishButton.setButtonText(
      count === 0
        ? "Select a destination"
        : "Prepare " +
            String(count) +
            " destination" +
            (count === 1 ? "" : "s")
    );
    this.publishButton.setDisabled(
      count === 0 || this.busyPlatforms.size > 0
    );
  }

  private createInspectorSection(
    container: HTMLElement,
    title: string,
    description?: string
  ): HTMLElement {
    const section = container.createDiv({
      cls: "obsidian-publisher-inspector-section"
    });
    const heading = section.createDiv({
      cls: "obsidian-publisher-section-heading"
    });
    heading.createEl("h3", { text: title });
    if (description) {
      heading.createDiv({
        cls: "obsidian-publisher-section-description",
        text: description
      });
    }
    return section;
  }

  private renderDesignControls(): void {
    if (!this.designPanel) {
      return;
    }

    this.designPanel.empty();
    this.themeButtons.clear();
    this.sectionStyleButtons.clear();

    this.buildThemeControls(this.designPanel);
    this.buildTypographyControls(this.designPanel);
    this.buildSectionStyleControls(this.designPanel);
    this.buildColorControls(this.designPanel);
    this.buildResetControl(this.designPanel);
  }

  private buildThemeControls(container: HTMLElement): void {
    const section = this.createInspectorSection(
      container,
      "Theme",
      "Start from a coherent visual system, then fine-tune below."
    );

    const grid = section.createDiv({
      cls: "obsidian-publisher-theme-grid"
    });

    for (const preset of WECHAT_THEME_PRESETS) {
      const button = grid.createEl("button", {
        cls: "obsidian-publisher-theme-card"
      });
      button.type = "button";
      button.setAttribute("aria-label", "Apply " + preset.label + " theme");
      this.themeButtons.set(preset.id, button);

      const swatches = button.createDiv({
        cls: "obsidian-publisher-theme-swatches"
      });
      const bodySwatch = swatches.createSpan({
        cls: "obsidian-publisher-theme-swatch"
      });
      bodySwatch.setCssProps({"--publisher-swatch-color": preset.layout.bodyColor});
      const accentSwatch = swatches.createSpan({
        cls: "obsidian-publisher-theme-swatch"
      });
      accentSwatch.setCssProps({"--publisher-swatch-color": preset.layout.accentColor});

      const copy = button.createDiv({
        cls: "obsidian-publisher-theme-copy"
      });
      copy.createDiv({
        cls: "obsidian-publisher-theme-name",
        text: preset.label
      });
      copy.createDiv({
        cls: "obsidian-publisher-theme-description",
        text: preset.description
      });

      button.addEventListener("click", () => {
        this.applyThemePreset(preset);
      });
    }

    this.updateThemeSelection();
  }

  private applyThemePreset(preset: WechatThemePreset): void {
    this.layout = { ...preset.layout };
    void this.onLayoutChange({ ...this.layout });
    this.renderDesignControls();
    void this.refreshPreview();
    this.scheduleWechatClipboardPreparation();
  }

  private updateThemeSelection(): void {
    for (const preset of WECHAT_THEME_PRESETS) {
      const button = this.themeButtons.get(preset.id);
      if (!button) {
        continue;
      }
      const active = matchesWechatTheme(this.layout, preset);
      button.toggleClass("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  private buildTypographyControls(container: HTMLElement): void {
    const section = this.createInspectorSection(
      container,
      "Typography",
      "Control reading density without changing the article content."
    );

    new Setting(section)
      .setName("Font")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("system", "System / PingFang")
          .addOption("source-han", "Source Han Sans")
          .addOption("microsoft-yahei", "Microsoft YaHei")
          .setValue(this.layout.fontFamily)
          .onChange((value) => {
            const fontFamily =
              value === "source-han"
                ? "source-han"
                : value === "microsoft-yahei"
                  ? "microsoft-yahei"
                  : "system";
            this.updateLayout({ fontFamily });
          });
      });

    new Setting(section)
      .setName("Font size")
      .setDesc(this.layout.fontSize + "px")
      .addSlider((slider) => {
        slider
          .setLimits(14, 20, 1)
          .setValue(this.layout.fontSize)
          .setDynamicTooltip()
          .onChange((fontSize) => {
            this.updateLayout({ fontSize });
          });
      });

    new Setting(section)
      .setName("Line height")
      .setDesc(String(this.layout.lineHeight))
      .addSlider((slider) => {
        slider
          .setLimits(1.4, 2.4, 0.1)
          .setValue(this.layout.lineHeight)
          .setDynamicTooltip()
          .onChange((lineHeight) => {
            this.updateLayout({
              lineHeight: Number(lineHeight.toFixed(1))
            });
          });
      });
  }

  private buildSectionStyleControls(container: HTMLElement): void {
    const section = this.createInspectorSection(
      container,
      "Section heading",
      "Choose one repeated visual rhythm for H2 sections."
    );

    const grid = section.createDiv({
      cls: "obsidian-publisher-heading-style-grid"
    });

    (
      Object.keys(WECHAT_SECTION_STYLE_LABELS) as WechatSectionStyle[]
    ).forEach((style) => {
      const button = grid.createEl("button", {
        cls: "obsidian-publisher-heading-style"
      });
      button.type = "button";
      button.dataset.style = style;
      button.setAttribute(
        "aria-label",
        "Use " + WECHAT_SECTION_STYLE_LABELS[style] + " section style"
      );

      const sample = button.createSpan({
        cls: "obsidian-publisher-heading-sample"
      });
      sample.dataset.style = style;
      sample.setText("Aa");

      button.createSpan({
        cls: "obsidian-publisher-heading-style-label",
        text: WECHAT_SECTION_STYLE_LABELS[style]
      });

      button.addEventListener("click", () => {
        this.updateLayout({ sectionStyle: style });
      });

      this.sectionStyleButtons.set(style, button);
    });

    this.updateSectionStyleSelection();
  }

  private updateSectionStyleSelection(): void {
    for (const [style, button] of this.sectionStyleButtons) {
      const active = style === this.layout.sectionStyle;
      button.toggleClass("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  private buildColorControls(container: HTMLElement): void {
    const section = this.createInspectorSection(
      container,
      "Color",
      "Keep the body neutral and reserve accent for hierarchy."
    );

    const colorRow = section.createDiv({
      cls: "obsidian-publisher-color-row"
    });

    const body = colorRow.createDiv({
      cls: "obsidian-publisher-color-control"
    });
    body.createSpan({ text: "Body" });
    const bodyPicker = document.createElement("input");
    bodyPicker.type = "color";
    bodyPicker.value = this.layout.bodyColor;
    bodyPicker.setAttribute("aria-label", "Body text color");
    bodyPicker.addEventListener("input", () => {
      this.updateLayout({ bodyColor: bodyPicker.value });
    });
    body.appendChild(bodyPicker);

    const accent = colorRow.createDiv({
      cls: "obsidian-publisher-color-control"
    });
    accent.createSpan({ text: "Accent" });
    const accentPicker = document.createElement("input");
    accentPicker.type = "color";
    accentPicker.value = this.layout.accentColor;
    accentPicker.setAttribute("aria-label", "Accent color");
    accentPicker.addEventListener("input", () => {
      this.updateLayout({ accentColor: accentPicker.value });
    });
    accent.appendChild(accentPicker);
  }

  private buildResetControl(container: HTMLElement): void {
    const footer = container.createDiv({
      cls: "obsidian-publisher-inspector-footer"
    });
    const reset = footer.createEl("button", {
      cls: "obsidian-publisher-tertiary-button",
      text: "Reset layout"
    });
    reset.type = "button";
    reset.addEventListener("click", () => {
      this.layout = { ...DEFAULT_WECHAT_LAYOUT };
      void this.onLayoutChange({ ...this.layout });
      this.renderDesignControls();
      void this.refreshPreview();
      this.scheduleWechatClipboardPreparation();
    });
  }

  private updateLayout(
    patch: Partial<WechatLayoutSettings>
  ): void {
    this.layout = {
      ...this.layout,
      ...patch
    };
    void this.onLayoutChange({ ...this.layout });
    this.updateThemeSelection();
    this.updateSectionStyleSelection();
    void this.refreshPreview();
    this.scheduleWechatClipboardPreparation();
  }

  private buildPlatformControls(container: HTMLElement): void {
    const section = this.createInspectorSection(
      container,
      "Publish to",
      "Status and recovery stay attached to each destination."
    );
    section.addClass("obsidian-publisher-publish-section");

    const list = section.createDiv({
      cls: "obsidian-publisher-target-list"
    });

    (Object.keys(PLATFORM_LABELS) as PlatformId[]).forEach((platform) => {
      const row = list.createDiv({
        cls: "obsidian-publisher-target-row"
      });
      row.dataset.status = "pending";
      row.toggleClass("is-selected", this.selected.has(platform));

      const main = row.createDiv({
        cls: "obsidian-publisher-target-main"
      });
      const copy = main.createDiv({
        cls: "obsidian-publisher-target-copy"
      });
      copy.createDiv({
        cls: "obsidian-publisher-target-name",
        text: PLATFORM_LABELS[platform]
      });
      copy.createDiv({
        cls: "obsidian-publisher-target-description",
        text: PLATFORM_DESCRIPTIONS[platform]
      });

      const actions = main.createDiv({
        cls: "obsidian-publisher-target-actions"
      });
      const badge = actions.createDiv({
        cls: "obsidian-publisher-status-badge",
        text: this.selected.has(platform) ? "READY" : "OFF"
      });

      const toggleHost = actions.createDiv({
        cls: "obsidian-publisher-target-toggle"
      });
      const toggle = new ToggleComponent(toggleHost);
      toggle.setValue(this.selected.has(platform));
      toggle.onChange((enabled) => {
        if (enabled) {
          this.selected.add(platform);
        } else {
          this.selected.delete(platform);
        }

        row.toggleClass("is-selected", enabled);
        if (row.dataset.status === "pending") {
          badge.setText(enabled ? "READY" : "OFF");
          message.setText(enabled ? "Ready" : "Not selected");
        }
        this.updatePublishButtonLabel();
      });

      const message = row.createDiv({
        cls: "obsidian-publisher-status-message",
        text: this.selected.has(platform) ? "Ready" : "Not selected"
      });

      const details = row.createEl("pre", {
        cls: "obsidian-publisher-status-details"
      });
      details.classList.add("obsidian-publisher-hidden");

      const retryButton = row.createEl("button", {
        cls: "obsidian-publisher-retry-button",
        text: "Retry this destination"
      });
      retryButton.type = "button";
      retryButton.classList.add("obsidian-publisher-hidden");
      retryButton.addEventListener("click", () => {
        void this.retryPlatform(platform);
      });

      this.statusViews.set(platform, {
        root: row,
        badge,
        message,
        details,
        retryButton
      });
    });
  }

  private buildPreviewPanel(container: HTMLElement): void {
    const toolbar = container.createDiv({
      cls: "obsidian-publisher-preview-toolbar"
    });

    const left = toolbar.createDiv({
      cls: "obsidian-publisher-preview-context"
    });
    const tabs = left.createDiv({
      cls: "obsidian-publisher-preview-tabs"
    });

    (Object.keys(PREVIEW_LABELS) as PreviewPlatform[]).forEach((platform) => {
      const button = tabs.createEl("button", {
        cls: "obsidian-publisher-preview-tab",
        text: PREVIEW_LABELS[platform]
      });
      button.type = "button";
      this.previewButtons.set(platform, button);
      button.addEventListener("click", () => {
        this.setPreviewPlatform(platform);
      });
    });

    this.previewDescriptionEl = left.createDiv({
      cls: "obsidian-publisher-preview-description",
      text: previewDescription(this.previewPlatform)
    });

    const actions = toolbar.createDiv({
      cls: "obsidian-publisher-preview-actions"
    });

    this.copyButton = actions.createEl("button", {
      cls: "obsidian-publisher-preview-tool",
      text: "Preparing copy…"
    });
    this.copyButton.type = "button";
    this.copyButton.disabled = true;
    this.copyButton.addEventListener("click", () => {
      this.copyWechatRichText();
    });
    this.copyResultEl = actions.createSpan({
      cls: "obsidian-publisher-copy-result",
      text: "Copy not tested"
    });

    const focusButton = actions.createEl("button", {
      cls: "obsidian-publisher-preview-tool",
      text: "Focus preview"
    });
    focusButton.type = "button";
    focusButton.addEventListener("click", () => {
      this.focusPreview = !this.focusPreview;
      this.modalEl.toggleClass(
        "is-focus-preview",
        this.focusPreview
      );
      focusButton.setText(
        this.focusPreview ? "Exit focus" : "Focus preview"
      );
    });

    const canvas = container.createDiv({
      cls: "obsidian-publisher-preview-canvas"
    });
    this.previewBody = canvas.createDiv({
      cls: "obsidian-publisher-preview-body markdown-rendered"
    });

    this.updatePreviewTabs();
  }

  private async ensureArticle(): Promise<NormalizedArticle> {
    if (this.article) {
      return this.article;
    }
    if (this.articlePromise) {
      return this.articlePromise;
    }

    this.articlePromise = (async () => {
      const markdown = await this.app.vault.read(this.file);
      const adapter = this.app.vault.adapter as unknown as {
        getFullPath?: (vaultPath: string) => string;
      };
      const article = normalizeArticle({
        markdown,
        filePath: this.file.path,
        absoluteFilePath: adapter.getFullPath?.(this.file.path),
        toAbsolutePath: (vaultPath) => adapter.getFullPath?.(vaultPath)
      });
      this.article = article;
      return article;
    })();

    try {
      return await this.articlePromise;
    } finally {
      this.articlePromise = undefined;
    }
  }

  private setPreviewPlatform(platform: PreviewPlatform): void {
    this.previewPlatform = platform;
    this.updatePreviewTabs();
    if (this.previewDescriptionEl) {
      this.previewDescriptionEl.setText(previewDescription(platform));
    }
    void this.refreshPreview();
  }

  private updatePreviewTabs(): void {
    for (const [platform, button] of this.previewButtons) {
      const active = platform === this.previewPlatform;
      button.toggleClass("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  private async renderMarkdown(
    target: HTMLElement,
    article: NormalizedArticle,
    component: Component,
    styledWechat: boolean
  ): Promise<void> {
    target.empty();
    await MarkdownRenderer.render(
      this.app,
      buildPreviewMarkdown(article),
      target,
      this.file.path,
      component
    );
    if (styledWechat) {
      applyWechatLayout(target, this.layout);
    }
  }

  private async refreshPreview(): Promise<void> {
    if (!this.previewBody) {
      return;
    }

    this.previewRenderComponent?.unload();
    this.previewRenderComponent = new Component();
    this.previewRenderComponent.load();

    this.previewBody.empty();
    this.previewBody.removeClass(
      "is-wechat",
      "is-xiaohongshu",
      "is-error"
    );
    this.previewBody.addClass("is-" + this.previewPlatform);

    const loading = this.previewBody.createDiv({
      cls: "obsidian-publisher-preview-loading",
      text: "Rendering preview..."
    });

    try {
      const article = await this.ensureArticle();
      loading.remove();
      await this.renderMarkdown(
        this.previewBody,
        article,
        this.previewRenderComponent,
        this.previewPlatform === "wechat"
      );
    } catch (error) {
      loading.remove();
      this.previewBody.addClass("is-error");
      this.previewBody.createDiv({
        cls: "obsidian-publisher-preview-error",
        text:
          "Preview failed: " +
          (error instanceof Error ? error.message : String(error))
      });
    }
  }

  private async prepareWechatHtml(
    article: NormalizedArticle
  ): Promise<string> {
    const container = document.createElement("div");
    const component = new Component();
    component.load();

    try {
      await this.renderMarkdown(
        container,
        article,
        component,
        true
      );
      restoreLocalImageSources(container, article.images);
      return buildWechatHtmlDocument(
        article.title,
        container.innerHTML
      );
    } finally {
      component.unload();
    }
  }

  private async prepareWechatClipboardHtml(
    article: NormalizedArticle
  ): Promise<{ html: string; embeddedImages: number }> {
    const stagingHost = document.createElement("div");
    stagingHost.classList.add("obsidian-publisher-wechat-staging-host");

    const container = document.createElement("section");
    stagingHost.appendChild(container);
    document.body.appendChild(stagingHost);

    const component = new Component();
    component.load();

    try {
      await this.renderMarkdown(
        container,
        article,
        component,
        true
      );

      const fragment = cloneWechatFragmentWithComputedStyles(container);
      const embeddedImages = await embedLocalImagesAsDataUrls(
        fragment,
        article.images,
        async (vaultPath) => {
          const imageFile = this.app.vault.getAbstractFileByPath(vaultPath);
          if (!(imageFile instanceof TFile)) {
            return undefined;
          }
          return this.app.vault.readBinary(imageFile);
        }
      );

      return {
        html: serializeWechatClipboardFragment(fragment),
        embeddedImages
      };
    } finally {
      component.unload();
      stagingHost.remove();
    }
  }

  private scheduleWechatClipboardPreparation(
    delayMs = 180
  ): void {
    this.clipboardPreparationVersion += 1;
    const version = this.clipboardPreparationVersion;
    this.preparedWechatClipboard = undefined;
    this.clipboardPreparationError = undefined;

    if (this.clipboardPreparationTimer !== undefined) {
      window.clearTimeout(this.clipboardPreparationTimer);
    }

    if (this.copyButton) {
      this.copyButton.disabled = true;
      this.copyButton.setText("Preparing copy…");
    }

    this.clipboardPreparationTimer = window.setTimeout(() => {
      this.clipboardPreparationTimer = undefined;
      void this.prepareWechatClipboardPayload(version);
    }, delayMs);
  }

  private async prepareWechatClipboardPayload(
    version: number
  ): Promise<void> {
    try {
      const article = await this.ensureArticle();
      const { html, embeddedImages } =
        await this.prepareWechatClipboardHtml(article);

      if (version !== this.clipboardPreparationVersion) {
        return;
      }

      if (/<!doctype|<html\b|<head\b|<body\b/i.test(html)) {
        throw new Error(
          "Rich WeChat clipboard must contain a body fragment, not a full HTML document."
        );
      }

      if (html.length > WECHAT_CLIPBOARD_MAX_HTML_CHARS) {
        throw new Error(
          "Rich WeChat clipboard payload is too large (" +
            String(Math.round((html.length / 1024 / 1024) * 10) / 10) +
            " MB). Compress images or split the article before copying."
        );
      }

      if (embeddedImages !== article.images.length) {
        throw new Error(
          "Only " +
            String(embeddedImages) +
            " of " +
            String(article.images.length) +
            " local images could be embedded."
        );
      }

      // Parse for text extraction without inserting untrusted HTML into
      // Obsidian's live document or assigning directly to innerHTML.
      const plain = new DOMParser().parseFromString(html, "text/html").body;
      this.preparedWechatClipboard = {
        html,
        text: plain.textContent ?? article.title,
        imageCount: article.images.length
      };
      this.clipboardPreparationError = undefined;

      if (this.copyButton) {
        this.copyButton.disabled = false;
        this.copyButton.setText("Copy to WeChat");
      }
    } catch (error) {
      if (version !== this.clipboardPreparationVersion) {
        return;
      }

      this.preparedWechatClipboard = undefined;
      this.clipboardPreparationError =
        error instanceof Error ? error.message : String(error);
      if (this.copyButton) {
        this.copyButton.disabled = false;
        this.copyButton.setText("Retry copy prep");
      }
    }
  }

  private copyWechatRichText(): void {
    const payload = this.preparedWechatClipboard;
    if (!payload) {
      const error = this.clipboardPreparationError;
      this.scheduleWechatClipboardPreparation(0);
      new Notice(
        error
          ? "Copy preparation failed: " + error
          : "Rich copy is still preparing. Try again when the button says Copy to WeChat."
      );
      return;
    }

    let writePromise: ReturnType<RichClipboardWriter["writeHtml"]>;
    try {
      // The write call is intentionally the first effect in this click path.
      // execCommand runs synchronously here while Chromium still has the
      // user's transient activation.
      writePromise = this.richClipboard.writeHtml(
        payload.html,
        payload.text
      );
    } catch (error) {
      new Notice(
        "Copy to WeChat failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      return;
    }

    void writePromise
      .then((result) => {
        if (!result.htmlVerified) {
          throw new Error(
            "System clipboard did not retain the text/html payload. Formats: " +
              (result.formats.join(", ") || "none")
          );
        }
        if (!result.textVerified) {
          throw new Error(
            "System clipboard did not retain the text/plain fallback."
          );
        }
        if (
          result.nativeSnapshot
            ? result.nativeSnapshot.styleCount === 0
            : !result.html.includes("style=")
        ) {
          throw new Error("System clipboard HTML lost inline formatting.");
        }

        const dataImageCount = result.nativeSnapshot
          ? result.nativeSnapshot.imageCount
          : (result.html.match(/src=["']data:image\//gi) ?? []).length;
        if (dataImageCount < payload.imageCount) {
          throw new Error(
            "System clipboard retained " +
              String(dataImageCount) +
              " of " +
              String(payload.imageCount) +
              " embedded local images."
          );
        }

        if (this.copyResultEl) {
          this.copyResultEl.dataset.status = "ok";
          this.copyResultEl.setText(
            (result.nativeSnapshot ? "macOS HTML" : "HTML") +
              " · " + String(dataImageCount) + "/" +
              String(payload.imageCount) + " images"
          );
        }

        new Notice(
          "Rich WeChat content copied via " +
            (result.method ?? "browser") +
            ". HTML and " +
            String(dataImageCount) +
            " local image" +
            (dataImageCount === 1 ? "" : "s") +
            " detected in clipboard. Confirm formatting after pasting into WeChat."
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (this.copyResultEl) {
          this.copyResultEl.dataset.status = "failure";
          this.copyResultEl.setText("Copy check failed");
          this.copyResultEl.title = message;
        }
        new Notice("Copy to WeChat failed: " + message);
      });
  }

  private updateStatus(
    platform: PlatformId,
    status: PublishLifecycleStatus,
    message?: string,
    details?: string
  ): void {
    const view = this.statusViews.get(platform);
    if (!view) {
      return;
    }

    view.root.dataset.status = status;
    view.badge.setText(status.toUpperCase());
    view.message.setText(message || status);

    const detailText = details?.trim() ?? "";
    view.details.setText(detailText);
    view.details.classList.toggle("obsidian-publisher-hidden", !detailText);

    const canRetry =
      status === "failure" && !this.busyPlatforms.has(platform);
    view.retryButton.classList.toggle("obsidian-publisher-hidden", !canRetry);
    view.retryButton.disabled = this.busyPlatforms.has(platform);
  }

  private updateProgress(progress: PlatformProgress): void {
    this.updateStatus(
      progress.platform,
      progress.status,
      progress.message
    );
  }

  private applyFinalDetails(results: PublishResult[]): void {
    for (const result of results) {
      this.updateStatus(
        result.platform,
        result.status,
        result.message,
        result.details
      );
    }
  }

  private async startPublishing(): Promise<void> {
    if (this.selected.size === 0) {
      new Notice("Select at least one destination.");
      return;
    }
    await this.publishPlatforms([...this.selected]);
  }

  private async retryPlatform(platform: PlatformId): Promise<void> {
    await this.publishPlatforms([platform]);
  }

  private async publishPlatforms(platforms: PlatformId[]): Promise<void> {
    const targets = platforms.filter(
      (platform) => !this.busyPlatforms.has(platform)
    );
    if (targets.length === 0) {
      return;
    }

    targets.forEach((platform) => {
      this.busyPlatforms.add(platform);
      this.updateStatus(platform, "running", "Preparing draft...");
    });
    this.updatePublishButtonLabel();

    try {
      const article = await this.ensureArticle();
      if (targets.includes("wechat")) {
        article.wechatHtml = await this.prepareWechatHtml(article);
      }

      const results = await this.router.publish(
        article,
        targets,
        this.settings.dryRun,
        (progress) => this.updateProgress(progress)
      );
      targets.forEach((platform) => this.busyPlatforms.delete(platform));
      this.applyFinalDetails(results);
    } catch (error) {
      const details =
        error instanceof Error ? error.message : String(error);
      targets.forEach((platform) => {
        this.busyPlatforms.delete(platform);
        this.updateStatus(
          platform,
          "failure",
          "Could not prepare or publish this note.",
          details
        );
      });
      new Notice("Publisher Workbench failed: " + details);
    } finally {
      targets.forEach((platform) => this.busyPlatforms.delete(platform));
      this.updatePublishButtonLabel();
      targets.forEach((platform) => {
        const view = this.statusViews.get(platform);
        if (view?.root.dataset.status === "failure") {
          view.retryButton.classList.remove("obsidian-publisher-hidden");
          view.retryButton.disabled = false;
        }
      });
    }
  }

  onClose(): void {
    this.clipboardPreparationVersion += 1;
    if (this.clipboardPreparationTimer !== undefined) {
      window.clearTimeout(this.clipboardPreparationTimer);
      this.clipboardPreparationTimer = undefined;
    }
    this.previewRenderComponent?.unload();
    this.previewRenderComponent = undefined;
    this.modalEl.removeClass(
      "obsidian-publisher-workbench-modal",
      "is-focus-preview"
    );
    this.contentEl.empty();
  }
}
