# Source Navigator — P4

The kit exposes source navigation through its existing MCP → authenticated local HTTP daemon → compiler index path. CLI and direct RPC use the same dispatcher. No source or library code is executed, no compiler plugin is loaded, and no source/vendor write capability is enabled.

## Capture and navigate

Register the project, then call `source.capture` with disk source and the registered `projectId`:

```json
{"formatVersion":1,"requestId":"index-1","operation":"source.capture","projectId":"<project>","source":"disk","params":{"packages":["packages/my-components"],"engineRoot":"<selected Cocos engine source directory>"}}
```

The engine root is the directory containing `cocos/core/global-exports.ts` and `exports/base.ts`, not the application executable. The captured project Creator version must match its engine version. `enginePaths` optionally restricts the selected engine subtree; include `exports/base.ts` and its dependencies if you need project `cc` imports and inherited engine methods. Unsupported/missing modules remain unresolved; the compiler never reads a fallback path outside the captured files.

`source.capture` returns a snapshot, revision, file/class counts and static read-only coverage. This class count is static declarations, not the live registered-constructor count in P3.

Use the same project and source snapshot:

| Operation | Parameters besides snapshot | Result |
| --- | --- | --- |
| `source.classes` | limit, cursor | Paged class identities and locations |
| `component.source` | type, or graphSnapshot + target component path | Exact class location; duplicate names need returned identity |
| `symbol.definition` | type, optional member | Class/member declaration or implementation location |
| `type.hierarchy` | type, limit, cursor | Captured class ancestry |
| `symbol.references` | type, optional member, limit, cursor | Compiler symbol references, including aliases/literal element access |
| `method.body` | type, member, offset | Method text in bounded fragments; static/arrow members supported |
| `source.slice` | uri, hash, optional start/end/offset | Captured source text with range/hash |
| `source.mapping` | uri, line, column | Source-map original point where captured and verified |
| `source.dependencies` | type | Resolved/unresolved static import/reexport edges |
| `source.dynamic` | limit, cursor | Unknown dynamic event/component/property edges |
| `event.bindings` | graphSnapshot, limit, cursor | Serialized ClickEvent owner, receiver, handler and source location |

`type` accepts a returned class identity, a unique registered ccclass name, or unique class name. A field declaration is not proof of a callable handler: accessors/non-callable members have no method body. Inherited overload declarations without an implementation remain declaration-only.

To connect a serialized UI component, first capture the prefab/scene through `graph.capture`. Select its component path through `graph.query`, then pass `graphSnapshot` and `target` to `component.source`. Bindings use the same disk graph, validate its current bytes and asset inventory, and resolve nonempty `_componentId` ahead of legacy `component`, matching Creator3.7.3. Unresolved populated IDs do not silently fall back. Runtime-added or computed bindings are not inferred as static truth.

## Locations, fragments and freshness

Every location includes URI, absolute path, one-based line/column range, UTF-16 offsets, source hash, source-index revision and project/package/engine owner. Package versions and actual content hashes are retained. URIs use `project://`, `package://` and `engine://` namespaces; use returned URIs rather than constructing them.

Paged lists use signed cursors and the existing 6,000-character fragment budget. Concatenate fragments for a JSON page before parsing. `method.body` and `source.slice` return at most 6,000 characters and `nextOffset`, relative to the requested method/range. Keep the snapshot, URI, hash, start/end and selector unchanged while continuing. Fragments may split lines; concatenation preserves every original character exactly.

Every source-navigation operation rechecks source inventory/content. Changes to source, relevant metadata/config or dependencies reject old navigation with `STALE_REVISION`; recapture and resolve fresh identities/ranges. An immutable historical artifact is not evidence that its old line numbers still identify current code. Read observations are not an atomic mutation transaction.

Source-map support is v3 flat VLQ mappings into original files already captured. Results describe a mapped point, not an invented original method range. Unmapped spans, absent/malformed maps, missing originals and external/embedded/indexed maps are explicit. Original bodies can be read separately from their captured source locations. Minified/compiled JavaScript retains its compiled label; `.d.ts` never becomes a fabricated implementation.

## Scope, budgets and setup

Project discovery excludes `.git`, `.superpowers`, `library`, `temp`, `build`, `dist`, `node_modules` and `.venv`. Explicit project-relative package roots can include selected installed dependencies. Package roots/symlinks cannot escape the registered project. External package-root registration is not implemented. Engine source requires explicit selection and containment/version checks. Relevant file extensions include TS/JS variants, source maps, asset metadata, package.json and tsconfig JSON.

The index is bounded to 6,000 captured files, 16 MiB source text, 2 MiB per file, traversal depth64/30,000 entries. Snapshot retention additionally charges a 12× source-byte estimate against the existing 128 MiB budget, so some inventories below16MiB may still exceed the retained-index limit. A requested inventory that exceeds limits fails rather than appearing complete. Restrict the selected project/package/engine scope for larger workspaces.

Compiler diagnostics/build success are not inferred from navigable symbols. Unresolved modules, dynamic code, JavaScript mutation/reflection, native bridges and omitted source roots prevent a complete call-graph claim. The initial sealed host supports the selected engine `cc` entry; custom engine module generators may need a future adapter.

## Verification

`npm run check` exercises scoped compiler/transport/permission/binding/freshness regressions. `npm run qualify:source` reads the installed Creator3.7.3 engine and standalone P3 fixture project, then verifies actual MCP navigation. Set `COCOS_ENGINE_SOURCE` for another matching source installation. The qualification requires the standalone P3 project to have been created previously; it writes only fixture package files and evidence, not engine/game sources.

Inspect `docs/testing/evidence/p4/report.json`, `source-report.json` and `mcp-report.json` for exact scope/timings. macOS arm64 is exercised. Windows CI is configured but has not executed here. C++/Java/Objective-C/binary recovery adapters and mutation remain later phases.
