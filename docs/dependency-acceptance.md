# Dependency acceptance

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
