# streambreak — Project Instructions

## Tech stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri v2 |
| Backend | Rust (axum HTTP server on :19840, rusqlite cache) |
| Frontend | React 19, TypeScript, Tailwind v4 |
| Linter | Biome (`bun run check`) |
| Tests | Vitest (`bun run test`), `cargo test` |
| Package manager | Bun |

## Development

```bash
bun install
bun tauri dev
```

## Key architecture

- **`src-tauri/src/api.rs`** — axum HTTP server. Every `POST /api/timer/start` checks the threshold; if exceeded, shows popup immediately (no separate notification needed).
- **`src-tauri/src/timer.rs`** — idle timer state machine.
- **`src-tauri/src/window.rs`** — popup show/hide with focus-aware delay (`hide --reason=complete` polls `win.is_focused()` before closing).
- **`src/games/`** — MemoryMatch, Minesweeper, Gomoku (React).

## Linter rules (Biome)

- Do NOT use `arr?.[i]!` (noNonNullAssertedOptionalChain). Use `arr![i]!` instead.

## Release process

```bash
bash scripts/bump-version.sh <version>   # bumps Cargo.toml + tauri.conf.json
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock
git commit -m "chore: bump version to <version>"
git tag v<version> && git push && git push --tags
```

GitHub Actions then:
1. Builds universal macOS binary (`aarch64` + `x86_64`)
2. Packages `.tar.gz` + `.dmg`
3. Updates `rhc98/homebrew-tap` formula (needs `HOMEBREW_TAP_TOKEN` secret)
4. Creates GitHub Release with artifacts

## Homebrew distribution

Formula lives exclusively in `rhc98/homebrew-tap` (not in this repo).

```bash
brew tap rhc98/tap
brew install streambreak
```

## HTTP API

`localhost:19840` — see `api.rs` for all endpoints.

## Config

`~/.streambreak/config.toml` — threshold, language, popup size/position.

## Claude Mod (in progress)

Port of streambreak to a Claude Mod (function-hooks plugin that draws a Pane/Toast inside Claude Code terminal and desktop). Not started yet — planning only.

- **Plan / progress SoT:** `plans/2026-10-03-streambreak-claude-mod-plan.md` (goalplan checklist). Read it first. Mark an item `[x]` only with a `verified:` basis.
- **Canonical source:** `mod/streambreak/` in this repo (create it there directly). `~/.claude/dev-mods/<session-id>/…`, installed plugin caches and remote checkouts are derived copies — never edit them, and never commit absolute home paths.
- **Do not touch** the existing Tauri app (`src/`, `src-tauri/`); the Mod is additive.
- **Dev loop (verified commands only):** `claude plugin validate mod/streambreak`, `claude plugin test mod/streambreak`, `claude --plugin-dir mod/streambreak`. How to hot-reload from the canonical folder in a desktop session is an open question (plan F1(c)); load the `plugin-authoring` skill first in each new session.
- **CI/release gotchas:** vitest has no `include`, so exclude `mod/**` before adding `*.test.ts` there. `release.yml` fires on `v*` tags — Mod releases must use `claude plugin tag` (`streambreak--v<ver>`), never `v0.x.x`.
