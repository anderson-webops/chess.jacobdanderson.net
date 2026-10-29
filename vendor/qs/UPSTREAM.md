# qs compatibility patch

Based on the integrity-verified npm `qs@6.17.0` distribution.
Original archive integrity:
`sha512-5LK5BZ2XDHMvcUJaf0CQ5HL3aVgKbpklvByC7qLSxYkfE8COEEbJg5xCHWCTqzqi0Gs4Jn5Mv5v3R38W6edscA==`.
The BSD-3-Clause license and original runtime dependencies are retained.
`6.17.2-webops.1` identifies this private patch, not an upstream release.

The upstream own-data-property input copies remain unchanged, preserving ordinary
object prototypes when nested input contains an own `__proto__` key. Comma-array coercion recognizes
intrinsic array methods across realms, while retaining custom conversion and
join behavior. Only methods with matching intrinsic source and an empty-array
result qualify; user-defined functions are not executed as recognition probes.
Intrinsic arrays are joined with one observation per index and conversion before
the next indexed read. The initial length, sparse separators, path-local cycles,
custom conversion hints and exception identities retain native join semantics.
Both comma serialization and delegated default encoding use this shared boundary.
Descriptor-only inspection leaves conversion with native join when no static
data needs normalization, preserving native reentrant-cycle handling without
probing indexed getters or invoking user conversion hooks during inspection.

The browser distribution uses the locked esbuild toolchain with an ES5 target
and an isolated installation of this directory's runtime dependency lock. It
does not depend on workspace hoisting. It retains CommonJS, AMD and global `Qs` interfaces. Its bundled dependency
licenses are retained alongside the generated code. The normal CommonJS entry
continues to use the library sources and declared runtime dependencies.

`npm run package:qs` regenerates the browser files and the backend's local npm
archive. `npm run check:qs-package` verifies those exact outputs without changing
source. The installed-package tests bind runtime files to these reviewed sources.
Both workspace and independent backend locks must bind the same packed archive.
Replace this patch after a reviewed upstream release passes the same security
and compatibility regressions.
