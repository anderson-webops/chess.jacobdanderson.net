# Dependency acceptance

The private qs 6.17.1-webops.1 patch is based on current upstream 6.17.0.
It retains that release's input-copy prototype protection and fixes native
comma-array coercion across realms. The source, license and compatibility
boundary are in `vendor/qs/UPSTREAM.md`. The installed CommonJS files and all
three browser interfaces pass the same security and ordinary-input fixtures.
The locked build reproduces both the browser distribution and local npm archive.

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
