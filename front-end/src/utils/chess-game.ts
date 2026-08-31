import type { Chess, Color, Move, PieceSymbol, Square } from 'chess.js'

export type BotLevel = 'beginner' | 'club' | 'challenger'

export interface MoveAttempt {
  error?: string
  move?: Move
  ok: boolean
}

interface SearchSettings {
  depth: number
  maxNodes: number
}

interface SearchContext {
  maxNodes: number
  nodes: number
}

const MATE_SCORE = 1_000_000

const pieceValues: Record<PieceSymbol, number> = {
  b: 330,
  k: 20_000,
  n: 320,
  p: 100,
  q: 900,
  r: 500,
}

const levelSettings: Record<BotLevel, SearchSettings> = {
  beginner: { depth: 1, maxNodes: 1_500 },
  club: { depth: 2, maxNodes: 12_000 },
  challenger: { depth: 3, maxNodes: 55_000 },
}

export const pieceGlyphs: Record<Color, Record<PieceSymbol, string>> = {
  b: { b: '♝', k: '♚', n: '♞', p: '♟', q: '♛', r: '♜' },
  w: { b: '♗', k: '♔', n: '♘', p: '♙', q: '♕', r: '♖' },
}

export const pieceNames: Record<PieceSymbol, string> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
}

function moveDescriptor(move: Move) {
  return {
    from: move.from,
    promotion: move.promotion,
    to: move.to,
  }
}

export function moveToUci(move: Pick<Move, 'from' | 'promotion' | 'to'>) {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

function orderedMoves(game: Chess) {
  return game.moves({ verbose: true }).sort((left, right) => {
    const score = (move: Move) => {
      const capture = move.captured ? pieceValues[move.captured] * 10 - pieceValues[move.piece] : 0
      const promotion = move.promotion ? pieceValues[move.promotion] * 12 : 0
      const check = move.san.endsWith('#') ? 100_000 : move.san.endsWith('+') ? 400 : 0
      const castle = move.isKingsideCastle() || move.isQueensideCastle() ? 80 : 0
      return capture + promotion + check + castle
    }

    return score(right) - score(left) || moveToUci(left).localeCompare(moveToUci(right))
  })
}

function positionalValue(type: PieceSymbol, color: Color, square: Square) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  const distanceFromCenter = Math.abs(file - 3.5) + Math.abs(rank - 4.5)
  const centrality = 7 - distanceFromCenter
  const advancement = color === 'w' ? rank - 2 : 7 - rank

  switch (type) {
    case 'p':
      return advancement * 9 + centrality * 2
    case 'n':
      return centrality * 11
    case 'b':
      return centrality * 7
    case 'r':
      return advancement * 2
    case 'q':
      return centrality * 3
    case 'k':
      return square === 'g1' || square === 'c1' || square === 'g8' || square === 'c8' ? 28 : 0
  }
}

function evaluateForWhite(game: Chess) {
  let score = 0

  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece)
        continue

      const value = pieceValues[piece.type] + positionalValue(piece.type, piece.color, piece.square)
      score += piece.color === 'w' ? value : -value
    }
  }

  return score
}

function staticEvaluation(game: Chess) {
  const perspective = game.turn() === 'w' ? 1 : -1
  const checkPenalty = game.isCheck() ? 35 : 0
  return perspective * evaluateForWhite(game) - checkPenalty
}

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext,
): number {
  context.nodes += 1

  if (game.isCheckmate())
    return -MATE_SCORE + ply
  if (game.isDraw())
    return 0
  if (depth === 0 || context.nodes >= context.maxNodes)
    return staticEvaluation(game)

  let best = -Infinity

  for (const move of orderedMoves(game)) {
    game.move(moveDescriptor(move))
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, context)
    game.undo()

    best = Math.max(best, score)
    alpha = Math.max(alpha, score)
    if (alpha >= beta || context.nodes >= context.maxNodes)
      break
  }

  return best
}

/**
 * Returns a deterministic legal move using material and positional evaluation
 * with alpha-beta-pruned negamax search. The supplied game is restored before
 * this function returns.
 */
export function chooseBotMove(game: Chess, level: BotLevel): Move | null {
  if (game.isGameOver())
    return null

  const settings = levelSettings[level]
  const context: SearchContext = { maxNodes: settings.maxNodes, nodes: 0 }
  let bestMove: Move | null = null
  let bestScore = -Infinity

  for (const move of orderedMoves(game)) {
    game.move(moveDescriptor(move))
    const score = -negamax(game, settings.depth - 1, -Infinity, Infinity, 1, context)
    game.undo()

    if (score > bestScore || (score === bestScore && bestMove && moveToUci(move) < moveToUci(bestMove))) {
      bestMove = move
      bestScore = score
    }

    if (context.nodes >= context.maxNodes)
      break
  }

  return bestMove
}

function coordinateMove(input: string) {
  const match = input.trim().toLowerCase().match(/^([a-h][1-8])[\s-]?([a-h][1-8])(?:=?([qrbn]))?$/)
  if (!match)
    return null

  return {
    from: match[1] as Square,
    promotion: match[3] as PieceSymbol | undefined,
    to: match[2] as Square,
  }
}

export function tryPlayerMove(game: Chess, input: string): MoveAttempt {
  const text = input.trim()
  if (!text)
    return { error: 'Enter a move in SAN or coordinate notation.', ok: false }

  try {
    const coordinates = coordinateMove(text)
    if (!coordinates)
      return { move: game.move(text, { strict: false }), ok: true }

    const candidates = game.moves({ square: coordinates.from, verbose: true })
      .filter(move => move.to === coordinates.to)
    const needsPromotion = candidates.some(move => move.isPromotion())

    return {
      move: game.move({
        from: coordinates.from,
        promotion: coordinates.promotion ?? (needsPromotion ? 'q' : undefined),
        to: coordinates.to,
      }),
      ok: true,
    }
  }
  catch {
    return { error: 'That move is not legal in the current position.', ok: false }
  }
}

export function describePosition(game: Chess) {
  if (game.isCheckmate())
    return `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate.`
  if (game.isStalemate())
    return 'Draw by stalemate.'
  if (game.isInsufficientMaterial())
    return 'Draw by insufficient material.'
  if (game.isThreefoldRepetition())
    return 'Draw by threefold repetition.'
  if (game.isDrawByFiftyMoves())
    return 'Draw by the fifty-move rule.'
  if (game.isDraw())
    return 'The game is drawn.'

  const player = game.turn() === 'w' ? 'White' : 'Black'
  return game.isCheck() ? `${player} to move and is in check.` : `${player} to move.`
}
