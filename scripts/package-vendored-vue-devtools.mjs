import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path.join(root, 'vendor/vite-plugin-vue-devtools')
const archive = 'vite-plugin-vue-devtools-9.0.0-rc.2-webops.1.tgz'
const check = process.argv.length === 3 && process.argv[2] === '--check'
assert.ok(process.argv.length === 2 || check, 'Only --check is supported')
assert.ok(process.env.npm_execpath, 'Use the selected npm executable')
const upstream = JSON.parse(await readFile(path.join(source, 'UPSTREAM.json'), 'utf8'))
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
  const contents = await readFile(path.join(source, filename))
  assert.equal(createHash('sha256').update(contents).digest('hex'), digest, `${filename} must preserve upstream bytes`)
}

async function normalize(directory) {
  await chmod(directory, 0o755)
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await normalize(filename)
    }
    else {
      assert.ok(entry.isFile(), 'Package sources must be regular files')
      await chmod(filename, 0o644)
    }
  }
}

const scratchRoot = path.join(root, '.ai-work/runs')
await mkdir(scratchRoot, { recursive: true })
const scratch = await mkdtemp(path.join(scratchRoot, 'vue-devtools-pack-'))
try {
  const packagedSource = path.join(scratch, 'package')
  await cp(source, packagedSource, { recursive: true })
  await normalize(packagedSource)
  const result = spawnSync(process.execPath, [
    process.env.npm_execpath,
    'pack',
    packagedSource,
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    scratch,
  ], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const packages = JSON.parse(result.stdout)
  const receipt = Array.isArray(packages)
    ? packages[0]
    : packages['vite-plugin-vue-devtools']
  assert.equal(receipt.filename, archive)
  const generated = path.join(scratch, archive)
  const destination = path.join(root, 'vendor', archive)
  if (check)
    assert.ok((await readFile(destination)).equals(await readFile(generated)), 'The installed archive must reproduce from reviewed sources')
  else
    await cp(generated, destination)
  console.log(`Verified ${Object.keys(upstream.files).length} unchanged upstream files and reproducible Vue DevTools packaging`)
}
finally {
  await rm(scratch, { recursive: true, force: true })
}
