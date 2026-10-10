import path from "node:path";
import type { ArticleImage, NormalizedArticle } from "./types";

export interface ParsedFrontmatter {
  attributes: Record<string, string>;
  body: string;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { attributes: {}, body: markdown };
  }

  const lines = normalized.split("\n");
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );
  if (end === -1) {
    return { attributes: {}, body: markdown };
  }

  const attributes: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(":");
    if (colon <= 0) {
      continue;
    }

    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key) {
      attributes[key] = value;
    }
  }

  return {
    attributes,
    body: lines.slice(end + 1).join("\n")
  };
}

export function inferTitle(
  markdown: string,
  filePath: string
): { title: string; cover?: string } {
  const parsed = parseFrontmatter(markdown);
  const frontmatterTitle = parsed.attributes.title?.trim();
  const cover =
    parsed.attributes.cover?.trim() || parsed.attributes.image?.trim();

  if (frontmatterTitle) {
    return { title: frontmatterTitle, cover };
  }

  const heading = parsed.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));

  if (heading) {
    return {
      title: heading.replace(/^#\s+/, "").trim(),
      cover
    };
  }

  const basename = path.posix.basename(filePath).replace(/\.md$/i, "");
  return {
    title: basename || "Untitled",
    cover
  };
}

function stripAngleBrackets(value: string): string {
  if (value.startsWith("<") && value.endsWith(">")) {
    return value.slice(1, -1);
  }
  return value;
}

function isRemoteReference(reference: string): boolean {
  return /^(https?:|data:|app:|obsidian:)/i.test(reference);
}

function extractMarkdownImageSource(rawDestination: string): string {
  return stripAngleBrackets(
    rawDestination
      .replace(/\s+["'][^"']*["']\s*$/, "")
      .trim()
  );
}

export function normalizeVaultPath(
  notePath: string,
  reference: string
): string {
  const decoded = safeDecode(stripAngleBrackets(reference.trim()));
  const clean = decoded.split("#")[0]?.split("?")[0] ?? "";

  if (!clean) {
    return clean;
  }

  if (clean.startsWith("/")) {
    return path.posix.normalize(clean.slice(1));
  }

  return path.posix.normalize(
    path.posix.join(path.posix.dirname(notePath), clean)
  );
}

export function extractImageReferences(
  markdown: string,
  notePath: string,
  toAbsolutePath?: (vaultPath: string) => string | undefined
): ArticleImage[] {
  const found = new Map<string, ArticleImage>();

  const markdownImage = /!\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(markdownImage)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    const source = extractMarkdownImageSource(raw);
    if (!source || isRemoteReference(source)) {
      continue;
    }

    const vaultPath = normalizeVaultPath(notePath, source);
    found.set(source, {
      originalReference: source,
      vaultPath,
      absolutePath: toAbsolutePath?.(vaultPath)
    });
  }

  const wikiImage = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  for (const match of markdown.matchAll(wikiImage)) {
    const source = match[1]?.trim();
    if (!source || isRemoteReference(source)) {
      continue;
    }

    const vaultPath = normalizeVaultPath(notePath, source);
    found.set(source, {
      originalReference: source,
      vaultPath,
      absolutePath: toAbsolutePath?.(vaultPath)
    });
  }

  return [...found.values()];
}

export function rewriteWikiImagesToMarkdown(markdown: string): string {
  return markdown.replace(
    /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_whole, rawSource: string, rawAlias?: string) => {
      const source = rawSource.trim();
      if (!source) {
        return _whole;
      }

      const alias = (rawAlias ?? "").trim();
      const alt = alias && !/^\d+(?:x\d+)?$/i.test(alias)
        ? alias
        : path.posix.basename(source).replace(/\.[^.]+$/, "") || "image";
      const destination = /\s/.test(source) ? "<" + source + ">" : source;
      return "![" + alt + "](" + destination + ")";
    }
  );
}

export function rewriteLocalImagesToVaultRelative(
  markdown: string,
  images: ArticleImage[]
): string {
  const lookup = new Map(
    images.map((image) => [
      image.originalReference,
      image.vaultPath.replace(/\\/g, "/")
    ])
  );

  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (whole, alt: string, rawDestination: string) => {
      const source = extractMarkdownImageSource(rawDestination);
      const vaultPath = lookup.get(source);
      if (!vaultPath) {
        return whole;
      }
      const destination = /\s/.test(vaultPath)
        ? "<" + vaultPath + ">"
        : vaultPath;
      return "![" + alt + "](" + destination + ")";
    }
  );
}

export function rewriteLocalImagesToAbsolute(
  markdown: string,
  images: ArticleImage[]
): string {
  const lookup = new Map(
    images
      .filter((image) => Boolean(image.absolutePath))
      .map((image) => [image.originalReference, image.absolutePath as string])
  );

  const markdownRewritten = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (whole, alt: string, rawDestination: string) => {
      const source = extractMarkdownImageSource(rawDestination);
      const absolutePath = lookup.get(source);
      if (!absolutePath) {
        return whole;
      }
      return "!" + "[" + alt + "]" + "(<" +
        absolutePath.replace(/\\/g, "/") + ">)";
    }
  );

  return markdownRewritten.replace(
    /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g,
    (whole, source: string) => {
      const absolutePath = lookup.get(source.trim());
      if (!absolutePath) {
        return whole;
      }
      return "![image](<" + absolutePath.replace(/\\/g, "/") + ">)";
    }
  );
}

export function normalizeArticle(input: {
  markdown: string;
  filePath: string;
  absoluteFilePath?: string;
  toAbsolutePath?: (vaultPath: string) => string | undefined;
}): NormalizedArticle {
  const inferred = inferTitle(input.markdown, input.filePath);
  const images = extractImageReferences(
    input.markdown,
    input.filePath,
    input.toAbsolutePath
  );

  return {
    title: inferred.title,
    cover: inferred.cover,
    filePath: input.filePath,
    absoluteFilePath: input.absoluteFilePath,
    rawMarkdown: input.markdown,
    normalizedMarkdown: rewriteLocalImagesToAbsolute(input.markdown, images),
    xMarkdown: rewriteLocalImagesToVaultRelative(
      rewriteWikiImagesToMarkdown(input.markdown),
      images
    ),
    images
  };
}
