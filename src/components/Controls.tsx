import { Gamepad2, Globe, Newspaper, SkipForward, X } from 'lucide-react'
import type { ViewMode } from '../App'

interface Props {
  mode: ViewMode
  language: string
  onNext: () => void
  onToggleGame: () => void
  onClose: () => void
  onToggleLanguage: () => void
}

export default function Controls({
  mode,
  language,
  onNext,
  onToggleGame,
  onClose,
  onToggleLanguage,
}: Props) {
  if (mode === 'complete') return null

  return (
    <div className="flex items-center gap-1.5 rounded-b-[14px] border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5">
      {mode === 'news' && (
        <ControlButton onClick={onNext} icon={<SkipForward size={12} />} label="Next" />
      )}
      <ControlButton
        onClick={onToggleGame}
        icon={mode === 'game' ? <Newspaper size={12} /> : <Gamepad2 size={12} />}
        label={mode === 'game' ? 'News' : 'Game'}
      />
      <ControlButton
        onClick={onToggleLanguage}
        icon={<Globe size={12} />}
        label={language === 'en' ? 'KO' : 'EN'}
      />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ControlButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(255,255,255,0.1)] hover:bg-[var(--bg-card-active)] hover:text-[var(--text-primary)]"
    >
      {icon}
      {label}
    </button>
  )
}
