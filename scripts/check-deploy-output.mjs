#!/usr/bin/env node
import { access, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const paths = {
  apiApp: resolve(projectRoot, 'back-end/dist/app.js'),
  apiServer: resolve(projectRoot, 'back-end/dist/server.js'),
  directNginx: resolve(projectRoot, 'deploy/nginx/chess.jacobdanderson.net.server.conf'),
  directPrepare: resolve(projectRoot, 'deploy/systemd/prepare-release.sh'),
  directPromote: resolve(projectRoot, 'deploy/systemd/promote-release.sh'),
  directService: resolve(projectRoot, 'deploy/systemd/chess-jacobdanderson-net-api.service'),
  frontendHealth: resolve(projectRoot, 'front-end/.output/public/healthz'),
  frontendIndex: resolve(projectRoot, 'front-end/.output/public/index.html'),
  frontendNotices: resolve(projectRoot, 'front-end/.output/public/THIRD_PARTY_NOTICES.txt'),
  frontendAssets: resolve(projectRoot, 'front-end/.output/public/_nuxt'),
  netlifyConfig: resolve(projectRoot, 'netlify.toml'),
  netlifyFunction: resolve(projectRoot, 'netlify/functions/api.ts'),
}

for (const path of Object.values(paths))
  await access(path)

const [apiApp, apiServer, directNginx, directPrepare, directPromote, directService, frontendHealth, frontendIndex, frontendNotices, frontendAssets, netlifyConfig] = await Promise.all([
  readFile(paths.apiApp, 'utf8'),
  readFile(paths.apiServer, 'utf8'),
  readFile(paths.directNginx, 'utf8'),
  readFile(paths.directPrepare, 'utf8'),
  readFile(paths.directPromote, 'utf8'),
  readFile(paths.directService, 'utf8'),
  readFile(paths.frontendHealth, 'utf8'),
  readFile(paths.frontendIndex, 'utf8'),
  readFile(paths.frontendNotices, 'utf8'),
  readdir(paths.frontendAssets),
  readFile(paths.netlifyConfig, 'utf8'),
])

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

assert(JSON.parse(frontendHealth).ok === true, 'Static health check must return {"ok":true}')
assert(/http-equiv=["']content-security-policy["']/i.test(frontendIndex), 'Generated HTML must include a CSP meta policy')
assert(frontendNotices.includes('Copyright (c) 2025, Jeff Hlywa'), 'Browser distribution must include the chess.js notice')
assert(frontendAssets.some(name => /^chess-bot\.worker-.+\.js$/.test(name)), 'Frontend output must include the computer worker')
assert(!frontendIndex.includes('http://localhost:3006'), 'Generated HTML must not embed the local API origin')
assert(!frontendIndex.includes('/api/pageview'), 'Generated HTML must not reference the removed mutable endpoint')
assert(!apiApp.includes('startedAt') && !apiApp.includes('pageview'), 'Compiled API must not expose process timing or page-view state')
assert(!apiApp.includes('sourceMappingURL') && !apiServer.includes('sourceMappingURL'), 'Production API output must not expose source maps')
assert(/^User=chess-site$/m.test(directService), 'Direct API service must use its unprivileged account')
assert(/^ExecStart=\/opt\/node-24\.18\.1\/bin\/node /m.test(directService), 'Direct API must select the approved runtime without replacing the host-wide binary')
assert(/^Environment=HOST=127\.0\.0\.1$/m.test(directService), 'Direct API service must bind only to loopback')
assert(/^NoNewPrivileges=true$/m.test(directService), 'Direct API service must deny privilege escalation')
assert(/^ProtectSystem=strict$/m.test(directService), 'Direct API service must have a read-only system view')
assert(!/0\.0\.0\.0|docker/i.test(directService), 'Direct API service must not depend on a container listener')
assert(/proxy_pass http:\/\/127\.0\.0\.1:3006;/.test(directNginx), 'Nginx must proxy the API to loopback')
assert(/X-Forwarded-For \$remote_addr/.test(directNginx), 'Nginx must replace, not append, the forwarded chain')
assert(!/\$proxy_add_x_forwarded_for/.test(directNginx), 'Nginx must not trust a client-supplied forwarded chain')
const directAssetLocation = directNginx.match(/location \/_nuxt\/ \{([\s\S]*?)\n\}/)?.[1] ?? ''
assert(/Cross-Origin-Embedder-Policy "require-corp"/.test(directAssetLocation), 'Nginx assets must retain the worker isolation header')
assert(/Cross-Origin-Resource-Policy "same-origin"/.test(directAssetLocation), 'Nginx assets must retain the worker resource header')
const netlifyAssetHeaders = netlifyConfig.slice(netlifyConfig.indexOf('for = "/_nuxt/*"'))
assert(/Cross-Origin-Embedder-Policy = "require-corp"/.test(netlifyAssetHeaders), 'Netlify assets must retain the worker isolation header')
assert(/Cross-Origin-Resource-Policy = "same-origin"/.test(netlifyAssetHeaders), 'Netlify assets must retain the worker resource header')
assert(/npm audit signatures/.test(directPrepare), 'Direct preparation must verify package signatures')
assert(/origin\/main/.test(directPrepare), 'Direct preparation must require the exact remote main revision')
assert(/runtime-artifact\.py/.test(directPromote) && /trusted-paths\.py/.test(directPromote), 'Promotion must verify artifacts through protected administrative helpers')
assert(/--ipv4/.test(directPromote) && /--ipv6/.test(directPromote), 'Promotion must gate both address families')
assert(/if \[\[ -L "\$current_link" \]\]; then/.test(directPromote), 'First promotion must not invent a rollback target')
assert(/restoring the previous direct release/i.test(directPromote), 'Promotion must provide source rollback')

for (const removedPath of ['.dockerignore', 'Dockerfile', 'compose.yaml', 'docker-compose.yml', 'nginx.conf']) {
  try {
    await access(resolve(projectRoot, removedPath))
    throw new Error(`${removedPath} must be absent from the direct production template`)
  }
  catch (error) {
    if (error?.code !== 'ENOENT')
      throw error
  }
}

console.log('Deployment output check passed for direct systemd/Nginx and Netlify production paths.')
