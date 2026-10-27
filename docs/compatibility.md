# Compatibility and supported scope — 0.10

Black Dolphin Forge selects an adapter from current project metadata: `package.json` → `creator.version` for Creator 3; `project.json` → `version` for Creator 2. Conflicts and unsupported versions fail explicitly. The kit never chooses the nearest installed version or upgrades project metadata automatically. Small known reads can still use focused scripts directly.

| Creator | Disk UI / source | Editor read bridge | Web preview observer | Web Mobile build |
| --- | --- | --- | --- | --- |
| 3.7.3 | Existing qualified fixtures | Existing macOS qualification | Existing actual preview qualification | Existing actual macOS pipeline |
| 3.6.3 | Actual serialized fixture: integrity and byte-identical no-edit restore PASS | Actual macOS session/capture PASS | Adapter and contract tests; actual browser NOT_RUN | Actual macOS full job pipeline PASS after excluding generated local/logs |
| 2.4.15 | Actual .fire fixture: integrity and byte-identical no-edit restore PASS; static cc.Class lookup tested | Actual macOS session/capture PASS | Node geometry adapter and contract tests; actual browser NOT_RUN | Experimental adapter; actual macOS export FAILED inside Creator with exportSimpleProject undefined, including retry |
| 2.1.3 | Metadata/.fire/graph/source fixtures PASS | Legacy adapter and Node 8 protocol/proxy contracts implemented; actual Creator NOT_RUN (not installed) | Node geometry adapter and contract tests; actual browser NOT_RUN | Experimental command adapter; actual build NOT_RUN (Creator not installed) |

These are exact versions, not blanket support for every 2.x or 3.x patch. A fixture/contract test is not actual Editor, browser, native-device or Windows qualification. The 2.4.15 failure is a known observed limit on this Mac; the kit does not report it as successful build support. New Editor versions are read-only: only 3.7.3 keeps its separately qualified property/reference/rename mutation capability. Structural, nested-prefab, array, asset and source mutations remain unavailable.

## Automatic selection

Register a project normally. Project inspection and capture read its current metadata again, so a version change cannot silently keep the old adapter. Creator 2 scenes use `.fire`; Creator 3 scenes use `.scene`; both support source `.prefab`. Unknown and storage metadata is preserved; the generic native writer is still unqualified.

`editor install <project-id>` installs the selected bridge into `packages/cocos-ai-bridge` for 2.x or `extensions/cocos-ai-bridge` for 3.x. This is an explicit local command which writes project extension files; ordinary reading does not install anything. Existing extension directories are never overwritten automatically. Restart that project's Editor after installation. Creator 2 dirty state is conservatively reported true; live prefab-stage and mutation behavior are not qualified.

Build profiles derive `creatorVersion` from the registered project. Omit `creator`, `engineRoot` and `creatorVersion` to search standard exact-version installation folders. `COCOS_CREATOR_INSTALL_ROOTS` adds explicit search roots using the platform path delimiter. Explicit executable/engine paths remain available for custom locations. Python and the scene UUID are still explicit. Missing Creator versions produce an actionable error, not a fallback or automatic download.

Creator 2 build commands use `--path`, legacy settings and only the matching bundled engine. Custom 2.x engine selection is unavailable. Creator 3 uses `--project` and `--engine`. All jobs retain exact proposal approval, source/profile/executable fingerprints, unique output, cancellation and stale-output checks. Root `local/logs` is generated state and excluded; local settings remain fingerprinted.

## Other boundaries

- Node 22.16+ is required for the kit core; Creator 2's embedded Node is separate. The legacy reader probes native proxy detection and refuses reflection if it is unavailable.
- Source navigation does not execute project factories. Static cc.Class methods can be located; generated members, dynamic registrations and factory inheritance may remain unresolved.
- Runtime readers never align Widgets, update Layout, activate inactive nodes or change physics/audio/input. Legacy 2D physics backend telemetry and legacy camera screen projection are unavailable.
- Windows portable paths, commands and installer are implemented; actual Windows installation, Creator integration, login/reboot and native execution remain NOT_RUN.
- macOS runtime install/service start-stop are tested; login/reboot and signed/notarized distribution remain unqualified. Node/Python/Creator/SDKs are not silently installed.

Local qualification output is under `output/compatibility/<version>`. See `docs/testing/version-qualification.md` for the source-controlled summary. Historical 3.7.3 scope reports remain under `docs/testing/evidence/p*/report.json`.

Primary API references: [Creator 2.1 scene scripts](https://docs.cocos.com/creator/2.1/manual/en/extension/scene-script.html), [Creator 2.1 command-line publishing](https://docs.cocos.com/creator/2.1/manual/en/publish/publish-in-command-line.html), [Creator 2.4 command-line publishing](https://docs.cocos.com/creator/2.4/manual/en/publish/publish-in-command-line.html). Actual installed Creator behavior and qualification results take precedence over untested assumptions.
