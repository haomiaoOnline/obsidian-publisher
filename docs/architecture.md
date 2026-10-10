# Architecture

## Product boundary

Obsidian Publisher owns:

- reading the current note,
- normalizing Markdown metadata,
- resolving local image references,
- platform selection UI,
- adapter routing,
- safe local process invocation,
- status and error reporting.

It does not own:

- platform credentials,
- account login,
- browser cookies,
- public publish confirmation,
- Wechatsync internals,
- X account/session management.

The Wechatsync local bridge token may be stored in Obsidian plugin settings when the user chooses to configure it. It is not embedded in source code and is passed to the CLI only as a child-process environment variable.

## Layers

### 1. Obsidian UI

src/main.ts

- command palette entry,
- ribbon entry,
- settings registration.

src/publish-modal.ts

- current note display,
- platform toggles,
- progress state,
- per-platform results.

### 2. Article normalization

src/article.ts

- frontmatter title and cover extraction,
- H1 and file-name fallback,
- Markdown and Obsidian image discovery,
- relative-vault-path resolution,
- staged absolute image reference rewriting for Wechatsync,
- Obsidian wiki-image to standard Markdown conversion for X Bridge handoff.

### 3. Publisher routing

src/services/publisher-router.ts maps PlatformId to a PlatformPublisher and handles:

- running status,
- adapter exceptions,
- fail-closed missing adapters.

### 4. Providers

WechatsyncPublisher handles:

- WeChat,
- Xiaohongshu as a secondary target,
- future Wechatsync-supported destinations.

XArticlesPublisher handles:

- a separate X Articles path,
- the default versioned clipboard handoff,
- opening the X Articles composer,
- prepare-only fallback,
- dedicated external command support.

Future adapters can implement the same PlatformPublisher interface for Zhihu, Juejin, CSDN, Medium, or custom browser automation.

### 5. Bundled X Bridge

`x-extension/` is a narrow fork of the MIT-licensed xPoster Chrome extension. The repository retains the upstream MIT license and pinned commit.

The bridge contract is:

    OBSIDIAN_PUBLISHER_X_V1\n
    <JSON payload>

The JSON contains the article title, vault-relative source path, Markdown, handoff id, and timestamp.

Normal runtime flow:

1. Obsidian writes the versioned handoff to the system clipboard.
2. Obsidian opens https://x.com/compose/articles.
3. The Chrome background observes the completed X Articles root tab.
4. An offscreen extension document reads the clipboard with the explicit clipboardRead + offscreen permissions.
5. The background validates and de-duplicates the handoff id.
6. The existing xPoster content script receives xposter:import-markdown with forceNewArticle: true.
7. xPoster creates/enters a new draft and writes the article through X's editor interaction path.

The side panel still understands the same handoff protocol and remains a diagnostics/manual-retry fallback, but it is not required for the normal flow.

The bridge deliberately leaves xPoster's existing X Articles machinery intact:

- preflight checks,
- public editor/DOM interaction,
- relative local-image resolution,
- persistent local-folder handle in IndexedDB,
- media upload and formatting,
- draft-write diagnostics.

The background stores the last automatic handoff state and result in chrome.storage.local, so duplicate tab events cannot repeatedly write the same article and failures remain observable.

It does not press X's final Publish button.
Private GraphQL metadata automation is forced off in this fork; cover metadata automation is disabled and the default write path uses the editor interaction layer.

### 6. Process boundary

NodeProcessRunner uses Node spawn with:

- shell false,
- argv arrays,
- captured stdout and stderr,
- exit-code based failure.

No shell command string is constructed from article content or file paths.

## Draft-only safety model

The plugin intentionally has no public-publish UI.

A provider may:

- create a remote draft,
- prepare local content,
- open or hand off to a review workflow.

It must not silently convert a weaker operation into a success claim. The default X Bridge handoff returns `prepared`; only the browser-side extension can establish that content was actually written into an X draft, and final public publication remains manual.

## Staging

The normalized note is written beneath the operating-system temporary directory in an obsidian-publisher folder.

This avoids mutating the original Obsidian note.

Local image links are rewritten only in the staged copy.

## Why X Articles is separate

Generic X posting and X Articles use different editor capabilities and content models. The router therefore exposes x-articles as its own platform and provider.

This prevents a generic x adapter from being misrepresented as long-form X Articles support.
