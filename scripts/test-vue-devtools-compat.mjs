import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(path.join(root, 'package.json'))
const source = path.join(root, 'vendor/vite-plugin-vue-devtools')

test('Vue DevTools keeps every upstream executable, type, client and license byte', async () => {
  const upstream = JSON.parse(await readFile(path.join(source, 'UPSTREAM.json'), 'utf8'))
  assert.equal(Object.keys(upstream.files).length, 38)
  const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
  assert.deepEqual(metadata, {
    ...upstream.package,
    version: '9.0.0-rc.2-webops.1',
    peerDependencies: {
      ...upstream.package.peerDependencies,
      '@vitejs/devtools': '^0.7.6 || ^0.8.0',
    },
  })
  for (const [filename, digest] of Object.entries(upstream.files)) {
    const original = await readFile(path.join(source, filename))
    assert.equal(createHash('sha256').update(original).digest('hex'), digest, filename)
    const installed = await readFile(path.join(path.dirname(require.resolve('vite-plugin-vue-devtools/package.json')), filename))
    assert.ok(installed.equals(original), filename)
  }
})

test('the complete lock binds every affected Vue plugin to the reviewed package', async () => {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
  const plugins = Object.entries(lock.packages).filter(([filename]) => filename.endsWith('/vite-plugin-vue-devtools'))
  assert.ok(plugins.length > 0)
  for (const [filename, metadata] of plugins) {
    assert.equal(metadata.version, '9.0.0-rc.2-webops.1', filename)
    assert.equal(metadata.resolved, 'file:vendor/vite-plugin-vue-devtools-9.0.0-rc.2-webops.1.tgz')
    assert.equal(metadata.peerDependencies['@vitejs/devtools'], '^0.7.6 || ^0.8.0')
  }
})
