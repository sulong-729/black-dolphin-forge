# Automatic Creator version adapters

User scope: add Creator 3.6.3, 2.1.3 and 2.4.15 alongside 3.7.3; automatically select the adapter from the project.

Use one version detector for project registration, current inspection, disk graph, source indexing, bridge install and build configuration. package.json creator.version and legacy project.json version are checked without modifying them. Conflicts and unsupported versions fail explicitly; never choose a nearest engine version or auto-upgrade a project. Existing project IDs are stable across metadata refresh.

Keep a small adapter table, shared source graph codec and separate IPC wrappers for Creator 2/3. Accept .fire for 2.x and .scene for 3.x. Index legacy cc.Class object methods without executing factories. Runtime UI 2.x reads Node geometry; 3.x reads UITransform. Preserve local IDs/unknown metadata internally for round-trip. Component/backend fields without a qualified adapter remain unavailable, not fabricated.

Build configuration derives creatorVersion from registered project metadata, and searches exact version installation folders when executable/engine paths are omitted. Manual paths remain available. Creator 2 uses --path, its bundled engine and legacy builder settings; Creator 3 keeps --project/--engine and its builder config. Preserve existing job approval, isolation, fingerprints and no output-cache reuse.

Only 3.7.3 retains its qualified mutation flag. New Editor readers and runtime adapters have contract tests, followed by isolated real Creator 3.6.3/2.4.15 checks on this Mac. Creator 2.1.3 is not installed: its adapter/fixture evidence must stay distinct from actual Editor/build qualification. Windows execution remains NOT_RUN.

Verification: metadata/format and conflict tests, inactive/reference round-trip checks, legacy JS method lookup, exact installation discovery, legacy IPC wrapper and runtime geometry tests; existing suite; real serialized fixtures; actual Editor IPC when available; explicit qualification report before release.
