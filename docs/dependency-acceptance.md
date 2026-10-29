# Dependency acceptance

Nuxt DevTools 4.0.0 uses Vite DevTools 0.8.0, but its Vue plugin's 9.0.0-rc.2
distribution still declares only the 0.7.6 peer range. The maintained metadata
patch in `vendor/vite-plugin-vue-devtools` adds the 0.8 range without changing
any executable, type, client or license bytes. Its exact registry identity and
all 38 unchanged-file hashes are recorded alongside the original metadata.
The archive must reproduce from that source, and the complete installed graph
must pass `npm ls --all` without an incompatible peer exception.

The real Vite DevTools 0.8 host initializes the unmodified plugin, serves its
exact UI and dock bytes, and transforms its actual injected HMR client over
loopback. That integration remains part of `npm test`; full Nuxt types, site
checks and artifact acceptance remain required. No provider version is forced
outside its declared range, and neither dependency warnings nor checks are
suppressed. Replace the patch when upstream supports this peer combination.

The private qs 6.17.2-webops.1 patch is based on current upstream 6.17.0.
It retains that release's input-copy prototype protection and fixes native
comma-array coercion across realms. The source, license and compatibility
boundary are in `vendor/qs/UPSTREAM.md`. The installed CommonJS files and all
three browser interfaces pass the same security and ordinary-input fixtures.
The locked build reproduces both the browser distribution and local npm archive.

Intrinsic-array coercion reads each index once and converts it before reading
the next index. This prevents changing getters from bypassing normalization and
preserves conversion-driven mutations, fixed initial lengths, sparse separators,
cycles, repeated aliases, custom hooks and original exceptions. The regressions
cover both comma serialization and custom encoders delegating to the default
encoder, across the installed CommonJS and three browser distributions.

Packing normalizes only its disposable public-library copy to 0644 files and
0755 directories, so private source checkouts keep their original permissions
without changing archive bytes. Archive and installed-file comparisons use
bounded equality checks rather than formatting binary diffs. Regressions cover
a 0600 checkout, a 0077 builder umask and rejection under a 256 MiB Node heap.

The local archive is a source installation input. Independent API fixtures and
the artifact producer supply it during locked installation. The final immutable
runtime retains the installed library and its verified inventory, rather than
its package-manager input archive. The existing artifact layout and retained
release verification remain unchanged.

TypeScript uses the latest maintained 6.x release, 6.0.3. The current
`vue-tsc@3.3.13` requires `typescript/lib/tsc`, which TypeScript 7.0.2 no longer
exports; the native compiler therefore fails Nuxt type checking.
The current typescript-eslint parser also declares support below 6.1.
Reevaluate TypeScript 7 after both integrations support its compiler API.
Type checking remains required without suppressing these compatibility checks.

Nuxt remains on 4.6.3. A version-scoped override uses `unimport@7.0.1` while
7.0.2's advertised npm provenance endpoint returns 404. Version 7.0.1 has
retrievable provenance. Full registry-signature and provenance verification
remain required; the unavailable attestation is not treated as a pass.

The upstream patch changes class-export declaration generation and an unused
TypeScript parameter. Clean installation, Nuxt auto-import/type checking,
application tests and the generated site must pass with this scoped exception.
Remove the exception after a compatible successor has verifiable provenance.

The local deepmerge fork preserves both published entrypoints while defining
destination keys as own data properties. Its package provenance and compatibility
boundary are recorded in `vendor/deepmerge/UPSTREAM.md`; the security regressions
and complete consumer-lock assertions remain part of `npm test`.
