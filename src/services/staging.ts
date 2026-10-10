import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NormalizedArticle } from "../types";

function safeBaseName(title: string): string {
  const trimmed = title
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
    .replace(/\s+/g, " ")
    .trim();

  return trimmed.slice(0, 80) || "article";
}

export async function stageContent(
  title: string,
  content: string,
  extension: ".md" | ".html"
): Promise<string> {
  const root = path.join(os.tmpdir(), "obsidian-publisher");
  await mkdir(root, { recursive: true });

  const fileName =
    safeBaseName(title) + "-" + String(Date.now()) + extension;
  const filePath = path.join(root, fileName);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function stageArticle(article: NormalizedArticle): Promise<string> {
  return stageContent(article.title, article.normalizedMarkdown, ".md");
}
