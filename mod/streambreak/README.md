# streambreak

Break-time news and mini games inside Claude Code, while Claude works.

When a turn runs longer than a few seconds, streambreak offers a break with a small toast. Open the pane with `/streambreak` to read rotating tech news or play a quick game of Memory, Minesweeper or Gomoku. When Claude finishes, a one-line "finished" note appears in the pane, so you know it is time to get back to work. Nothing opens on its own: the pane appears only when you ask for it.

Works in the terminal and in the desktop Code tab. Colors follow your Claude Code theme, including the light, dark, colorblind-friendly and ANSI themes.

## Install

```bash
claude plugin marketplace add rhc98/streambreak
claude plugin install streambreak@streambreak
```

## Use

- **Break toast**: shown when a turn passes the threshold (10 seconds by default), or when Claude asks for a permission.
- **`/streambreak`**: opens the pane with a **News** tab (Hacker News and TechCrunch, or GeekNews in Korean) and a **Games** tab. A button switches between English and Korean.
- **Escape** or **Close** closes the pane. Games keep their state until you start a new one.

## Settings

Run `/plugin configure streambreak@streambreak` to set:

| Setting | Default | What it does |
|---|---|---|
| `threshold_seconds` | 10 | How long a turn runs before the break toast appears |
| `language` | `en` | News sources and UI language (`en` or `ko`) |
| `rotation_seconds` | 15 | How often the news cards move on |
| `fade_out_delay_ms` | 3000 | How long the "finished" note stays before the pane closes |

## Network

The News tab fetches public RSS feeds (hnrss.org for Hacker News, TechCrunch, GeekNews) over HTTPS. streambreak sends no data about you or your sessions anywhere.

## License

MIT. Source: https://github.com/rhc98/streambreak
