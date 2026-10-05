import type { Language } from '../types'

export type { Language }

const en = {
  // Desktop prefixes toasts with the plugin name, so toasts never repeat "streambreak".
  suggest: 'Break time — run /streambreak',
  opened: 'streambreak pane opened.',
  legacyHooks:
    'The desktop app’s hooks are still in your Claude Code settings.json — remove its show / hide / timer hook commands, or both will pop up.',
  notPlaced: (reason: string) =>
    `Pane is waiting to be shown (${reason}). Widen the terminal or update the desktop app.`,
  done: '✓ Claude finished — back to work',
  news: 'News',
  games: 'Games',
  close: 'Close',
  switchLanguage: '한국어',
  ago: { justNow: 'just now', minutes: 'm', hours: 'h', days: 'd' },
  working: '⏳ Claude is working…',
  newsPosition: (position: number, total: number) => `${position} / ${total}`,
  newsEmpty: 'No news yet.',
  loading: 'Loading news…',
  offline: 'Offline — showing the last saved news',
  gamesEmpty: 'Pick a game.',
  memory: 'Memory',
  gomoku: 'Gomoku',
  newGame: 'New game',
  memoryStatus: (moves: number, seconds: number) => `Moves ${moves} · ${seconds}s`,
  memoryDone: (moves: number, seconds: number) => `Complete! ${moves} moves in ${seconds}s`,
  gomokuTurn: (lastAi: string | null) =>
    lastAi ? `AI played ${lastAi} — your turn (X)` : 'Your turn (X)',
  gomokuResult: { black: 'You win!', white: 'AI wins', draw: 'Draw' },
  minesweeper: 'Mines',
  minesStatus: (flagsLeft: number) => `Mines left ${flagsLeft}`,
  minesResult: { won: 'Cleared!', lost: 'Boom — try again' },
  minesMode: { open: 'Mode: open', flag: 'Mode: flag' },
}

const ko: typeof en = {
  suggest: '휴식 시간 — /streambreak',
  opened: 'streambreak 패널을 열었습니다.',
  legacyHooks:
    '데스크탑 앱의 훅이 Claude Code settings.json에 남아 있습니다 — show / hide / timer 훅 명령을 지우지 않으면 둘 다 뜹니다.',
  notPlaced: (reason: string) =>
    `패널이 표시 대기 중입니다(${reason}). 터미널을 넓히거나 데스크탑 앱을 업데이트하세요.`,
  done: '✓ 작업 완료 — 돌아갈 시간',
  news: '뉴스',
  games: '게임',
  close: '닫기',
  switchLanguage: 'English',
  ago: { justNow: '방금', minutes: '분', hours: '시간', days: '일' },
  working: '⏳ Claude가 작업 중…',
  newsPosition: (position: number, total: number) => `${position} / ${total}`,
  newsEmpty: '아직 뉴스가 없습니다.',
  loading: '뉴스를 불러오는 중…',
  offline: '오프라인 — 마지막으로 저장된 뉴스입니다',
  gamesEmpty: '게임을 고르세요.',
  memory: '메모리',
  gomoku: '오목',
  newGame: '새 게임',
  memoryStatus: (moves: number, seconds: number) => `${moves}수 · ${seconds}초`,
  memoryDone: (moves: number, seconds: number) => `완료! ${moves}수, ${seconds}초`,
  gomokuTurn: (lastAi: string | null) =>
    lastAi ? `AI가 ${lastAi}에 둠 — 당신 차례 (X)` : '당신 차례 (X)',
  gomokuResult: { black: '승리!', white: 'AI 승리', draw: '무승부' },
  minesweeper: '지뢰찾기',
  minesStatus: (flagsLeft: number) => `남은 지뢰 ${flagsLeft}`,
  minesResult: { won: '성공!', lost: '펑 — 다시 해 보세요' },
  minesMode: { open: '모드: 열기', flag: '모드: 깃발' },
}

export type Strings = typeof en

export const strings = (language: Language): Strings => (language === 'ko' ? ko : en)
