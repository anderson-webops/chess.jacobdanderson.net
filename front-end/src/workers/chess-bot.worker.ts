import type { PieceSymbol, Square } from 'chess.js'
import type { BotLevel } from '../utils/chess-game'
import { Chess } from 'chess.js'
import { chooseBotMove } from '../utils/chess-game'

interface BotWorkerRequest {
  fen: string
  id: number
  level: BotLevel
}

interface BotWorkerResponse {
  id: number
  move: {
    from: Square
    promotion?: PieceSymbol
    to: Square
  } | null
}

interface WorkerScope {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<BotWorkerRequest>) => void,
  ) => void
  postMessage: (message: BotWorkerResponse) => void
}

const workerScope = globalThis as unknown as WorkerScope

workerScope.addEventListener('message', (event) => {
  const game = new Chess(event.data.fen)
  const move = chooseBotMove(game, event.data.level)

  workerScope.postMessage({
    id: event.data.id,
    move: move
      ? { from: move.from, promotion: move.promotion, to: move.to }
      : null,
  })
})
