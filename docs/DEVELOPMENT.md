# Development

How to build, run, and debug RemoteKit — plus the non-obvious constraints we hit, so future sessions don't relearn them.

## Where the code runs

RemoteKit is a **workspace extension** (`"extensionKind": ["workspace"]`). When connected over Remote-SSH, VS Code runs its extension host **on the remote machine**. So:

- `os.*`, `process.env`, and `vscode.workspace.fs` all operate against the **remote** filesystem — exactly what we want for browsing the remote box.
- There is no live "connected" event mid-session. **`activate()` is the connect signal** (a fresh remote host starts on connect) and **`deactivate()` is the disconnect signal** (the host is torn down). `RemoteSessionMonitor` models it this way.

## Build & test

Use **`pnpm`**, not npm.

- `pnpm run compile` — type-check the host (`tsc -p ./` → `out/`) **and** Vite-build the webview (`dist/`)
- `pnpm run build:webview` / `pnpm run watch:webview` — Vite build of `webview-ui/` → `dist/` (one-shot / watch)
- `pnpm run typecheck:webview` — type-check the webview (Vite strips types without checking, so run this)
- `pnpm run watch` — incremental host build; the default build task / debugger `preLaunchTask`. For webview work, run `watch:webview` alongside.
- `pnpm run lint` — `eslint src webview-ui` (run before considering a change done)

The webview is a **Vite + React + TS** app under `webview-ui/`, built to `dist/` (which `F5` serves — run `pnpm run compile` once before launching). It's eslinted alongside `src`, and additionally type-checked via `typecheck:webview` (eslint doesn't type-check). The host and webview share `src/RemoteFileExplorer/protocol.ts` (webview reaches it through the `@shared` Vite alias + a `tsconfig` path).

## Running it on the remote (the dev loop)

The catch with remote extension development: an extension loaded via `--extensionDevelopmentPath` lives at a path the remote can't see, so **it can only run where its source is**. Practical consequence:

1. The source must be **on the remote machine**. Ours lives at `~/remotekit` on `mini.local` (synced via `rsync` over SSH; no git remote yet).
2. Open that folder in a Remote-SSH window (`mini.local`), then press **F5** ("Run Extension"). The Extension Development Host launches **already connected to the remote**, so the extension runs on the remote and breakpoints/Debug Console work.

Gotchas:

- **Dev-path extensions never appear in the Extensions panel** and get **no "Install in SSH: …" button**. That button only exists for installed (Marketplace/VSIX) extensions. Nothing is broken — that's just how dev extensions work. Confirm it's loaded via **"Developer: Show Running Extensions"**.
- `node`/`pnpm` on the remote may be hidden from non-login shells (installed via nvm). Use a login shell or full paths when checking from scripts.
- Editing here (on the remote copy) does not sync back to any local copy. Keep one source of truth; a git remote would remove the dual-copy hazard.

## Logging

`console.log` on the remote goes to the **Extension Host log**, which is buried and detaches when you reconnect. Instead we use a **`LogOutputChannel`** named `RemoteKit` (created in `activate`, passed into `RemoteSessionMonitor`). View it via **Output panel → "RemoteKit"**. It's visible regardless of debugger state and survives reconnects.

## Detecting the SSH connection

- `env.remoteName === 'ssh-remote'` is the authoritative "are we on SSH" check.
- **You cannot parse the host from the workspace URI on the remote host** — there it's a plain `file:///path` with an empty authority. The `vscode-remote://ssh-remote+<host>` authority only exists UI-side. Get the host from `remote-internal.getActiveSshRemote()` instead (`getActiveSshRemote.ts`).

### Remote-SSH `remote-internal.*` commands (verified shapes)

Callable via `vscode.commands.executeCommand`, probed from the workspace host on `mini.local`:

- `remote-internal.getActiveSshRemote` → `{ hostName, config: { Host, HostName, User } }` — source of truth for the current connection.
- `remote-internal.getConfiguredHostnames` → `{ alias: alias }` map from `~/.ssh/config`.
- `remote-internal.getSshFoldersHistory` → `[]` on the workspace host (history is UI-side, not visible to a workspace-kind extension). **Don't seed "recent folders" / Favourites from it — persist our own in `globalState`.**

## The Remote File Explorer is a Webview — and why

We tried a native `TreeView` first. The feature needs a **horizontal, per-segment-clickable, horizontally-scrolling breadcrumb**, which a TreeView fundamentally cannot render (a `TreeItem` has one label + one click command; no inline segments). So the explorer is a **`WebviewViewProvider`**.

Hard platform constraints that shaped the design (don't relitigate these):

- **A view is atomically either a TreeView or a Webview** — never both. There is no "stacked/group/composite view" API, and no supported way to hide an individual view's header. So "native tree + inline breadcrumb in one seamless view" is impossible.
- **A webview cannot use the active file-icon theme.** Native trees get per-extension icons for free (the workbench resolves `TreeItem.resourceUri` against the *active* icon theme internally); a webview has no API to query the resolved icon. Workaround: we **bundle the default Seti theme** ourselves (`webview-ui/src/seti.woff` + `setiData.json`, generated from MIT `microsoft/vscode` `extensions/theme-seti/icons/{seti.woff,vs-seti-icon-theme.json}`; resolved in `seti.ts`). This reproduces the *default* file icons (incl. README/tsconfig/.npmrc `fileNames` rules) but **cannot track a user's chosen theme** (Material, vscode-icons, …) — that's the irreducible limit. To refresh: re-fetch the two theme-seti files, drop the woff in place, and regenerate `setiData.json` as `{file, defs:{id→{c,color}}, names, exts, langs}`, converting each `fontCharacter` `"\\Exxxx"` to its actual PUA char.
- Net: it's a pick-two-of-three among {the user's live icon theme, single header, interactive breadcrumb}. We chose single webview + interactive breadcrumb, with a bundled default-Seti icon set.

### Replicating the native tree

`VscodeEnhancedTree` (`webview-ui/src/VscodeEnhancedTree.tsx` + `styles.css`) re-creates the native tree's box model with **our own class names** — it does *not* reuse Monaco's private class names (which can change between VS Code versions). The metrics were ported faithfully from the original `media/fileExplorer.css` (which had reverse-engineered them from the real Explorer):

```
.tree[role=tree][tabindex]                      (scroll container; .focused when focused)
  └ .tree-spacer (height = rows×22)             (virtualized: sets full scroll height)
      └ .tree-row[role=treeitem][aria-level]    (position:absolute, top = index×22)
          ├ .tree-indent       (absolute overlay; width (level-1)×8; holds .indent-guide lines)
          ├ .tree-twistie       (padding-left = level×8; .collapsible chevron for folders, else width:0)
          └ .tree-contents
              └ .tree-icon-label {folder,file}-icon  ›  span.tree-label
```

**Virtualization**: only the rows in `[scrollTop−overscan, scrollTop+viewport+overscan]` are rendered; the `.tree-spacer` reserves full height so the scrollbar is correct. Because rows are React state, selection/expand only re-diff the affected rows — no full rebuild (the old plain-JS version rebuilt the entire DOM on every interaction).

Key fidelity rules (same as the original, keep them):

- **Indentation** comes from `.tree-twistie { padding-left: level×8 }`, *not* flat padding. `.tree-indent` is `position: absolute` (guides only, shown on hover via `--vscode-tree-indentGuidesStroke`) and consumes no flow width.
- **Single glyph column**: folders render the **chevron** (no icon glyph), files render the **file icon** (no twistie). Both occupy the same 16px column so labels align with no blank gaps:
  - `.tree-twistie:not(.collapsible) { width: 0; margin-right: 0 }` (files: no twistie)
  - `.tree-icon-label::before { width: 0 }` (folders: no icon); `.file-icon::before { width: 16px; margin-right: 6px; content: "\ea7b" }`
  - (If folder icons are ever wanted, give `.tree-icon-label.folder-icon::before` a folder glyph — files already reserve the column, so it stays aligned.)
- The twistie chevron glyph **isn't in the npm codicon font** under the tree-item names, so it's set directly in CSS: `.tree-twistie.collapsible.expanded::before { content: "\eab4" }` (chevron-down) / `.collapsed::before { content: "\eab6" }` (chevron-right), with `font-family: codicon`.
- Rows are 22px; hover / inactive-selection / active-selection-when-focused use the `--vscode-list-*` variables. Rows are **plain codicon spans, not `<vscode-icon>`** — a web component per row would defeat virtualization.

### Webview essentials

- The host serves the **built `dist/index.html`** (Vite output): it injects a strict **CSP with a per-load nonce** (scripts run only via that nonce), a `<base href>` set to `asWebviewUri(dist)` so Vite's relative `./assets/*` paths resolve, the codicon `<link>`, and strips `crossorigin` from the emitted tags. `localResourceRoots: [extensionUri]` covers `dist/` and `node_modules/@vscode/codicons`.
- Codicons must be registered as `<link id="vscode-codicon-stylesheet" nonce=…>` in the head — both our plain `.codicon`/CSS glyphs and `@vscode-elements`' `<vscode-icon>` read the font from that exact id.
- Theme everything through **`--vscode-*` CSS variables** (injected by VS Code) so it tracks the active theme. Add `-webkit-font-smoothing: antialiased` to `body` — webviews don't inherit the workbench's smoothing and otherwise render text too heavy (a giveaway vs. native).
- File open uses `vscode.open` with `{ preview: true, preserveFocus: true }` so it matches native single-click (preview tab, focus stays in the tree → selection highlight persists).
- **Context menus** in a webview: tag elements with `data-vscode-context='{"webviewSection":"…","preventDefaultContextMenuItems":true, …customKeys}'` and contribute to `menus.webview/context` with `when: webviewSection == '…'`. The command receives the context object (with your custom keys) as its argument — that's how "Set as Explorer Root" gets the folder path.

## File upload — and why drag-drop needs Shift

Local→remote upload **must** go through the webview (the only part running locally; the host's `showOpenDialog` browses the *remote* FS). We capture bytes three ways — **paste**, the breadcrumb **upload button** (a hidden `<input type=file>`; a title-bar command can't open the picker because the message round-trip loses the user-activation gesture), and **Shift+drag** — base64-encode them in the webview (avoids `Uint8Array`-over-`postMessage` structured-clone pitfalls), and `workspace.fs.writeFile` on the host with an Overwrite/Keep Both/Skip conflict prompt.

The hard-won constraint (don't relitigate): **OS file drag-drop into a sidebar `WebviewView` is blocked unless the user holds ⇧ Shift.** VS Code disables the webview during DnD for security so the *workbench* handles the drag; without Shift, **no `dragenter`/`dragover`/`drop` events reach the webview's document at all** (verified empirically — ~99% silent on macOS). Consequences:

- A live drag highlight, or any reactive "a drag started" cue, is **impossible without Shift** — the events we'd need are the ones being withheld (chicken-and-egg). We teach the gesture with a **persistent, dismissible callout** (`UploadHint`, dismissal persisted in `globalState`) instead.
- With Shift held, events flow normally and the folder drop-target highlight works. Drag listeners are on `window` (capture phase); hit-testing uses `event.target.closest('.tree-row')` + `data-index`, **not** `clientX/Y` (drag coordinates are unreliable inside the webview iframe on macOS).
- It does work without Shift in an **editor-tab `WebviewPanel`** (not the sidebar) — see [vscode#224967](https://github.com/microsoft/vscode/issues/224967). Refs: [#193558](https://github.com/microsoft/vscode/issues/193558) (macOS sidebar/iframe), [#158150](https://github.com/microsoft/vscode/issues/158150) (as-designed), [#111092](https://github.com/microsoft/vscode/issues/111092) (DnD API out-of-scope).

## Debugging the webview

Run **Command Palette → "Developer: Open Webview Developer Tools"** — full Chrome DevTools scoped to the webview's document (Elements/Computed/Console). This is the right tool for inspecting spacing/DOM. ("Toggle Developer Tools" opens the workbench DevTools, where you'd have to drill into the nested webview `<iframe>`.) The webview renders **locally** even over SSH, so DevTools works normally.

## Iterating on webview styling without F5

A headless/SSH session (e.g. this agent) can't press F5. To sanity-check CSS/layout fast, build the webview (`pnpm run build:webview`) and use a **preview harness**: a `tmp/preview.html` that links the *built* `dist/assets/index.css`, defines representative `--vscode-*` values (Dark+), and contains a static copy of the row DOM `VscodeEnhancedTree` produces — then render it with a headed browser and screenshot it.

Caveats: the harness uses system fonts + CDN codicons and hand-set theme vars, so it diverges slightly from the real webview (especially font metrics and the unavailable file-icon theme). It's a layout sanity check, **not** ground truth. Final verification is always **F5 + Webview DevTools, compared against the real Explorer**. To match exact native metrics, read VS Code's own `tree/media/tree.css` + `iconLabel/iconlabel.css` (they live in a local VS Code source checkout, not reachable from the remote host — paste them in when needed).
