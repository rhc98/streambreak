# streambreak

[English](README.md) | **한국어**

AI 코딩 도구의 대기 시간에 뉴스와 미니게임을 띄워주는 데스크톱 팝업 앱.

## 왜 만들었나

AI 코딩 도구가 작업을 완료하는 데 짧으면 30초, 길면 수 분이 걸립니다. 지루하기엔 너무 짧고, 브라우저를 열기엔 너무 아까운 시간입니다.

**streambreak**는 그 대기 시간에 작은 팝업으로 기술 뉴스나 간단한 미니게임을 띄워줍니다. 흐름을 깨지 않으면서 심심하지 않을 정도의 것들입니다. AI가 완료되면 자동으로 사라집니다.

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
brew tap rhc98/tap
brew install streambreak
```

> macOS Gatekeeper가 차단하는 경우:
> ```bash
> xattr -d com.apple.quarantine $(which streambreak)
> ```

Claude Code 훅 등록:

```bash
streambreak init
```

## Claude Mod (Claude Code 안에서)

streambreak는 **Claude Mod**로도 배포됩니다. Claude Code 안(터미널과 데스크탑 Code 탭)에 직접 그리는 플러그인이라 앱, 데몬, 훅 설치가 필요 없습니다. Mod는 Claude Code의 early access 기능이라 릴리스마다 동작이 바뀔 수 있습니다.

**설치**

```bash
claude plugin marketplace add rhc98/streambreak
claude plugin install streambreak@streambreak
```

GitHub 소스는 Mod가 `master`에 들어간 뒤부터 동작합니다. 로컬 체크아웃에서 설치하려면 경로를 넘깁니다: `claude plugin marketplace add /path/to/streambreak`.

**사용**

- 턴이 기준 시간(10초)을 넘기면 휴식을 제안하는 토스트가 뜹니다. Claude가 권한 창을 띄우면 바로 뜹니다.
- `/streambreak`로 패널을 엽니다. **뉴스** 탭(Hacker News + TechCrunch, 한국어는 GeekNews, 15초마다 넘어감), **게임** 탭(메모리, 지뢰찾기, 오목), 한국어/English 전환, 닫기가 있습니다.
- Claude가 끝나면 열린 패널에 "작업 완료" 배너가 뜨고 3초 뒤 닫힙니다. 패널에 입력 중이면 닫지 않습니다.

**설정**: `/plugin configure streambreak@streambreak`에서 `threshold_seconds`, `language`(en/ko), `rotation_seconds`, `fade_out_delay_ms`를 바꿉니다. 패널의 언어 전환은 다음에 설정을 바꿀 때까지 `language`보다 우선합니다.

**streambreak 데스크탑 앱(Tauri)도 설치돼 있을 때**: `streambreak init`이 Claude Code `settings.json`에 넣은 `streambreak …` 훅 명령 3개를 지우세요. 그대로 두면 둘 다 뜹니다. 훅이 남아 있는 동안 Mod가 세션마다 한 번 알려 줍니다.

**개발**: 소스는 `mod/streambreak/`입니다. **Claude** 데스크탑 앱에 들어 있는 Claude Code(2.1.286 이상)로 검증하고 테스트합니다. 그 이전 CLI는 테스트 옵션을 무시합니다.

```bash
claude plugin validate mod/streambreak
claude plugin test mod/streambreak
```

Mod 릴리스 태그는 `claude plugin tag mod/streambreak`(`streambreak--v<버전>`)로 만듭니다. Mod에는 `v<버전>` 태그를 쓰지 마세요. 그 태그는 streambreak 데스크탑 앱을 빌드하고 배포합니다.

## 개발

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
