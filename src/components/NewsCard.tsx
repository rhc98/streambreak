import { open } from '@tauri-apps/plugin-shell'
import { ExternalLink, Flame, Lightbulb, Newspaper } from 'lucide-react'
import type { ContentItem } from '../App'

const SOURCE_ICONS: Record<string, typeof Flame> = {
  'Hacker News': Flame,
  GeekNews: Newspaper,
  TechCrunch: Lightbulb,
}

interface Props {
  item: ContentItem
  isActive: boolean
}

export default function NewsCard({ item, isActive }: Props) {
  const timeAgo = getTimeAgo(item.published_at)
  const Icon = SOURCE_ICONS[item.source] ?? Newspaper

  async function handleClick() {
    if (!item.url) return
    try {
      await open(item.url)
    } catch {
      window.open(item.url, '_blank')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all duration-200 ${
        isActive
          ? 'border-[var(--border-active)] bg-[var(--bg-card-active)] shadow-[0_0_20px_var(--accent-glow)]'
          : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[rgba(255,255,255,0.1)] hover:bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isActive
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
          }`}
        >
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] leading-[1.4] font-medium ${
              isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {item.title}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="font-medium">{item.source}</span>
            {timeAgo && (
              <>
                <span className="opacity-40">·</span>
                <span>{timeAgo}</span>
              </>
            )}
          </div>
        </div>
        {item.url && (
          <ExternalLink
            size={13}
            className="mt-1.5 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>
    </button>
  )
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
