import { Bomb, Brain, CircleDot } from 'lucide-react'
import { useState } from 'react'
import Gomoku from '../games/Gomoku'
import MemoryMatch from '../games/MemoryMatch'
import Minesweeper from '../games/Minesweeper'

const GAMES = [
  { id: 'memory', label: 'Memory', icon: Brain, component: MemoryMatch },
  { id: 'mines', label: 'Mines', icon: Bomb, component: Minesweeper },
  { id: 'gomoku', label: 'Gomoku', icon: CircleDot, component: Gomoku },
] as const

type GameId = (typeof GAMES)[number]['id']

function randomGame(): GameId {
  return GAMES[Math.floor(Math.random() * GAMES.length)]?.id
}

export default function MiniGame() {
  const [activeGame, setActiveGame] = useState<GameId>(randomGame)

  const ActiveComponent = GAMES.find(g => g.id === activeGame)?.component

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1">
        {GAMES.map(game => {
          const Icon = game.icon
          const isActive = activeGame === game.id
          return (
            <button
              type="button"
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={12} />
              {game.label}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1">
        <ActiveComponent />
      </div>
    </div>
  )
}
