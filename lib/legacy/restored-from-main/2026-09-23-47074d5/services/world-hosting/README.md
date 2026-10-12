# World hosting

Shared FeltOS server code for Farstone: local snapshots, the adjacent world clock, single-flight request catch-up, mutation saves, HTTP/room transport, and graceful shutdown. Recovered from the deployed `@red-cup-engineering/world-hosting@0.3.1` package so its required source is maintained here.

`FELTOS_SAVE` names the local snapshot. An omitted path explicitly selects memory-only operation in the shared API; Farstone supplies a persistent local default. Run one process per world and retain its data directory across upgrades. Existing FeltOS snapshot encoding and the caller's historical clock tag are preserved.

The server does not fetch former hosted bucket contents. An existing snapshot can be placed at the configured path before starting. Google storage clients and provider retry behavior have been removed.
