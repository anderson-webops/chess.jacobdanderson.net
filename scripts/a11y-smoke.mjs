import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const axeSourcePath = require.resolve('axe-core/axe.min.js')
const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const frontendPackagePath = resolve(projectRoot, 'front-end/package.json')
const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, 'utf8'))

const siteName = 'Jacob Anderson Chess'
const frontendKind = 'nuxt'
const frontendPort = Number(process.env.A11Y_FRONTEND_PORT || 3356)
const apiPort = Number(process.env.A11Y_API_PORT || 3056)
const baseUrl = `http://127.0.0.1:${frontendPort}`
const apiUrl = `http://127.0.0.1:${apiPort}/api`
const routes = ['/']
const gameViews = ['board', 'headless']
const colorSchemes = (process.env.A11Y_COLOR_SCHEMES || 'light,dark')
  .split(',')
  .map(scheme => scheme.trim())
  .filter(Boolean)

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)

const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (chromePath)
  process.env.PUPPETEER_EXECUTABLE_PATH = chromePath

function writeServerLine(prefix, data) {
  const text = data.toString().trim()
  if (text)
    process.stderr.write(`[${prefix}] ${text}\n`)
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': baseUrl,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function emptyCollection() {
  return {
    items: [],
    results: [],
    data: [],
    records: [],
    total: 0,
  }
}

function responseFor(url) {
  const pathname = url.pathname.replace(/\/+/g, '/')
  if (pathname.endsWith('/pageview'))
    return { pageview: 0, startAt: Date.now() }
  if (pathname.includes('/session'))
    return { authenticated: false, user: null, admin: null }
  if (pathname.includes('/auth') || pathname.includes('/login'))
    return { authenticated: false, user: null, token: '' }
  if (pathname.includes('/me') || pathname.includes('/account'))
    return { user: null, authenticated: false }
  if (pathname.includes('/quotes'))
    return []
  if (pathname.includes('/availability')) {
    const start = new Date(Date.now() + 24 * 60 * 60_000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60_000)
    return [{ id: 'a11y-slot', title: 'Available', start: start.toISOString(), end: end.toISOString() }]
  }
  if (pathname.includes('/topics'))
    return { topics: [], claims: [], ...emptyCollection() }
  if (pathname.includes('/claims'))
    return { claims: [], ...emptyCollection() }
  if (pathname.includes('/search'))
    return { query: url.searchParams.get('q') || '', ...emptyCollection() }
  if (pathname.includes('/submissions') || pathname.includes('/board') || pathname.includes('/items'))
    return emptyCollection()
  if (pathname.includes('/service-directory'))
    return { services: [], categories: [], ...emptyCollection() }
  if (pathname.includes('/elections'))
    return { elections: [], ...emptyCollection() }
  if (pathname.includes('/jurisdictions') || pathname.includes('/locations') || pathname.includes('/districts'))
    return { jurisdictions: [], locations: [], districts: [], ...emptyCollection() }
  if (pathname.includes('/representatives') || pathname.includes('/candidate'))
    return { representatives: [], candidates: [], ...emptyCollection() }
  if (pathname.includes('/sources'))
    return { sources: [], ...emptyCollection() }
  if (pathname.includes('/products'))
    return []
  if (pathname.includes('/contact') || pathname.includes('/cart') || pathname.includes('/orders'))
    return { ok: true }
  return { ok: true, ...emptyCollection() }
}

function createMockApiServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${apiPort}`)
    if (req.method === 'OPTIONS') {
      sendJson(res, {}, 204)
      return
    }
    sendJson(res, responseFor(url))
  })
}

async function listen(server, port) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolveListen)
  })
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok)
        return
      lastError = new Error(`${url} returned ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 400))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

function startFrontend() {
  const isNuxt = frontendKind === 'nuxt' || Object.values(frontendPackage.scripts || {}).some(script => String(script).includes('nuxt'))
  const args = isNuxt
    ? ['exec', '-w', 'front-end', '--', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', String(frontendPort)]
    : ['exec', '-w', 'front-end', '--', 'vite', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort']

  const child = spawn('npm', args, {
    cwd: projectRoot,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      BROWSER: 'none',
      DISABLE_ANALYTICS: 'true',
      DEV_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
      NUXT_A11Y_SCAN: 'true',
      NUXT_TELEMETRY_DISABLED: '1',
      NUXT_PUBLIC_APP_URL: baseUrl,
      NUXT_PUBLIC_SITE_URL: baseUrl,
      NUXT_PUBLIC_API_BASE: apiUrl,
      NUXT_PUBLIC_API_BASE_URL: apiUrl,
      PUBLIC_API_BASE: apiUrl,
      INTERNAL_API_BASE: apiUrl,
      API_INTERNAL_BASE: apiUrl,
      ADMIN_API_BASE: apiUrl,
      NUXT_ADMIN_API_BASE: apiUrl,
      ADMIN_API_KEY: 'a11y-smoke',
      NUXT_ADMIN_API_KEY: 'a11y-smoke',
      ADMIN_SESSION_SECRET: 'a11y-smoke-session-secret',
      NUXT_ADMIN_SESSION_SECRET: 'a11y-smoke-session-secret',
      NUXT_SESSION_SIGNING_SECRET: 'a11y-smoke-session-secret',
      SESSION_SIGNING_SECRET: 'a11y-smoke-session-secret',
      NUXT_PUBLIC_BACKEND_MODE: 'mock',
      NUXT_PUBLIC_BILLING_MODE: 'mock',
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: 'true',
      NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE: 'true',
      NUXT_PUBLIC_PORTAL_URL: baseUrl,
      VITE_API_BASE_URL: apiUrl,
      VITE_API_URL: apiUrl,
      VITE_SSG_API_BASE_URL: apiUrl,
      VITE_PUBLIC_SITE_ORIGIN: baseUrl,
      VITE_SHOW_AD_SLOTS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', data => writeServerLine(isNuxt ? 'nuxt' : 'vite', data))
  child.stderr.on('data', data => writeServerLine(isNuxt ? 'nuxt' : 'vite', data))
  return child
}

function delay(durationMs) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, durationMs))
}

function signalProcessTree(child, signal) {
  if (!child.pid)
    return false

  try {
    if (process.platform === 'win32')
      return child.kill(signal)

    process.kill(-child.pid, signal)
    return true
  }
  catch (error) {
    if (error?.code === 'ESRCH')
      return false
    throw error
  }
}

async function stopProcessTree(child) {
  if (!child.pid)
    return

  signalProcessTree(child, 'SIGTERM')
  await delay(1_000)

  if (process.platform === 'win32') {
    if (child.exitCode === null)
      signalProcessTree(child, 'SIGKILL')
  }
  else {
    try {
      process.kill(-child.pid, 0)
      signalProcessTree(child, 'SIGKILL')
    }
    catch (error) {
      if (error?.code !== 'ESRCH')
        throw error
    }
  }

  await Promise.race([
    new Promise(resolveClose => child.once('close', resolveClose)),
    delay(1_000),
  ])
}

function closeServer(server) {
  return new Promise(resolveClose => server.close(resolveClose))
}

async function analyzePage(browser, route, scheme, gameView) {
  const url = `${baseUrl}${route}`
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 })
  if (scheme === 'dark' || scheme === 'light') {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 }).catch(() => {})
  if (gameView === 'headless') {
    await page.select('#interface-mode', 'headless')
    await page.waitForSelector('.headless-console')
  }
  await page.addScriptTag({ path: axeSourcePath })
  const result = await page.evaluate(async () => {
    return await globalThis.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    })
  })
  await page.close()
  return {
    url,
    gameView,
    scheme,
    violations: result.violations.filter(violation => violation.id !== 'frame-tested'),
  }
}

async function readGameState(page) {
  return await page.evaluate(() => {
    const normalize = value => value?.replace(/\s+/g, ' ').trim() ?? null
    const input = document.querySelector('#notation-move')

    return {
      boardBusy: document.querySelector('.chessboard')?.getAttribute('aria-busy') ?? null,
      firstWhiteMove: normalize(document.querySelector('.move-history li span:nth-child(2)')?.textContent),
      heading: normalize(document.querySelector('.game-panel h3')?.textContent),
      history: normalize(document.querySelector('.history-heading span')?.textContent),
      inputDisabled: input instanceof HTMLInputElement ? input.disabled : null,
      inputValue: input instanceof HTMLInputElement ? input.value : null,
      interfaceMode: document.querySelector('#interface-mode')?.value ?? null,
      liveMessage: normalize(document.querySelector('[aria-live="polite"]')?.textContent),
      opponentMode: document.querySelector('#opponent-mode')?.value ?? null,
      status: normalize(document.querySelector('.turn-label')?.textContent),
    }
  })
}

async function assertBoardGeometry(page, label, expectedSize) {
  const geometry = await page.evaluate(() => {
    const board = document.querySelector('.chessboard')
    if (!(board instanceof HTMLElement))
      return null

    const boardRect = board.getBoundingClientRect()
    const squares = [...board.querySelectorAll(':scope > .square')].map((square) => {
      const rect = square.getBoundingClientRect()
      return {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      }
    })

    return {
      board: {
        height: boardRect.height,
        width: boardRect.width,
      },
      squares,
    }
  })

  const tolerance = 1
  const fail = (reason) => {
    throw new Error(`${label}: ${reason}; geometry ${JSON.stringify(geometry)}`)
  }
  const clusterPositions = (values) => {
    const positions = []
    for (const value of [...values].sort((left, right) => left - right)) {
      const position = positions.find(entry => Math.abs(entry.value - value) <= tolerance)
      if (position)
        position.count += 1
      else
        positions.push({ count: 1, value })
    }
    return positions
  }

  if (!geometry)
    fail('visible board was not found')
  if (geometry.squares.length !== 64)
    fail(`expected 64 squares, received ${geometry.squares.length}`)
  if (Math.abs(geometry.board.width - geometry.board.height) > tolerance)
    fail(`board is not square (${geometry.board.width} x ${geometry.board.height})`)

  const widths = geometry.squares.map(square => square.width)
  const heights = geometry.squares.map(square => square.height)
  if (Math.max(...widths) - Math.min(...widths) > tolerance)
    fail('square widths are not equal')
  if (Math.max(...heights) - Math.min(...heights) > tolerance)
    fail('square heights are not equal')
  if (geometry.squares.some(square => Math.abs(square.width - square.height) > tolerance))
    fail('one or more cells are not square')

  const columns = clusterPositions(geometry.squares.map(square => square.left))
  const rows = clusterPositions(geometry.squares.map(square => square.top))
  if (columns.length !== 8 || columns.some(column => column.count !== 8))
    fail(`expected eight columns of eight squares, received ${JSON.stringify(columns)}`)
  if (rows.length !== 8 || rows.some(row => row.count !== 8))
    fail(`expected eight rows of eight squares, received ${JSON.stringify(rows)}`)

  if (expectedSize) {
    if (Math.abs(geometry.board.width - expectedSize.width) > tolerance
      || Math.abs(geometry.board.height - expectedSize.height) > tolerance) {
      fail(`board changed size from ${expectedSize.width} x ${expectedSize.height}`)
    }
  }

  return geometry.board
}

async function waitForGameState(page, expected, label, timeoutMs = 10_000) {
  try {
    await page.waitForFunction((expectedState) => {
      const normalize = value => value?.replace(/\s+/g, ' ').trim() ?? null
      const input = document.querySelector('#notation-move')
      const currentState = {
        boardBusy: document.querySelector('.chessboard')?.getAttribute('aria-busy') ?? null,
        firstWhiteMove: normalize(document.querySelector('.move-history li span:nth-child(2)')?.textContent),
        heading: normalize(document.querySelector('.game-panel h3')?.textContent),
        history: normalize(document.querySelector('.history-heading span')?.textContent),
        inputDisabled: input instanceof HTMLInputElement ? input.disabled : null,
        inputValue: input instanceof HTMLInputElement ? input.value : null,
        interfaceMode: document.querySelector('#interface-mode')?.value ?? null,
        liveMessage: normalize(document.querySelector('[aria-live="polite"]')?.textContent),
        opponentMode: document.querySelector('#opponent-mode')?.value ?? null,
        status: normalize(document.querySelector('.turn-label')?.textContent),
      }

      return Object.entries(expectedState).every(([key, value]) => currentState[key] === value)
    }, { timeout: timeoutMs }, expected)
  }
  catch (error) {
    const actual = await readGameState(page)
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`, { cause: error })
  }
}

async function playHeadlessMove(page, move, expectedPlyCount) {
  await waitForGameState(page, {
    inputDisabled: false,
    inputValue: '',
  }, `Before playing ${move}`)

  await page.type('#notation-move', move)
  const historyUpdated = page.waitForFunction((expectedHistory) => {
    return document.querySelector('.history-heading span')?.textContent?.replace(/\s+/g, ' ').trim() === expectedHistory
  }, { timeout: 10_000 }, `${expectedPlyCount} ${expectedPlyCount === 1 ? 'ply' : 'plies'}`)

  await Promise.all([
    historyUpdated,
    page.click('.notation-input-row button[type="submit"]'),
  ])
}

async function runGameInteractionSmoke(browser) {
  const page = await browser.newPage()
  page.setDefaultTimeout(30_000)
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 })

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 }).catch(() => {})
    await page.select('#opponent-mode', 'local')
    await page.select('#interface-mode', 'headless')
    await page.waitForSelector('.headless-console')

    const activeSession = {
      interfaceMode: 'headless',
      opponentMode: 'local',
    }

    await waitForGameState(page, {
      ...activeSession,
      heading: 'White player',
      history: '0 plies',
      inputDisabled: false,
      inputValue: '',
      status: 'White to move.',
    }, 'Initial local headless game')

    await playHeadlessMove(page, 'f3', 1)
    await playHeadlessMove(page, 'e5', 2)
    await playHeadlessMove(page, 'g4', 3)
    await playHeadlessMove(page, 'Qh4#', 4)
    await waitForGameState(page, {
      ...activeSession,
      heading: 'Game complete',
      history: '4 plies',
      inputDisabled: true,
      inputValue: '',
      status: 'Black wins by checkmate.',
    }, 'Fool\'s Mate terminal state')

    await page.click('.game-actions .secondary-action')
    await waitForGameState(page, {
      ...activeSession,
      heading: 'Black player',
      history: '3 plies',
      inputDisabled: false,
      inputValue: '',
      status: 'Black to move.',
    }, 'Undo recovery')

    await playHeadlessMove(page, 'Qh4#', 4)
    await waitForGameState(page, {
      ...activeSession,
      heading: 'Game complete',
      history: '4 plies',
      inputDisabled: true,
      inputValue: '',
      status: 'Black wins by checkmate.',
    }, 'Replayed Fool\'s Mate terminal state')

    await page.click('.game-actions .primary-action')
    await waitForGameState(page, {
      ...activeSession,
      heading: 'White player',
      history: '0 plies',
      inputDisabled: false,
      inputValue: '',
      status: 'White to move.',
    }, 'New game recovery')

    console.log(`interaction ok: ${baseUrl}/ [local friend, headless, Fool's Mate, Undo, replay, New game]`)
  }
  finally {
    await page.close()
  }
}

async function runComputerOpponentSmoke(browser) {
  const page = await browser.newPage()
  const browserFailures = []
  page.setDefaultTimeout(30_000)
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    if (message.type() === 'error')
      browserFailures.push(`console error: ${message.text()}`)
  })
  page.on('pageerror', error => browserFailures.push(`page error: ${error.message}`))
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'unknown reason'
    browserFailures.push(`request failed: ${request.method()} ${request.url()} (${reason})`)
  })

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 }).catch(() => {})
    await page.waitForSelector('.chessboard [data-square="e2"]')

    const activeSession = {
      interfaceMode: 'board',
      opponentMode: 'computer',
    }

    await waitForGameState(page, {
      ...activeSession,
      boardBusy: 'false',
      heading: 'Your turn',
      history: '0 plies',
      status: 'White to move.',
    }, 'Initial computer game')
    const initialBoardSize = await assertBoardGeometry(page, 'Initial desktop board')

    await page.click('[data-square="e2"]')
    await page.waitForFunction(() => {
      return document.querySelector('[data-square="e2"]')?.getAttribute('aria-label')?.includes('selected')
    }, { timeout: 10_000 })
    await page.click('[data-square="e4"]')

    await waitForGameState(page, {
      ...activeSession,
      boardBusy: 'false',
      firstWhiteMove: 'e4',
      heading: 'Your turn',
      history: '2 plies',
      status: 'White to move.',
    }, 'Computer reply and returned human turn', 30_000)
    await assertBoardGeometry(page, 'Moved desktop board', initialBoardSize)

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    const movedMobileBoardSize = await assertBoardGeometry(page, 'Moved mobile board')

    await page.click('.game-actions .primary-action')
    await waitForGameState(page, {
      ...activeSession,
      boardBusy: 'false',
      heading: 'Your turn',
      history: '0 plies',
      status: 'White to move.',
    }, 'Reset mobile computer game')
    await assertBoardGeometry(page, 'Reset mobile board', movedMobileBoardSize)

    if (browserFailures.length)
      throw new Error(`Browser failures during computer game: ${browserFailures.join(' | ')}`)

    console.log(`bot interaction ok: ${baseUrl}/ [computer, stable visible board, e2-e4, worker reply, responsive reset]`)
  }
  catch (error) {
    if (!browserFailures.length)
      throw error

    const state = await readGameState(page)
    throw new Error(`Computer-opponent browser failure: ${browserFailures.join(' | ')}; state ${JSON.stringify(state)}`, { cause: error })
  }
  finally {
    await page.close()
  }
}

const apiServer = createMockApiServer()
const frontendProcess = startFrontend()
let browser

try {
  await listen(apiServer, apiPort)
  await waitForHttp(baseUrl)

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const failures = []
  for (const route of routes) {
    for (const scheme of colorSchemes) {
      for (const gameView of gameViews) {
        const result = await analyzePage(browser, route, scheme, gameView)
        if (result.violations.length) {
          failures.push(result)
          continue
        }
        console.log(`a11y ok: ${result.url} [${scheme}, ${gameView}]`)
      }
    }
  }

  let interactionFailure
  try {
    await runGameInteractionSmoke(browser)
  }
  catch (error) {
    interactionFailure = error
  }

  let computerOpponentFailure
  try {
    await runComputerOpponentSmoke(browser)
  }
  catch (error) {
    computerOpponentFailure = error
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`\nAccessibility issues for ${siteName} at ${failure.url} [${failure.scheme}, ${failure.gameView}]`)
      for (const violation of failure.violations) {
        console.error(`- [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}`)
        console.error(`  ${violation.helpUrl}`)
        for (const node of violation.nodes) {
          console.error(`  ${node.target.join(', ')}`)
        }
      }
    }
    process.exitCode = 1
  }

  if (interactionFailure) {
    console.error(`\nGame interaction issue for ${siteName} at ${baseUrl}/`)
    console.error(interactionFailure)
    process.exitCode = 1
  }

  if (computerOpponentFailure) {
    console.error(`\nComputer-opponent interaction issue for ${siteName} at ${baseUrl}/`)
    console.error(computerOpponentFailure)
    process.exitCode = 1
  }
}
finally {
  if (browser)
    await browser.close()
  await stopProcessTree(frontendProcess)
  await closeServer(apiServer)
}
