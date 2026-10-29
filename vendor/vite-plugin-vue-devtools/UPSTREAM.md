# Vue DevTools compatibility candidate

Based on the unchanged public distribution of `vite-plugin-vue-devtools`
9.0.0-rc.2, published by Vue DevTools under its retained MIT license.
`UPSTREAM.json` records its registry archive identity, original metadata and
SHA-256 of every unchanged source, type, client and license file.

Nuxt DevTools 4.0.0 requires Vite DevTools 0.8.0, but the Vue plugin still
declares only 0.7.6. This candidate adds 0.8 to that declared peer range.
It changes no executable files, exports, client assets, dependencies or types.
Vite DevTools 0.8 moved the JSON-render API; this Vue plugin does not import it.
Both plugin hooks and its real development UI must pass against the 0.8 host
before this candidate is eligible for source delivery. A clean audit alone is
not compatibility evidence.

Replace this local candidate with a supported upstream release once its peer
declaration and the same integration checks cover the current Nuxt host.
