# Install and operate Black Dolphin Forge

Use Node22.16+ on macOS or Windows. Python is optional until a build worker is called. No admin rights are needed for the toolkit's user-scoped actions. Current Windows execution and OS auto-start qualification remain NOT_RUN.

## Portable package

From source run `npm ci`, `npm run check`, then `npm run package:portable`. The output is a versioned directory under `output/`; it includes runtime production dependencies, worker, Editor bridge, skill and operational docs. It excludes projects, assets, state, tokens, approvals, caches, tests and local bridge config. Node/Python/Creator are not bundled. Checksums detect corruption; they are not a publisher signature.

Use a dedicated, user-owned installation root, separate from projects and daemon state:

```text
node <bundle>/dist/cli/main.js package install <bundle> <install-root>
node <install-root>/forge.mjs daemon start
node <install-root>/forge.mjs daemon status
node <install-root>/forge.mjs describe
node <install-root>/forge.mjs mcp
```

The stable `forge.mjs` launcher reads the current version pointer. State remains in the platform user profile (`COCOS_AI_STATE_DIR` can select an isolated directory). The endpoint/token files remain private. Use the same state selection for start/status/stop, configuration and local approval.

Stop the daemon/user service before upgrade/rollback/uninstall. Install a new version with the same install command; only state format1 is accepted. Incompatible formats fail without rewriting existing configuration. The prior version remains for rollback:

```text
node <install-root>/forge.mjs package status <install-root>
node <install-root>/forge.mjs package rollback <install-root>
node <install-root>/forge.mjs daemon stop
node <install-root>/forge.mjs package uninstall <install-root>
```

Uninstall verifies owned files and removes only listed version files/launcher/current pointer. Unknown notes and daemon/project state remain. A modified owned file, foreign/nonempty root, symlink, conflicting installer lock or incompatible package requires inspection; it is not overwritten or force-removed. Installer locks are not cleared based solely on PID reuse. An interrupted activation may leave a staged/unactivated version; inspect the dedicated root before retrying. Keep a known working bundle available for recovery.

## Optional user auto-start

This is separate from normal `daemon start`. Preview the plan first, using an absolute **stable launcher** path:

```text
node <install-root>/forge.mjs service plan <install-root>/forge.mjs
node <install-root>/forge.mjs service install <install-root>/forge.mjs
node <install-root>/forge.mjs service status <install-root>/forge.mjs
node <install-root>/forge.mjs service uninstall <install-root>/forge.mjs
```

Stop a manual daemon before installing. macOS uses a current-user LaunchAgent; Windows uses a current-user InteractiveToken/LeastPrivilege Task Scheduler registration. Arguments are passed without a shell; paths with spaces/XML metacharacters are escaped. The local registration record is preserved when OS outcome is uncertain. Inspect status before retrying; do not erase an unknown registration blindly. Existing unrelated services are not enumerated or modified. No password, elevation or global service is requested.

OS installation, login/reboot and sleep/wake must be checked on the actual platform. They were not simulated as a passing device check. In particular, the generated service plan does not prove Windows restarts correctly, and native login auto-start is not part of the portable CLI smoke result.

## Logs, state and job retention

The core does not scan the home directory. It reads registered projects explicitly. Snapshot count/byte/TTL limits are enforced. `daemon.log` rotates at startup above1MiB, retaining one previous regular file; symlinked logs are refused. Rotation applies only to the daemon-owned log before its writer starts. OS-owned service.stdout.log/service.stderr.log are explicitly excluded: launchd opens those descriptors before the host runs. They require a separate OS/operator retention policy. This is not a universal byte cap for external child/OS logs. Runtime credentials should never be logged; OS and user project extensions can have their own logging behavior.

Interrupted jobs do not replay after reboot. Inspect/reconcile through the exact local hash channel described in `build.md`. Terminal generated output can be pruned explicitly:

```text
node <install-root>/forge.mjs job prune <terminal-job-id>
```

This removes only known job output/log/manifest/config files and keeps the journal/idempotent outcome. Running/queued/interrupted jobs are refused. A pruned artifact is unavailable and the old job ID does not rerun it. No periodic prune deletes active work automatically.

## Benchmark

Create a Python environment with `benchmarks/requirements.txt` and set `COCOS_BENCH_PYTHON` to its executable. Run `npm run benchmark` and `node benchmarks/idle.mjs`. Input hash, dataset version, tokenizer/version/encoding, actual tokens, schema overhead, cold capture and warm p50/p95 are recorded separately. The comparison is full raw prefab context versus focused toolkit responses including warnings, not an optimized grep workflow. A warm in-process result is not an HTTP/MCP/Editor/native latency guarantee.

## Simple cross-platform control window (0.9)

`node <install-root>/forge.mjs desktop start` opens the same plain HTML/JavaScript dashboard on macOS and Windows. Its separate loopback controller stays available while the service is stopped. The icon authenticates the window with a scoped controller token; the daemon's root token is never put in the page. `desktop stop` closes the controller, not the Cocos service.

Use Bật service / Tắt service for the owned LaunchAgent or Task Scheduler registration. Stop also disables auto-start; start enables it again. Status verifies the daemon's endpoint identity, and log views show only four known files with a 64 KiB tail and credential redaction. Project/build actions are not exposed through this UI.

After installing the runtime, `node scripts/install-desktop.mjs <install-root>` creates a macOS application/Desktop icon or a Windows shortcut. The Windows portable folder also includes `desktop/Launch-Forge.cmd`. Node remains required. The browser UI and OS adapter commands are shared/portable; actual Windows service lifecycle must be verified on Windows and must not be inferred from a Mac test.
