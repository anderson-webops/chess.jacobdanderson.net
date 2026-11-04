# Dependency acceptance

Nuxt DevTools 4.1.0 uses Vite DevTools 0.8.0. The unmodified Vue plugin's
9.0.0-rc.2 distribution declares the 0.7.6 API line, so the frontend provides
compatible 0.7 dependencies separately from DevTools 4's own 0.8 dependencies.
The former metadata-only peer patch and local archive are retired. The original
registry metadata, integrity and all 38 payload hashes remain checked against
`vendor/vite-plugin-vue-devtools/UPSTREAM.json`. The complete installed graph
must pass `npm ls --all` without forced or ignored peer ranges.

The actual Nuxt-selected Vite DevTools 0.8 integration initializes the plugin, serves its
exact UI and dock bytes, and transforms its actual injected HMR client over
loopback. That integration remains part of `npm test`; full Nuxt types, site
checks and artifact acceptance remain required. No provider version is forced
outside its declared range, and neither dependency warnings nor checks are
suppressed. The host test selects 0.8 explicitly through its public integration
API rather than silently accepting the root's compatible 0.7 provider.

The private qs 6.17.2-webops.2 patch is based on current upstream 6.17.1.
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

The backend build, watch and type checks use TypeScript 7.0.2 through the explicit
`typescript-native` package alias and its published CLI. Vue and typescript-eslint
retain their independently required TypeScript 6.0.3 compiler API. The current
`vue-tsc@3.3.14` requires `typescript/lib/tsc`, which TypeScript 7 no longer
exports; typescript-eslint also declares support below 6.1. The alias preserves
these genuine API boundaries without widening metadata or choosing an ambiguous
`tsc` executable. Compiler regressions exercise the real TypeScript 7 CLI and
both legacy API consumers. Full production installation and runtime inventory
checks reject both compiler packages; Linux ARM64 binding and artifact checks
remain required.

Nuxt uses 4.6.4. The existing version-scoped exception retains `unimport@7.0.1` while
7.0.2's advertised npm provenance endpoint returns 404. Version 7.0.1 has
retrievable provenance. Full registry-signature and provenance verification
remain required; the unavailable attestation is not treated as a pass.

The upstream patch changes class-export declaration generation and an unused
TypeScript parameter. Clean installation, Nuxt auto-import/type checking,
application tests and the generated site must pass with this scoped exception.
Remove the exception after a compatible successor has verifiable provenance.

The frontend's c12 dependency remains on the stable 3.3 API required by its Nitro 2 dependency.
The newer 4.0.0-rc.4 distribution is a prerelease outside that parent range;
evaluate it with a compatible framework update rather than forcing its API.

The local deepmerge fork preserves both published entrypoints while defining
destination keys as own data properties. Its package provenance and compatibility
boundary are recorded in `vendor/deepmerge/UPSTREAM.md`; the security regressions
and complete consumer-lock assertions remain part of `npm test`.

Glob 14.0.3 and Minimatch 11.0.4 replace vulnerable older transitive majors.
Nitro 2 still calls Archiver through its legacy default factory, so the local
`archiver` workspace bridges that API to unmodified Archiver 8.0.0. Its source
and dependency identity remain visible in the lockfile. Exact installed-graph,
file-matching, archive-factory, Nuxt build and artifact regressions are required
because these upgrades cross the parent packages' declared major ranges.
Remove the bridge when Nitro natively supports the modern Archiver interface.
The standalone backend lock pins the same patched Minimatch major, and both
full and production backend audits are required before artifact packaging.
