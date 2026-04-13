# streambreak

[English](README.md) | **한국어**

AI 코딩 도구의 대기 시간에 뉴스와 미니게임을 서빙하는 데스크톱 팝업 앱. Claude Code, Cursor 등이 추론하는 동안 자동으로 팝업이 뜹니다.

## 왜 만들었나

Claude Code가 최근 패치에서 extended thinking 출력을 터미널에서 숨겼습니다. 예전에는 추론 과정이 실시간으로 스트리밍되어 기다리면서 읽을 거리가 있었는데, 이제는 프로그레스 스피너만 돌아갑니다. 짧으면 30초, 길면 수 분을 빈 화면만 보고 있어야 합니다.

다른 앱으로 넘어가자니 컨텍스트 스위칭 비용이 큽니다. 브라우저 탭을 열었다가 돌아오면 흐름이 끊기고, Claude가 끝났는지 확인하러 왔다 갔다 하게 됩니다.

**streambreak**는 그 틈을 채웁니다. 작은 팝업으로 기술 뉴스나 간단한 미니게임을 띄워서 코딩 흐름을 깨지 않으면서 대기 시간을 활용할 수 있게 해줍니다. Claude가 끝나면 팝업은 자동으로 사라지고, 바로 작업에 복귀할 수 있습니다.

## 동작 원리

```
Claude Code 추론 시작
       |
       v
  Hook 실행 → streambreak timer start
       |
  30초 이상 경과...
       |
       v
  우하단에서 팝업 슬라이드 인
  HN/GeekNews 피드 + 미니게임
       |
  Claude Code 추론 완료
       |
       v
  "Task Complete" → 페이드 아웃
```

## 기능

- **뉴스 피드** — Hacker News (영어) 또는 GeekNews (한국어), 전환 가능
- **미니게임** — Memory Match, 지뢰찾기, 오목 (9x9 AI 대전)
- **시스템 트레이** — 메뉴바 아이콘으로 표시/숨김/언어 변경
- **HTTP API** — `localhost:19840`으로 CLI 및 훅 연동
- **Claude Code 훅** — PreToolUse/Notification/Stop 훅 자동 등록
- **설정** — `~/.streambreak/config.toml`로 임계값, 피드, 팝업 커스터마이즈

## 시작하기

```bash
# 필수: Rust, Bun
bun install
bun tauri dev
```

첫 실행 시 시스템 트레이 아이콘이 나타납니다. 클릭해서 팝업 표시/숨김, 언어 변경, 종료할 수 있습니다.

### Claude Code 훅 등록

```bash
streambreak init
```

`~/.claude/settings.json`에 훅을 등록하여 긴 대기 시간에 자동으로 팝업을 표시합니다.

### 수동 제어

```bash
streambreak show              # 팝업 표시
streambreak hide              # 팝업 숨김
streambreak timer start       # 타이머 시작
curl -X POST localhost:19840/api/show   # HTTP API
```

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 데스크톱 쉘 | Tauri v2 |
| 백엔드 | Rust (axum HTTP, rusqlite 캐시) |
| 프론트엔드 | React 19, TypeScript, Tailwind v4 |
| 아이콘 | Lucide React |
| 린터 | Biome |
| 패키지 매니저 | Bun |

## 프로젝트 구조

```
streambreak/
├── src-tauri/              # Rust 백엔드
│   └── src/
│       ├── main.rs         # CLI + 앱 진입점
│       ├── lib.rs          # Tauri 설정 + IPC 커맨드
│       ├── api.rs          # axum HTTP 서버 (:19840)
│       ├── timer.rs        # 대기 타이머 상태 머신
│       ├── window.rs       # 팝업 윈도우 제어
│       ├── config.rs       # ~/.streambreak/config.toml
│       ├── tray.rs         # 시스템 트레이 + 언어 메뉴
│       ├── cli/            # CLI init + 훅 등록
│       └── content/        # RSS 피드, 캐시, 로테이션
├── src/                    # React 프론트엔드
│   ├── App.tsx             # 메인 레이아웃 + 라우팅
│   ├── components/         # NewsCard, Controls, ProgressBar 등
│   └── games/              # MemoryMatch, Minesweeper, Gomoku
├── biome.json
├── package.json
└── vite.config.ts
```

## 설정

```toml
# ~/.streambreak/config.toml

[general]
threshold_seconds = 30       # 이 시간 이상 대기 시 팝업 표시
language = "ko"              # "en": Hacker News, "ko": GeekNews

[popup]
width = 400
height = 500
position = "bottom-right"

[content]
rotation_seconds = 15        # 뉴스 자동 전환 간격 (초)
```

## 빌드

```bash
bun tauri build              # .dmg 생성 (macOS)
```

## 라이선스

MIT
