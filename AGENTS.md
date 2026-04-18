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
