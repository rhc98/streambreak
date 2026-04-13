import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Controls from '../components/Controls'

const defaultProps = {
  mode: 'news' as const,
  language: 'en',
  onNext: vi.fn(),
  onToggleGame: vi.fn(),
  onClose: vi.fn(),
  onToggleLanguage: vi.fn(),
}

describe('Controls', () => {
  it('renders Next button in news mode', () => {
    render(<Controls {...defaultProps} />)
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('hides Next button in game mode', () => {
    render(<Controls {...defaultProps} mode="game" />)
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('returns null in complete mode', () => {
    const { container } = render(<Controls {...defaultProps} mode="complete" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows KO label when language is en', () => {
    render(<Controls {...defaultProps} language="en" />)
    expect(screen.getByText('KO')).toBeInTheDocument()
  })

  it('shows EN label when language is ko', () => {
    render(<Controls {...defaultProps} language="ko" />)
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('calls onNext when Next clicked', () => {
    const onNext = vi.fn()
    render(<Controls {...defaultProps} onNext={onNext} />)
    fireEvent.click(screen.getByText('Next'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('calls onToggleGame when Game clicked', () => {
    const onToggleGame = vi.fn()
    render(<Controls {...defaultProps} onToggleGame={onToggleGame} />)
    fireEvent.click(screen.getByText('Game'))
    expect(onToggleGame).toHaveBeenCalledOnce()
  })

  it('shows News label in game mode', () => {
    render(<Controls {...defaultProps} mode="game" />)
    expect(screen.getByText('News')).toBeInTheDocument()
  })
})
