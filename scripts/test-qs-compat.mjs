import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const backendRequire = createRequire(new URL('../back-end/package.json', import.meta.url))
const browser = await readFile(new URL('../vendor/qs/dist/qs.js', import.meta.url), 'utf8')
const variants = [
  {
    name: 'commonjs',
    library: backendRequire('qs'),
    input: text => JSON.parse(text),
    prototype: Object.prototype,
  },
]

for (const mode of ['module', 'global', 'amd']) {
  const context = vm.createContext(mode === 'module'
    ? {
        module: { exports: {} },
        exports: {},
      }
    : {})
  if (mode === 'amd') {
    context.define = (_dependencies, factory) => {
      context.result = factory()
    }
    context.define.amd = {}
  }
  vm.runInContext(browser, context)
  variants.push({
    name: `browser-${mode}`,
    library: mode === 'module'
      ? context.module.exports
      : mode === 'amd'
        ? context.result
        : context.Qs,
    input: text => vm.runInContext(`JSON.parse(${JSON.stringify(text)})`, context),
    prototype: vm.runInContext('Object.prototype', context),
  })
}

for (const { name, library, input, prototype } of variants) {
  test(`${name}: nested object copies retain safe prototypes and caller data`, () => {
    const original = input('{"filter":{"__proto__":{"injected":true},"label":"kept"},"items":[{"__proto__":{"injected":true},"label":"item"}]}')
    const before = JSON.stringify(original)
    const parsed = library.parse(original)
    for (const item of [parsed.filter, parsed.items[0]]) {
      assert.equal(Object.getPrototypeOf(item), prototype)
      assert.equal(item.injected, undefined)
    }
    assert.equal(parsed.filter.label, 'kept')
    assert.equal(parsed.items[0].label, 'item')
    assert.equal(JSON.stringify(original), before)
    assert.equal(Object.prototype.injected, undefined)
  })

  test(`${name}: native comma-array coercion is safe across realms`, () => {
    for (const encodeValuesOnly of [false, true]) {
      for (const value of ['blocked', 1, null, false, {}]) {
        const serialized = JSON.stringify({
          items: [
            [
              { toString: value },
            ],
          ],
        })
        const inputs = [
          input(serialized),
          vm.runInNewContext(`JSON.parse(${JSON.stringify(serialized)})`),
        ]
        for (const record of inputs)
          assert.doesNotThrow(() => library.stringify(record, { arrayFormat: 'comma', encodeValuesOnly }))
      }
    }
  })

  test(`${name}: custom conversion and join functions retain their receiver and call count`, () => {
    for (const property of ['toString', 'join']) {
      const nested = input('[1,2]')
      let calls = 0
      nested[property] = function () {
        calls += 1
        assert.equal(this, nested)
        return 'custom'
      }
      assert.equal(library.stringify({
        items: [nested],
      }, { arrayFormat: 'comma' }), 'items=custom')
      assert.equal(calls, 1)
    }
    const nested = input('[1,2]')
    nested.toString = Object.prototype.toString
    assert.equal(library.stringify({
      items: [nested],
    }, { arrayFormat: 'comma' }), 'items=%5Bobject%20Array%5D')
  })

  test(`${name}: ordinary parsing, formats and limits remain intact`, () => {
    assert.equal(JSON.stringify(library.parse('tag=one&tag=two')), '{"tag":["one","two"]}')
    assert.equal(JSON.stringify(library.parse('filter[0]=one&filter[1]=two')), '{"filter":["one","two"]}')
    assert.equal(JSON.stringify(library.parse('filter.name=one', { allowDots: true })), '{"filter":{"name":"one"}}')
    assert.equal(library.stringify({
      items: ['one', 'two'],
    }, { arrayFormat: 'comma' }), 'items=one%2Ctwo')
    assert.equal(library.stringify({ text: 'one two' }, { format: 'RFC1738' }), 'text=one+two')
    assert.equal(library.stringify({ text: 'one two' }), 'text=one%20two')
    assert.throws(() => library.parse('one=1&two=2', {
      parameterLimit: 1,
      throwOnLimitExceeded: true,
    }), { name: 'RangeError' })
  })
}

test('the installed qs runtime is byte-bound to the reviewed source', async () => {
  for (const relative of [
    'package.json',
    'LICENSE.md',
    'lib/index.js',
    'lib/formats.js',
    'lib/parse.js',
    'lib/stringify.js',
    'lib/utils.js',
    'dist/qs.js',
    'dist/qs.js.LICENSES.txt',
  ]) {
    const installed = backendRequire.resolve(`qs/${relative}`)
    assert.deepEqual(await readFile(installed), await readFile(new URL(`../vendor/qs/${relative}`, import.meta.url)))
  }
})
