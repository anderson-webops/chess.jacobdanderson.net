<script setup lang="ts">
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import type { BotLevel } from '~/utils/chess-game'
import { Chess, SQUARES } from 'chess.js'
import {
  describePosition,
  moveToUci,
  pieceGlyphs,
  pieceNames,
  tryPlayerMove,
} from '~/utils/chess-game'

type OpponentMode = 'computer' | 'local'
type ViewMode = 'board' | 'headless'

interface PromotionChoice {
  from: Square
  to: Square
}

interface BotMoveDescriptor {
  from: Square
  promotion?: PieceSymbol
  to: Square
}

interface BotWorkerResponse {
  id: number
  move: BotMoveDescriptor | null
}

const game = new Chess()
const revision = ref(0)
const opponentMode = ref<OpponentMode>('computer')
const viewMode = ref<ViewMode>('board')
const humanColor = ref<Color>('w')
const botLevel = ref<BotLevel>('club')
const orientation = ref<Color>('w')
const selectedSquare = ref<Square | null>(null)
const pendingPromotion = ref<PromotionChoice | null>(null)
const notationInput = ref('')
const inputError = ref('')
const liveMessage = ref('New game. White to move.')
const isBotThinking = ref(false)
const promotionDialog = useTemplateRef<HTMLDialogElement>('promotionDialog')
const promotionQueenButton = useTemplateRef<HTMLButtonElement>('promotionQueenButton')
const notationMoveInput = useTemplateRef<HTMLInputElement>('notationMoveInput')

let botTimer: ReturnType<typeof setTimeout> | undefined
let botWorker: Worker | undefined
let botGeneration = 0

function trackGameRevision() {
  return revision.value
}

const botColor = computed<Color>(() => humanColor.value === 'w' ? 'b' : 'w')

const history = computed(() => {
  trackGameRevision()
  return game.history({ verbose: true })
})

const moveRows = computed(() => {
  const rows: Array<{ black?: Move, number: number, white?: Move }> = []
  for (let index = 0; index < history.value.length; index += 2) {
    rows.push({
      black: history.value[index + 1],
      number: index / 2 + 1,
      white: history.value[index],
    })
  }
  return rows
})

const lastMove = computed(() => history.value.at(-1) ?? null)

const boardSquares = computed(() => {
  trackGameRevision()
  const squares = SQUARES.map(square => ({ piece: game.get(square), square }))
  return orientation.value === 'w' ? squares : squares.reverse()
})

const legalTargetSquares = computed(() => {
  trackGameRevision()
  if (!selectedSquare.value)
    return new Set<Square>()

  return new Set(game.moves({ square: selectedSquare.value, verbose: true }).map(move => move.to))
})

const legalMoves = computed(() => {
  trackGameRevision()
  return game.isGameOver() ? [] : game.moves()
})

const status = computed(() => {
  trackGameRevision()
  return describePosition(game)
})

const fen = computed(() => {
  trackGameRevision()
  return game.fen()
})

const pgn = computed(() => {
  trackGameRevision()
  return game.pgn() || 'No moves yet.'
})

const isHumanTurn = computed(() => {
  trackGameRevision()
  return opponentMode.value === 'local' || game.turn() === humanColor.value
})

const canHumanMove = computed(() => {
  trackGameRevision()
  return !game.isGameOver() && !isBotThinking.value && isHumanTurn.value
})
const canUndo = computed(() => history.value.length > 0)

const turnOwner = computed(() => {
  trackGameRevision()
  if (opponentMode.value === 'local')
    return game.turn() === 'w' ? 'White player' : 'Black player'
  return game.turn() === humanColor.value ? 'Your turn' : 'Computer turn'
})

const panelHeading = computed(() => {
  trackGameRevision()
  if (game.isGameOver())
    return 'Game complete'
  if (isBotThinking.value)
    return 'Considering the position'
  return turnOwner.value
})

const promotionOptions: Array<{ label: string, piece: PieceSymbol }> = [
  { label: 'Queen', piece: 'q' },
  { label: 'Rook', piece: 'r' },
  { label: 'Bishop', piece: 'b' },
  { label: 'Knight', piece: 'n' },
]

function squareLabel(square: Square) {
  const piece = game.get(square)
  const parts = [piece ? `${piece.color === 'w' ? 'white' : 'black'} ${pieceNames[piece.type]}` : 'empty', square]
  if (selectedSquare.value === square)
    parts.push('selected')
  if (legalTargetSquares.value.has(square))
    parts.push('legal destination')
  return parts.join(', ')
}

function showFileLabel(square: Square) {
  return orientation.value === 'w' ? square[1] === '1' : square[1] === '8'
}

function showRankLabel(square: Square) {
  return orientation.value === 'w' ? square[0] === 'a' : square[0] === 'h'
}

function isLastMoveSquare(square: Square) {
  return lastMove.value?.from === square || lastMove.value?.to === square
}

function cancelBotMove() {
  botGeneration += 1
  if (botTimer)
    clearTimeout(botTimer)
  botWorker?.terminate()
  botTimer = undefined
  botWorker = undefined
  isBotThinking.value = false
}

function refresh(message?: string) {
  revision.value += 1
  selectedSquare.value = null
  pendingPromotion.value = null
  inputError.value = ''
  if (message)
    liveMessage.value = message
}

function applyCompletedMove(move: Move, actor: 'Computer' | 'Player') {
  refresh(`${actor} played ${move.san}. ${describePosition(game)}`)
  queueBotMove()
  if (viewMode.value === 'headless')
    nextTick(() => notationMoveInput.value?.focus())
}

function queueBotMove() {
  cancelBotMove()
  if (opponentMode.value !== 'computer' || game.isGameOver() || game.turn() !== botColor.value)
    return

  const generation = ++botGeneration
  isBotThinking.value = true
  liveMessage.value = 'Computer is considering its move.'

  botTimer = setTimeout(() => {
    if (generation !== botGeneration)
      return

    botTimer = undefined
    if (!import.meta.client) {
      isBotThinking.value = false
      return
    }

    const failBotMove = () => {
      if (generation !== botGeneration)
        return
      cancelBotMove()
      liveMessage.value = 'The computer could not calculate a move. Start a new game or undo the last move.'
    }

    try {
      const worker = new Worker(new URL('../workers/chess-bot.worker.ts', import.meta.url), { type: 'module' })
      botWorker = worker
      botTimer = setTimeout(failBotMove, 15_000)

      worker.onmessage = (event: MessageEvent<BotWorkerResponse>) => {
        if (generation !== botGeneration || event.data.id !== generation)
          return

        cancelBotMove()
        if (!event.data.move) {
          refresh(describePosition(game))
          return
        }

        try {
          const playedMove = game.move(event.data.move)
          applyCompletedMove(playedMove, 'Computer')
        }
        catch {
          refresh('The computer could not apply its move. Start a new game or undo the last move.')
        }
      }
      worker.onerror = failBotMove
      worker.onmessageerror = failBotMove
      worker.postMessage({ fen: game.fen(), id: generation, level: botLevel.value })
    }
    catch {
      failBotMove()
    }
  }, 260)
}

function startNewGame() {
  cancelBotMove()
  game.reset()
  orientation.value = opponentMode.value === 'computer' ? humanColor.value : 'w'
  notationInput.value = ''
  refresh(`New game. ${describePosition(game)}`)
  queueBotMove()
}

function selectSquare(square: Square) {
  if (!canHumanMove.value) {
    liveMessage.value = isBotThinking.value ? 'Wait for the computer to move.' : status.value
    return
  }

  const piece = game.get(square)
  if (!selectedSquare.value) {
    if (!piece || piece.color !== game.turn()) {
      liveMessage.value = `Choose a ${game.turn() === 'w' ? 'white' : 'black'} piece.`
      return
    }

    selectedSquare.value = square
    liveMessage.value = `${square} selected. ${game.moves({ square }).length} legal moves.`
    return
  }

  if (selectedSquare.value === square) {
    selectedSquare.value = null
    liveMessage.value = 'Selection cleared.'
    return
  }

  const candidates = game.moves({ square: selectedSquare.value, verbose: true }).filter(move => move.to === square)
  if (candidates.some(move => move.isPromotion())) {
    pendingPromotion.value = { from: selectedSquare.value, to: square }
    nextTick(() => {
      promotionDialog.value?.showModal()
      promotionQueenButton.value?.focus()
    })
    return
  }

  if (candidates.length > 0) {
    const move = game.move({ from: selectedSquare.value, to: square })
    applyCompletedMove(move, 'Player')
    return
  }

  if (piece?.color === game.turn()) {
    selectedSquare.value = square
    liveMessage.value = `${square} selected. ${game.moves({ square }).length} legal moves.`
    return
  }

  liveMessage.value = 'That piece cannot move there.'
}

function completePromotion(piece: PieceSymbol) {
  if (!pendingPromotion.value)
    return

  const originSquare = pendingPromotion.value.from
  const move = game.move({
    from: pendingPromotion.value.from,
    promotion: piece,
    to: pendingPromotion.value.to,
  })
  promotionDialog.value?.close()
  applyCompletedMove(move, 'Player')
  restoreSquareFocus(originSquare)
}

function cancelPromotion() {
  if (!pendingPromotion.value)
    return

  const originSquare = pendingPromotion.value.from
  promotionDialog.value?.close()
  pendingPromotion.value = null
  liveMessage.value = 'Promotion cancelled.'
  restoreSquareFocus(originSquare)
}

function restoreSquareFocus(square: Square) {
  nextTick(() => {
    document.querySelector<HTMLButtonElement>(`[data-square="${square}"]`)?.focus()
  })
}

function submitNotationMove() {
  if (!canHumanMove.value) {
    inputError.value = isBotThinking.value ? 'Wait for the computer to move.' : status.value
    return
  }

  const result = tryPlayerMove(game, notationInput.value)
  if (!result.ok || !result.move) {
    inputError.value = result.error ?? 'That move could not be played.'
    liveMessage.value = inputError.value
    return
  }

  notationInput.value = ''
  applyCompletedMove(result.move, 'Player')
}

function undoMove() {
  if (!canUndo.value)
    return

  cancelBotMove()
  game.undo()
  if (opponentMode.value === 'computer' && game.history().length > 0 && game.turn() !== humanColor.value)
    game.undo()

  refresh(`Move undone. ${describePosition(game)}`)
  queueBotMove()
}

function flipBoard() {
  orientation.value = orientation.value === 'w' ? 'b' : 'w'
  liveMessage.value = `${orientation.value === 'w' ? 'White' : 'Black'} is now at the bottom of the board.`
}

function changeView() {
  selectedSquare.value = null
  pendingPromotion.value = null
  liveMessage.value = viewMode.value === 'board'
    ? `Visible board selected. ${status.value}`
    : `Headless notation selected. ${status.value}`
  if (viewMode.value === 'headless')
    nextTick(() => notationMoveInput.value?.focus())
}

function changeBotLevel() {
  if (isBotThinking.value)
    queueBotMove()
  liveMessage.value = `Computer strength changed to ${botLevel.value}.`
}

onBeforeUnmount(cancelBotMove)
</script>

<template>
  <section id="game" class="game-shell" aria-labelledby="game-heading">
    <div class="game-toolbar">
      <div>
        <p class="section-kicker">
          New game
        </p>
        <h2 id="game-heading">
          Choose how to play
        </h2>
      </div>

      <div class="setup-controls" aria-label="Game setup">
        <label>
          Opponent
          <select id="opponent-mode" v-model="opponentMode" @change="startNewGame">
            <option value="computer">Computer</option>
            <option value="local">Local friend</option>
          </select>
        </label>

        <label>
          Interface
          <select id="interface-mode" v-model="viewMode" @change="changeView">
            <option value="board">Visible board</option>
            <option value="headless">Headless notation</option>
          </select>
        </label>

        <label v-if="opponentMode === 'computer'">
          Play as
          <select v-model="humanColor" @change="startNewGame">
            <option value="w">White</option>
            <option value="b">Black</option>
          </select>
        </label>

        <label v-if="opponentMode === 'computer'">
          Computer
          <select v-model="botLevel" :disabled="isBotThinking" @change="changeBotLevel">
            <option value="beginner">Beginner</option>
            <option value="club">Club</option>
            <option value="challenger">Challenger</option>
          </select>
        </label>
      </div>
    </div>

    <div class="play-grid">
      <div class="play-surface">
        <div v-if="viewMode === 'board'" class="board-frame">
          <div class="board-wrap">
            <div
              class="chessboard"
              :aria-label="`Chessboard. ${status}`"
              :aria-busy="isBotThinking"
            >
              <button
                v-for="cell in boardSquares"
                :key="cell.square"
                class="square"
                :class="[
                  game.squareColor(cell.square) === 'light' ? 'square-light' : 'square-dark',
                  {
                    'square-selected': selectedSquare === cell.square,
                    'square-target': legalTargetSquares.has(cell.square),
                    'square-capture': legalTargetSquares.has(cell.square) && cell.piece,
                    'square-last-move': isLastMoveSquare(cell.square),
                  },
                ]"
                type="button"
                :data-square="cell.square"
                :aria-label="squareLabel(cell.square)"
                @click="selectSquare(cell.square)"
              >
                <span v-if="showRankLabel(cell.square)" class="rank-label" aria-hidden="true">{{ cell.square[1] }}</span>
                <span
                  v-if="cell.piece"
                  class="piece"
                  :class="cell.piece.color === 'w' ? 'piece-white' : 'piece-black'"
                  aria-hidden="true"
                >{{ pieceGlyphs[cell.piece.color][cell.piece.type] }}</span>
                <span v-else-if="legalTargetSquares.has(cell.square)" class="target-dot" aria-hidden="true" />
                <span v-if="showFileLabel(cell.square)" class="file-label" aria-hidden="true">{{ cell.square[0] }}</span>
              </button>
            </div>

            <dialog
              v-if="pendingPromotion"
              ref="promotionDialog"
              class="promotion-dialog"
              aria-labelledby="promotion-heading"
              @cancel.prevent="cancelPromotion"
            >
              <p id="promotion-heading">
                Promote your pawn
              </p>
              <div class="promotion-options">
                <button
                  ref="promotionQueenButton"
                  type="button"
                  aria-label="Promote to Queen"
                  @click="completePromotion('q')"
                >
                  <span aria-hidden="true">{{ pieceGlyphs[game.turn()].q }}</span>
                  Queen
                </button>
                <button
                  v-for="option in promotionOptions.slice(1)"
                  :key="option.piece"
                  type="button"
                  :aria-label="`Promote to ${option.label}`"
                  @click="completePromotion(option.piece)"
                >
                  <span aria-hidden="true">{{ pieceGlyphs[game.turn()][option.piece] }}</span>
                  {{ option.label }}
                </button>
              </div>
              <button class="text-action" type="button" @click="cancelPromotion">
                Cancel
              </button>
            </dialog>
          </div>
        </div>

        <div v-else class="headless-console">
          <div class="terminal-heading">
            <span class="terminal-lights" aria-hidden="true"><i /><i /><i /></span>
            <span>notation session</span>
          </div>

          <div class="terminal-body">
            <p><span aria-hidden="true">&gt;</span> {{ status }}</p>
            <p v-if="lastMove">
              <span aria-hidden="true">&gt;</span> Last move: <strong>{{ lastMove.san }}</strong> ({{ moveToUci(lastMove) }})
            </p>
            <p v-if="isBotThinking">
              <span aria-hidden="true">&gt;</span> Computer search in progress…
            </p>

            <form class="notation-form" @submit.prevent="submitNotationMove">
              <label for="notation-move">Enter a move</label>
              <div class="notation-input-row">
                <span aria-hidden="true">$</span>
                <input
                  id="notation-move"
                  ref="notationMoveInput"
                  v-model="notationInput"
                  name="move"
                  type="text"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="e4, Nf3, or e2e4"
                  :disabled="!canHumanMove"
                  :aria-describedby="inputError ? 'notation-error notation-help' : 'notation-help'"
                >
                <button type="submit" :disabled="!canHumanMove">
                  Play move
                </button>
              </div>
              <p id="notation-help" class="terminal-help">
                Use SAN such as Nf3 or coordinates such as g1f3. Promotions accept e7e8q.
              </p>
              <p v-if="inputError" id="notation-error" class="input-error" role="alert">
                {{ inputError }}
              </p>
            </form>

            <details>
              <summary>Legal moves ({{ legalMoves.length }})</summary>
              <p class="code-line">
                {{ legalMoves.join(' · ') || 'None' }}
              </p>
            </details>

            <details>
              <summary>Position (FEN)</summary>
              <code class="code-line">{{ fen }}</code>
            </details>

            <details>
              <summary>Game record (PGN)</summary>
              <pre class="code-line">{{ pgn }}</pre>
            </details>
          </div>
        </div>
      </div>

      <aside class="game-panel" aria-label="Game status and history">
        <div>
          <p class="turn-label">
            {{ isBotThinking ? 'Computer thinking' : status }}
          </p>
          <h3>{{ panelHeading }}</h3>
          <p v-if="opponentMode === 'computer'">
            You are {{ humanColor === 'w' ? 'White' : 'Black' }}. The computer uses deterministic alpha-beta search, with every move verified by the same rules engine as yours.
          </p>
          <p v-else>
            Pass the device after each move. White and Black share the same board or notation session.
          </p>
        </div>

        <div class="game-actions" aria-label="Game actions">
          <button class="primary-action" type="button" @click="startNewGame">
            New game
          </button>
          <button class="secondary-action" type="button" :disabled="!canUndo" @click="undoMove">
            Undo
          </button>
          <button v-if="viewMode === 'board'" class="secondary-action" type="button" @click="flipBoard">
            Flip board
          </button>
        </div>

        <div class="history-block">
          <div class="history-heading">
            <h4>Moves</h4>
            <span>{{ history.length }} {{ history.length === 1 ? 'ply' : 'plies' }}</span>
          </div>
          <ol v-if="moveRows.length" class="move-history" aria-label="Move history">
            <li v-for="row in moveRows" :key="row.number">
              <span class="move-number">{{ row.number }}.</span>
              <span>{{ row.white?.san ?? '…' }}</span>
              <span>{{ row.black?.san ?? '…' }}</span>
            </li>
          </ol>
          <p v-else class="empty-history">
            Your moves will appear here.
          </p>
        </div>
      </aside>
    </div>

    <p class="visually-hidden" aria-live="polite" aria-atomic="true">
      {{ liveMessage }}
    </p>
  </section>
</template>
