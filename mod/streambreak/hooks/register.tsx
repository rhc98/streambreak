import type { EngineInterface, Register, UiPane } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { NewsFeed, Phase, Tab } from '../types'
import {
  asFeedCache,
  cacheKey,
  cleanText,
  FEEDS,
  FETCH_TIMEOUT_MS,
  type FeedSource,
  isFresh,
  parseFeed,
  safeHref,
  settleFetches,
  timeAgo,
  visibleWindow,
} from './feed'
import { type Language, strings } from './i18n'

// $.state refs must be declared in the file that reads or writes them (validate's scan rule),
// so every state access stays in this file; other modules hold pure logic and drawing.
const PANE = 'streambreak'
// Legacy app defaults (config.toml); userConfig takes over in F12.
const THRESHOLD_MS = 10_000
const FADE_OUT_MS = 3_000
const ROTATION_MS = 15_000
const LANGUAGE: Language = 'en'
const t = strings(LANGUAGE)

const phase = atom({ plugin: 'streambreak', key: 'phase' } as const, 'idle' as Phase)
const turnId = atom({ plugin: 'streambreak', key: 'turnId' } as const, null as string | null)
const turnStartedAt = atom(
  { plugin: 'streambreak', key: 'turnStartedAt' } as const,
  null as number | null,
)
const tab = atom({ plugin: 'streambreak', key: 'tab' } as const, 'news' as Tab)
const news = atom(
  { plugin: 'streambreak', key: 'news' } as const,
  {
    items: [],
    isOffline: false,
    isLoading: false,
  } as NewsFeed,
)
const newsIndex = atom({ plugin: 'streambreak', key: 'newsIndex' } as const, 0)

// Timers die with the module on a reload; session.start re-arms them from $.state (S7).
type Timer = { cancel: () => void }
let suggestTimer: Timer | undefined
let fadeTimer: Timer | undefined
let rotationTimer: Timer | undefined
let refreshing: Promise<void> | undefined

const ourPane = async ($: EngineInterface) => (await $.ui.panes()).find(pane => pane.id === PANE)
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
  $.ui.toast(t.suggest)
}

// F7: after the banner shows, close the pane unless the person holds its keyboard (S1); then poll.
const armFade = ($: EngineInterface) => {
  fadeTimer?.cancel()
  fadeTimer = $.clock.after(FADE_OUT_MS, () => {
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
  if (isVisible(pane) && pane?.isFocused) return armFade($)
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
const publish = async ($: EngineInterface, next: NewsFeed) => {
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
    const cached = asFeedCache(await $.store.get(cacheKey(LANGUAGE)))
    if (isFresh(cached, now)) {
      return publish($, { items: cached.items, isOffline: cached.isOffline, isLoading: false })
    }
    // "Loading" only when the network is really asked and there is nothing to show meanwhile.
    if ((await read($, news)).items.length === 0) {
      await update($, news, feed => (feed.isLoading ? feed : { ...feed, isLoading: true }))
    }
    const lists = await Promise.all(FEEDS[LANGUAGE].map(source => fetchSource($, source)))
    const next = settleFetches(lists, cached, now)
    await $.store.set(cacheKey(LANGUAGE), next)
    await publish($, { items: next.items, isOffline: next.isOffline, isLoading: false })
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
  const self: Timer = $.clock.every(ROTATION_MS, () => {
    const tick = async () => {
      // Only this rotation may stop itself: a reopen meanwhile started a newer one.
      if (!(await ourPane($))) return rotationTimer === self ? stopRotation() : self.cancel()
      await update($, newsIndex, index => index + 1)
      await refreshNews($)
    }
    tick().catch(error => debug($, `rotation failed: ${error}`))
  })
  rotationTimer = self
}

const stopRotation = () => {
  rotationTimer?.cancel()
  rotationTimer = undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streambreak', description: 'Open the streambreak pane' })

    // S7: a reload dropped the timers; re-arm from what $.state still holds.
    const current = await read($, phase)
    const id = await read($, turnId)
    const startedAt = await read($, turnStartedAt)
    if (current === 'working' && id !== null && startedAt !== null) {
      armSuggest($, id, THRESHOLD_MS - ((await $.clock.now()) - startedAt))
    }
    if (current === 'done') armFade($)
    if (await ourPane($)) startRotation($)

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
    armSuggest($, e.turnId, THRESHOLD_MS)

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

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await afterClose($)

    return next(e)
  })

  // F4 / S5: the pane opens only on the person's action; a pane left unplaced is explained once.
  on('command.run', { command: 'streambreak' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'streambreak' })
    startRotation($)
    // From a timer, not this dispatch: work a finished command dispatch left running may be dropped.
    $.clock.after(0, () => void refreshNews($))
    if (opened.isPlaced) return { text: t.opened }

    $.ui.toast(t.notPlaced(opened.reason))

    return { text: t.notPlaced(opened.reason) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const [currentPhase, currentTab, feed, index, now] = await Promise.all([
      read($, phase),
      read($, tab),
      read($, news),
      read($, newsIndex),
      $.clock.now(),
    ])
    const select = (next: Tab) => () => void update($, tab, () => next)

    return (
      <Box flexDirection="column" gap={1}>
        {currentPhase === 'done' && (
          <Box key="banner">
            <Text bold color="green">
              {t.done}
            </Text>
          </Box>
        )}
        <Box flexDirection="row" gap={1}>
          <Button
            key="tab:news"
            variant={currentTab === 'news' ? 'primary' : 'secondary'}
            onPress={select('news')}
          >
            {t.news}
          </Button>
          <Button
            key="tab:games"
            variant={currentTab === 'games' ? 'primary' : 'secondary'}
            onPress={select('games')}
          >
            {t.games}
          </Button>
          <Button key="close" role="dismiss" onPress={() => void closePane($)}>
            {t.close}
          </Button>
        </Box>
        {currentTab === 'news' ? (
          <Box key="news" flexDirection="column" gap={1}>
            {feed.isOffline && <Text color="yellow">{t.offline}</Text>}
            {feed.items.length === 0 && (
              <Text dimColor>{feed.isLoading ? t.loading : t.newsEmpty}</Text>
            )}
            {visibleWindow(feed.items, index).map((item, position) => {
              // Sanitized here, not only at parse time, so caches from older builds draw too (H1).
              const title = cleanText(`${position === 0 ? '›' : ' '} ${item.icon} ${item.title}`)
              const href = safeHref(item.url)
              const ago = timeAgo(item.published_at, now)
              return (
                <Box key={`card:${item.url || item.title}`} flexDirection="column">
                  {href ? <Link href={href} label={title} /> : <Text>{title}</Text>}
                  <Text dimColor>
                    {'    '}
                    {cleanText(item.source)}
                    {ago && ` · ${ago}`}
                  </Text>
                </Box>
              )
            })}
          </Box>
        ) : (
          <Text dimColor>{t.gamesEmpty}</Text>
        )}
      </Box>
    )
  })
}
