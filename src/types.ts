export type PlatformId = "wechat" | "xiaohongshu" | "x-articles";

export type WechatSectionStyle =
  | "underline"
  | "left-bar"
  | "boxed"
  | "bracket";

export interface WechatLayoutSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: "system" | "source-han" | "microsoft-yahei";
  bodyColor: string;
  accentColor: string;
  sectionStyle: WechatSectionStyle;
}

export const DEFAULT_WECHAT_LAYOUT: WechatLayoutSettings = {
  fontSize: 16,
  lineHeight: 1.9,
  fontFamily: "system",
  bodyColor: "#262626",
  accentColor: "#2f6bff",
  sectionStyle: "underline"
};

export type PublishLifecycleStatus =
  | "pending"
  | "running"
  | "success"
  | "prepared"
  | "failure";

export interface ArticleImage {
  originalReference: string;
  vaultPath: string;
  absolutePath?: string;
}

export interface NormalizedArticle {
  title: string;
  cover?: string;
  filePath: string;
  absoluteFilePath?: string;
  rawMarkdown: string;
  normalizedMarkdown: string;
  xMarkdown: string;
  wechatHtml?: string;
  images: ArticleImage[];
}

export interface PublishContext {
  dryRun: boolean;
}

export interface PublishResult {
  platform: PlatformId;
  status: Exclude<PublishLifecycleStatus, "pending" | "running">;
  message: string;
  details?: string;
}

export interface PlatformPublisher {
  readonly platform: PlatformId;
  readonly displayName: string;

  publish(
    article: NormalizedArticle,
    context: PublishContext
  ): Promise<PublishResult>;
}

export interface PlatformProgress {
  platform: PlatformId;
  status: PublishLifecycleStatus;
  message?: string;
}

export interface PublisherSettings {
  wechatsyncCommand: string;
  wechatsyncToken: string;
  wechatsyncWechatPlatform: string;
  wechatsyncXiaohongshuPlatform: string;
  wechatLayout: WechatLayoutSettings;
  dryRun: boolean;
  xArticlesStrategy: "xposter-clipboard" | "prepare-only" | "external-command";
  xArticlesOpenAfterHandoff: boolean;
  xArticlesOpenUrl: string;
  xArticlesCommand: string;
  xArticlesArgs: string;
}

export const DEFAULT_SETTINGS: PublisherSettings = {
  wechatsyncCommand: "wechatsync",
  wechatsyncToken: "",
  wechatsyncWechatPlatform: "weixin",
  wechatsyncXiaohongshuPlatform: "xiaohongshu",
  wechatLayout: { ...DEFAULT_WECHAT_LAYOUT },
  dryRun: true,
  xArticlesStrategy: "xposter-clipboard",
  xArticlesOpenAfterHandoff: true,
  xArticlesOpenUrl: "https://x.com/compose/articles",
  xArticlesCommand: "",
  xArticlesArgs: "--input\n{file}"
};

export function resolvePublisherSettings(
  loaded:
    | (Partial<Omit<PublisherSettings, "wechatLayout">> & {
        wechatLayout?: Partial<WechatLayoutSettings>;
      })
    | null
    | undefined
): PublisherSettings {
  const settings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    loaded ?? {}
  );


  settings.wechatLayout = {
    ...DEFAULT_WECHAT_LAYOUT,
    ...(loaded?.wechatLayout ?? {})
  };

  const legacyPrepareOnly =
    loaded?.xArticlesStrategy === "prepare-only" &&
    loaded.xArticlesOpenAfterHandoff === undefined &&
    loaded.xArticlesOpenUrl === undefined;

  if (legacyPrepareOnly) {
    settings.xArticlesStrategy = "xposter-clipboard";
  }

  return settings;
}
