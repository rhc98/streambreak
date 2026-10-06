import type { EngineInterface, Register, UiPane } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type {
  GameKind,
  GomokuState,
  Language,
  MemoryState,
  MinesState,
  NewsFeed,
  Phase,
  Tab,
} from '../types'
import {
  asFeedCache,
  cacheKey,
  FEEDS,
  FETCH_TIMEOUT_MS,
  type FeedSource,
  isFresh,
  parseFeed,
  settleFetches,
  visibleWindow,
} from './feed'
import { newGomoku, playTurn } from './games/gomoku'
import { FLIP_BACK_MS, flip, newMemory, settleMismatch } from './games/memory'
import { newMines, press as pressMine, toggleMode } from './games/minesweeper'
import {
  AVAILABLE_GAMES,
  BOARD_COLUMNS,
  gameSelector,
  gomokuView,
  memoryView,
  minesView,
} from './games/views'
import { strings } from './i18n'
import { hasLegacyHooks } from './legacy'
import { DEFAULT_SETTINGS, resolveLanguage, type Settings, settingsFrom } from './settings'
import { glyphs } from './theme'
import { chrome, newsView } from './views'

// $.state refs must be declared in the file that reads or writes them (validate's scan rule),
// so every state access stays in this file; other modules hold pure logic and drawing.
const PANE = 'streambreak'
// F12: the userConfig values (legacy config.toml defaults), set by register() on every load.
let settings: Settings = DEFAULT_SETTINGS
// $.store keys: the pane toggle's language override, and the setting it was made against (S6).
const LANGUAGE_OVERRIDE = 'language'
const LANGUAGE_CONFIGURED = 'config:language'

const phase = atom({ plugin: 'streambreak', key: 'phase' } as const, 'idle' as Phase)
const turnId = atom({ plugin: 'streambreak', key: 'turnId' } as const, null as string | null)
const turnStartedAt = atom(
  { plugin: 'streambreak', key: 'turnStartedAt' } as const,
  null as number | null,
)
const tab = atom({ plugin: 'streambreak', key: 'tab' } as const, 'news' as Tab)
const language = atom({ plugin: 'streambreak', key: 'language' } as const, 'en' as Language)
const news = atom(
  { plugin: 'streambreak', key: 'news' } as const,
  {
    items: [],
    isOffline: false,
    isLoading: false,
  } as NewsFeed,
)
const newsIndex = atom({ plugin: 'streambreak', key: 'newsIndex' } as const, 0)
const game = atom({ plugin: 'streambreak', key: 'game' } as const, null as GameKind | null)
const memory = atom({ plugin: 'streambreak', key: 'memory' } as const, null as MemoryState | null)
const gomoku = atom({ plugin: 'streambreak', key: 'gomoku' } as const, null as GomokuState | null)
const isLegacyWarned = atom({ plugin: 'streambreak', key: 'isLegacyWarned' } as const, false)
const minesweeper = atom(
  { plugin: 'streambreak', key: 'minesweeper' } as const,
  null as MinesState | null,
)

// Timers die with the module on a reload; session.start re-arms them from $.state (S7).
type Timer = { cancel: () => void }
let suggestTimer: Timer | undefined
let fadeTimer: Timer | undefined
let rotationTimer: Timer | undefined
let refreshing: Promise<void> | undefined
let flipBackTimer: Timer | undefined
let elapsedTimer: Timer | undefined

const ourPane = async ($: EngineInterface) => (await $.ui.panes()).find(pane => pane.id === PANE)
const stringsFor = async ($: EngineInterface) => strings(await read($, language))

// The person can see it: placed (not waiting on width or an older desktop) and the front tab.
const isVisible = (pane: UiPane | undefined) => pane?.isShown === true && pane.isPlaced

// Moves phase only when it still stands at `from`, inside one versioned update, so a timer that
// woke up late never overwrites a transition another hook made meanwhile. True when it moved.
const transition = async ($: EngineInterface, from: Phase, to: Phase) => {
  let moved = false
  await update($, phase, current => {
    moved = current === from
    return moved ? to : current
  })

  return moved
}

const setIdle = async ($: EngineInterface) => {
  suggestTimer?.cancel()
  fadeTimer?.cancel()
  await update($, turnId, () => null)
  await update($, turnStartedAt, () => null)
  await update($, phase, () => 'idle' as Phase)
}

// F3: offer a break once per main turn when it outlasts the threshold.
const armSuggest = ($: EngineInterface, id: string, delayMs: number) => {
  suggestTimer?.cancel()
  suggestTimer = $.clock.after(Math.max(0, delayMs), () => {
    suggest($, id).catch(error => debug($, `break offer failed: ${error}`))
  })
}

const suggest = async ($: EngineInterface, id: string) => {
  if ((await read($, turnId)) !== id || !(await transition($, 'working', 'suggested'))) return
  // A new turn may have started between the turnId read and the move: hand its phase back.
  if ((await read($, turnId)) !== id) {
    await transition($, 'suggested', 'working')
    return
  }
  void refreshNews($) // warm the feed: the person may open the pane now
  const pane = await ourPane($)
  // S2: no toast over a visible pane; and none if the turn ended while we looked.
  if (isVisible(pane) || (await read($, phase)) !== 'suggested') return
  $.ui.toast((await stringsFor($)).suggest)
}

// F14: Claude is waiting on the person (a permission prompt): offer the break now, not at the
// threshold. Same once-per-turn transition as the timer, so it never toasts twice.
const offerNow = async ($: EngineInterface) => {
  const id = await read($, turnId)
  if (id === null) return
  suggestTimer?.cancel() // suggest() itself refuses anything but a 'working' turn
  await suggest($, id)
}

// From a timer, so the permission decision the hook passes on is never held up by our work.
const offerSoon = ($: EngineInterface) => {
  $.clock.after(0, () => {
    offerNow($).catch(error => debug($, `early break offer failed: ${error}`))
  })
}

// F7: after the banner shows, close the pane unless the person holds its keyboard (S1); then poll.
// While the pane holds the keyboard the fade polls; never faster than this, even with a 0 ms
// fade-out setting (that would spin on $.ui.panes()).
const FADE_POLL_MS = 1_000

const armFade = ($: EngineInterface, delayMs = settings.fadeOutMs) => {
  fadeTimer?.cancel()
  fadeTimer = $.clock.after(delayMs, () => {
    fade($).catch(async error => {
      debug($, `banner fade failed: ${error}`)
      await transition($, 'done', 'idle').catch(() => undefined)
    })
  })
}

// What a closed pane leaves behind: no rotation, no banner. The ui.close hook runs this for the
// person's close; our own $.ui.close never reaches our own hook, so closePane runs it too.
const afterClose = async ($: EngineInterface) => {
  stopRotation()
  if (await transition($, 'done', 'idle')) fadeTimer?.cancel()
}

const closePane = async ($: EngineInterface) => {
  await afterClose($)
  await $.ui.close({ id: PANE })
}

const fade = async ($: EngineInterface) => {
  if ((await read($, phase)) !== 'done') return
  const pane = await ourPane($)
  if (isVisible(pane) && pane?.isFocused)
    return armFade($, Math.max(settings.fadeOutMs, FADE_POLL_MS))
  // Moved to a background tab (or gone) meanwhile: drop the banner but never close it (S5).
  const isClosing = (await transition($, 'done', 'idle')) && isVisible(pane)
  if (isClosing) await closePane($)
}

// Failures stay off the person's transcript: they are ours to debug, not theirs to read.
const debug = ($: EngineInterface, text: string) => $.ui.log(text, { to: 'debug' })

// One source over the network: its items, or undefined for an error, a non-2xx, a body that
// parses to nothing, or no answer within FETCH_TIMEOUT_MS (M3: one hung socket must not stall
// every later refresh).
const fetchSource = async ($: EngineInterface, source: FeedSource) => {
  let timer: Timer | undefined
  const timeout = new Promise<undefined>(resolve => {
    timer = $.clock.after(FETCH_TIMEOUT_MS, () => resolve(undefined))
  })
  const request = (async () => {
    const response = await $.http.fetch(source.url, {
      headers: { 'user-agent': 'streambreak/0.1' },
    })
    const items = response.ok ? parseFeed(response.text, source) : []
    return items.length > 0 ? items : undefined
  })().catch(() => undefined)
  try {
    return await Promise.race([request, timeout])
  } finally {
    timer?.cancel()
  }
}

const sameFeed = (a: NewsFeed, b: NewsFeed) =>
  a.isOffline === b.isOffline &&
  a.isLoading === b.isLoading &&
  a.items.length === b.items.length &&
  a.items.every((item, i) => {
    const other = b.items[i]
    return other !== undefined && item.url === other.url && item.title === other.title
  })

// Writes the feed only when it changed (a tick that hit the cache redraws nothing); new items
// start the rotation from the top.
// Only for the language it was fetched in: a toggle meanwhile has cleared the cards for its own.
const publish = async ($: EngineInterface, lang: Language, next: NewsFeed) => {
  if ((await read($, language)) !== lang) return
  let isNewItems = false
  await update($, news, current => {
    if (sameFeed(current, next)) return current
    isNewItems =
      current.items.map(item => item.url).join('\n') !== next.items.map(item => item.url).join('\n')
    return next
  })
  if (isNewItems) await update($, newsIndex, () => 0)
}

// F5: the $.store cache within the TTL, else every source over the network (S8 keeps the last
// items when all fail). One refresh at a time: the pane opening and a rotation tick share it.
const refreshNews = ($: EngineInterface) => {
  refreshing ??= (async () => {
    const now = await $.clock.now()
    const lang = await read($, language)
    const cached = asFeedCache(await $.store.get(cacheKey(lang)))
    if (isFresh(cached, now)) {
      return publish($, lang, {
        items: cached.items,
        isOffline: cached.isOffline,
        isLoading: false,
      })
    }
    // "Loading" only when the network is really asked and there is nothing to show meanwhile.
    if ((await read($, news)).items.length === 0) {
      await update($, news, feed => (feed.isLoading ? feed : { ...feed, isLoading: true }))
    }
    const lists = await Promise.all(FEEDS[lang].map(source => fetchSource($, source)))
    const next = settleFetches(lists, cached, now)
    await $.store.set(cacheKey(lang), next)
    await publish($, lang, { items: next.items, isOffline: next.isOffline, isLoading: false })
  })()
    .catch(async error => {
      debug($, `news refresh failed: ${error}`)
      await update($, news, feed => (feed.isLoading ? { ...feed, isLoading: false } : feed)).catch(
        () => undefined,
      )
    })
    .finally(() => {
      refreshing = undefined
    })

  return refreshing
}

// F6: while the pane is open, advance the cards every 15 s; each tick also refreshes past the TTL.
// A close we never heard of (the engine unloading the pane) ends the rotation at the next tick.
const startRotation = ($: EngineInterface) => {
  rotationTimer?.cancel()
  const self: Timer = $.clock.every(settings.rotationMs, () => {
    const tick = async () => {
      // Only this rotation may stop itself: a reopen meanwhile started a newer one.
      if (!(await ourPane($))) return rotationTimer === self ? stopRotation() : self.cancel()
      await update($, newsIndex, index => index + 1)
      await refreshNews($)
      // No event says a background pane came to the front again: the Memory clock catches up here.
      await syncElapsedClock($)
    }
    tick().catch(error => debug($, `rotation failed: ${error}`))
  })
  rotationTimer = self
}

const stopRotation = () => {
  rotationTimer?.cancel()
  rotationTimer = undefined
  stopElapsedClock() // S9: no game tick for a closed pane
}

// F11: the games tab opens on a random game the first time; each board is kept until New game.
const ensureGame = async ($: EngineInterface) => {
  let picked: GameKind = 'memory'
  await update($, game, current => {
    picked =
      current ?? AVAILABLE_GAMES[Math.floor(Math.random() * AVAILABLE_GAMES.length)] ?? 'memory'
    return current === picked ? current : picked
  })
  await startGame($, picked, false)
}

// Shows `kind`, dealing a fresh board when asked (New game) or when it has none. A kept board's
// pending flip-back is left alone: its timer, or the next press, still settles it (S9).
const startGame = async ($: EngineInterface, kind: GameKind, isFresh: boolean) => {
  await update($, game, current => (current === kind ? current : kind))
  if (kind === 'memory') {
    if (isFresh) flipBackTimer?.cancel()
    await update($, memory, current => (current && !isFresh ? current : newMemory()))
  }
  if (kind === 'gomoku') {
    await update($, gomoku, current => (current && !isFresh ? current : newGomoku()))
  }
  if (kind === 'minesweeper') {
    await update($, minesweeper, current => (current && !isFresh ? current : newMines()))
  }
  await syncElapsedClock($)
}

// S9: a reopened pane (or a reloaded module) turns back a mismatch whose timer may be gone.
const settlePendingMismatch = ($: EngineInterface) =>
  update($, memory, current => (current?.mismatch ? settleMismatch(current) : current))

// F8: a mismatched pair turns back after 600 ms. The timer is armed in the same step as the write
// (no await between), and it settles only the mismatch it was armed for: `moves` grows with every
// pair, so it tells this mismatch from a later one on the same two cards.
const flipCard = async ($: EngineInterface, index: number) => {
  const now = await $.clock.now()
  let armedAt: number | null = null
  await update($, memory, current => {
    if (!current) return current
    const next = flip(current, index, now)
    armedAt = next.mismatch && next.mismatch !== current.mismatch ? next.moves : null
    return next
  })
  if (armedAt !== null) {
    const moves: number = armedAt
    flipBackTimer?.cancel()
    flipBackTimer = $.clock.after(FLIP_BACK_MS, () => {
      update($, memory, current =>
        current?.mismatch && current.moves === moves ? settleMismatch(current) : current,
      ).catch(error => debug($, `flip back failed: ${error}`))
    })
  }
  await syncElapsedClock($)
}

// F10: one press opens or flags, per the mode; the first open lays the mines.
const pressMines = ($: EngineInterface, r: number, c: number) =>
  update($, minesweeper, current => (current ? pressMine(current, r, c) : current))

const toggleMinesMode = ($: EngineInterface) =>
  update($, minesweeper, current => (current ? toggleMode(current) : current))

// F9: the person's stone and the AI's reply land in one write.
const playGomoku = ($: EngineInterface, r: number, c: number) =>
  update($, gomoku, current => (current ? playTurn(current, r, c) : current))

// The Memory clock redraws each second only while it can be seen moving: pane shown, games tab,
// Memory started and unfinished. Re-checked after anything that changes one of those (S9).
const syncElapsedClock = async ($: EngineInterface) => {
  const [pane, currentTab, currentGame, state] = await Promise.all([
    ourPane($),
    read($, tab),
    read($, game),
    read($, memory),
  ])
  const isRunning =
    isVisible(pane) &&
    currentTab === 'games' &&
    currentGame === 'memory' &&
    state !== null &&
    state.startedAt !== null &&
    state.finishedAt === null
  if (!isRunning) return stopElapsedClock()
  if (elapsedTimer) return
  elapsedTimer = $.clock.every(1_000, () => {
    $.ui.invalidate('ui.render')
    syncElapsedClock($).catch(error => debug($, `clock tick failed: ${error}`))
  })
}

const stopElapsedClock = () => {
  elapsedTimer?.cancel()
  elapsedTimer = undefined
}

// S6: a language change starts the news over in that language (cache per language), like the
// Tauri app's onToggleLanguage. A refresh still in flight for the old one is waited out first.
const restartNews = async ($: EngineInterface) => {
  await update($, newsIndex, () => 0)
  await update($, news, () => ({ items: [], isOffline: false, isLoading: false }))
  if (!(await ourPane($))) return // the next open fetches
  await refreshing?.catch(() => undefined)
  await refreshNews($)
}

const setLanguage = async ($: EngineInterface, next: Language) => {
  let isChanged = false
  await update($, language, current => {
    isChanged = current !== next
    return isChanged ? next : current
  })
  return isChanged
}

// Best effort: a store that fails must not stop the language the person sees from changing.
const storeQuietly = ($: EngineInterface, write: () => Promise<unknown>) =>
  write().catch(error => debug($, `store write failed: ${error}`))

// F13: the pane's EN ↔ KO toggle. The flip happens inside one update, so two quick presses land
// as two flips; then it is saved as an override of the setting (setting first, so a half-done
// save never leaves an override without the setting it was made against).
const toggleLanguage = async ($: EngineInterface) => {
  let next: Language = 'en'
  await update($, language, current => {
    next = current === 'en' ? 'ko' : 'en'
    return next
  })
  // Saved before the fetch: an exit or reload while the news loads must not undo the press.
  await storeQuietly($, () => $.store.set(LANGUAGE_CONFIGURED, settings.language))
  await storeQuietly($, () => $.store.set(LANGUAGE_OVERRIDE, next))
  await restartNews($)
}

// At every load: the setting, the override, and whether the menu changed the setting since (S6).
// An unreadable store counts as empty, so the setting still applies.
const loadLanguage = async ($: EngineInterface) => {
  const UNREAD = Symbol('unread')
  const readQuietly = (key: string) => $.store.get(key).catch(() => UNREAD)
  const configured = await readQuietly(LANGUAGE_CONFIGURED)
  const override = await readQuietly(LANGUAGE_OVERRIDE)
  const { language: effective, isOverrideCleared } = resolveLanguage(
    settings.language,
    configured === UNREAD ? undefined : configured,
    override === UNREAD ? undefined : override,
  )
  const isChanged = await setLanguage($, effective)
  const hasPane = (await ourPane($)) !== undefined
  // The news follows from a timer: session.start must not wait on the network.
  if (isChanged || hasPane) {
    $.clock.after(0, () => {
      // A reload mid-switch may have dropped its fetch, so an open pane refreshes either way.
      ;(isChanged ? restartNews($) : refreshNews($)).catch(error =>
        debug($, `news after language load failed: ${error}`),
      )
    })
  }
  if (isOverrideCleared) await storeQuietly($, () => $.store.delete(LANGUAGE_OVERRIDE))
  // Only when we know what was stored: recording the setting over an unread value could hide a
  // later menu change behind a stale override for good.
  if (configured !== UNREAD) {
    await storeQuietly($, () => $.store.set(LANGUAGE_CONFIGURED, settings.language))
  }
}

// F15: once a session, if the Tauri app's hooks are still registered, say so (two popups
// otherwise). The engine's own reading of the user settings: no path guessing, no parsing here.
const warnLegacyHooks = async ($: EngineInterface) => {
  let isFirst = false
  await update($, isLegacyWarned, current => {
    isFirst = !current
    return true
  })
  if (!isFirst) return
  const userSettings = await $.settings.read({ source: 'user' })
  if (hasLegacyHooks(userSettings)) {
    $.ui.toast((await stringsFor($)).legacyHooks, { timeoutMs: 12_000 })
  }
}

export const register: Register = (on, options) => {
  settings = settingsFrom(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streambreak', description: 'Open the streambreak pane' })

    // S9: a mismatched pair whose flip-back timer died with the old module turns back now.
    await settlePendingMismatch($)
    if ((await read($, tab)) === 'games') await ensureGame($)
    // S7: a reload dropped the timers; re-arm from what $.state still holds.
    const current = await read($, phase)
    const id = await read($, turnId)
    const startedAt = await read($, turnStartedAt)
    if (current === 'working' && id !== null && startedAt !== null) {
      armSuggest($, id, settings.thresholdMs - ((await $.clock.now()) - startedAt))
    }
    if (current === 'done') armFade($)
    if (await ourPane($)) startRotation($)
    await syncElapsedClock($)

    // Last, and on its own: a store failure here must not cost the re-arming above.
    await loadLanguage($).catch(error => debug($, `language load failed: ${error}`))
    await warnLegacyHooks($).catch(error => debug($, `legacy hook check failed: ${error}`))

    return next(e)
  })

  // S10: /clear raises session.end alone (no new session.start); the game board survives.
  on('session.end', async ($, e, next) => {
    await setIdle($)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    fadeTimer?.cancel() // S2: a new turn takes the banner down
    suggestTimer?.cancel()
    // Claim the banner first, so a fade already in flight finds no 'done' and leaves the pane.
    await transition($, 'done', 'working')
    const now = await $.clock.now()
    // turnId first: a half-done write must never leave phase 'working' for a turn we don't track.
    await update($, turnId, () => e.turnId)
    await update($, turnStartedAt, () => now)
    await update($, phase, () => 'working' as Phase)
    armSuggest($, e.turnId, settings.thresholdMs)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // S3: subagent turns carry agentId; S4: a stale or unknown turn changes nothing.
    if (e.agentId !== undefined || e.turnId !== (await read($, turnId))) return next(e)

    suggestTimer?.cancel()
    // The banner says "finished", so only a real answer earns it, and only on a pane the person
    // sees; closing an unplaced or background pane would cancel what they asked for (S5).
    if (e.reason !== 'answer' || !isVisible(await ourPane($))) {
      await setIdle($)
    } else {
      await update($, turnId, () => null)
      await update($, turnStartedAt, () => null)
      await update($, phase, () => 'done' as Phase)
      armFade($)
    }

    return next(e)
  })

  // F14: a permission dialog is about to be shown. Not `tool.check`'s `ask`: auto mode, dontAsk and
  // other plugins settle many asks with no dialog, and a plugin's own `$.tool.check` query raises
  // it too. The decision is passed on untouched; nothing of ours may throw into it.
  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      offerSoon($)
    } catch {}

    return next(e)
  })

  // The terminal also announces the prompt as a notification; the transition dedupes the two.
  on('classic.Notification', async ($, e, next) => {
    try {
      if (e.notification_type === 'permission_prompt') offerSoon($)
    } catch {}

    return next(e)
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await afterClose($)

    return next(e)
  })

  // F4 / S5: the pane opens only on the person's action; a pane left unplaced is explained once.
  on('command.run', { command: 'streambreak' }, async $ => {
    // rows: Gomoku and the chrome fit inline; columns: Memory and the header fit when docked.
    const opened = await $.ui.open({
      id: PANE,
      title: 'streambreak',
      rows: 20,
      columns: 40,
      closeOnEscape: true,
    })
    await settlePendingMismatch($) // S9: reopening resolves a flip-back left waiting
    if ((await read($, tab)) === 'games') await ensureGame($) // F11: never an empty games tab
    startRotation($)
    await syncElapsedClock($)
    // From a timer, not this dispatch: work a finished command dispatch left running may be dropped.
    $.clock.after(0, () => void refreshNews($))
    const t = await stringsFor($)
    if (opened.isPlaced) return { text: t.opened }

    $.ui.toast(t.notPlaced(opened.reason))

    return { text: t.notPlaced(opened.reason) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    // Each read subscribes this drawing: read only what the shown tab draws, so a news tick never
    // redraws an 81-button board and a game move never redraws the news.
    const [currentPhase, currentTab, now, currentLanguage] = await Promise.all([
      read($, phase),
      read($, tab),
      $.clock.now(),
      read($, language),
    ])
    const t = strings(currentLanguage)
    const g = glyphs(e.surface)
    const isNews = currentTab === 'news'
    const [feed, index] = isNews
      ? await Promise.all([read($, news), read($, newsIndex)])
      : [null, 0]
    const [currentGame, memoryState, gomokuState, minesState] = isNews
      ? [null, null, null, null]
      : await Promise.all([read($, game), read($, memory), read($, gomoku), read($, minesweeper)])

    // Handlers read what they need when pressed (another surface may have moved on since this
    // drawing) and send failures to the debug log.
    const act = (label: string, work: () => Promise<unknown>) => () => {
      work().catch(error => debug($, `${label} failed: ${error}`))
    }
    const select = (next: Tab) =>
      act('tab switch', async () => {
        if (next === 'games') await ensureGame($) // the board first, so no empty tab is drawn
        await update($, tab, current => (current === next ? current : next))
        await syncElapsedClock($)
      })
    const pickGame = (kind: GameKind) => act('game pick', () => startGame($, kind, false))()
    const newGame = act('new game', async () => {
      const current = await read($, game)
      return current ? startGame($, current, true) : ensureGame($)
    })

    return (
      <Box flexDirection="column" gap={1}>
        {chrome(els, t, e.surface, currentTab, currentPhase, {
          onTab: select,
          onLanguage: act('language', () => toggleLanguage($)),
          onClose: act('close', () => closePane($)),
        })}
        {isNews && feed ? (
          newsView(els, t, {
            items: feed.items,
            shown: visibleWindow(feed.items, index),
            index,
            isOffline: feed.isOffline,
            isLoading: feed.isLoading,
            now,
            columns: e.props.bodyColumns,
            surface: e.surface,
          })
        ) : (
          <Box key="games" flexDirection="column" gap={1}>
            {gameSelector(els, t, e.surface, currentGame, pickGame, newGame)}
            {currentGame && e.props.bodyColumns < BOARD_COLUMNS[currentGame] ? (
              <Text dimColor>{t.narrowGame}</Text>
            ) : currentGame === 'memory' && memoryState ? (
              memoryView(
                els,
                t,
                g,
                memoryState,
                now,
                cardIndex => act('flip', () => flipCard($, cardIndex))(),
                newGame,
              )
            ) : currentGame === 'gomoku' && gomokuState ? (
              gomokuView(
                els,
                t,
                g,
                gomokuState,
                (r, c) => act('move', () => playGomoku($, r, c))(),
                newGame,
              )
            ) : currentGame === 'minesweeper' && minesState ? (
              minesView(
                els,
                t,
                g,
                minesState,
                (r, c) => act('mines', () => pressMines($, r, c))(),
                act('mines mode', () => toggleMinesMode($)),
                newGame,
              )
            ) : (
              <Text dimColor>{t.gamesEmpty}</Text>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
