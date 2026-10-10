import { parseFrontmatter } from "./article";
import type { NormalizedArticle } from "./types";

export type PreviewPlatform = "wechat" | "xiaohongshu";

function stripDuplicateTitle(body: string, title: string): string {
  const lines = body.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) {
    return "";
  }

  const first = lines[firstContentIndex]?.trim() ?? "";
  if (/^#\s+/.test(first)) {
    const heading = first.replace(/^#\s+/, "").trim();
    if (heading === title.trim()) {
      lines.splice(firstContentIndex, 1);
    }
  }

  return lines.join("\n").trim();
}

export function buildPreviewMarkdown(article: NormalizedArticle): string {
  const parsed = parseFrontmatter(article.rawMarkdown);
  const body = stripDuplicateTitle(parsed.body, article.title);
  return body ? "# " + article.title + "\n\n" + body : "# " + article.title;
}

export function previewDescription(platform: PreviewPlatform): string {
  return platform === "wechat"
    ? "WeChat article preview — title, paragraphs and images are rendered before draft creation."
    : "Xiaohongshu mobile preview — use this to check reading density, images and title before handoff.";
}
