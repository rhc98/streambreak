import { Bug, Code, Cpu, Database, Globe, Lock, RotateCcw, Terminal, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const ICONS = [Code, Terminal, Bug, Cpu, Database, Globe, Zap, Lock]

interface Card {
  id: number
  iconIndex: number
  flipped: boolean
  matched: boolean
}

function createDeck(): Card[] {
  const pairs = ICONS.flatMap((_, i) => [i, i])
  const shuffled = pairs.sort(() => Math.random() - 0.5)
  return shuffled.map((iconIndex, id) => ({
    id,
    iconIndex,
    flipped: false,
    matched: false,
  }))
}

export default function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>(createDeck)
  const [selected, setSelected] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [locked, setLocked] = useState(false)

  const matched = cards.filter(c => c.matched).length
  const isComplete = matched === cards.length

  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isComplete, startTime])

  const handleClick = useCallback(
    (id: number) => {
      if (locked) return
      const card = cards[id]
      if (!card || card.flipped || card.matched) return

      const newCards = cards.map(c => (c.id === id ? { ...c, flipped: true } : c))
      const newSelected = [...selected, id]
      setCards(newCards)
      setSelected(newSelected)

      if (newSelected.length === 2) {
        setMoves(m => m + 1)
        setLocked(true)
        const [first, second] = newSelected
        const c1 = newCards[first!]!
        const c2 = newCards[second!]!

        if (c1.iconIndex === c2.iconIndex) {
          setCards(prev =>
            prev.map(c => (c.id === first || c.id === second ? { ...c, matched: true } : c)),
          )
          setSelected([])
          setLocked(false)
        } else {
          setTimeout(() => {
            setCards(prev =>
              prev.map(c => (c.id === first || c.id === second ? { ...c, flipped: false } : c)),
            )
            setSelected([])
            setLocked(false)
          }, 600)
        }
      }
    },
    [cards, selected, locked],
  )

  function reset() {
    setCards(createDeck())
    setSelected([])
    setMoves(0)
    setElapsed(0)
    setLocked(false)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex w-full items-center justify-between px-1">
        <div className="flex gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Moves
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--accent)]">{moves}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Time
            </div>
            <div className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {elapsed}s
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[rgba(255,255,255,0.1)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map(card => {
          const Icon = ICONS[card.iconIndex]!
          return (
            <button
              type="button"
              key={card.id}
              onClick={() => handleClick(card.id)}
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-lg transition-all duration-200 ${
                card.matched
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : card.flipped
                    ? 'bg-[var(--bg-card-active)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-card)] text-transparent hover:bg-[var(--bg-card-active)]'
              }`}
            >
              {card.flipped || card.matched ? (
                <Icon size={28} />
              ) : (
                <Lock size={20} className="text-[var(--text-tertiary)] opacity-30" />
              )}
            </button>
          )
        })}
      </div>

      {isComplete && (
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--accent)]">
            Complete! {moves} moves in {elapsed}s
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}
