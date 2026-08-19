# Installing dsh-code-workbench on any device

Requirements: a DeepSeek Harness installation that ships the web surface (`dsh --profile web`), Node `^22.19 || >=24`, and pnpm.

## Install

```sh
dsh plugin --profile web add dsh-code-workbench
```

The command initializes the `web` profile on first use, installs the package into the profile, and appends it to the profile's bundle layers (the package declares `dsh.bundle`, so it joins automatically).

Local development install from a checkout:

```sh
dsh plugin --profile web add file:../dsh-code-workbench
```

## Use

1. Start the web app: `dsh --profile web` (the printed URL line names the page).
2. The default experience is unchanged: the harness chat layout.
3. Switch to code mode from the workbench's own affordance or by setting the mode:

   - In code mode the status bar carries the switch back to the harness layout.
   - Programmatic: in the browser console, `localStorage.setItem('dsh.workbench.mode', 'workbench')` then reload; `'harness'` returns.

   Switching reloads the page once (the shell shape is a boot-time decision).

Per-session override: `localStorage.setItem('dsh.workbench.mode.session.<sessionId>', 'harness'|'workbench')` — the override wins for that session; remove the key to fall back to the global default.

## Uninstall

```sh
dsh plugin --profile web remove dsh-code-workbench
```

Removing the bundle removes its row from the tree; the next page load is the plain harness experience. Any `dsh.workbench.mode` keys left in localStorage are inert without the plugin.

## Building the bundle for offline use

```sh
pnpm install && pnpm run build   # produces lib/index.js, lib/client.js, lib/types
pnpm pack                        # tarball: install via `dsh plugin ... add <tarball>`
```

## Compatibility

The plugin depends on published `@deepseek-ai/dsh-*` releases (`0.1.0-rc.6` family) and reacts to the browser plugin loading contract (`dsh.client` + `exports["./client"]`). It makes no assumptions about dsh internals beyond the documented service faces (`ctx.slots`, `ctx.sessions`); a dsh release that keeps those faces compatible keeps the plugin compatible.
