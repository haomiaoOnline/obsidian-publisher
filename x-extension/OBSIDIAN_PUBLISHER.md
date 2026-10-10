# Obsidian Publisher X Bridge

This bundled Chrome extension is based on xPoster (MIT), pinned to the upstream commit documented in UPSTREAM.md.

Obsidian Publisher adds one narrow integration:

- the Obsidian plugin writes a versioned `OBSIDIAN_PUBLISHER_X_V1` Markdown handoff to the system clipboard;
- when this side panel opens, it reads the clipboard;
- if the payload is a new Obsidian Publisher handoff, it loads the Markdown into xPoster's normal draft workflow;
- all X editor checks, local image folder handling, media upload, formatting, diagnostics, and final draft writing remain xPoster's workflow;
- private GraphQL metadata writes are forced off in this fork; title/body/images use the editor path and cover metadata automation is disabled;
- the extension never presses X's final Publish button.

Local image folder access is still granted by the user through Chrome and is persisted by xPoster in IndexedDB when the permission remains valid.
