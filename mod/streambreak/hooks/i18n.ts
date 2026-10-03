export type Language = 'en' | 'ko'

const en = {
  // Desktop prefixes toasts with the plugin name, so toasts never repeat "streambreak".
  suggest: 'Break time — run /streambreak',
  opened: 'streambreak pane opened.',
  notPlaced: (reason: string) =>
    `Pane is waiting to be shown (${reason}). Widen the terminal or update the desktop app.`,
  done: '✓ Claude finished — back to work',
  news: 'News',
  games: 'Games',
  close: 'Close',
  newsEmpty: 'No news yet.',
  loading: 'Loading news…',
  offline: 'Offline — showing the last saved news',
  gamesEmpty: 'Games are coming soon.',
}

const ko: typeof en = {
  suggest: '휴식 시간 — /streambreak',
  opened: 'streambreak 패널을 열었습니다.',
  notPlaced: (reason: string) =>
    `패널이 표시 대기 중입니다(${reason}). 터미널을 넓히거나 데스크탑 앱을 업데이트하세요.`,
  done: '✓ 작업 완료 — 돌아갈 시간',
  news: '뉴스',
  games: '게임',
  close: '닫기',
  newsEmpty: '아직 뉴스가 없습니다.',
  loading: '뉴스를 불러오는 중…',
  offline: '오프라인 — 마지막으로 저장된 뉴스입니다',
  gamesEmpty: '게임은 곧 추가됩니다.',
}

export type Strings = typeof en

export const strings = (language: Language): Strings => (language === 'ko' ? ko : en)
