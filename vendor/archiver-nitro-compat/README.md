# Archiver compatibility bridge

Nitro 2 calls Archiver as a default factory. Archiver 8 exports archive classes
instead. This local package preserves Nitro's factory API while delegating the
archive implementation to unmodified Archiver 8. Keep its identity distinct from
the registry package. Its workspace identity satisfies Nitro's Archiver 7
range and keeps npm's local-file dependency resolved at the workspace root.
Verify the direct-build and archive regressions before removing it when Nitro
natively supports Archiver 8.
