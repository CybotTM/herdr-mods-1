# Changelog

What changed in each release of herdr-mods, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). Every change that a user of the mods or the integrations
would notice gets a line under **Unreleased** in the same commit; a release turns that section into
a version (see [AGENTS.md](AGENTS.md#releases)).

## [Unreleased]

## [0.3.0] - 2026-11-04

### Added

- **agents-ids:** an X next to Resume removes a session from Recent sessions; it comes back only if
  that session runs again; an X on the Recent sessions header clears the whole list.
- **agents-ids:** Recent sessions show how long ago each one ran (`3h`, `2d`), and "Show n more"
  lists every remembered session, not only the last 5.
- **sysstat:** CPU, memory and GPU values turn red at 90% busy or full.

### Changed

- **agents-ids:** a plain click no longer copies anything; Ctrl-click copies the session ID (on the
  ID line and in Recent sessions), Shift-click still copies the address.

## [0.2.1] - 2026-11-04

### Fixed

- herdr.dev can list the three mods: each is now one folder in the shape its index expects
  (`agents-ids/RECIPE.md`, `agents-ids/preview.png`, the mod in `agents-ids/mods/agents-ids/`; the
  same for `spaces-plus` and `sysstat`). The mods themselves are unchanged. After `git pull`, run
  `./install.sh` again; it reads the new paths.

### Changed

- The `main-plus` layout moved to `layout/main-plus.json` and is no longer offered on
  herdr.dev/layouts (a listed layout has to carry its own copies of the mods). `install.sh` still adds it.
- The README's whole-window screenshot moved to `docs/window.png`.

## [0.2.0] - 2026-11-03

### Added

- **agents-ids:** a *Recent sessions* group under the agents: agent sessions that ended (the agent
  quit, or its terminal closed) with a **Resume** button. At a bare shell, Resume types the resume
  command there (`claude --resume <id>`, `codex resume <id>`, `pi --session <id>`,
  `opencode --session <id>`, `hermes --resume <id>`); otherwise it opens a new tab in the same space
  and folder. Click a row to copy its session ID. Remembers the last 20 sessions for 14 days, across
  restarts.
- **spaces-plus:** the ports a space's programs listen on (`:5173`), from `ss` (Linux) or `lsof`
  (macOS) on the space's machine; click opens it in the browser. A server in a worktree shows on the
  worktree, not on the checkout around it. Agents' own sockets and ephemeral ports are left out.
- **spaces-plus:** the pull request of a space's branch (`#42`: green open, dim draft, purple merged),
  from `gh pr list`, refreshed every 5 minutes; click opens it.
- **spaces-plus:** CPU and memory in use on each machine row (red from 90%).
- **sysstat:** a one-minute CPU sparkline; GPU load and VRAM on AMD cards (amdgpu sysfs); it follows
  the shown space to its machine; click opens `btop` (else `htop`, else `top`) in a new tab.
- **Integrations:** every agent now also sets the `agent.app` label (which program the session belongs
  to), so Resume knows the command.
- **Integrations:** a Hermes plugin, `integrations/hermes/agent-session-label`.
  `install.sh` links it into `~/.hermes/plugins/` unless another plugin already sets the label.
- `scripts/demo.sh`: screenshots from an isolated demo window (own herdr-core, demo repos and agents),
  so previews never show your own spaces.
- Self-checks: `mods/sysstat/test_logic.mjs`, `tests/test_hermes_plugin.py`.
- `AGENTS.md` and `CLAUDE.md` for coding agents working on this repo; this changelog.

### Changed

- `agent-session-label` falls back to `ps` where there is no `/proc`, so the hooks also run on macOS
  (untested there). A `-` for the pid argument means "find the agent".
- sysstat's text is shorter (`MEM 25.1/31.3G`), the memory percentage moved to the tooltip, and
  `main-plus` gives it 420px.
- The mods' own helpers moved to `extras.mjs` (agents-ids, spaces-plus) and `logic.mjs` (sysstat), so
  merging Herdr's updates to `agents` and `spaces` touches fewer lines, and the tests import them
  instead of evaluating `main.js`.

## [0.1.0] - 2026-11-03

First public release.

### Added

- **agents-ids:** Herdr's Agents list with a second line per agent: terminal address and short session
  ID from the `agent.session` label. Click copies the session ID, Shift-click the address.
- **spaces-plus:** Herdr's Spaces list with git changes, tab count and agent status per space, the
  active space's tabs, space counts on machine rows, and recent spaces to reopen.
- **sysstat:** CPU and memory in the status bar (Linux).
- Session-ID integrations for Claude Code and Codex (`SessionStart` hooks), Pi and PiG (extension) and
  OpenCode (TUI plugin), all through `integrations/bin/agent-session-label`.
- `install.sh` (`--mods-only`, `--watch`) and the `main-plus` layout.

[Unreleased]: https://github.com/DarkoKuzmanovic/herdr-mods/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/DarkoKuzmanovic/herdr-mods/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/DarkoKuzmanovic/herdr-mods/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/DarkoKuzmanovic/herdr-mods/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/DarkoKuzmanovic/herdr-mods/releases/tag/v0.1.0
