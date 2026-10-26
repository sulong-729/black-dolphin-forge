# Phase 5 mutation guide

Black Dolphin Forge uses the existing authenticated loopback daemon and MCP facade. A proposal is a read-only preflight at the live scene owner. It pins the exact project, session, document, revision, class schema, paths, object identities and expected-before values. Paths are owner-scoped labels, never disk IDs.

## Qualified adapter scope

Creator/engine 3.7.3, scene stage only, `scope: "scene-instance"`, `save: false`. The bridge advertises `features.mutationV1` only when the current Creator scene facade exposes synchronous Undo recording/snapshot support. Mutation preflight checks every target and reference for prefab ancestry; nested instances and prefab stage are refused.

| Operation | Exact owner type | Fields | Value |
| --- | --- | --- | --- |
| `property.set` | `cc.Node` | `active`, `position` | boolean, or finite `{x,y,z}` |
| `node.rename` | `cc.Node` | `name` | nonempty string up to 256 characters |
| `reference.bind` | `cc.Button` | `target` | `{path:"/…"}` to a node in this document, or null |
| `property.set` | `cc.Button` | `interactable` | boolean |
| `property.set` | `cc.UITransform` | `width`, `height` | finite nonnegative number, at most 10,000,000 |
| `property.set` | `cc.UIOpacity` | `opacity` | integer 0–255 |

Only the adapter set covered by the current qualification report is considered engine-tested; declaring a field above does not establish Windows, visual or gameplay qualification. Custom subclasses and guessed serialized field aliases are refused. `Button.target` has an explicit serialized `_target` alias: null clears that slot through the public setter; Cocos' public getter then falls back to the button's own node. This is intentional engine behavior.

Node add/remove/reparent, component add/remove/dependencies, array insert/remove/move, asset moves/deletes, source edits and prefab apply/revert/unpack have no write adapter yet. RPC/MCP cannot select arbitrary methods, run shell/eval, inject a schema or bypass those exclusions.

## Propose and review

Start the daemon, register the project and install the bridge as described in [Editor bridge](editor-bridge.md). Use `editor.sessions` and `editor.query` with `command:"scene.capture"` to obtain the explicit session, revision and paths.

Send `editor.propose` via `cocos_propose` (or authenticated RPC), with envelope `source:"editor"`, `projectId`, `session`, `revision`, and params:

```json
{
  "scope": "scene-instance",
  "save": false,
  "steps": [
    {"operation":"property.set", "target":"/Qualification[0]/Panel[0]", "field":"position", "expected":{"x":0,"y":0,"z":0}, "value":{"x":87,"y":21,"z":0}}
  ]
}
```

Rename must be a separate one-step proposal; capture fresh paths afterwards. All steps need an expected-before value, even null. Plans contain at most 20 distinct target/field pairs and a compact preview budget. The response contains `id`, `hash`, exact diff, pinned scope and a five-minute expiry. Proposal creates no scene/disk changes and no Undo record.

After reviewing that exact diff, the trusted human/host runs locally:

```text
node dist/cli/main.js approve <proposal-id> <reviewed-hash>
```

Run with the same `COCOS_AI_STATE_DIR` as the daemon. This action writes a user-private approval record for that proposal hash and expiry. There is **no authorize RPC/MCP**. `approved:true` in client parameters is rejected. Host policy must separately prevent an untrusted AI from using arbitrary shell access to invoke the local approval command; software running with the same user's unrestricted OS access is not isolated by this kit.

## Apply and recover

Send `editor.apply` via `cocos_apply` with the same project/session, `source:"editor"`, and params `{proposal:"<id>",idempotencyKey:"<stable key>"}`. Apply accepts only the stored proposal, never new steps. The owner checks revision, schema, document, object identity, expected-before, adapter/range and prefab restrictions again synchronously before setter calls. Undo records use Creator's current scene facade. Writes never save the scene implicitly.

An apply returns per-step outcomes and a checkpoint. `applied` means qualified public-field read-back matched; it does not imply visual/native/gameplay correctness. Callback conflicts stop the batch and return partial results, not atomic success. Timeout, disconnect or lost acknowledgment returns `indeterminate`; do not blindly retry a write. The durable attempt journal reserves a key before dispatch, and the same key replays the original outcome. Another key cannot re-execute that proposal. Restart does not retry pending writes. Use `editor.mutation.status` and inspect the live scene to reconcile an uncertain result.

For a fully applied checkpoint, request `editor.rollback.propose` with `{checkpoint:"<id>"}`, explicit current revision and the same session. This is a new inverse proposal requiring its own approval. Any intervening document/schema/state change is a conflict; recovery never overwrites newer user edits. Expired or partial/indeterminate checkpoints cannot be auto-reversed. Deferred engine callbacks can also change the full fingerprint after a synchronous write, so even a successful write may later reject inverse recovery; use a fresh, explicitly reviewed proposal based on current values rather than refreshing the old checkpoint. Native Undo remains available in Creator itself; the toolkit exposes no blanket Undo endpoint.

## Persistence and qualification

Approvals and attempt journals are local-only files under the daemon state directory, mode 0600 on Unix; Windows inherited ACLs still need actual Windows qualification. Proposals expire after five minutes and are capped at 100 per daemon; owner plans/receipts are also bounded and expire. Journals persist for reconciliation; automated retention cleanup belongs to P8. A daemon restart invalidates unattempted approvals. Keep raw endpoint tokens, local config, journals and Editor logs out of Git.

The qualification harness uses its own temporary Creator project and child process. `npm run check` exercises portable core/owner/transport behavior; `npm run qualify:mutations` exercises actual Creator Undo/redo and save/reload. Raw local evidence is excluded from Git; the scoped summary report is included. Windows and all unimplemented write adapters remain unqualified.
