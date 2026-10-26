# Portable service control — 2026-10-26

User scope: install the user service and a simple icon/application for status, start/stop and logs on this Mac. Existing Node/Python core remains portable. UI uses plain HTML/CSS/JavaScript served by a separate authenticated loopback Node controller. One UI runs on macOS and Windows; OS controls use LaunchAgent/Task Scheduler adapters.

1. Add ownership-checked, serialized local service start/stop and useful redacted control logging. macOS stop disables auto-start and boots out the exact label; start enables/loads the same service. No arbitrary PID kill. Keep restart distinct from starting a running service.
2. Build a small browser dashboard with a desktop icon/launcher and a compact status/control/log view. Poll only the private local endpoint; never expose its credential in UI/logs. Run actions through argument-array CLI calls.
3. Qualify core tests plus the native model. Package/install the new version without rewriting user state. Stop the owned manual daemon, install the LaunchAgent, verify actual start/stop/start and GUI controls on this Mac. Leave service running/enabled as requested.
4. Save actual status/log/screenshot evidence, retain exclusions for Windows, login/reboot and native game/device behavior. Do not reboot or push changes automatically.

Updated user requirement: both macOS and Windows, simple code. Plain HTML plus Node reuses existing runtime; no GUI framework or Electron dependency. The controller stays available while the daemon is stopped, uses a separate scoped control token, exact loopback Host/Origin checks and a closed endpoint set. Authorization already covers these concrete functions and installing this user's service; no additional design or installation confirmation is needed.
