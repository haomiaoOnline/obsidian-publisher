# Publisher Workbench

**Turn Markdown notes into styled, review-ready publishing drafts.** Publisher Workbench is a free, open-source, desktop-only community plugin for [Obsidian](https://obsidian.md/), with an editorial workbench for WeChat Official Accounts and an optional companion Chrome extension for X Articles.

[简体中文](./README_zh.md) · [Download releases](https://github.com/haomiaoOnline/obsidian-publisher/releases) · [Report an issue](https://github.com/haomiaoOnline/obsidian-publisher/issues)

> **Draft-first by design.** The plugin does not click the final public Publish button. Verify content on the destination platform before publishing it yourself.

The development project was previously called **Obsidian Publisher**. The Community Plugins listing is **Publisher Workbench** (ID `publisher-workbench`), in accordance with Obsidian's plugin naming rules. The repository is still `haomiaoOnline/obsidian-publisher`. This is not an official Obsidian product.

## Features

| Platform | Capabilities | Additional requirements |
| --- | --- | --- |
| **WeChat Official Account** | Theme presets, live HTML preview, rich-text **Copy to WeChat** with local images, optional automated draft handoff. | Logged-in WeChat editor. For draft automation, a separate Wechatsync installation. |
| **X Articles** | Markdown handoff and article draft creation through the optional **X Bridge**, including image import. | Desktop Chrome, an X account eligible for Articles and a separate X Bridge installation. |
| **Xiaohongshu** | Optional draft handoff through the external Wechatsync adapter. | Configured Wechatsync CLI and extension; functionality depends on external platform support. |

- Keep Markdown notes as the source of truth.
- Open the Publisher Workbench using the ribbon icon or **Publish current note** in the command palette.
- Style WeChat text with 14–20px font sizes, line height, accent and text colors, font family, and four section treatments (underline, left bar, box, bracket).
- Choose **Editorial**, **Tech Blue**, **Warm Paper** or **Forest** themes, then fine-tune the typography.
- Preview the article before copying, and retry individual platform handoffs if needed.
- Prepare HTML with compressed, embedded images and validate the local rich-text clipboard write.
- **Dry run is on by default.** No scheduled or silent publication, bundled tracking, or automatic installation of third-party tools.

## Requirements and supported environment

- Obsidian **desktop** 1.6.0 or later; mobile is not supported.
- A platform account and logged-in browser session for any target you choose.
- macOS was used for end-to-end clipboard/draft verification. Other desktop operating systems use the same plugin, but clipboard interoperability with external editors should be checked locally.
- The core WeChat **Copy to WeChat** workflow does not require Wechatsync. Wechatsync and X Bridge are optional companion integrations and must be installed separately.

## Installation

### From Obsidian Community Plugins

After the directory review is approved, open **Settings → Community plugins → Browse**, find **Publisher Workbench**, install and enable it. This installs the Obsidian plugin only, not its separate Chrome extensions or command-line integrations.

### Manual installation before directory approval

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest GitHub Release](https://github.com/haomiaoOnline/obsidian-publisher/releases/latest). **Use matching files from the same release.**
2. Create `<Vault>/.obsidian/plugins/publisher-workbench/` and copy those files into the folder.
3. Restart/reload Obsidian if necessary. Enable **Publisher Workbench** from Settings → Community plugins.
4. Open a Markdown note, click the ribbon send icon, or run **Publish current note**.

**Migrating from an earlier private/test version:** The former ID was `obsidian-publisher` and the Community version ID is `publisher-workbench`. Disable the old plugin before enabling the new one. Back up its `data.json` if needed; settings and locally stored bridge tokens do **not** migrate automatically. Do not keep both enabled at once.

## WeChat: rich-text publishing workflow

1. Open the source article in Obsidian. Local `![image](...)` and Obsidian `![[image]]` embeds are supported when attachments are resolvable from the vault.
2. In the workbench, select the WeChat preview, choose a theme, and adjust typography. The **Focus preview** view helps inspect long articles.
3. Wait until image processing is complete and the **Copy to WeChat** button is enabled. Click it once and check the local copy result.
4. Open a new draft at [WeChat Official Account](https://mp.weixin.qq.com/). Paste **into the body editor**, not the browser address bar or title field.
5. The WeChat editor may warn about text-alignment properties. Review the preview, and continue insertion only if it looks correct.
6. **Explicitly choose Save as draft.** Reopen/reload the saved draft and check image order, section styling, text and links. Final public publication remains a user action.

**Why explicit saving matters:** In real-editor acceptance testing, merely pasting text did not always cause a persistent save. A manual **Save as draft** followed by reopening did preserve the complete 11,298-character, five-image article. External clipboard managers, device-sharing utilities and desktop automation can occasionally replace the clipboard after copying. A successful local clipboard check cannot guarantee that the remote editor received or saved the content.

## Optional: Wechatsync draft handoff

Wechatsync is a separate third-party CLI plus Chrome integration, **not installed automatically by this plugin**.

1. Install and configure [Wechatsync](https://github.com/wechatsync/Wechatsync) according to its own documentation. Check the supported command syntax for your version.
2. Sign into the destination platform in Chrome. Enable Wechatsync's local bridge and copy its local MCP bridge token.
3. In **Publisher Workbench settings**, set the executable (default `wechatsync`), platform identifiers, and token.
4. Keep **Dry run** enabled while checking the planned command. Disable it only when ready to request a real draft.
5. Use **Generate selected drafts / handoffs**. Review the per-platform status and inspect the remote draft before any publication.

The plugin stages temporary Markdown/HTML files outside the vault for the configured adapter. It launches the executable **without a shell**, supplies the local token through the child-process `WECHATSYNC_TOKEN` environment variable (not command arguments), and checks bridge availability at `127.0.0.1:9527/9528`. Versions of the third-party tool may behave differently. The plugin does not manage Wechatsync upgrades.

## Optional: X Articles via the X Bridge Chrome extension

X Articles is not the same as a regular short post on X. The companion extension uses a pinned, MIT-licensed version of [xPoster](https://github.com/nevertoday/xposter).

1. Download **`x-bridge.zip`** from the [matching GitHub Release](https://github.com/haomiaoOnline/obsidian-publisher/releases/latest), and extract it to a stable directory.
2. In Chrome open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the extracted directory that contains the extension `manifest.json`.
3. Make sure Chrome is logged into X and the account can access the X Articles composer. Grant one-time image-folder permission if requested; Chrome stores the handle locally when permission remains valid.
4. In Publisher Workbench settings, leave the **Bundled X Bridge** strategy selected (the X Bridge companion is installed separately).
5. Open a note, select X Articles, and use **Generate selected drafts / handoffs**. The bridge consumes the clipboard handoff and fills an X **draft**.
6. Reopen the draft and verify text, every image and their order. **You** decide when to click Publish.

The X Bridge has a diagnostic side panel for manual retry. The core plugin also offers **Prepare only** and **External command** strategies; an external command must support X Articles, not merely short posts. No extension is installed by this Obsidian plugin. See [extension notes](./x-extension/OBSIDIAN_PUBLISHER.md), [xPoster license](./x-extension/LICENSE.xposter), and [upstream version attribution](./x-extension/UPSTREAM.md).

## Privacy, permissions and external services

**No built-in ads, telemetry or hosted plugin service.** The plugin reads the currently opened note and referenced images only when you use the publishing interface. Nothing is made public automatically.

| Capability | Disclosure |
| --- | --- |
| **Vault access** | Reads the active Markdown note and images referenced by that article. |
| **System clipboard** | Writes HTML, plain text or a versioned X handoff. Other desktop programs may read or overwrite clipboard content. |
| **Files outside the vault** | Creates temporary Markdown/HTML staging files and may expose absolute file paths to locally configured third-party tools. |
| **Launching local programs** | Starts the configured Wechatsync or external X Article command when the user executes a non-dry-run handoff. These programs must be separately installed and trusted. |
| **Local networking** | Checks Wechatsync's bridge status on loopback TCP ports `9527`/`9528`. |
| **Platform networks** | Separately installed Wechatsync and X Bridge communicate with the website you are signed into (including `mp.weixin.qq.com` and `x.com`) to create drafts and upload images. Their own terms and privacy practices apply. |
| **Local secrets** | The configured Wechatsync token is stored in local Obsidian plugin settings, and is passed only to the spawned adapter process when needed. Do not commit your plugin's `data.json` or any token. |

We cannot control the behavior of other installed publishing tools or Chrome extensions. Protect your vault, clipboard, local browser sessions and permission grants. Do not share private drafts or authentication data in bug reports.

## Troubleshooting

| Problem | Suggested check |
| --- | --- |
| Rich copy is unavailable | Wait for attachment conversion; retry preparation if image decoding failed or the article is too large. |
| WeChat paste appears plain or missing images | Re-copy, temporarily disable competing clipboard utilities, paste directly into the WeChat body editor, **save manually**, then reopen and inspect. |
| WeChat warns about text alignment | Inspect the preview and choose to continue only if the article looks right; verify saved formatting and images. |
| Wechatsync says `connected:false` | Open its Chrome extension, enable the local bridge, and confirm the token and local ports; avoid duplicate background processes. |
| X Articles has missing images or `XPOSTER_` markers | Check the X Bridge version, extension enabled state, image-directory permission and draft after reload; use the diagnostic side panel for retry. |
| Manual installation does not appear | Ensure all three release files are in `<Vault>/.obsidian/plugins/publisher-workbench/` and the manifest ID matches the folder. |

## Development

Use a Node.js development environment:

```bash
npm ci
npm run typecheck
npm test
npm run test:x-bridge
npm run build
```

`main.js` is a **generated** build artifact and is intentionally absent from Git source history. Community installs require the binary release assets `main.js`, `manifest.json` and `styles.css`. The optional X Bridge is distributed as `x-bridge.zip`.

See [architecture](./docs/architecture.md) and [MVP test scope](./docs/MVP_ACCEPTANCE.md). The repository is open for [bug reports and contributions](https://github.com/haomiaoOnline/obsidian-publisher/issues).

## Compatibility and limitations

- First community-facing release: **0.5.0** (the Chrome X Bridge is version **0.1.10**).
- Requires Obsidian desktop 1.6.0+. Mobile not supported.
- Frontmatter normalization is intentionally limited to the fields needed by the MVP.
- WeChat rich copy and X Articles drafts have been verified end to end; Xiaohongshu is adapter-dependent.
- Platform UI changes, clipboard software, browser permissions and account eligibility can affect draft creation.
- No scheduling, automatic final publication, platform-password management or cloud publishing history.

## Credits, license and trademarks

Copyright © 2026 haomiaoOnline contributors. Distributed under the [MIT License](./LICENSE).

The optional Chrome extension contains modified material from **xPoster** under its [MIT License](./x-extension/LICENSE.xposter), pinned to the [documented upstream commit](./x-extension/UPSTREAM.md). Its third-party Markdown parser retains [its license](./x-extension/vendor/minigfm.LICENSE).

Obsidian, WeChat, X, Xiaohongshu and other platform names and marks belong to their respective owners. This project is independent and not endorsed by them.
