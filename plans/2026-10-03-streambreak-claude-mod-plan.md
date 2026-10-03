# [streambreak → Claude Mod 이식 계획]

지금 streambreak은 Tauri 팝업 윈도우, axum 데몬(`:19840`), 그리고 `streambreak init`이 `~/.claude/settings.json`에 박는 Claude Code 훅(PreToolUse / Notification / Stop)으로 돌아간다. 쓰려면 brew 설치, 데몬 상주, 훅 등록이 필요하고 macOS 윈도우 이슈(Space bug 등)도 따라온다. 이번 주 출시된 Claude Mods(plugin-authoring 스펙, 이 빌드 기준 2.1.286)는 터미널과 데스크탑 Code 탭 안에 Pane / Toast / Client UI를 직접 그리고 `turn.start`, `turn.complete`, `$.clock`, `$.http.fetch`, `$.store`를 제공한다. 그래서 데몬, 훅 등록, 윈도우 제어가 전부 필요 없어지고, 플러그인 하나를 켜는 것으로 같은 경험이 가능해진다.

조사로 확인한 것 (모두 `types/claude-code.d.ts`와 `reference.md` 근거):
- **Pane 자동 오픈 제약**: 타이머처럼 사용자 행동 없이 연 Pane은 터미널 144열 미만에서 그려지지 않고 대기하고, 구형 데스크탑은 Pane 자체를 못 놓는다(`isPlaced:false`). 그래서 타이머는 **토스트로 제안**만 하고, Pane은 사용자 행동(`/streambreak`, 버튼)으로 연다. 사용자 행동으로 열면 어떤 폭에서도 놓인다.
- **`turn.complete`는 서브에이전트 턴에서도 발생**한다(`agentId` 있음, `turn.start`는 없음). 중단은 `isAborted`로 구분한다. 메인 루프만 처리해야 한다.
- `/clear`는 `session.end(reason:'clear')`만 오고 `session.start`는 다시 오지 않는다. 핫리로드나 설정 변경은 모듈 변수와 `$.clock` 타이머를 날리고 `$.state`/`$.store`만 남긴다.
- 피드(hnrss, TechCrunch, GeekNews)는 전부 XML인데 Mod 환경에는 DOM도 Node도 없다. 최소 RSS/Atom 파서를 직접 쓴다.
- 기존 앱 기본값: threshold 10s, rotation 15s, fade-out 3s, max_items 10, Memory Match 8쌍, Minesweeper 8×8 / 지뢰 10, Gomoku 9×9 5목 + AI. 이 값을 그대로 이식한다.

설계 결정:
1. 기존 Tauri 앱(`src/`, `src-tauri/`)은 **건드리지 않고** Mod를 추가한다. 다른 도구(Codex 등)용으로 앱이 계속 쓸모 있다.
2. 게임 상태는 `$.state` atom에 둔다(탭 전환, 핫리로드에도 생존). 렌더는 hooks 모듈의 Box / Button 격자로 한다. `Client`(키보드 `onKey`)는 키보드 커서 UX가 필요해질 때만 도입한다.
3. 게임 로직은 mod 안에 순수 TS로 **복제 포팅**한다(Mod는 플러그인 폴더 밖 파일을 import할 수 없음). 앱과의 공유화는 후속 과제.
4. 영속 데이터(피드 캐시, 언어 오버라이드)는 `$.store`, 일시 상태는 `$.state`.
5. **정본은 이 레포의 `mod/streambreak/` 하나**다. 코드 정본은 `~/testbed` 아래 체크아웃이고 GitHub `rhc98/streambreak`로 push된다. `~/.claude/dev-mods/<session-id>/…`(세션마다 새 폴더), 설치 캐시, 원격 세션의 체크아웃은 전부 정본에서 파생된 것이라 복사본을 직접 고치지 않는다. 개발 로드는 정본을 가리키는 링크나 `--plugin-dir`로, 배포 설치는 레포 루트 marketplace(`.claude-plugin/marketplace.json`, source `./mod/streambreak`)로 같은 정본을 읽는다. 정본 파일과 문서에는 사용자 홈 절대경로를 쓰지 않는다.
6. 원격(모바일 포함) 표면에서도 돌도록 `Box / Text / Button / Link / Markdown`만 쓴다. `Input`, `Select`, `Client`는 mobile 표면 표에 없다.

미검증 가정 3개는 F1에서 먼저 확인한다: ① Pane이 데스크탑 Code 탭에서 실제로 뜨는지, ② `classic.Notification` 훅이 가능한지, ③ 정본 폴더를 세션 dev-mods 폴더에 symlink해도 핫리로드되는지(안 되면 CLI는 `--plugin-dir`, 데스크탑은 `~/.claude/settings.json`의 `env`에 `CLAUDE_CODE_PLUGIN_DIRS` + `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` — 전역 설정 변경이라 사용자 승인 후). API는 early access라 릴리스마다 바뀔 수 있다.

기존 레포 설정과의 충돌 지점 (확인 완료):
- `vitest.config.ts`에 `include`가 없어 `mod/**/*.test.ts`(`claude-code/testing`을 import)를 주워 `bun run test`를 깨뜨릴 수 있다. 플러그인 테스트는 `claude plugin test` 전용으로 두고 vitest에서 제외한다.
- `biome.json`의 `includes`는 `src/**, *.ts, *.tsx, *.json`이라 `mod/`는 CI lint 대상이 아니다. 포함할지 F2에서 결정한다.
- `release.yml`은 `v*` 태그에 반응한다. Mod 릴리스는 `claude plugin tag`의 `streambreak--v<ver>` 형식만 쓰고, `v0.x.x`는 앱 릴리스를 트리거하므로 쓰지 않는다.
- `ci.yml`은 `bun run check / test`와 `cargo test`만 돌린다. `claude plugin validate / test`는 로컬 게이트이고 CI 편입은 별도 결정이다.

진행 순서 제안: **P0** = F1–F7(뼈대와 뉴스 경로), **P1** = F8, F9, F11(게임), **P2** = F10, F12–F14, **P3** = F15, F16.

---

## 기능 목록

- [ ] F1 (P0) 스파이크 — 미검증 가정 3개 확인, 결과를 이 항목 아래에 기록: (a) Pane의 `isPlaced`가 데스크탑 Code 탭과 터미널(<144열 / ≥144열)에서 어떻게 나오는지, (b) `classic.Notification` 훅 가능 여부, (c) 정본 `mod/streambreak`를 세션 dev-mods 폴더에 symlink했을 때 핫리로드 가능 여부(불가 시 `--plugin-dir` / `CLAUDE_CODE_PLUGIN_DIRS` 중 개발 로드 방식 결정)
- [ ] F2 (P0) Mod 골격 — 정본 `mod/streambreak/`에 직접 생성: `.claude-plugin/plugin.json`(name `streambreak`, `types` 지정), `hooks/hooks.json`, `hooks/register.tsx`, `types/index.d.ts`(`PluginState.streambreak` 계약: phase, tab, 뉴스 인덱스, 게임 상태). 함께 vitest가 `mod/**`를 줍지 않게 `exclude` 설정, biome `includes`에 `mod/**`를 넣을지 결정
- [ ] F3 (P0) 휴식 제안 타이머 — 메인 루프 `turn.start` 후 threshold(기본 10s)가 지나도 턴이 진행 중이면 `$.clock.after`로 토스트 "휴식 시간 — /streambreak" 1회(턴당 1회)
- [ ] F4 (P0) `/streambreak` 커맨드(`session.start`에서 등록) + 탭형 Pane 셸(뉴스 / 게임 / 닫기). 사용자 행동으로만 연다
- [ ] F5 (P0) 피드 수집 — `$.http.fetch` + 최소 RSS/Atom 파서(hnrss, TechCrunch, GeekNews), 발행일 내림차순, max_items 10, `$.store` TTL 캐시
- [ ] F6 (P0) 뉴스 탭 UI — 5개 카드 목록, `Link`로 원문 열기, `$.clock.every` 15s 로테이션
- [ ] F7 (P0) 완료 배너 — 메인 루프 `turn.complete`(중단 아님) 시 Pane에 "작업 완료" 표시. 키보드를 쥐고 있으면(게임 중) 유지, 아니면 fade-out 3s 후 `$.ui.close`
- [ ] F8 (P1) Memory Match — 8쌍 16장, Button 카드, 불일치 되돌리기 지연은 `$.clock.after`, 소요 시간 표시
- [ ] F9 (P1) Gomoku 9×9 vs AI — `createBoard / checkWin / evaluateLine / scorePosition / aiMove` 순수 로직 포팅, Button 격자
- [ ] F10 (P2) Minesweeper 8×8 / 지뢰 10 — 열기와 깃발 모드 토글 Button, flood fill, 승패 판정
- [ ] F11 (P1) 게임 탭 — 게임 선택기(진입 시 랜덤 시작), 새 게임 버튼, 진행 상태 보존
- [ ] F12 (P2) `userConfig` — threshold_seconds, language(en/ko 선택), rotation_seconds, fade_out_delay_ms (기존 `config.toml` 대응)
- [ ] F13 (P2) Pane 안 언어 토글(EN ↔ KO) — `$.store` 오버라이드
- [ ] F14 (P2) 권한 프롬프트 / idle 알림 시 즉시 휴식 제안(기존 Notification 훅과 동등). F1(b) 결과에 따라 보류 가능
- [ ] F15 (P3) 레거시 공존 경고 — `session.start`에서 `$.fs`로 `~/.claude/settings.json`을 읽어 `streambreak` 훅이 남아 있으면 토스트 1회(팝업 이중 방지 안내)
- [ ] F16 (P3) 배포 및 문서 — 레포 루트 `.claude-plugin/marketplace.json`(source `./mod/streambreak`)으로 정본 기반 설치 경로를 만들고, `claude plugin marketplace add`(로컬 경로와 `rhc98/streambreak` 둘 다) 후 `claude plugin install`이 되는지 확인, README.md / README.ko.md에 Mod 섹션, AGENTS.md 갱신, 릴리스 태그 규칙(`claude plugin tag`) 기록

---

## 혼합 상태

- [ ] S1 Pane이 열려 있고 게임 진행 중에 `turn.complete`가 도착하면 게임 상태를 유지한 채 배너만 얹고, 키보드를 쥐고 있으면 자동 닫기를 미룬다 (F7 × F8·F9·F10·F11)
- [ ] S2 Pane이 이미 열려 있을 때 새 `turn.start`가 오면 배너를 해제하고 제안 토스트는 다시 띄우지 않는다 (F3 × F4 × F7)
- [ ] S3 서브에이전트 턴(`agentId` 있음)의 `turn.complete`는 무시한다 — 메인 턴의 타이머와 배너에 영향이 없어야 한다 (F3 × F7)
- [ ] S4 threshold 전에 `turn.complete`가 오면 대기 중인 타이머를 취소해 늦은 토스트가 나오지 않게 하고, `isAborted`(중단)이면 배너 없이 조용히 정리한다 (F3 × F7)
- [ ] S5 Pane이 놓이지 못하면(`isPlaced:false`, 구형 데스크탑 등) 열렸다고 가정하지 않고 사유와 대안을 토스트로 안내하며, 재시도 루프는 돌지 않는다 (F4)
- [ ] S6 언어가 바뀌면(Pane 토글 또는 설정 변경) 피드 캐시는 언어별로 분리하고 인덱스를 0으로 리셋하고 새 언어로 다시 fetch한다(기존 `onToggleLanguage`와 동일). 우선순위는 Pane 토글(`$.store`) > `userConfig`이고, 설정 메뉴에서 값을 바꾸면 오버라이드를 지운다 (F5 × F6 × F12 × F13)
- [ ] S7 핫리로드나 설정 변경으로 모듈이 재로드되면 모듈 변수와 `$.clock` 타이머가 사라지므로, `session.start`에서 phase, 로테이션 타이머, 대기 중 전이를 재무장하거나 정리한다. `$.state`의 게임 보드는 유지한다 (F3 × F6 × F8)
- [ ] S8 피드 fetch가 실패하거나 오프라인이면 마지막 캐시로 로테이션을 계속하고 "오프라인"을 표기한다. TTL 전에는 재시도하지 않고, 캐시도 없으면 빈 상태 문구를 보여준다 (F5 × F6)
- [ ] S9 타이머성 게임 전이(Memory 불일치 되돌리기, 소요 시간 tick)가 Pane 닫힘과 겹쳐도 카드가 뒤집힌 채 굳지 않는다 — 닫히면 tick을 멈추고, 재오픈이나 재로드 시 대기 전이를 해소한다 (F8 × F4 × S7)
- [ ] S10 `/clear`는 `session.end(reason:'clear')`만 오고 `session.start`가 오지 않으므로, phase와 배너 초기화는 `session.end`에서 처리한다(게임 보드는 유지) (F3 × F7)

---

## 검증 방법

- [ ] V1 `claude plugin validate mod/streambreak` — 에러 0 (매니페스트, hooks 모듈, `$.state` 키가 `types/index.d.ts` 계약과 일치)
- [ ] V2 타입체크 — `/plugin-types`로 `.claude/types` 생성 후 d.ts 헤더의 tsconfig로 `tsc --noEmit` 통과
- [ ] V3 `claude plugin test` 순수 로직 — Gomoku(즉승 수 선택, 차단), Minesweeper(flood fill, 승패), Memory(일치 / 불일치), 피드 파서(고정 픽스처 3종 → `{title,url,source,icon,published_at}`, 정렬, max_items 10)
- [ ] V4 `claude plugin test` 훅 시나리오 — 가짜 시계로 S2–S4, S7, S10 재현: threshold 후 토스트 1회, 조기 `turn.complete` / 중단 시 토스트 없음, 서브에이전트 `turn.complete` 무시, 재로드 후 재무장, `/clear` 후 phase 초기화
- [ ] V5 `claude plugin test` UI 마운트를 `['terminal','desktop','mobile']` 모두에서 통과 — Pane 렌더, 탭 전환, Button 동작, 트리 검증 거부 없음 (S1, S5, S6, S8, S9)
- [ ] V6 헤드리스 로드 스모크 — `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude -p --plugin-dir mod/streambreak "hi"` 종료코드 0, stderr에 load / refused 문구 없음
- [ ] V7 기존 앱 회귀 없음 — `bun run check && bun run test` 및 `cargo test --manifest-path src-tauri/Cargo.toml` 통과(vitest가 `mod/**`를 줍지 않음 포함, biome에 `mod/**`를 넣었다면 그것도 통과)
- [ ] V8 Tauri 앱 무변경 — `git diff --stat master..HEAD -- src src-tauri`가 비어 있음
- [ ] V9 정본 설치 경로 — `claude plugin validate .`(레포 루트 marketplace) 에러 0, `claude plugin validate mod/streambreak --strict` 통과
- [ ] V10 이식성 — `git grep -n "/Users[/]" -- mod plans AGENTS.md README.md README.ko.md`가 비어 있음 (원격 체크아웃에서도 동작; 패턴을 `[/]`로 써서 이 줄 자신은 걸리지 않음)
- [ ] V11 릴리스 격리 — `git tag --list`에 `v*` 형식의 Mod 태그가 없고 Mod 태그는 `streambreak--v*` 형식만 존재 (`release.yml`의 `v*` 트리거 보호)

---

## 테스트 환경

- [ ] E1 빌드 차이 확인 — 셸 `claude --version`은 2.1.282이고 데스크탑 번들 엔진(플러그인 작성 스킬의 d.ts 기준)은 2.1.286이다. 둘 다 `claude plugin validate / test`는 있다(셸에서 확인). d.ts는 2.1.286 기준이므로 셸 쪽 동작 차이에 주의하고, 구형 데스크탑이면 `isPlaced:false` 사유가 나온다
- [ ] E2 개발 로드 준비 — 새 세션에서 `plugin-authoring` 스킬을 다시 로드(세션마다 `~/.claude/dev-mods/<session-id>/` 폴더가 새로 생김)하고, 정본 `mod/streambreak`를 그 폴더에 링크한 뒤 뜨는 "Enable hot reloading for this session?"에 사용자가 `Enable for this session` 응답. 링크가 안 먹으면 F1(c)의 대안을 쓴다
- [ ] E3 네트워크 — `curl -sI https://hnrss.org/frontpage https://techcrunch.com/feed/ https://news.hada.io/rss/news` 가 모두 200
- [ ] E4 피드 픽스처 확보 — 위 3개 피드의 샘플 XML을 `mod/streambreak/fixtures/`에 저장 (V3 입력)
- [ ] E5 수동 확인 표면 — Claude 데스크탑 Code 탭 1개, 터미널 2가지 폭(≥144열 / <144열), fullscreen 레이아웃 on/off
- [ ] E6 이중 팝업 방지 — F15 전까지 개발 중에는 `~/.claude/settings.json`에 레거시 `streambreak` 훅이 없거나 Tauri 데몬이 꺼져 있음(`grep streambreak ~/.claude/settings.json`, `pgrep -fl streambreak`)

---

<!--
체크박스 3상태:
- [ ]  미착수
- [/]  진행중  → "- [/] F2 상세 내역 클릭 시 모달로 표시 (in-progress · owner: agent-2)"
- [x]  완료    → "- [x] F2 상세 내역 클릭 시 모달로 표시 (done · verified: build+test · owner: agent-2)"

완료 처리 시 verified: 근거 없이 체크만 하는 것은 금지.
-->
