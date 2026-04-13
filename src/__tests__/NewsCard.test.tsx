import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../App'
import NewsCard from '../components/NewsCard'

const item: ContentItem = {
  title: 'Test Article Title',
  url: 'https://example.com/article',
  source: 'Hacker News',
  icon: '🔥',
  published_at: new Date().toISOString(),
}

describe('NewsCard', () => {
  it('renders title and source', () => {
    render(<NewsCard item={item} isActive={false} />)
    expect(screen.getByText('Test Article Title')).toBeInTheDocument()
    expect(screen.getByText('Hacker News')).toBeInTheDocument()
  })

  it('renders as active with different styling', () => {
    const { container } = render(<NewsCard item={item} isActive={true} />)
    const button = container.querySelector('button')
    expect(button?.className).toContain('border-[var(--border-active)]')
  })

  it('shows time ago for recent items', () => {
    render(<NewsCard item={item} isActive={false} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('handles empty url gracefully', () => {
    const noUrlItem = { ...item, url: '' }
    render(<NewsCard item={noUrlItem} isActive={false} />)
    expect(screen.getByText('Test Article Title')).toBeInTheDocument()
  })
})
