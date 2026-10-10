import type { NormalizedArticle } from "../types";

export const XPOSTER_HANDOFF_PREFIX = "OBSIDIAN_PUBLISHER_X_V1\n";

export interface XPosterHandoffPayload {
  version: 1;
  id: string;
  title: string;
  filePath: string;
  markdown: string;
  createdAt: number;
}

export function buildXPosterHandoff(
  article: NormalizedArticle,
  createdAt: number = Date.now()
): string {
  const payload: XPosterHandoffPayload = {
    version: 1,
    id: String(createdAt) + ":" + article.filePath,
    title: article.title,
    filePath: article.filePath,
    markdown: article.xMarkdown,
    createdAt
  };

  return XPOSTER_HANDOFF_PREFIX + JSON.stringify(payload);
}
