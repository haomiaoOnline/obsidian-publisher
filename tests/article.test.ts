import { describe, expect, it } from "vitest";
import {
  extractImageReferences,
  inferTitle,
  normalizeArticle,
  normalizeVaultPath,
  rewriteLocalImagesToVaultRelative,
  rewriteWikiImagesToMarkdown
} from "../src/article";
import { buildPreviewMarkdown } from "../src/preview";

describe("article normalization", () => {
  it("prefers frontmatter title and cover", () => {
    const result = inferTitle(
      "---\ntitle: My Article\ncover: assets/cover.png\n---\n# Ignored",
      "posts/fallback.md"
    );

    expect(result).toEqual({
      title: "My Article",
      cover: "assets/cover.png"
    });
  });

  it("builds preview markdown without duplicating frontmatter or the main title", () => {
    const article = normalizeArticle({
      markdown: "---\ntitle: Preview title\n---\n# Preview title\nBody\n\n![A](img/a.png)",
      filePath: "posts/demo.md"
    });

    const preview = buildPreviewMarkdown(article);

    expect(preview).toBe("# Preview title\n\nBody\n\n![A](img/a.png)");
    expect(preview).not.toContain("---");
  });

  it("falls back from H1 to file basename", () => {
    expect(
      inferTitle("# Heading\nBody", "posts/fallback.md").title
    ).toBe("Heading");
    expect(
      inferTitle("Body", "posts/fallback.md").title
    ).toBe("fallback");
  });

  it("resolves relative image paths against the note directory", () => {
    expect(
      normalizeVaultPath(
        "posts/2026/article.md",
        "../assets/a.png"
      )
    ).toBe("posts/assets/a.png");
  });

  it("extracts local markdown and wiki images", () => {
    const images = extractImageReferences(
      "![A](../assets/a.png)\n![[b.jpg|600]]\n![R](https://example.com/r.png)",
      "posts/article.md",
      (vaultPath) => "/vault/" + vaultPath
    );

    expect(images).toEqual([
      {
        originalReference: "../assets/a.png",
        vaultPath: "assets/a.png",
        absolutePath: "/vault/assets/a.png"
      },
      {
        originalReference: "b.jpg",
        vaultPath: "posts/b.jpg",
        absolutePath: "/vault/posts/b.jpg"
      }
    ]);
  });

  it("converts Obsidian image embeds into xPoster-friendly Markdown", () => {
    expect(
      rewriteWikiImagesToMarkdown(
        "# Demo\n![[images/photo one.png|Hero image]]\n![[diagram.png|600]]"
      )
    ).toBe(
      "# Demo\n![Hero image](<images/photo one.png>)\n![diagram](diagram.png)"
    );
  });

  it("rewrites X local images to vault-root-relative paths", () => {
    const article = normalizeArticle({
      markdown: "# Demo\n![A](./local.png)\n![[images/photo one.png]]",
      filePath: "Publisher Acceptance/image-case/demo.md"
    });

    expect(article.xMarkdown).toContain(
      "![A](<Publisher Acceptance/image-case/local.png>)"
    );
    expect(article.xMarkdown).toContain(
      "![photo one](<Publisher Acceptance/image-case/images/photo one.png>)"
    );
  });

  it("rewrites an extracted local Markdown image to its vault path", () => {
    expect(
      rewriteLocalImagesToVaultRelative(
        "![A](../assets/a.png)",
        [{
          originalReference: "../assets/a.png",
          vaultPath: "assets/a.png"
        }]
      )
    ).toBe("![A](assets/a.png)");
  });

  it("rewrites local images to absolute staged references", () => {
    const article = normalizeArticle({
      markdown: "# Demo\n![A](img/a.png)\n![[img/b.png]]",
      filePath: "posts/demo.md",
      toAbsolutePath: (vaultPath) => "/vault/" + vaultPath
    });

    expect(article.normalizedMarkdown).toContain(
      "![A](</vault/posts/img/a.png>)"
    );
    expect(article.normalizedMarkdown).toContain(
      "![image](</vault/posts/img/b.png>)"
    );
    expect(article.xMarkdown).toContain("![b](posts/img/b.png)");
  });
});
