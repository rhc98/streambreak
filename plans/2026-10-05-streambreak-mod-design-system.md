# streambreak Mod 디자인 시스템

Claude Code 안에서 그려지는 streambreak Pane과 토스트의 디자인 기준이다. F17(UI 다듬기) 이후의 화면은 이 문서를 따른다. 구현 진행은 아래 "구현 계획"의 D 항목으로 기록한다(`[x]`는 `verified:` 근거와 함께).

- v0 (2026-10-05): 초안.
- v1 (2026-10-05): 디자이너 리뷰와 비평가 리뷰를 반영했다. 바뀐 내용은 다음과 같다.
  - 메모리 카드는 모두 Button으로 유지한다.
  - 선택 표시에 색 말고 `›` 기호를 쓴다.
  - 상태 줄을 1줄로 고정한다.
  - 폭 기준을 게임별로 나눈다.
  - 테마별 대비에 대한 보장 문구를 철회한다.
  - Pane 크기를 정했다. 핫키는 D0 결과로 넣지 않기로 했다.
  - D 항목마다 테스트에 미치는 영향을 적었다.

## 결정 기록

| 날짜 | 결정 | 이유 |
|---|---|---|
| 10-05 사용자 | **톤: 하이브리드.** 틀(헤더, 테두리, 상태 줄, 뉴스)은 Claude Code의 회색에 녹아들게 한다. 여러 색은 게임 판 안에서만 쓴다 | 조사한 앱 대부분이 같은 원칙을 쓴다. 호스트 색을 빌리고 강조색은 하나만 둔다 |
| 10-05 사용자 | **강조색은 Claude 테마 키 `claude`를 빌려 쓴다.** 고유 색은 만들지 않는다 | 기존 Tauri 앱의 크림슨 `#e94560`은 다크 테마 에러색 `#FF6B80`과 가깝다 |
| 10-05 | **브랜드 마크는 `☕`.** `✻`는 쓰지 않는다 | `✻`는 Claude Code 스피너 기호라서 내장 기능처럼 보인다 |
| 10-05 리뷰 | **헤더에는 마크 `☕`만 둔다.** `streambreak` 글자는 Pane 틀 제목(L0)이 이미 보여 준다 | 중복을 없애고 12칸을 아낀다. 모든 표면이 Pane 제목을 보이는지는 D0에서 확인한다 |
| 10-05 리뷰 | **선택 표시는 색이 아닌 기호로 한다.** 터미널에서는 선택된 탭과 게임의 라벨 앞에 `›`를 붙인다 | 터미널은 primary 버튼을 강조색으로만 그린다. ANSI와 색약 보정 테마에서 구분되지 않는다 |
| 10-05 리뷰 | **상태 줄은 1줄로 고정한다.** 완료도 테두리 없는 1줄로 같은 자리에 둔다 | 게임 도중에 완료되면 판이 밀려서 지뢰를 잘못 누르게 된다 |
| 10-05 사용자 | **뉴스 목록 줄은 그대로 둔다.** 아이콘, 제목, 출처·시간 | 출처 구분이 시간보다 중요하다 |
| 10-05 사용자 | **완료 문구는 "Claude가 끝냈어요 — 돌아갈 시간이에요"** | 기존 앱의 "back to work" 느낌을 유지한다 |
| 10-05 사용자 | **Pane 크기 요청을 이번 범위에 넣는다.** 핫키는 처음에 넣기로 했다가 D0 결과를 보고 뺐다 | 레이아웃을 고정한다. 핫키는 터미널에서 보이지 않고 데스크탑에서는 전체 화면에서만 동작한다 |

### 근거로 삼은 조사

- **Claude Code 테마** (2.1.286 바이너리에서 확인)
  - 색은 의미 기반 키다. 테마는 6종이다: light, dark, 색약 보정(daltonized) light/dark, ANSI light/dark.
  - 플러그인 `Text`의 색은 "테마 키 또는 원시 색"을 받는다(`claude-code.d.ts`, TextProps).
  - **d.ts에 이름이 나온 키는 `promptBorder`, `inactive`, `permission`뿐이다.** `claude`, `suggestion`, `subtle`, `success`, `error`, `warning`은 바이너리에서 찾은 이름이다. `color`의 타입이 `string`이라서 오타나 이름이 바뀐 키는 아무 오류 없이 무시된다. 엔진을 올릴 때마다 다시 확인한다(D6).
- **터미널 앱의 공통 원칙** (lazygit, k9s, Charm lipgloss, Textual)
  - 의미 기반 ANSI 색을 쓴다.
  - 배경은 칠하지 않는다.
  - 선택은 테두리, 굵기, 반전, 기호로 보인다. 색만으로 보이지 않는다.
- **호스트 안 플러그인 가이드** (VS Code webview, Raycast, Figma)
  - 호스트 토큰을 빌려 쓴다. 호스트 컴포넌트를 다시 꾸미지 않는다.
  - 청하지 않았는데 가로막지 않는다. Pane은 사람이 열 때만 열린다(F4).
- **휴식 앱의 말투** (Stretchly, Time Out, BreakTimer)
  - 허락하는 말투를 쓰고 꾸짖지 않는다.
  - 연속 기록은 없다.
  - streambreak만의 근거는 "어차피 Claude가 일하는 중"이다.
- **터미널 게임** (go-sweep, minesviiper, minesweep-rs)
  - 격자 안에는 1칸 문자를 쓴다.
  - 지뢰 숫자는 고전 색 순서를 따른다.
- **문자 폭** (Python `unicodedata.east_asian_width`로 확인)
  - **Ambiguous(A)**: `· … — • ● ○ ■ ▶`. 터미널의 "ambiguous는 넓게" 설정이 켜져 있으면 2칸으로 그려진다. 한국어·일본어 사용자 설정에서 흔하다.
  - **Wide(W)**: `☕ ❓ ⚡`와 대부분의 이모지.
  - **Narrow(N)**: `› ✓ ⎿ ▸`.
- **Claude Code 기호 깨짐** (#39127, #59123)
  - `⎿`가 일부 글꼴에서 빈 네모로 깨진다.
  - 그래도 Claude Code가 스스로 그리는 기호라면 써도 된다. 그 글꼴이면 Claude Code 화면도 이미 깨져 있다.

## 원칙

1. **손님답게.**
   - 틀은 Claude Code의 회색(`promptBorder`, dim)으로 그린다.
   - 우리가 직접 칠하는 `claude` 색은 오목의 AI 돌 한 곳뿐이다.
   - 선택된 탭과 게임은 엔진이 primary로 그린다. 그 색은 엔진의 몫이고 우리가 늘리지 않는다.
2. **색은 놀이 안에서만.**
   - 여러 색은 게임 판과 게임 상태 줄에서만 쓴다.
   - 틀과 뉴스는 상태를 알릴 때만 의미색을 쓴다(오프라인 `warning`, 완료 `success`).
3. **색만으로 뜻을 전하지 않는다.**
   - 모든 상태에는 글자나 기호도 함께 둔다. 선택은 `›`, 지뢰는 숫자, 결과는 문구로 보인다.
   - 테마 키를 써도 테마마다 대비가 보장되지는 않는다. 아래 "테마별 주의"를 본다.
4. **색은 테마 키로 지정한다.** 원시 ANSI 이름은 게임 팔레트에서 테마 키로 대신할 수 없을 때만 쓴다. hex 리터럴은 쓰지 않는다. 모든 색 값은 `hooks/theme.ts` 한 곳에만 둔다.
5. **격자는 1칸 문자로.**
   - 터미널 격자 안에는 ASCII만 쓴다.
   - 메모리 카드는 예외로 이모지를 쓴다. 모든 카드를 `[ X ]` 버튼으로 그리고 이모지끼리 폭이 같아서 판이 맞는다.
   - 글자 폭 계산(`columnsOf`)은 Wide 문자를 빠짐없이 2칸으로 센다.
   - Ambiguous 문자는 2칸일 수도 있다고 보고 폭에 여유를 둔다.
6. **화면은 움직이지 않는다.**
   - 상태가 바뀌어도 누를 수 있는 칸의 위치는 그대로다.
   - 스피너와 깜빡임은 쓰지 않는다.
   - tick은 메모리 게임의 초 표시만 허용한다(S9).
7. **조용한 말투.**
   - 해요체로 짧게 쓴다.
   - 꾸짖지 않는다. 느낌표는 이겼을 때만 쓴다.

## 표면 모델

| 표면 | 버튼 | 색 | 테스트 | 주의 |
|---|---|---|---|---|
| terminal | `[ label ]`. `plain`이면 라벨만 그린다. 포커스와 포인터가 오면 반전된다 | 테마 키는 사용자 테마로 해석된다 | `SURFACES`에 있음 | Link는 OSC 8을 지원하지 않는 터미널(macOS Terminal.app 등)에서 "텍스트 + dim URL"로 그려진다 |
| desktop | 항상 네이티브 버튼. `role="dismiss"`는 오른쪽 끝의 닫기 | **D0 확인** | 있음 | Text와 Button을 같은 줄에 섞으면 폭이 다르다 |
| mobile | 네이티브 | **D0 확인** | 있음 | Input과 Select가 없다. hover는 없다 |
| vscode | 네이티브 | **D0 확인** | **없음. D6에서 추가** | `RenderSurface`에 들어 있다 |

`Button` 라벨은 문자열 하나이고, 평소에는 색과 bold를 받지 않는다. 받을 수 있는 것은 `dimColor`와 hover 때의 `TextHoverProps`뿐이다. 그래서 다음 규칙을 따른다.

- **색이 필요한 칸 중 누를 필요가 없는 칸만 `Text`로 그린다.** 지뢰찾기의 열린 칸, 오목의 놓인 돌이 해당한다.
- **메모리 카드는 전부 `Button`으로 둔다.** 앞면이 보이는 짝 안 맞은 카드도 다시 누르는 동작이 있다(`flip()`이 대기 중인 불일치를 정리하고 다시 뒤집는다, F8). 짝을 맞춘 카드도 지금처럼 `dimColor` Button으로 둔다. 그래서 메모리 판에는 Text와 Button이 섞이지 않는다.
- **판의 칸 배치 (D6에서 확정).** 터미널은 래퍼 없이 `gap={1}` 행으로 그린다. 고정폭이라 1칸 문자끼리 맞는다. 데스크탑, 모바일, vscode는 모든 칸, 열 이름, 행 번호, 여백을 `width 3` + 가운데 정렬 slot Box에 넣고 행 간격을 0으로 둔다. D0의 C1(래퍼 없음)은 비슷한 폭의 글자로만 확인한 것이었다. 실제 판에서는 💣, ■, 숫자, NBSP의 폭 차이로 열이 어긋났다(D6 스크린샷). C2가 어긋났던 것은 가운데 정렬 없이 폭만 줬기 때문이다.

## 토큰

### 색 역할

값은 Claude Code 2.1.286의 light / dark 테마 기준이다. 코드에서는 역할 이름(`tone.x`)만 쓴다.

| 역할 | 테마 키 | light | dark | 쓰는 곳 |
|---|---|---|---|---|
| `accent` | `claude` | `#D77757` | `#D77757` | 오목 AI 돌 |
| `you` | `suggestion` | `#5769F7` | `#B1B9F9` | 오목 내 돌, 지뢰 숫자 1 |
| `border` | `promptBorder` | `#999999` | `#888888` | 대표 뉴스 카드, 게임 판 테두리 |
| `muted` | `dimColor` prop | – | – | 메타, 목록 줄의 출처·시간, 좌표, 빈 칸 |
| `success` | `success` | `#2C7A39` | `#4EBA65` | 완료 줄, 승리, 지뢰 숫자 2 |
| `danger` | `error` | `#AB2B3F` | `#FF6B80` | 패배, 터진 지뢰, 지뢰 숫자 3 |
| `warning` | `warning` | `#966C1E` | `#FFC107` | 오프라인, 지뢰 숫자 5 |

- **본문 글자에는 색을 주지 않는다.**
- **`subtle`은 쓰지 않는다.** 라이트에서 2.2:1, 다크에서 2.1:1이라 테두리가 거의 보이지 않는다.
- **`promptBorder`도 라이트 흰 배경에서 2.85:1로 약하다.** Claude Code 입력창 테두리와 같은 수준이라 받아들인다.
- **`warning`은 반드시 테마 키로 쓴다.** 원시 `yellow`는 밝은 배경에서 읽히지 않는다.
- **내부용으로 보이는 키는 쓰지 않는다.** `*_FOR_SUBAGENTS_ONLY`, `rainbow_*`, `clawd_*`, `briefLabel*`가 해당한다.

### 테마별 주의 (2.1.286 바이너리 기준)

| 테마 | 문제 | 대응 |
|---|---|---|
| 색약 보정 light/dark | `suggestion`과 `success`가 둘 다 파랑이다. 지뢰 1과 2의 색이 같아진다 | 숫자가 다르므로 괜찮다(원칙 3) |
| ANSI dark | `claude`와 `error`가 가까운 빨강이다. AI 돌과 패배 문구가 같은 계열이 된다 | AI 돌은 문자(`O`/`○`)로도 구분된다. 패배 문구는 글자로 전달된다 |
| ANSI light | `promptBorder`가 `ansi:white`라서 밝은 배경에서 테두리가 거의 사라진다 | 테두리가 없어도 레이아웃이 성립하게 한다. 카드 제목은 bold로 둔다 |
| 라이트 | `claude` 3.15:1, `suggestion` 4.4:1(4.5 바로 아래) | 돌 문자는 bold로 그린다(Text는 bold를 받는다) |

### 게임 팔레트 (판 안에서만)

지뢰 숫자:

| 숫자 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 색 | `suggestion` | `success` | `error` | `magenta` | `warning` | `cyan` | 기본 | 기본 |

- 숫자는 모두 bold로 그린다.
- 7과 8은 기본색이다. 드물지만 정보량이 크므로 dim으로 흐리게 하지 않는다.

오목:
- 내 돌은 `you` bold, AI 돌은 `accent` bold다.
- 빈 교차점은 dim `Button plain`이다.
- **AI의 마지막 수는 bold와 underline으로 표시한다.** `inverse`는 엔진이 포커스와 포인터를 표시할 때 쓰므로 겹친다.

메모리:
- 뒷면 `❓`, 앞면은 이모지, 짝을 맞춘 카드는 `dimColor`다. 모두 Button이다.
- 뒷면 `❓`는 두 기호 세트 모두 같다.

dim 규칙: dim은 "아무것도 없음"(빈 교차점, 열린 빈칸)과 "부가 정보"(메타, 좌표)에만 쓴다. 지뢰의 닫힌 칸 `#`은 "모름"이지 비어 있는 게 아니므로 기본색으로 둔다.

### 글자 위계

| 단계 | 스타일 | 예 |
|---|---|---|
| Heading | bold | 대표 뉴스 제목(`<Text bold>`가 `Link`를 감싼다. D0 확인), 게임 결과 |
| Body | 기본 | 게임 진행 문구 |
| Meta | dim | 출처·시간, `3 / 10`, 좌표, 작업 중 줄 |
| Status | 의미색과 bold | 오프라인, 승패, 완료 |

이탤릭은 쓰지 않는다(한글 이탤릭은 가짜로 기울여 그린다). 밑줄은 Link, 그리고 오목 AI의 마지막 수에만 쓴다.

### 간격과 테두리

- **단위는 터미널 셀이다.**
- **섹션 사이:** 헤더, 상태 줄, 본문 사이는 `gap={1}`.
- **테두리 박스:** `paddingX={1}`, `paddingY` 없음. 테두리 스타일은 `round` 하나만 쓴다.
- **테두리는 두 단계만 쓴다.**
  - L0: Pane 틀. 엔진이 그린다.
  - L1: 대표 카드, 게임 판. 둘 다 `border` 색이다.
  - L1 안에 테두리를 더 넣지 않는다. 완료 표시는 테두리가 없다.
- **구분자:** ` · `.

### 기호 세트

`glyphs(surface)`는 순수 함수다. terminal은 `ascii` 세트를 고르고, desktop, mobile, vscode는 `rich` 세트를 고른다. 테스트도 기대값을 `glyphs(surface)`에서 읽는다.

| 의미 | ascii | rich | 요소 |
|---|---|---|---|
| 선택 표시 (탭, 게임) | `› ` 접두 | 없음 (네이티브 primary가 채워 그린다) | Button |
| 지뢰 닫힌 칸 | `#` | `■` | Button plain |
| 열린 빈칸 | `.` dim | ` ` | Text |
| 깃발 | `F` | `🚩` | Button plain (다시 눌러 해제) |
| 지뢰 | `*` | `💣` | Text, `danger` |
| 오목 빈 교차점 | `+` dim | `·` dim | Button plain |
| 내 돌 / AI 돌 | `X` / `O` | `●` / `○` | Text |
| 메모리 뒷면 | `❓` | `❓` | Button |
| 작업 중 / 완료 | `⎿` / `✓` | `⎿` / `✓` | Text |

문구 안의 돌 표시(`(X)`)도 같은 세트에서 읽는다. desktop에서는 `(●)`가 된다.

## 레이아웃 틀

### Pane 열기

```ts
$.ui.open({ id: PANE, title: 'streambreak', rows: 20, columns: 40, closeOnEscape: true })
```

- **`rows: 20`**: 터미널 인라인(프롬프트 위)에 놓일 때 요청하는 높이다. 지정하지 않으면 3분의 1이다. 오목은 헤더 1, 상태 1, 선택 1, 판 13, 사이 간격 3을 합쳐 19줄이 든다.
- **`columns: 40`**: 전체 화면 옆에 붙을(dock) 때 요청하는 폭이다. 가장 넓은 판인 메모리(31)와 헤더가 한 줄에 들어간다.
- 둘 다 요청일 뿐이다. 사람이 크기를 바꾸면 그 크기를 따른다.
- **`closeOnEscape`**: 사람이 닫는 것이므로 `ui.close` 훅이 정리를 실행한다.
- **`holdToasts`는 쓰지 않는다.** Pane이 열려 있을 때 띄우는 토스트가 없다.

### Pane 해부도 (terminal, 40칸)

```
╭ streambreak ─────────────────────────╮  ← L0 (엔진이 그린 title)
│ ☕ [ › 뉴스 ] [ 게임 ]  [ English ] [ 닫기 ] │  ← Header (오른쪽 묶음은 폭이 모자라면 다음 줄)
│ ⎿ Claude가 작업 중이에요              │  ← StatusSlot (항상 1줄)
│                                      │
│ 3 / 10        오프라인 — 저장된 뉴스예요 │  ← 메타 줄
│ ╭──────────────────────────────────╮ │
│ │ 📰 Rust 2026 에디션 로드맵 공개  │ │  ← FeaturedCard (bold 제목)
│ │ GeekNews · 12분                  │ │
│ ╰──────────────────────────────────╯ │
│  📰 SQLite, 벡터 검색…  GeekNews · 40분 │  ← NewsRow × 4
╰──────────────────────────────────────╯
```

- **Header**: `☕` 마크, 탭 2개, 언어 전환, 닫기. 언어 버튼은 바꿀 언어를 보인다(한국어 화면이면 `English`).
- **StatusSlot**은 **항상 1줄을 차지한다.** 그래서 phase가 바뀌어도 본문이 움직이지 않는다.
  - working / suggested: `⎿ Claude가 작업 중이에요` (dim)
  - done: `✓ Claude가 끝냈어요 — 돌아갈 시간이에요` (`success`, bold, 테두리 없음)
  - idle: 빈 줄
- **Body**: 탭 내용.

### 게임 탭

```
│ [ 메모리 ] [ › 지뢰찾기 ] [ 오목 ]   │  ← GameSelector (flexWrap)
│ [ 새 게임 ]                           │
│ ╭──────────────────╮                 │
│ │ 남은 지뢰 10     │                 │  ← GameStatus (판 안 첫 줄, flexWrap)
│ │ [ 모드: 열기 ]   │                 │
│ │ 1 1 . . . 2 # #  │                 │  ← 열린 칸 = Text, 닫힌 칸 = Button plain
│ │ # 2 1 . . 3 F #  │                 │
│ ╰──────────────────╯                 │
```

- **GameSelector에 `flexWrap`과 `columnGap={1}`을 준다.** 지금은 줄바꿈이 없어서 약 44칸이 필요하다. `gap={1}`을 쓰면 줄이 넘어갈 때 빈 줄이 생기므로 쓰지 않는다(D0).
- **GameStatus는 이미 판 안 첫 줄에 있다.** 여기에 `flexWrap`과 `columnGap={1}`을 더한다. 헤더도 같은 방식으로 바꾼다.
- **게임이 끝나면** 상태 줄 오른쪽에 `[ 새 게임 ]`(key `game:new:result`)을 보인다. selector의 `game:new`와 key를 따로 둔다.
- **탭을 오가도 게임 상태는 유지된다**(`$.state`). 이미 구현되어 있다.

### 폭 기준

판 박스의 폭은 테두리 2와 패딩 2를 포함한다. 상태 줄과 selector는 줄바꿈되므로 하한을 정하지 않는다.

| 판 | 격자 폭 | 박스 최소 폭 |
|---|---|---|
| 지뢰 8×8 | 15 | 19 |
| 오목 9×9 (좌표 포함) | 20 | 24 |
| 메모리 4×4 `[ ❓ ]` | 27 | 31 |

- **판별로 정한다.** `bodyColumns`가 그 판의 최소 폭보다 작으면 판 대신 `패널을 넓히면 이 게임을 할 수 있어요`를 dim으로 보인다. 다른 게임은 그대로 고를 수 있다.
- **뉴스에는 하한이 없다.** 목록 줄은 `clip()`으로 자른다. 폭이 24칸 미만이면 대표 카드만 보인다.
- **`columnsOf`의 `isWide`에 빠진 범위를 넣는다.** `☕` U+2615, `⚡` U+26A1, `❓` U+2753 등 2600–27BF 구간의 Wide 문자가 빠져 있다.

### 핫키

**넣지 않는다**(2026-10-05 사용자 결정, D0 결과).
- 데스크탑은 버튼 옆에 키 배지를 그리지만, 보통 창 배치에서는 키 입력이 입력 창으로 가서 동작하지 않는다. 전체 화면에서만 동작한다.
- 터미널은 일반 Button의 핫키를 화면에 표시하지 않는다.
- 그래서 코드와 테스트만 늘어난다. 모든 동작은 클릭(과 터미널 포커스 링)으로 한다. 필요해지면 나중에 추가한다.

### 화면 상태 목록

| 화면 | 상태 | 표현 |
|---|---|---|
| 공통 | working / suggested | StatusSlot `⎿ …` dim |
| 공통 | done | StatusSlot `✓ …` `success` bold |
| 공통 | idle | StatusSlot 빈 줄 |
| 뉴스 | loading | `뉴스를 불러오는 중…` dim |
| 뉴스 | empty (온라인) | `아직 뉴스가 없어요` dim |
| 뉴스 | **오프라인이고 캐시 없음** | `오프라인이라 뉴스를 불러오지 못했어요` `warning`. 지금은 empty 문구로 잘못 보인다 |
| 뉴스 | offline + 캐시 | 메타 줄 오른쪽에 `warning` 문구 |
| 게임 | 고르기 전 | `게임을 골라 보세요` dim |
| 게임 | playing | GameStatus 기본색 |
| 게임 | won | `success` bold + `[ 새 게임 ]` |
| 게임 | lost | `danger` bold + `[ 새 게임 ]` |
| 게임 | draw (오목) | 기본색 bold + `[ 새 게임 ]` |
| 게임 | 폭 부족 | 판별 안내 문구 |
| 모든 버튼 | focus / hover | 엔진이 반전으로 그린다. 우리 스타일은 더하지 않는다 |

## 컴포넌트

`$`를 받지 않는 순수 함수다(validate 규칙). 토스트 호출(`$.ui.toast`)은 `register.tsx`에 남는다.

| 컴포넌트 | 구성 | 토큰 |
|---|---|---|
| `Header` | Box row space-between wrap. 왼쪽 [Text ☕, Button 탭×2], 오른쪽 [Button 언어, Button dismiss] | 탭은 선택된 것만 `primary`. 터미널에서는 라벨에 `› ` 접두 |
| `StatusSlot` | 항상 Text 한 줄 | 위 상태 목록 |
| `FeaturedCard` | Box round column [Text bold(Link 또는 Text 제목), Text 메타] | 테두리 `border`, 메타 dim |
| `NewsRow` | Box row gap 1 [Link 또는 Text(clip), Text 메타] | 제목 기본색, 메타 dim |
| `GameSelector` | Box row **wrap** [Button×3, Button 새 게임] | 선택된 것만 `primary`와 `› ` |
| `BoardFrame` | Box round column, 첫 줄은 GameStatus | 테두리 `border` |
| `GameStatus` | Box row wrap [Text 상태, (Button 모드 / 새 게임)] | 결과일 때 의미색과 bold |
| 판의 칸 | `Button plain` 또는 `Text`를 `gap={1}` 행에 둔다. 래퍼는 없다 | 게임 팔레트 |

**링크 (D0 결과로 확정)**
- 터미널은 OSC 8 지원 여부를 알려 주지 않는다. Terminal.app처럼 지원하지 않는 터미널에서는 링크마다 dim URL이 통째로 붙어 여러 줄로 넘어간다(D0 확인). 지원하는 터미널(Ghostty)에서는 링크가 단서 없는 일반 글자로 보인다.
- **terminal**
  - 목록 줄은 `Text`로 그린다(누를 수 없다). 아이콘, 제목, 출처·시간은 그대로다.
  - 대표 카드만 `Link`로 둔다. `<Text bold underline color="text">`로 감싸서 밑줄을 링크 단서로 쓴다.
  - 지원하지 않는 터미널에서는 카드 안 제목 아래에 URL이 붙는다. 카드 안이라 받아들인다.
- **desktop·mobile·vscode**: 목록 줄과 대표 카드 모두 `Link`다. 데스크탑이 파란 anchor로 그린다.
- **bold 제목**에는 `color="text"`를 준다. 어두운 터미널에서 light 테마를 쓸 때 bold 글자가 사라지는 문제를 막는다(D0 H3).

## 말투와 문구

- **영어**: 2인칭, 짧게, 마침표 없이.
- **한국어**: 해요체로 통일한다. 게임 문구에서 주어("당신", "내")는 생략한다.
- **금지**: 죄책감 주는 말, 연속 기록, 승리 외의 느낌표, 문장 앞 이모지. 단 뉴스 소스 아이콘은 데이터라서 예외다.
- **토스트 길이**: 한 줄, 한국어 50자, 영어 80자 이내.

| 키 | 현재 (en / ko) | 제안 (en / ko) |
|---|---|---|
| `suggest` | Break time — run /streambreak / 휴식 시간 — /streambreak | Claude is on it — /streambreak for a break / Claude가 작업 중이에요 — 쉬려면 /streambreak |
| `opened` (모델이 읽는 명령 결과) | streambreak pane opened. / streambreak 패널을 열었습니다. | streambreak pane opened / streambreak 패널을 열었어요 |
| `legacyHooks` | (약 150자) | Old app hooks are still in settings.json — remove them or both pop up / 예전 앱 훅이 settings.json에 남아 있어요 — 지우지 않으면 둘 다 떠요 |
| `notPlaced` | …넓히거나 업데이트하세요 | Pane is waiting (reason) — widen the terminal or update the app / 패널이 대기 중이에요(사유) — 터미널을 넓히거나 앱을 업데이트해 주세요 |
| `working` | ⏳ Claude is working… / ⏳ Claude가 작업 중… | ⎿ Claude is working… / ⎿ Claude가 작업 중이에요 |
| `done` | ✓ Claude finished — back to work / ✓ 작업 완료 — 돌아갈 시간 | ✓ Claude is done — back to work / ✓ Claude가 끝냈어요 — 돌아갈 시간이에요 |
| `newsEmpty` | No news yet. / 아직 뉴스가 없습니다. | No news yet / 아직 뉴스가 없어요 |
| `newsOfflineEmpty` (신규) | – | Offline — couldn’t load news / 오프라인이라 뉴스를 불러오지 못했어요 |
| `offline` | Offline — showing the last saved news / 오프라인 — 마지막으로 저장된 뉴스입니다 | Offline — saved news / 오프라인 — 저장된 뉴스예요 |
| `gamesEmpty` | Pick a game. / 게임을 고르세요. | Pick a game / 게임을 골라 보세요 |
| `gomokuTurn` | AI played g6 — your turn (X) / AI가 g6에 둠 — 당신 차례 (X) | AI played g6 — your move (X) / AI가 g6에 뒀어요 — 둘 차례예요 (X). `X`는 `glyphs(surface)`에서 읽는다 |
| `memoryDone` | Complete! 12 moves in 48s / 완료! 12수, 48초 | All matched! 12 moves in 48s / 다 맞혔어요! 12수, 48초 |
| `narrowGame` (신규) | – | Widen the pane to play this / 패널을 넓히면 이 게임을 할 수 있어요 |

## 구현 계획

각 항목의 "영향"은 깨지는 테스트이거나, 실제로는 아무것도 확인하지 않게 되는 테스트다. 고칠 위치까지 적는다(행 번호는 v1 작성 시점 기준).

- [x] **D0 표면 확인 스파이크.** (done · verified: 2026-10-05 사용자 스크린샷 8장. 데스크탑 light/dark, Ghostty dark/dark-ansi/light, Terminal.app. 아래 결과)
  - 개발 모드에서 견본 Pane을 그리고 각 표면의 스크린샷으로 확인한다.
  - 표면: 터미널(iTerm2 같은 OSC 8 지원 터미널과 Terminal.app), 데스크탑, 모바일.
  - 결과로 이 문서의 표면 모델을 고친다. 커밋하지 않는다.
  - kit(`claude plugin test`)는 그려진 모습을 확인하지 못하므로 전부 사람 눈으로 확인한다.
  - 확인할 것:
    - (a) 테마 키가 desktop과 mobile에서 색으로 해석되는가? 모르는 키를 주면 validate가 거부하는가, 기본색으로 그리는가?
    - (b) 원시 ANSI 이름(`magenta`, `cyan`)이 desktop에서 어떻게 보이는가?
    - (c) 한 줄에 `Text`와 `Button plain`이 섞일 때 desktop에서 폭이 맞는가? 고정 폭 `Box`로 맞출 수 있는가?
    - (d) `<Text bold>`로 감싼 `Link`가 굵게 그려지는가? Terminal.app에서 Link는 어떤 모양인가?
    - (e) Pane 틀 제목(L0)이 모든 표면에 보이는가?
    - (f) 일반 Button의 `hotkey`가 어떻게 보이는가?
    - (g) 터미널에서 Claude Code 테마 6종을 하나씩 바꿔 가며 확인한다.
  - 데스크탑 결과 (2026-10-05, 라이트 테마, `bodyColumns` 60, 사용자 스크린샷):
    - (a) 테마 키는 데스크탑에서도 색으로 해석된다. 값은 데스크탑 자체 팔레트를 쓴다. 예를 들어 `suggestion`은 터미널보다 짙은 남색이다. `promptBorder`는 글자색으로 쓰면 거의 보이지 않을 만큼 옅다(테두리 용도로만 쓴다). `dimColor`와 `inactive`는 같은 회색이다.
    - (b) 원시 ANSI 이름도 그려진다. 다만 `yellow`는 밝은 배경에서 거의 읽히지 않는다. `warning` 테마 키를 써야 한다는 규칙이 맞았다.
    - (c) `Button plain`은 데스크탑에서 테두리 없이 글자만 그려진다. 그래서 같은 줄에 Text와 섞어도 `gap={1}`만으로 간격이 고르다(C1). 칸마다 `Box width`로 감싸면 버튼 안쪽 여백 때문에 오히려 줄이 어긋난다(C2). 결론: `BoardCell` 래퍼는 쓰지 않고 지금처럼 `gap={1}` 행으로 둔다.
    - (d) `<Text bold>`로 감싼 `Link`는 굵게 그려진다.
    - (f) 데스크탑은 버튼 오른쪽에 핫키 배지(`1`, `N`, `W`)를 그린다. primary 버튼은 검게 채워진다. 그래서 데스크탑에서는 `›` 접두가 필요 없다(rich 세트 결정과 같다).
    - 밑줄과 bold, `inverse` 모두 그려진다.
    - 핫키를 눌렀을 때의 동작: 보통 창 배치에서는 패널을 클릭해도 키보드 포커스가 입력 창으로 돌아간다. `focus: true`로 열어도 마찬가지다. 앱 창을 전체 화면으로 하면 데스크탑에서도 핫키가 눌린다(사용자 확인). 결론: 핫키는 있으면 편한 가속 수단으로만 둔다. 모든 동작은 클릭으로도 할 수 있어야 하고, 핫키로만 할 수 있는 동작은 두지 않는다. `open()`에 `focus`는 넣지 않는다. 입력 창의 포커스를 빼앗기 때문이다.
    - (a) 모르는 키(`notARealThemeKey`)를 주면 거부되지 않는다. 기본 글자색으로 조용히 그려진다. 그래서 키 이름에 오타가 나도 알 수 없다. `theme.ts`에서 키를 상수로 한 번만 쓰고, 엔진을 올릴 때마다 키 목록을 다시 확인하는 규칙(D6)이 필요하다.
    - (e) Pane 제목은 데스크탑 패널 상단에 보인다. 헤더에서 `streambreak` 글자를 빼도 된다(데스크탑 기준).
    - 다크 테마(`bodyColumns` 59): 테마 키가 다크 값으로 바뀐다. `suggestion`은 밝은 파랑, `success`는 밝은 초록, `error`는 분홍빨강, `warning`은 호박색이 된다. `yellow`도 다크에서는 읽힌다. `promptBorder`는 글자색으로는 거의 보이지 않는다(라이트와 같음). 그 밖의 항목은 라이트와 같다.
    - 배치: `columns`를 준 Pane은 오른쪽에 전체 높이로 붙는다(dock). `rows`/`columns` 없이 연 Pane(`/sbprobe-bogus`)은 대화 안의 카드로 들어간다. 그 카드는 앱을 다크로 바꾼 뒤에도 흰 배경으로 남았다. 데스크탑 쪽 문제로 보이며, streambreak는 `columns`를 주므로 영향이 없다.
    - 데스크탑은 Pane 위에 제목, 펼치기, 닫기(✕)를 직접 그린다.
    - **데스크탑 확인 완료.**
  - 터미널 결과 (2026-10-05, Ghostty, 어두운 배경, 실행된 엔진 v2.1.289, `bodyColumns` 44, 사용자 스크린샷 3장: dark, dark-ansi, light):
    - (a) dark: 테마 키가 모두 의도한 색으로 나온다. `subtle`은 거의 보이지 않는다(쓰지 않기로 한 결정이 맞았다).
    - (c) 한 줄에 Text와 `Button plain`을 섞어도 정확히 맞는다(1칸씩). `Box width`로 감싼 줄도 맞는다.
    - (d) Ghostty(OSC 8 지원)에서 `Link`는 **색도 밑줄도 없는 일반 글자로 보인다.** 그래서 눌러 볼 수 있는 링크라는 단서가 없다. 감싼 `Text bold`는 적용된다. 감싼 `Text`의 밑줄과 색으로 단서를 줄 수 있는지는 H 줄에서 확인 중이다.
    - (f) 터미널은 primary 버튼을 파랑 계열(`suggestion` 비슷한 색)로 그린다. `claude` 색이 아니다. **일반 Button의 `hotkey`는 터미널에 전혀 표시되지 않는다.** `plain` Button만 `w: label`로 보인다. 그래서 터미널에서는 핫키를 찾을 방법이 없다.
    - **`flexWrap`과 `gap={1}`을 함께 쓰면 줄이 넘어갈 때 줄 사이에 빈 줄이 하나 생긴다**(B 줄의 `gray`). 줄바꿈이 있는 행은 `columnGap={1}`을 써야 한다. 확인은 H4 줄로 하고 있다.
    - dark-ansi: Pane 배경이 회색으로 칠해진다. `claude`와 `error`가 같은 빨강이다(예상대로). 그 회색 위에서는 파랑, 빨강, `gray` 글자의 대비가 낮다. dim 계열 키(`promptBorder`, `subtle`, `inactive`, dim)는 모두 같은 밝은 회색이 된다.
    - light 테마를 어두운 터미널에서 쓰면 Pane 배경이 밝게 칠해진다. 그런데 **색을 주지 않은 bold Text, Link, 버튼 라벨, `inverse`는 터미널 기본 글자색(흰색)으로 그려져 보이지 않는다.** 색을 주지 않은 일반 Text와 dim은 보인다. 이 조합은 설정이 서로 맞지 않는 경우라 흔하지 않고, 엔진 쪽 문제로 보인다. 대책: bold 제목에 `color="text"`를 줄 수 있는지 H3 줄로 확인한다. Link와 Button은 색을 줄 수 없어서 우리가 고칠 수 없다.
    - (g) Ghostty에서 `●○`는 1칸으로 그려진다(ambiguous를 좁게 그리는 설정). 한글 버튼 라벨은 글자 사이가 벌어져 보인다(글꼴의 셀 폭 문제라 우리와 무관).
    - H 줄 (Ghostty, dark, v2.1.286):
      - `Link`를 `<Text underline>`로 감싸면 밑줄이 보인다.
      - `<Text color="suggestion">`으로 감싸면 링크가 파랑으로 보인다. 그래서 링크 단서를 줄 수 있다.
      - `<Text bold color="text">`는 정상으로 보인다.
      - `flexWrap`에 `columnGap={1}`을 쓰면 줄이 넘어가도 빈 줄이 생기지 않는다.
    - dark-daltonized 캡처는 생략한다. 키 값은 바이너리에서 확인했고(지뢰 1과 2가 둘 다 파랑), 숫자 자체로 구분되므로 디자인 결정에 영향이 없다.
    - Terminal.app (OSC 8 미지원, v2.1.286): `Link`는 라벨 뒤에 dim URL을 붙여 그린다. 목록 줄(D2)은 URL이 여러 줄로 넘어가 출처·시간이 밀려난다. 밑줄과 색으로 감싼 경우(H1, H2)도 URL이 다음 줄에 붙는다. → "링크" 규칙으로 확정했다.
- [x] **D1 `hooks/theme.ts`.** (done · verified: 아래 결과 + code-reviewer APPROVE, LOW 지적 반영)
  - 순수 모듈로 `tone`(역할 → 테마 키)과 `GLYPHS`(터미널 기호)를 둔다. 테마 키 이름의 출처(2.1.286 바이너리)와 "모르는 키는 조용히 기본색"(D0)을 주석으로 적는다.
  - 계획과 다른 점:
    - `MINE_COLOR`는 칸을 색 Text로 바꾸는 D4에서 만든다. 지금 만들면 쓰는 곳이 없는 코드가 된다.
    - `glyphs(surface)`와 views에 `surface`를 넘기는 일도 rich 세트를 적용하는 D4에서 한다. D1에서는 모든 표면이 같은 기호를 쓰므로 상수 `GLYPHS`로 충분하다.
  - views의 색과 기호 리터럴을 모두 `tone`과 `GLYPHS`로 옮긴다.
    - 제목의 `cyan`은 없앤다(원칙 1).
    - 무승부는 기본색으로 둔다.
    - 대표 뉴스 카드와 게임 판 테두리는 `cyan`/`gray`에서 `promptBorder`로 바뀌어 더 옅어진다(의도한 변경).
    - `tone`에는 지금 쓰는 역할만 둔다. `accent`와 `you`는 D4에서 오목 돌에 쓸 때 추가한다.
  - `columnsOf`가 `\p{Emoji_Presentation}` 문자(☕ ⚡ ❓ …)를 2칸으로 센다.
  - 검증: `grep -nE "['\"](cyan|green|red|yellow|gray|grey|blue|magenta|white|black)(Bright)?['\"]|#[0-9a-fA-F]{3,8}\b" mod/streambreak/hooks/views.tsx mod/streambreak/hooks/games/views.tsx mod/streambreak/hooks/register.tsx`의 결과가 비어 있다.
    - 범위를 view와 register로 좁힌 이유: `gomoku.ts`의 결과값 `'black'`/`'white'`는 색이 아니다. `git grep`은 추적되지 않은 파일을 보지 않으므로 `grep`을 쓴다.
    - 수정 전에는 10곳이 걸렸다.
  - 결과(2026-10-06):
    - grep 결과 없음
    - `claude plugin validate` 통과, `claude plugin test` 132/132(2.1.286), `tsc -p mod/streambreak` 0, `bun run check` 경고 32
    - V8 diff 비어 있음
    - 변이 검사: `EMOJI.test`를 빼면 D1 너비 테스트가 실패한다.
- [x] **D2 문구.** (done · verified: 아래 결과 + code-reviewer APPROVE, MEDIUM·LOW 지적 반영)
  - 위 표대로 `i18n.ts`를 고친다. 한국어는 해요체로 통일한다.
  - `newsOfflineEmpty` 추가: 오프라인이고 캐시도 없으면 `warning` 색으로 "불러오지 못했어요"를 보인다. 이때 메타 줄의 `offline` 문구는 숨겨서 오프라인 표시가 한 번만 나온다.
  - `gomokuTurn`이 돌 기호를 인자로 받는다(`GLYPHS.stones[1]`). D4에서 표면별 기호로 바뀌어도 문구가 따라간다.
  - 계획과 다른 점: `narrowGame`은 쓰는 곳이 생기는 D4에서 추가한다.
  - 영향받은 테스트:
    - `language.test.ts:112`: 토스트 정확 문자열
    - `legacy.test.ts:92`: 한국어 경고 문구
    - `news.test.ts`의 S8(오프라인·캐시 없음): 새 문구를 단언하도록 바꿨다. 기존 "No news yet" 단언은 반대로 "없어야 한다"로 바꿨다.
  - 결과(2026-10-06):
    - `claude plugin test` 132/132(2.1.286), `validate` 통과, `tsc` 0, `bun run check` 경고 32
    - 변이 검사: 오프라인 분기를 지우면 S8 테스트가 실패한다.
    - 리뷰 반영:
      - 영어 `legacyHooks`에서 제품 이름을 빼 80자 규칙과 "토스트에 streambreak를 반복하지 않는다" 주석에 맞췄다.
      - 오목 차례 문구 단언을 추가했다(F11).
    - 범위 밖으로 남긴 것: 새로고침이 예외로 끝나고 캐시도 없으면 오프라인이 아니라 "아직 뉴스가 없어요"로 보인다(`register.tsx` catch 경로, D2 이전부터 있던 동작).
- [x] **D3 레이아웃 고정.** (done · verified: 아래 결과 + code-reviewer COMMENT(사실상 APPROVE), 지적 반영 · 데스크탑에서 대기 줄 높이를 눈으로 보는 확인은 D6 사람 확인으로 넘김)
  - StatusSlot을 항상 1줄로 그린다.
    - 완료: 테두리 없는 `success` bold 1줄, key `banner`
    - 작업 중 / 대기: dim 1줄, key `status`. 대기는 공백이다.
  - 헤더, GameSelector, 지뢰 GameStatus 행에 `flexWrap`과 `columnGap={1}`을 준다(D0: `gap`을 쓰면 줄이 넘어갈 때 빈 줄이 생긴다).
  - `$.ui.open`에 `rows: 20`, `columns: 40`, `closeOnEscape: true`를 넣는다.
  - 결정 기록의 두 항목도 여기서 적용했다.
    - 헤더는 `☕`만 둔다.
    - 터미널의 선택된 탭과 게임에 `› ` 접두를 붙인다(`theme.ts`의 `selectedLabel(surface, label)`). 그래서 `chrome`과 `gameSelector`가 `surface`를 받는다.
  - 핫키는 넣지 않았다(사용자 결정).
  - 검증 테스트:
    - `lifecycle.test.ts`의 D3 상태 줄 테스트: chrome의 자식이 대기, 작업 중, 완료에서 모두 2개다(터미널과 데스크탑).
    - `lifecycle.test.ts`의 D3 선택 표시 테스트: 터미널은 `› News`, 데스크탑은 `News`다.
    - `pane.test.ts`의 F4: open 인자에 `rows`, `columns`, `closeOnEscape`가 들어 있다.
    - `language.test.ts`: 탭 라벨 기대값 8곳을 `› ` 접두로 바꿨다.
    - `bannerShown()`(key `banner`)은 그대로 동작한다.
  - 결과(2026-10-06):
    - `claude plugin test` 134/134(2.1.286), `validate` 통과, `tsc` 0, `bun run check` 경고 32
    - V8 diff 비어 있음
    - 변이 검사:
      - 대기 상태 줄을 지우면 D3 상태 줄 테스트가 실패한다.
      - `rows`를 지우면 F4 테스트가 실패한다.
  - 리뷰 반영:
    - 대기 줄은 NBSP(`\u00a0`)와 `minHeight={1}`로 그린다. DOM 렌더러에서 공백만 있는 줄이 0높이로 접히는 것을 막는다.
    - 선택되지 않은 탭과 게임 라벨도 터미널에서 2칸을 비워 둔다(`selectableLabel`). 선택이 바뀌어도 버튼이 움직이지 않는다.
    - `›`를 `GLYPHS.selected`로 옮겼다.
    - 상태 줄 테스트를 3표면 × 3상태로 넓혔다.
- [x] **D4 게임 판 색과 기호.** (done · verified: 아래 결과 + code-reviewer APPROVE(with comments), 지적 반영 · 데스크탑 격자 정렬과 데스크탑·모바일의 폭 하한은 D6 사람 확인으로 넘김)
  - 누를 수 없는 칸은 색 `Text`로 그린다. 테스트가 칸을 찾을 수 있도록 key를 단 Box로 감싼다(래퍼에 폭은 주지 않는다. D0 C2).
    - 지뢰의 열린 칸: 숫자는 `MINE_COLOR`, 빈칸은 dim, 지뢰는 `danger`
    - 오목의 돌: 내 돌은 `you`, AI 돌은 `accent`, 둘 다 bold
  - 계획보다 넓힌 것: **끝난 판은 칸을 누를 수 없다.** 지뢰가 끝나면 닫힌 칸도 dim Text가 되고, 오목이 끝나면 빈 교차점도 Text가 된다. 결과 줄에는 `[ 새 게임 ]`(key `game:new:result`)이 나온다. 메모리 카드는 계속 Button이다.
  - AI의 마지막 수는 bold와 underline으로 표시한다.
  - `glyphs(surface)`: terminal은 ASCII 세트를 쓴다. desktop, mobile, vscode는 rich 세트(`■ 🚩 💣 · ● ○`, 열린 빈칸은 NBSP)를 쓴다. 문구 안의 돌 기호도 같은 세트에서 읽는다.
  - 판별 폭 하한 `BOARD_COLUMNS`: 메모리 31, 지뢰 19, 오목 24. `bodyColumns`가 모자라면 그 게임만 `narrowGame` 문구를 보인다. 여기서 `narrowGame` 문자열을 추가했다.
  - 테스트:
    - 헬퍼: `labels(pane, game)`은 칸 key 정규식으로 Button과 keyed Box를 함께 모은다. `pressable(pane, game)`은 Button 칸만 센다. `cellText()`는 keyed 칸 안 Text의 props를 읽는다.
    - 기대 기호는 `glyphs(surface)`에서 읽는다(3표면).
    - 누를 수 있는 칸 수를 단언한다:
      - 오목: 시작 81, 한 수 뒤 79
      - 지뢰: 시작 64, 첫 오픈 뒤 닫힌 칸 수, 깃발을 꽂아도 같음, 끝나면 0
    - 새 테스트 4개: 지뢰 숫자 색, 끝난 판 + 새 게임 버튼, 마지막 수 밑줄, 판별 폭 하한(오목 23칸 → 안내 문구, 같은 폭에서 지뢰는 그려짐).
  - 결과(2026-10-06):
    - `claude plugin test` 138/138(2.1.286), `validate` 통과, `tsc` 0, `bun run check` 경고 32
    - V8 diff 비어 있음
    - 변이 검사 5개를 모두 해당 테스트가 잡았다:
      - 돌을 Button으로 되돌림
      - 밑줄 제거
      - 끝난 판을 다시 누를 수 있게 함
      - 폭 하한 제거
      - 숫자 색 제거
  - 리뷰 반영:
    - `MINE_COLOR`를 `tone` 역할로 구성했다. 4와 6만 원시 ANSI 이름이다(데스크탑이 라이트와 다크 모두에서 읽히는 색으로 바꿔 그린다. D0 스크린샷).
    - 판별 폭 경계 테스트를 3게임 모두 정확히 하한(그려짐)과 하한-1(안내)로 바꿨다. `<`를 `<=`로 바꾸는 변이도 잡는다.
    - 메모리를 끝까지 맞추는 테스트와 오목을 끝까지 두는 테스트를 추가했다. 끝나면 결과 옆 새 게임 버튼이 나오고, 오목은 누를 수 있는 칸이 0이 된다.
    - 열린 빈칸이 실제로 그려지는지(dim Text) 확인하고, 깃발을 다시 눌러 빼는 동작도 확인한다.
    - 결과: 141/141.
  - 남은 것(D6 사람 확인):
    - 데스크탑에서 버튼 칸(`■`)과 Text 칸(숫자, NBSP, 💣)이 섞인 행의 정렬
    - 데스크탑·모바일에서 `bodyColumns` 기준 폭 하한이 맞는지
    - 터미널에서 수를 둔 칸이 Text로 바뀐 뒤 포커스 링이 어디로 가는지
    - 지뢰 승리 판은 무작위 배치라 자동 테스트로 만들지 않았다. 승리와 패배는 같은 `isPlaying` 분기를 쓰고, 패배 경로는 테스트한다.
  - 기호 세트 메모: 끝난 지뢰 판의 닫힌 칸은 dim으로 그린다. 끝나서 더 누를 수 없다는 뜻이다(진행 중에는 기본색).
- [x] **D5 링크.** (done · verified: 아래 결과 + code-reviewer APPROVE, MEDIUM 2건 반영)
  - terminal:
    - 목록 줄은 `Text`로 그린다.
    - 대표 카드는 `<Text bold underline color={tone.text}>`로 감싼 `Link`다.
  - 다른 표면:
    - 목록 줄도 `Link`다.
    - 대표 카드는 `<Text bold>`로 감싼다(anchor 자체의 색을 살린다).
  - `tone.text`(테마 키 `text`)를 추가했다. 어두운 터미널에서 light 테마를 쓸 때 bold 제목이 사라지는 문제를 막는다(D0 H3).
  - `NewsView`가 `surface`를 받는다.
  - 테스트:
    - 카드는 Link 대신 key가 `card:<url>`인 Box로 찾는다.
      - `cardUrls`, `cardTitles` 헬퍼(news), `hrefs`(language)
      - `cardTitles`는 첫 자식에서 Link 라벨이나 텍스트를 읽는다.
    - F5/F6(3표면):
      - Link 수: 터미널 1, 그 외 4
      - 대표 제목 props: 터미널 `{ bold, underline, color: 'text' }`, 그 외 `{ bold }`
    - H1(안전하지 않은 링크 정규화)은 모든 카드가 Link인 desktop에 마운트해 확인한다.
  - 결과(2026-10-06):
    - 141/141, `validate` 통과, `tsc` 0, 경고 32, V8 diff 비어 있음
    - 변이 검사: 목록 줄을 다시 Link로 되돌리거나 밑줄을 빼면 F5/F6 terminal이 실패한다.
  - 리뷰 반영:
    - 밑줄은 `safeHref`가 받아 준 URL에만 긋는다. 그 밖의 URL(http, 빈 값, 너무 긴 값)은 링크가 아닌데 밑줄만 있는 가짜 단서가 된다. H1 회전에서 터미널 대표 제목의 밑줄과 Link 유무가 같은지 단언한다(항상 밑줄로 바꾸는 변이를 잡는다).
    - F5/F6은 Link의 href가 카드 URL 순서와 같은지도 단언한다(정규화된 href 검사를 복원).
  - 남긴 것: 터미널 목록 줄은 누를 수 없어서, 그 URL은 회전으로 대표 카드가 되었을 때만 열 수 있다. 계획에서 받아들인 대가다. 빈 URL 두 개가 같은 제목이면 카드 key가 겹칠 수 있다(D4 이전부터 있던 동작).
- [x] **D6 검증.** (done · verified: 아래 진행 기록. 자동 검사, code-reviewer APPROVE, 데스크탑(라이트/다크)·Ghostty 사용자 확인 · 모바일 실기기는 열린 질문)
  - 자동 검사:
    - `claude plugin validate mod/streambreak` (2.1.286 CLI)
    - `claude plugin test mod/streambreak` (2.1.286 CLI). 테스트 `SURFACES`에 `vscode`를 추가한다.
    - `tsc -p mod/streambreak`
    - `bun run check`, 경고 32개 유지
    - V7: `bun run test`, `cargo test --manifest-path src-tauri/Cargo.toml`
    - V8: `git diff --stat master -- src src-tauri`가 비어 있음
    - V10: `git grep -n "/Users[/]" -- mod plans AGENTS.md README.md README.ko.md`가 비어 있음
  - 변이 검사: 상태 줄 고정, 누를 수 있는 칸 수, terminal 목록 줄의 Link 제외를 지키는 코드를 하나씩 되돌려 보고, 해당 테스트가 실패하는지 확인한다.
  - 리뷰: 독립 code-reviewer가 통과시킨다.
  - 사람 확인:
    - 터미널: light, dark, 색약 보정 하나, ANSI 하나
    - 데스크탑 1장
    - 모바일 1장(가능하면)
  - 엔진을 올릴 때마다 테마 키 이름을 다시 확인한다.
  - 진행 기록 (D6):
    - 자동 검사 (2026-10-07, 2.1.286):
      - 테스트 `SURFACES`에 `vscode`를 추가해 145/145
      - `validate --strict`, `validate .` 통과, `tsc` 0, `bun run check` 경고 32
      - V7: `bun run test` 12, `cargo test` 10
      - V8 diff 비어 있음, V10 결과 없음
    - 엔진 2.1.295로 올라감 (2026-10-13): 145/145, `validate` 통과. 테마 키 7개(`claude suggestion promptBorder success error warning text`)가 바이너리에 그대로 있다.
    - 사람 확인 (데스크탑, 2026-10-13): `Esc`로 닫았다 다시 열어도 게임 판이 그대로다(사용자 확인).
    - 사람 확인 (데스크탑, 2026-10-13): 패널을 연 채로 턴이 시작되어 상태 줄이 바뀌어도 게임 판이 밀리지 않는다(사용자 확인. D3 데스크탑 대기 줄 높이 확인을 겸한다).
    - 사람 확인 (데스크탑 다크, 2026-10-13): 색은 의도대로 나왔다(지뢰 숫자 1 파랑 2 초록 3 빨강 4 자홍, 내 돌 파랑 ●, AI 돌 주황 ○, 마지막 수 밑줄, 끝난 판과 결과 옆 새 게임). **하지만 판 정렬이 깨졌다.** 데스크탑은 비례 글꼴이라, `gap`만으로 둔 칸은 💣, ■, 숫자, NBSP의 폭 차이로 열이 어긋났다. 오목은 열 이름이 한 칸 왼쪽으로 밀렸다.
    - 수정 (D6):
      - rich 기호 세트에 `cellWidth: 3`을 둔다. 판의 모든 칸, 열 이름, 행 번호, 여백을 `width 3` + 가운데 정렬 Box(slot)에 넣는다. 행 간격은 0이다.
      - 누를 수 있는 칸은 slot Box(key `<cell>:slot`) 안에 Button(key `<cell>`)을 둔다.
      - 터미널은 그대로다.
      - 폭 하한은 `boardColumns(game, glyphs)`로 표면별로 계산한다. rich에서 지뢰는 8×3+4 = 28, 오목은 10×3+4 = 34, 메모리는 31이다.
      - 테스트: 3게임×2표면 폭 경계, 데스크탑 slot props(width, 가운데 정렬), 터미널에는 slot이 없음. 149/149(2.1.295).
    - 리뷰 반영(code-reviewer APPROVE):
      - 위 "판의 칸 배치" 규칙을 D6 기준으로 고쳤다.
      - 폭 하한 숫자 6개를 리터럴로 고정했다(경계 테스트가 같은 함수로 기대값을 계산하는 순환을 끊기 위해).
      - 오목 열 이름과 놓을 자리의 slot도 단언한다.
    - 열린 질문: 모바일 오목의 하한이 24에서 34로 올라갔다. 모바일 `bodyColumns`가 34보다 작으면 모바일에서는 오목 대신 안내 문구가 나온다. 모바일 실기기 확인이 필요하다.
    - 재확인 (데스크탑 다크, 2026-10-16, 사용자 캡처): 지뢰찾기의 8열이 ■, 숫자, 빈칸 모두 반듯하게 맞는다. 오목의 열 이름 a–i와 행 번호가 점·돌과 같은 열에 있다. → 정렬 확인 완료.
    - 사람 확인 (Ghostty 다크, 엔진 v2.1.295, 2026-10-17, 사용자 캡처):
      - 헤더는 좁은 폭에서 두 줄로 나뉜다(`☕ [   뉴스 ] [ › 게임 ]` / `[ English ] [ 닫기 ]`). `columnGap` 덕분에 사이에 빈 줄이 없다.
      - 선택 표시 `›`가 보인다. 선택되지 않은 라벨은 2칸 여백을 유지해서 버튼 위치가 고정된다.
      - 게임 선택 줄은 `[ 새 게임 ]`이 다음 줄로 넘어가고, 빈 줄이 없다.
      - 지뢰판은 8열이 정렬되고 숫자 색(1 파랑, 2 초록, 3 빨강)이 나온다. `.`은 dim, `#`은 기본색이다.
      - 한글 버튼 라벨의 글자 사이가 벌어져 보이는 것은 글꼴의 셀 폭 문제다(D0과 같고, 우리와 무관).

## 열린 질문

- **데스크탑이 테마 키를 해석하지 못하면?**
  - `tone`이 표면별로 값을 고르게 한다.
  - 그 경우 desktop에는 원시 이름을 쓴다. hex 금지 원칙은 유지한다.
  - D0 (a)의 결과로 정한다.
- **모바일 칸 크기.** 64칸의 네이티브 버튼을 손가락으로 누를 수 있는지는 D0에서 본다. 너무 작으면 모바일에서는 지뢰찾기를 6×6으로 줄이는 안을 검토한다(이번 범위 밖).
- **화면 읽기 도구(접근성).** Button에는 접근성 라벨 prop이 없다. 칸 라벨이 기호 그대로 읽힌다(`#`, `F`). GameStatus 줄이 게임 상태를 말로 전하게 하는 것까지가 이번 범위다.
