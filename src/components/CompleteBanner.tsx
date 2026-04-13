import { CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function CompleteBanner() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`flex h-full flex-col items-center justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
        <CircleCheck size={32} className="text-emerald-400" />
      </div>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Task Complete</h1>
      <p className="mt-1.5 text-[13px] text-[var(--text-tertiary)]">Ready for the next one</p>
    </div>
  )
}
