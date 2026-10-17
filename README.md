# streambreak

**English** | [한국어](README.ko.md)

A desktop popup that shows news and mini-games while you wait for AI coding tools to finish.

## Why

AI coding tools can take anywhere from 30 seconds to several minutes to finish a task. Long enough to be bored, short enough that opening a browser is a bad idea.

**streambreak** slides in a small popup with tech news or a quick mini-game during those waits — just enough to keep your hands busy without breaking your focus. When the AI finishes, it fades out automatically.

## How it works

```
Claude Code starts thinking
       |
       v
  Hook fires → streambreak timer start
       |
  30+ seconds pass...
       |
       v
  Popup slides in from bottom-right
  with HN/GeekNews feed + mini-games
       |
  Claude Code finishes
       |
       v
  "Task Complete" → fade out
```

## Features

- **News feeds** — Hacker News (EN) or GeekNews (KO), switchable
- **Mini-games** — Memory Match, Minesweeper, Gomoku (9x9 vs AI)
- **System tray** — menu bar icon with show/hide/language controls
- **HTTP API** — `localhost:19840` for CLI and hook integration
- **Claude Code hooks** — auto-registers PreToolUse/Notification/Stop hooks
- **Config** — `~/.streambreak/config.toml` for thresholds, feeds, popup settings

## Installation

```bash
brew tap rhc98/tap
brew install streambreak
```

> If macOS blocks the binary (Gatekeeper):
> ```bash
> xattr -d com.apple.quarantine $(which streambreak)
> ```

Then register Claude Code hooks:

```bash
streambreak init
```

## Claude Mod (inside Claude Code)

streambreak also ships as a **Claude Mod**: a plugin that draws inside Claude Code itself (terminal and the desktop Code tab), with no app, daemon or hooks to install. Mods are early access in Claude Code, so behaviour may change between releases.

**Install**

```bash
claude plugin marketplace add rhc98/streambreak
claude plugin install streambreak@streambreak
```

The GitHub source works once the mod is on `master`. From a local checkout, pass its path instead: `claude plugin marketplace add /path/to/streambreak`.

**Use**

- When a turn runs past the threshold (10 s), a toast offers a break. It also appears as soon as Claude shows a permission dialog.
- `/streambreak` opens the pane: a **News** tab (Hacker News + TechCrunch, or GeekNews in Korean, rotating every 15 s), a **Games** tab (Memory, Minesweeper, Gomoku), a 한국어/English toggle and Close.
- When Claude finishes, a "finished" banner shows in the open pane, which closes after 3 s unless you are typing in it.

**Settings**: `/plugin configure streambreak@streambreak` sets `threshold_seconds`, `language` (en/ko), `rotation_seconds` and `fade_out_delay_ms`. The pane's language toggle overrides `language` until you change the setting again.

**With the streambreak desktop app (Tauri) also installed**: remove the three `streambreak …` hook commands that `streambreak init` added to your Claude Code `settings.json`, or both will pop up. The mod reminds you once per session while they are there.

**Develop**: the source is `mod/streambreak/`. Validate and test it with the Claude Code build that the **Claude** desktop app ships (2.1.286 or later; older CLIs ignore test options):

```bash
claude plugin validate mod/streambreak
claude plugin test mod/streambreak
```

Mod releases are tagged with `claude plugin tag mod/streambreak` (`streambreak--v<version>`). Never use a `v<version>` tag for the mod: that tag builds and publishes the streambreak desktop app.

## Development

```bash
# Prerequisites: Rust, Bun
bun install
bun tauri dev
```

First run opens the system tray icon. Click it to show/hide the popup, change language, or quit.

### Register Claude Code hooks

```bash
streambreak init
```

This writes hooks to `~/.claude/settings.json` that automatically show the popup during long waits.

### Manual control

```bash
streambreak show              # show popup
streambreak hide              # hide popup
streambreak timer start       # start idle timer
curl -X POST localhost:19840/api/show   # HTTP API
```

## Tech stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri v2 |
| Backend | Rust (axum HTTP, rusqlite cache) |
| Frontend | React 19, TypeScript, Tailwind v4 |
| Icons | Lucide React |
| Linter | Biome |
| Package manager | Bun |

## Project structure

```
streambreak/
├── src-tauri/              # Rust backend
│   └── src/
│       ├── main.rs         # CLI + app entry
│       ├── lib.rs          # Tauri setup + IPC commands
│       ├── api.rs          # axum HTTP server (:19840)
│       ├── timer.rs        # idle timer state machine
│       ├── window.rs       # popup window control
│       ├── config.rs       # ~/.streambreak/config.toml
│       ├── tray.rs         # system tray + language menu
│       ├── cli/            # CLI init + hook registration
│       └── content/        # RSS feed, cache, rotation
├── src/                    # React frontend
│   ├── App.tsx             # main layout + routing
│   ├── components/         # NewsCard, Controls, ProgressBar, etc.
│   └── games/              # MemoryMatch, Minesweeper, Gomoku
├── biome.json
├── package.json
└── vite.config.ts
```

## Configuration

```toml
# ~/.streambreak/config.toml

[general]
threshold_seconds = 30       # show popup after this idle time
language = "en"              # "en" for HN, "ko" for GeekNews

[popup]
width = 400
height = 500
position = "bottom-right"

[content]
rotation_seconds = 15        # auto-rotate news items
```

## Build

```bash
bun tauri build              # produces .dmg (macOS)
```

## License

MIT
