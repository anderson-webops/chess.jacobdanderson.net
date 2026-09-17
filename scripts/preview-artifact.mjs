// Local browser-test fixture only. Production continues to use host Nginx.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.argv[2] || '')
assert.ok(process.argv[2], 'Pass an already unpacked production artifact')
const checked = spawnSync('python3', ['-B', resolve(import.meta.dirname, 'runtime-artifact.py'), 'verify', root], {
  encoding: 'utf8',
  timeout: 15000,
  maxBuffer: 32768,
})
assert.equal(checked.status, 0, checked.stderr)
const manifest = JSON.parse(await readFile(resolve(root, 'runtime-manifest.json'), 'utf8'))
const prefix = 'front-end/.output/public/'
const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' }
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end()
    return
  }
  let path
  try {
    path = decodeURIComponent(new URL(request.url, 'http://fixture.invalid').pathname)
  }
  catch {
    response.writeHead(400).end()
    return
  }
  const relative = `${prefix}${path === '/' ? 'index.html' : path.slice(1)}`
  if (path.includes('..') || !Object.hasOwn(manifest.files, relative)) {
    response.writeHead(404).end()
    return
  }
  response.setHeader('Content-Type', contentTypes[extname(relative)] || 'application/octet-stream')
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  const stream = createReadStream(resolve(root, relative))
  response.once('close', () => stream.destroy())
  stream.once('error', () => response.destroy())
  stream.pipe(response)
})
server.listen(Number(process.env.A11Y_FRONTEND_PORT || 3356), '127.0.0.1', () => {
  console.log(JSON.stringify({ artifactPreview: `http://127.0.0.1:${server.address().port}`, commit: manifest.commit }))
})
let closing = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (closing)
      return
    closing = true
    server.close()
    server.closeAllConnections()
  })
}
