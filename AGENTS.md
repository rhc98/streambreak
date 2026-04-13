# AGENTS.md — streambreak

## Architecture

Tauri v2 desktop app. Single binary: runs as GUI app (no args) or CLI (with subcommand).

- **Rust backend** (`src-tauri/src/`): Tauri app, axum HTTP API on `:19840`, system tray, SQLite content cache
- **React frontend** (`src/`): 400x500px popup webview, news cards, mini-games
- **Communication**: Frontend uses Tauri IPC (`invoke()`). External tools use HTTP API.

## Key conventions

- **Linter**: Biome (`bun run check`). Single quotes, no semicolons, 2-space indent.
- **Icons**: Lucide React only. No emoji in UI.
- **Styling**: Tailwind v4 + CSS variables in `src/styles/globals.css`. Dark theme only.
- **State**: Local React state (useState/useCallback). No global state library.
- **Games**: Self-contained in `src/games/`. Each exports a default component. MiniGame.tsx handles tab switching + random rotation.

## File map

### Rust (src-tauri/src/)

| File | Purpose |
|------|---------|
| `main.rs` | Entry point. Clap CLI parsing → subcommand or Tauri app |
| `lib.rs` | Tauri builder, IPC commands (get_status, get_content_list, hide_popup, get_language, set_language) |
| `api.rs` | axum HTTP routes: /api/timer/start, /api/show, /api/hide, /api/status, /api/content/next |
| `timer.rs` | State machine: Idle → Counting → Triggered → Showing |
| `window.rs` | Popup create/show/hide. Frameless, always-on-top, bottom-right positioning |
| `config.rs` | Serde config from ~/.streambreak/config.toml. Language-aware feed selection |
| `tray.rs` | System tray icon + menu (Show/Hide/Language/Quit) |
| `content/rss.rs` | RSS/Atom feed fetcher (feed-rs + reqwest) |
| `content/cache.rs` | SQLite cache for feed items |
| `content/rotation.rs` | Content rotation logic |
| `cli/init.rs` | `streambreak init`: creates config + registers Claude Code hooks |

### React (src/)

| File | Purpose |
|------|---------|
| `App.tsx` | Root. Modes: news / game / complete. Language toggle, animations |
| `components/NewsCard.tsx` | News item card. Click opens in browser via shell plugin |
| `components/Controls.tsx` | Bottom bar: Next, Game, Language, Close buttons |
| `components/ProgressBar.tsx` | Top bar: branding + elapsed time. Draggable region |
| `components/CompleteBanner.tsx` | "Task Complete" with auto fade-out |
| `components/MiniGame.tsx` | Game container with tab switcher (Memory/Mines/Gomoku) + random rotation |
| `games/MemoryMatch.tsx` | 4x4 card matching with Lucide dev icons |
| `games/Minesweeper.tsx` | 8x8 grid, 10 mines. Click reveal, right-click flag |
| `games/Gomoku.tsx` | 9x9 board, 5-in-a-row vs heuristic AI |

## Adding a new game

1. Create `src/games/NewGame.tsx` — export default component, self-contained state
2. Add to `GAMES` array in `src/components/MiniGame.tsx` with id, label, Lucide icon, component
3. Game area is ~320x400px. Use CSS variables for theming. Buttons need `type="button"`.

## Commands

```bash
bun install          # install deps
bun tauri dev        # dev mode (Vite + Tauri)
bun run check        # biome lint
bun run format       # biome format + fix
bun tauri build      # production build
```
