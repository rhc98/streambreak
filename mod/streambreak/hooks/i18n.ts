import type { Language } from '../types'

export type { Language }

const en = {
  // Desktop prefixes toasts with the plugin name, so toasts never repeat "streambreak".
  suggest: 'Claude is on it — /streambreak for a break',
  opened: 'streambreak pane opened',
  legacyHooks: 'Old app hooks are still in settings.json — remove them or both pop up',
  notPlaced: (reason: string) =>
    `Pane is waiting (${reason}) — widen the terminal or update the app`,
  done: '✓ Claude is done — back to work',
  news: 'News',
  games: 'Games',
  close: 'Close',
  switchLanguage: '한국어',
  ago: { justNow: 'just now', minutes: 'm', hours: 'h', days: 'd' },
  working: '⎿ Claude is working…',
  newsPosition: (position: number, total: number) => `${position} / ${total}`,
  newsEmpty: 'No news yet',
  newsOfflineEmpty: 'Offline — couldn’t load news',
  loading: 'Loading news…',
  offline: 'Offline — saved news',
  gamesEmpty: 'Pick a game',
  memory: 'Memory',
  gomoku: 'Gomoku',
  newGame: 'New game',
  memoryStatus: (moves: number, seconds: number) => `Moves ${moves} · ${seconds}s`,
  memoryDone: (moves: number, seconds: number) => `All matched! ${moves} moves in ${seconds}s`,
  gomokuTurn: (lastAi: string | null, stone: string) =>
    lastAi ? `AI played ${lastAi} — your move (${stone})` : `Your move (${stone})`,
  gomokuResult: { black: 'You win!', white: 'AI wins', draw: 'Draw' },
  minesweeper: 'Mines',
  minesStatus: (flagsLeft: number) => `Mines left ${flagsLeft}`,
  minesResult: { won: 'Cleared!', lost: 'Boom — try again' },
  minesMode: { open: 'Mode: open', flag: 'Mode: flag' },
}

const ko: typeof en = {
  suggest: 'Claude가 작업 중이에요 — 쉬려면 /streambreak',
  opened: 'streambreak 패널을 열었어요',
  legacyHooks: '예전 앱 훅이 settings.json에 남아 있어요 — 지우지 않으면 둘 다 떠요',
  notPlaced: (reason: string) =>
    `패널이 대기 중이에요(${reason}) — 터미널을 넓히거나 앱을 업데이트해 주세요`,
  done: '✓ Claude가 끝냈어요 — 돌아갈 시간이에요',
  news: '뉴스',
  games: '게임',
  close: '닫기',
  switchLanguage: 'English',
  ago: { justNow: '방금', minutes: '분', hours: '시간', days: '일' },
  working: '⎿ Claude가 작업 중이에요',
  newsPosition: (position: number, total: number) => `${position} / ${total}`,
  newsEmpty: '아직 뉴스가 없어요',
  newsOfflineEmpty: '오프라인이라 뉴스를 불러오지 못했어요',
  loading: '뉴스를 불러오는 중…',
  offline: '오프라인 — 저장된 뉴스예요',
  gamesEmpty: '게임을 골라 보세요',
  memory: '메모리',
  gomoku: '오목',
  newGame: '새 게임',
  memoryStatus: (moves: number, seconds: number) => `${moves}수 · ${seconds}초`,
  memoryDone: (moves: number, seconds: number) => `다 맞혔어요! ${moves}수, ${seconds}초`,
  gomokuTurn: (lastAi: string | null, stone: string) =>
    lastAi ? `AI가 ${lastAi}에 뒀어요 — 둘 차례예요 (${stone})` : `둘 차례예요 (${stone})`,
  gomokuResult: { black: '승리!', white: 'AI 승리', draw: '무승부' },
  minesweeper: '지뢰찾기',
  minesStatus: (flagsLeft: number) => `남은 지뢰 ${flagsLeft}`,
  minesResult: { won: '성공!', lost: '펑 — 다시 해 보세요' },
  minesMode: { open: '모드: 열기', flag: '모드: 깃발' },
}

export type Strings = typeof en

export const strings = (language: Language): Strings => (language === 'ko' ? ko : en)
