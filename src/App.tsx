import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import CompleteBanner from './components/CompleteBanner'
import Controls from './components/Controls'
import MiniGame from './components/MiniGame'
import NewsCard from './components/NewsCard'
import ProgressBar from './components/ProgressBar'

export type ViewMode = 'news' | 'game' | 'complete'

export interface ContentItem {
  title: string
  url: string
  source: string
  icon: string
  published_at: string
}

export default function App() {
  const [mode, setMode] = useState<ViewMode>('news')
  const [items, setItems] = useState<ContentItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [animClass, setAnimClass] = useState('animate-slide-in')
  const [language, setLanguage] = useState('en')

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
  useEffect(() => {
    invoke<string>('get_language')
      .then(setLanguage)
      .catch(() => {})
    loadContent()
    const interval = setInterval(() => {
      invoke<{ elapsed_ms: number; popup_visible: boolean; mode: string }>('get_status')
        .then(status => {
          setElapsedMs(status.elapsed_ms)
          if (status.mode === 'complete') {
            setMode('complete')
          }
        })
        .catch(() => {})
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (mode !== 'news' || items.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % items.length)
    }, 15000)
    return () => clearInterval(interval)
  }, [mode, items.length])

  async function loadContent(lang?: string) {
    try {
      const content = await invoke<ContentItem[]>('get_content_list')
      if (content.length > 0) {
        setItems(content)
        return
      }
    } catch {
      // Tauri not available — show placeholder
    }
    const current = lang ?? language
    setItems(
      current === 'ko'
        ? [
            {
              title: 'GeekNews: 최신 기술 뉴스',
              url: '',
              source: 'GeekNews',
              icon: '📰',
              published_at: new Date().toISOString(),
            },
            {
              title: 'Claude Code 2.0 출시 — 새로운 기능 정리',
              url: '',
              source: 'GeekNews',
              icon: '📰',
              published_at: new Date().toISOString(),
            },
            {
              title: 'Rust 2026 에디션 주요 변경 사항',
              url: '',
              source: 'GeekNews',
              icon: '📰',
              published_at: new Date().toISOString(),
            },
          ]
        : [
            {
              title: 'Hacker News: Top Stories',
              url: '',
              source: 'Hacker News',
              icon: '🔥',
              published_at: new Date().toISOString(),
            },
            {
              title: 'Show HN: Streambreak – break time content for devs',
              url: '',
              source: 'Hacker News',
              icon: '🔥',
              published_at: new Date().toISOString(),
            },
            {
              title: 'Rust 2026 Edition Released',
              url: '',
              source: 'Hacker News',
              icon: '🔥',
              published_at: new Date().toISOString(),
            },
          ],
    )
  }

  function handleNext() {
    if (mode === 'news') {
      setCurrentIndex(i => (i + 1) % Math.max(items.length, 1))
    }
  }

  function handleToggleGame() {
    setMode(mode === 'game' ? 'news' : 'game')
  }

  async function handleClose() {
    setAnimClass('animate-fade-out')
    setTimeout(async () => {
      try {
        await invoke('hide_popup')
      } catch {
        // fallback
      }
      setAnimClass('animate-slide-in')
    }, 200)
  }

  return (
    <div className={`flex h-full flex-col rounded-[14px] bg-[var(--bg-primary)] ${animClass}`}>
      <ProgressBar elapsedMs={elapsedMs} />

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {mode === 'complete' ? (
          <CompleteBanner />
        ) : mode === 'game' ? (
          <MiniGame />
        ) : (
          <div className="flex h-full flex-col gap-2 overflow-y-auto pr-0.5">
            {items.length > 0 ? (
              items
                .slice(currentIndex, currentIndex + 5)
                .concat(
                  currentIndex + 5 > items.length
                    ? items.slice(0, (currentIndex + 5) % items.length)
                    : [],
                )
                .map((item, i) => (
                  <NewsCard key={`${item.url}-${i}`} item={item} isActive={i === 0} />
                ))
            ) : (
              <div className="flex flex-1 items-center justify-center text-[var(--text-secondary)]">
                Loading...
              </div>
            )}
          </div>
        )}
      </div>

      <Controls
        mode={mode}
        language={language}
        onNext={handleNext}
        onToggleGame={handleToggleGame}
        onClose={handleClose}
        onToggleLanguage={async () => {
          const next = language === 'en' ? 'ko' : 'en'
          try {
            await invoke('set_language', { language: next })
          } catch {
            // Tauri not available (browser preview)
          }
          setLanguage(next)
          setCurrentIndex(0)
          await loadContent(next)
        }}
      />
    </div>
  )
}
