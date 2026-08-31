import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { chooseBotMove, describePosition, moveToUci, tryPlayerMove } from '../src/utils/chess-game'

describe('chess game rules', () => {
  it('starts from the standard position with the expected legal move tree', () => {
    const game = new Chess()

    expect(game.moves()).toHaveLength(20)
    expect(game.perft(2)).toBe(400)
    expect(describePosition(game)).toBe('White to move.')
  })

  it('accepts SAN and coordinate notation while rejecting illegal moves', () => {
    const game = new Chess()

    expect(tryPlayerMove(game, 'e2e4').move?.san).toBe('e4')
    expect(tryPlayerMove(game, 'e5').move?.san).toBe('e5')
    expect(tryPlayerMove(game, 'Nf3').move?.san).toBe('Nf3')

    const illegal = tryPlayerMove(game, 'e1e8')
    expect(illegal.ok).toBe(false)
    expect(illegal.error).toContain('not legal')
  })

  it('supports castling, en passant, promotion, and checkmate', () => {
    const castling = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(tryPlayerMove(castling, 'O-O').ok).toBe(true)
    expect(castling.get('g1')).toEqual({ color: 'w', type: 'k' })
    expect(castling.get('f1')).toEqual({ color: 'w', type: 'r' })

    const enPassant = new Chess()
    for (const move of ['e4', 'a6', 'e5', 'd5', 'exd6'])
      expect(tryPlayerMove(enPassant, move).ok).toBe(true)
    expect(enPassant.get('d6')).toEqual({ color: 'w', type: 'p' })
    expect(enPassant.get('d5')).toBeUndefined()

    const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1')
    expect(tryPlayerMove(promotion, 'a7a8').move?.promotion).toBe('q')
    expect(promotion.get('a8')).toEqual({ color: 'w', type: 'q' })

    const checkmate = new Chess()
    for (const move of ['f3', 'e5', 'g4', 'Qh4#'])
      checkmate.move(move)
    expect(checkmate.isCheckmate()).toBe(true)
    expect(describePosition(checkmate)).toBe('Black wins by checkmate.')
  })

  it('reports terminal draw conditions clearly', () => {
    const game = new Chess('8/8/8/8/8/8/5k2/7K w - - 0 1')

    expect(game.isInsufficientMaterial()).toBe(true)
    expect(describePosition(game)).toBe('Draw by insufficient material.')
  })
})

describe('computer opponent', () => {
  it('chooses a deterministic legal move without changing the supplied game', () => {
    const game = new Chess()
    const startingFen = game.fen()
    const first = chooseBotMove(game, 'club')
    const second = chooseBotMove(game, 'club')

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(moveToUci(first!)).toBe(moveToUci(second!))
    expect(game.fen()).toBe(startingFen)
    expect(game.history()).toEqual([])

    expect(() => game.move({
      from: first!.from,
      promotion: first!.promotion,
      to: first!.to,
    })).not.toThrow()
  })

  it('does not move after the game has ended', () => {
    const game = new Chess()
    for (const move of ['f3', 'e5', 'g4', 'Qh4#'])
      game.move(move)

    expect(chooseBotMove(game, 'challenger')).toBeNull()
  })
})
