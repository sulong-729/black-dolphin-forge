# Editor bridge — P3

The experimental adapter supports Creator and engine **3.7.3**, with explicit feature probes. It is read-only. It does not install a login service or start an Editor by itself.

## Setup

The automated harness installs the extension only into `.superpowers/p3-creator-project`:

```text
npm run qualify:editor
```

Set `COCOS_CREATOR_EXECUTABLE` to the Creator executable on another installation or Windows. This script opens and closes its own synthetic Creator process, writes only the fixture project and evidence folder, and refuses concurrent harness runs through `qualification.lock`. An interrupted run can leave that lock: check that its recorded process and synthetic Creator have stopped before removing it. Do not point the fixture harness at a game.

For a deliberately selected project, first register its canonical path with the kit and install `extensions/cocos-ai-bridge` using Creator's extension workflow. The extension remains disabled without a local `config.json`:

```json
{"endpoint":"<absolute private state directory>/endpoint.json","projectId":"<registered project id>"}
```

Configuration contains an endpoint-file path, not a copied token. The endpoint must be authenticated loopback HTTP. The bridge reconnects when the daemon restarts. Do not publish private state/config files.

## Query

Discover `editor.sessions` with disk source and projectId. Each entry identifies the Editor, version, stage, document, dirty/import state and revisions. Lease credentials are never returned by this discovery operation.

```json
{"formatVersion":1,"requestId":"live-1","operation":"editor.query","projectId":"<project>","source":"editor","session":"<session>","params":{"command":"scene.capture"}}
```

Use `schema.list` with `offset:0,limit:25`. Follow `nextOffset` using the returned `schema` hash; `schema.describe` needs `type` and that hash. Lists contain unique registered constructors, not a count of aliases/registration keys. Full class schemas are loaded only when requested.

The result contains `snapshot`, source/session/state/revision and read-only coverage. `snapshot.query` and `artifact.read` page the content using existing 6,000-character fragments; concatenate fragments before parsing JSON. Default live output contains paths rather than engine IDs. Duplicate names have indexed paths scoped to the captured session/document. `$value` and `$ref` describe inline shared objects and references; arrays use `{ "$value": "...", "items": [...] }`.

Native `DontSave` subtrees belonging to Editor helpers are excluded and counted explicitly. Inactive user nodes are retained. Missing scripts are opaque, and their raw native serialization is not returned. Getters, proxies, external references and value-budget limits have explicit unavailable markers. Native values are never fabricated from unsupported metadata.

Schemas retain declared reference types, inherited owners, enum/bitmask labels, visibility/persistence flags and former serialized names. Backing fields keep their exact names. Computed properties are not inferred by stripping underscores or calling getters. Simple empty-array factories may be recognized as syntax; other factories stay unknown. Supplemental TypeScript syntax inventory does not execute project sources and does not establish a live binding/source location; source navigation is P4.

## Protocol and freshness

The authenticated bridge control operations are `editor.connect`, `editor.heartbeat`, `editor.poll`, `editor.respond` and `editor.disconnect`. They cannot be called through the read-only query facade. Server-issued leases bind them to one project/session; only three allowlisted read commands can reach the scene owner. There is no eval/method-forwarding/write route.

Session defaults: 15-second heartbeat TTL, 8-second read timeout, at most 16 sessions and 16 pending reads per session, 800,000-byte result cap. Larger captures fail rather than becoming a complete-looking truncated result. Individual nested values may report explicit budget omissions. Registry/snapshot discovery remains paged and bounded.

Owner data, constructor identity/schema, root identity, stage/document, observed dirty/import state and Editor change notifications contribute to revisions. Revision changes cancel pending reads and expire Editor snapshots. Observations are sampled; a change that has not yet reached a heartbeat can still leave a historical immutable snapshot readable briefly. No mutation can consume that observation in P3. Unsafely computable fields are unavailable and cannot be used as evidence of a complete effective value.

Prefab provenance is owner-process metadata: source paths where resolved, instance roots, property override owners and mounted/removed-component records. Unresolved targets remain null. It is not a generic override evaluator and does not include base serialized values. Full nested-prefab/override and source-origin qualification remains pending.

## Evidence and scope

Contract tests cover routing, expiry/reconnect, unsupported versions, import gates, metadata/getter/proxy safety, missing scripts, inherited schemas and inline identity. Real Creator evidence is recorded separately in `docs/testing/evidence/p3/creator-report.json` and `creator.log`; inspect its status and stated limitations. Do not infer real-engine or Windows qualification from passing contract tests.

The adapter never advertises writable or generic roundtrip coverage. Actual Windows execution, native runtime, builds and complete source navigation remain later qualification work.

Message routing follows Creator's [extension messaging contract](https://docs.cocos.com/creator/3.7/manual/zh/editor/extension/messages); exact installed APIs are feature-probed and exercised in the synthetic project.
