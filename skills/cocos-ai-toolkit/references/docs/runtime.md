# P6 runtime observations

Black Dolphin Forge 0.6 adds an **opt-in, read-only Cocos Creator 3.7.3 web-preview observer**. It runs in the runtime owner and captures after `Director.EVENT_AFTER_DRAW`. It never calls Widget alignment, Layout update, activates nodes, plays/stops animation/audio, changes physics, synthesizes input or pauses/steps gameplay.

This is observation coverage, not full P6 action coverage. P5.2 writes and all runtime actions without their own qualification remain unavailable. Native iOS/Android, Windows and production-release artifacts have not been qualified by a passing web preview.

## Connect a preview

Build the kit and start its existing daemon. Register the project. From the trusted local CLI allow the exact loopback preview origin (a scheme, host and port, without a path or trailing slash):

```text
npm ci
npm run build
node dist/cli/main.js daemon start
node dist/cli/main.js project register "<project folder>"
node dist/cli/main.js preview permit <project-id> http://127.0.0.1:7456
```

The result contains a scoped preview token, permit id and ten-minute expiry. Give only that preview token to the selected development page. Never copy `endpoint.json` or the daemon's root token into browser scripts/project assets. The browser cannot use a preview token against general RPC or Editor writes. General RPC continues to refuse every browser Origin.

The kit does **not automatically install a project component, patch a scene, inject a script into a release, or start a login service**. Explicitly attach the browser adapter through the preview developer bootstrap. Creator 3.7 uses SystemJS; the served modules are compiled for that loader:

```javascript
const cc = await System.import('cc');
const env = await System.import('cc/env');
if (env.PREVIEW && !env.BUILD) {
  const bridge = await System.import('<daemon-url>/v1/runtime/modules/bridge.js');
  const connection = await bridge.attachPreview({
    cc, url: '<daemon-url>', token: '<scoped-preview-token>',
    preview: env.PREVIEW, build: env.BUILD
  });
  // await connection.stop() when detaching this development connection.
}
```

The fixture harness uses an equivalent explicit development bootstrap. Do not serialize credentials into normal game prefabs/source or include the synthetic qualification configuration in a release. `attachPreview` returns disabled without reading the engine or starting fetch when preview is false or build is true. That runtime guard is **not** evidence that a built release has been inspected and found free of bridge code.

Revoke the permit locally when finished:

```text
node dist/cli/main.js preview revoke <project-id> <permit-id>
```

Only exact `http://127.0.0.1:<port>` or `http://localhost:<port>` origins with explicit non-default ports are allowed. The separate preview HTTP route accepts only connect/poll/respond/disconnect, with a project/origin-scoped credential plus per-session lease. It exposes no generic RPC, shell or method forwarding. Permits and sessions have bounded budgets and expire; credentials remain local-only.

## Read through AI/MCP or API

Use `runtime.sessions` (`source:"disk"`, registered `projectId`) to select the exact live session. It does not return credentials. Query tools are the existing `cocos_query` facade.

- `runtime.capture`: `source:"runtime"`, explicit `session`, params `{maxNodes:1000}` (maximum 5000). Returns snapshot/revision, epoch, frame/time window, viewport and domain scope.
- `runtime.query`: same source/session, params `{snapshot,domain:"ui",target:"<path-or-runtime-handle>",limit:25}`. Domains: `node`, `ui`, `animation`, `render`, `physics`, `audio`, `input`. Follow the cursor and concatenate 6000-character text fragments before parsing a complete page.
- `ui.diagnose`: same source/session, params `{snapshot,limit:25}`. Paged findings for inactive ancestry, zero UI size, unresolved Widget target and observed viewport overflow.
- `snapshot.query` / `artifact.read`: existing immutable snapshot pagination/artifacts; supply the correct project. Snapshot content is historical data from the reported frame.

Example envelope:

```json
{"formatVersion":1,"requestId":"runtime-1","operation":"runtime.capture","projectId":"<project>","source":"runtime","session":"<session>","params":{"maxNodes":1000}}
```

Later frames do not rewrite an existing snapshot. Reload, reconnect, permit revocation, expired heartbeat or scene transitions invalidate old runtime handles/snapshots. Re-entering the same scene object creates a new epoch; it cannot reuse an old handle for another node. Capture across frames reports `consistentFrame:false` plus the start/end frame and time window. A scene change during capture is refused. Paused/non-rendering previews time out; inspection never advances a frame itself.

## Domain and evidence limits

| Domain | Read scope | Explicit limits |
| --- | --- | --- |
| UI | activeSelf/activeInHierarchy, own-quad local/world/render-pixel corners, anchor/size, Widget target/offsets, Layout configuration, ScrollView links/offset, mask and Label/Sprite resource identity | No forced alignment/layout; an after-draw observation does not prove every deferred update completed. Render pixel coordinates use bottom-left origin; they are not CSS pixels. |
| Animation | Existing component-owned `cc.Animation` state records, playing/paused/time/duration/speed | Does not call `getState`, which can initialize curves. No controller graph or Spine track adapter. |
| Render | SpriteFrame/custom-material identity and Camera configuration | No material-instance creation or profiler/native GPU counters; no render mutation. |
| Physics | Qualified rigid-body configuration and finite velocity from an initialized real wrapper | Missing/uninitialized/no-op wrappers are unavailable, not zero. Units stay in Cocos API space; no inferred metres/screen conversion. Collider inventory is explicitly limited. |
| Audio | One AudioSource's clip/configuration/component-local state | No playback action and no native global voice-count claim. A component state is not native audio telemetry. |
| Input | Button binding receiver/handler metadata | No application/OS input spying or event dispatch. |

Runtime handles and paths have their own namespace. Source/Editor correspondence is marked **unresolved** without a separately verified identity map; matching names or paths are never presented as proof. Inactive nodes remain inactive. Custom classes, arbitrary getters and unsupported engine versions are not blanket qualified.

Out-of-viewport findings are informational: a clipped/hidden popup bottom can be intentional. Diagnostics never classify an intentional design as a confirmed defect or alter it automatically.

## Qualification

`npm run check` exercises contracts, domain readers, lifecycle/cancellation and regression boundaries. `node scripts/qualify-runtime.mjs` owns a new synthetic Creator project and child process; its browser phase records screenshots and geometry at 720×1280, 720×1920 and restored 720×1280. It never points the fixture at a game. Set `COCOS_CREATOR_EXECUTABLE` for another installation; actual Windows execution still needs separate evidence.

Raw logs, tokens, fixture config, captures and screenshots stay in ignored local evidence directories. The versioned summary reports exact tested scope. Release exclusion end to end, native device actions/counters and unsupported domain actions remain NOT_RUN/unavailable.
