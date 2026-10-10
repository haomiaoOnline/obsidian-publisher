# MVP Acceptance Criteria

The MVP is accepted only when all objective checks below pass.

## A. Repository and build

- [ ] npm install completes.
- [ ] npm test exits with code 0.
- [ ] npm run typecheck exits with code 0.
- [ ] npm run build exits with code 0.
- [ ] main.js is produced.
- [ ] manifest.json declares isDesktopOnly true.

## B. Obsidian entry points

Static or source verification:

- [ ] Ribbon action exists and opens the publisher.
- [ ] Command palette command Publish current note exists.
- [ ] Command is available only for an active Markdown file.

Manual Obsidian verification:

- [ ] Installed plugin loads without an exception.
- [ ] Opening a Markdown note and invoking the command opens the modal.
- [ ] Modal displays the current note path.

## C. Platform selection and status

- [ ] Modal exposes WeChat Official Account.
- [ ] Modal exposes Xiaohongshu.
- [ ] Modal exposes X Articles.
- [ ] WeChat and X Articles are selected by default.
- [ ] Xiaohongshu is secondary and not selected by default.
- [ ] Each selected platform transitions through a running state.
- [ ] Result is shown per platform.
- [ ] Failures show a readable message.

## D. Article normalization

Automated tests prove:

- [ ] Frontmatter title wins.
- [ ] H1 is title fallback.
- [ ] File basename is final title fallback.
- [ ] Relative Markdown image paths resolve against the note directory.
- [ ] Obsidian image references are discovered.
- [ ] Remote image URLs are not rewritten as local files.
- [ ] Local image references can be rewritten to absolute paths in staged Markdown.
- [ ] Obsidian wiki image embeds are converted to relative standard Markdown for X Bridge.

## E. Wechatsync safety and routing

Automated or source verification:

- [ ] WeChat uses a Wechatsync adapter.
- [ ] Xiaohongshu still uses a Wechatsync adapter when explicitly selected.
- [ ] Process invocation uses argv arrays and shell false.
- [ ] Wechatsync command and platform codes are configurable.
- [ ] Wechatsync local bridge token can be configured without placing it in command arguments.
- [ ] Configured bridge token is passed only through WECHATSYNC_TOKEN.
- [ ] Dry run prevents external execution.
- [ ] Missing or failed external command returns failure rather than success.

Real-environment acceptance, after Wechatsync is configured:

- [ ] With dry run disabled, WeChat target creates or hands off to a review-ready draft.
- [ ] The WeChat flow does not publicly publish without separate user confirmation.

## F. X Articles correctness

- [ ] X Articles has its own adapter.
- [ ] Generic X posting is not used as an alias.
- [ ] Bundled X Bridge is the default X Articles strategy.
- [ ] X handoff uses the versioned OBSIDIAN_PUBLISHER_X_V1 protocol.
- [ ] X handoff returns prepared, not success.
- [ ] X handoff contains vault-relative source path and X-compatible Markdown.
- [ ] Bundled Chrome extension has clipboardRead, offscreen, sidePanel, storage, and tabs permissions.
- [ ] Bundled extension retains xPoster's MIT license and pinned upstream commit.
- [ ] X Articles root-tab completion triggers automatic handoff processing.
- [ ] Offscreen document reads the versioned clipboard handoff.
- [ ] Background rejects non-Obsidian clipboard content.
- [ ] Background does not repeatedly consume the same successful handoff id.
- [ ] Automatic handoff sends forceNewArticle=true, setCover=false, and allowGraphqlMetadata=false.
- [ ] Side panel remains a manual diagnostics/retry fallback.
- [ ] External-command mode requires an explicit dedicated command.
- [ ] External command arguments support {file} replacement.
- [ ] Dry run does not write the X handoff to clipboard or open X.

Real-environment acceptance after the bundled X Bridge is loaded in Chrome:

- [ ] Clicking X in Obsidian opens or targets the X Articles composer.
- [ ] X Bridge automatically consumes the current Obsidian article without opening the side panel.
- [ ] X Bridge automatically creates or enters a new X Article draft and writes title/body.
- [ ] A local-image article can resolve images after at most one user folder permission grant.
- [ ] The resulting X Article draft is review-ready.
- [ ] Plugin still does not publicly publish automatically.

## G. Scope discipline

- [ ] No account or password storage.
- [ ] No scheduler.
- [ ] No cloud backend.
- [ ] No public-publish button.
- [ ] No changes outside this repository.
