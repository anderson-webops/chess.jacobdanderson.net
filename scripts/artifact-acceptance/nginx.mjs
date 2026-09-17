import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import process from 'node:process'

assert.equal(process.cwd(), '/app')
const root = '/tmp/chess-edge'
await mkdir(root, { recursive: true })
const certificate = `${root}/fixture.crt`
const key = `${root}/fixture.key`
const generated = spawnSync('/usr/bin/openssl', [
  'req',
  '-x509',
  '-config',
  '/dev/null',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-days',
  '1',
  '-subj',
  '/CN=fixture.invalid',
  '-addext',
  'subjectAltName=IP:127.0.0.1,IP:::1',
  '-keyout',
  key,
  '-out',
  certificate,
], { stdio: 'ignore', timeout: 10000 })
assert.equal(generated.status, 0, 'Synthetic TLS certificate generation failed')
const snippet = (await readFile('/harness/nginx-site.conf', 'utf8'))
  .replaceAll('/srv/chess.jacobdanderson.net/current', '/app')
await writeFile(`${root}/nginx.conf`, `
worker_processes 1;
daemon off;
pid ${root}/nginx.pid;
error_log stderr warn;
events { worker_connections 64; }
http {
  access_log off;
  include /harness/mime.types;
  client_body_temp_path ${root}/body;
  proxy_temp_path ${root}/proxy;
  fastcgi_temp_path ${root}/fastcgi;
  uwsgi_temp_path ${root}/uwsgi;
  scgi_temp_path ${root}/scgi;
  server {
    listen 127.0.0.1:18881 ssl;
    listen [::1]:18881 ssl;
    server_name fixture.invalid;
    ssl_certificate ${certificate};
    ssl_certificate_key ${key};
    ${snippet}
  }
}`)
const children = []
let diagnostics = ''
function start(command, args, env) {
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => {
      diagnostics = `${diagnostics}${data}`.slice(-4000)
    })
  }
  children.push(child)
  return child
}
async function request(origin, path, method = 'GET') {
  const args = ['--noproxy', '*', '--silent', '--show-error', '--max-time', '2', '--cacert', certificate, '--dump-header', `${root}/headers`, '--output', method === 'HEAD' ? '/dev/null' : `${root}/body.txt`, '--write-out', '%{http_code}']
  args.push(...(method === 'HEAD' ? ['--head'] : ['--request', method]), `${origin}${path}`)
  const result = spawnSync('/usr/bin/curl', args, { encoding: 'utf8', timeout: 3000, maxBuffer: 8192 })
  assert.equal(result.status, 0, `TLS request failed: ${result.stderr}; ${diagnostics}`)
  const headers = (await readFile(`${root}/headers`, 'utf8')).toLowerCase()
  const body = method === 'HEAD' ? '' : await readFile(`${root}/body.txt`, 'utf8')
  return { status: Number(result.stdout), headers, body }
}
async function stop(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null)
    return
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Artifact fixture did not drain'))
    }, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill(signal)
  })
}
try {
  start(process.execPath, ['/app/back-end/dist/server.js'], {
    PATH: '/runtime:/usr/bin:/bin',
    HOST: '127.0.0.1',
    PORT: '3006',
    TRUST_PROXY_HOPS: '1',
    NODE_ENV: 'production',
    DOTENV_CONFIG_PATH: '/absent',
  })
  start('/usr/sbin/nginx', ['-p', root, '-c', `${root}/nginx.conf`], { PATH: '/usr/bin:/bin' })
  const deadline = Date.now() + 15000
  while (true) {
    try {
      assert.equal((await request('https://127.0.0.1:18881', '/api/health')).status, 200)
      break
    }
    catch (error) {
      if (Date.now() >= deadline || children.some(child => child.exitCode !== null || child.signalCode !== null))
        throw error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  const metadata = JSON.parse(await readFile('/app/front-end/.output/public/release.json', 'utf8'))
  const manifest = JSON.parse(await readFile('/app/runtime-manifest.json', 'utf8'))
  const worker = Object.keys(manifest.files).find(name => /\/_nuxt\/chess-bot\.worker-.+\.js$/.test(name))
  assert.ok(worker)
  for (const origin of ['https://127.0.0.1:18881', 'https://[::1]:18881']) {
    const page = await request(origin, '/')
    assert.equal(page.status, 200)
    assert.match(page.body, /Chess/)
    assert.match(page.headers, /x-frame-options: deny/)
    assert.match(page.headers, /cross-origin-embedder-policy: require-corp/)
    assert.deepEqual(JSON.parse((await request(origin, '/release.json')).body), metadata)
    assert.equal((await request(origin, worker.replace('front-end/.output/public', ''))).status, 200)
    for (const method of ['GET', 'HEAD']) {
      for (const path of ['/healthz', '/api/health', '/api/healthz', '/api/readyz']) {
        const response = await request(origin, path, method)
        assert.equal(response.status, 200)
        assert.match(response.headers, /cache-control: no-store/)
        assert.doesNotMatch(response.headers, /(?:set-cookie|location):/)
        if (method === 'GET')
          assert.deepEqual(JSON.parse(response.body), { ok: true })
      }
    }
    assert.equal((await request(origin, '/api/health', 'POST')).status, 405)
    assert.equal((await request(origin, '/api/admin')).status, 404)
  }
  const sockets = []
  let retainedConnections
  try {
    await Promise.all(Array.from({ length: 260 }, () => new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: 3006 })
      sockets.push(socket)
      const timer = setTimeout(() => reject(new Error('Connection admission fixture timed out')), 2000)
      const settled = () => {
        clearTimeout(timer)
        resolve()
      }
      socket.once('connect', settled)
      socket.once('error', settled)
      socket.on('error', () => {})
    })))
    await new Promise(resolve => setTimeout(resolve, 300))
    retainedConnections = sockets.filter(socket => !socket.destroyed).length
    assert.ok(retainedConnections > 0 && retainedConnections <= 256, 'Compiled server must bound admitted connections')
    assert.ok(sockets.filter(socket => socket.destroyed).length >= 4, 'Excess sockets must be closed')
  }
  finally {
    for (const socket of sockets)
      socket.destroy()
  }
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal((await request('https://127.0.0.1:18881', '/api/readyz')).status, 200)
  console.log(JSON.stringify({ nginxArtifact: 'passed', ipv4: true, ipv6: true, tlsVerified: true, staticAndApi: true, retainedConnections, admissionRecovery: true }))
}
finally {
  const outcomes = await Promise.allSettled(children.map((child, index) => stop(child, index === 1 ? 'SIGQUIT' : 'SIGTERM')))
  for (const result of outcomes) {
    if (result.status === 'rejected') {
      console.error(result.reason)
      process.exitCode = 1
    }
  }
}
