import { Clock, Zap } from 'lucide-react'

interface Props {
  elapsedMs: number
}

export default function ProgressBar({ elapsedMs }: Props) {
  const seconds = Math.floor(elapsedMs / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between rounded-t-[14px] border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2.5"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--accent)]">
        <Zap size={11} fill="currentColor" />
        streambreak
      </span>
      <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-tertiary)]">
        <Clock size={10} />
        {display}
      </span>
    </div>
  )
}
