import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)

test('the backend compiler CLI runs TypeScript 7 independently from Vue and ESLint compiler APIs', () => {
  const frontend = createRequire(path.join(root, 'front-end/package.json'))
  const backend = createRequire(path.join(root, 'back-end/package.json'))
  assert.equal(typeof frontend('typescript').createProgram, 'function')
  assert.equal(typeof backend('typescript').createSourceFile, 'function')
  assert.match(backend('typescript-native').version, /^7\./u)
  const version = execFileSync(process.execPath, [
    path.join(root, 'back-end/scripts/run-typescript.mjs'),
    '--version',
  ], { encoding: 'utf8', timeout: 30_000 })
  assert.match(version, /Version 7\./u)
})

test('the actual Node lint plugin reads its supported JS-YAML 5 workspace format', async (context) => {
  const config = createRequire(require.resolve('@antfu/eslint-config'))
  const pluginEntry = config.resolve('eslint-plugin-n')
  const plugin = createRequire(pluginEntry)
  assert.match(plugin('js-yaml/package.json').version, /^5\./u)
  const yaml = plugin('js-yaml')
  assert.throws(() => yaml.load('value: 1\nvalue: 2\n'))
  assert.throws(() => yaml.load('value: !!js/function "function () {}"'))
  const scratchRoot = path.join(root, '.ai-work/runs')
  await mkdir(scratchRoot, { recursive: true })
  const directory = await mkdtemp(path.join(scratchRoot, 'yaml-consumer-'))
  context.after(() => rm(directory, { recursive: true }))
  await writeFile(path.join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - front-end\n  - back-end\n')
  const helper = await import(pathToFileURL(path.join(path.dirname(pluginEntry), 'util/get-pnpm-workspace-yaml.js')))
  assert.deepEqual(helper.getPnpmWorkspacePatterns(directory), ['front-end', 'back-end'])
})
