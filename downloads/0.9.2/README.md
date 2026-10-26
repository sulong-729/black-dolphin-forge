# Black Dolphin Forge installers

Requires Node.js 22.16 or newer, installed separately from https://nodejs.org.
The runtime includes its JavaScript dependencies. Python and Cocos Creator are only needed for the corresponding build workflows.

macOS: open the PKG, then open Black Dolphin Forge in Applications. The PKG installs an app launcher; first launch installs the per-user runtime and enables its LaunchAgent. The PKG and app are unsigned and not notarized. Do not disable Gatekeeper globally; this is a development installer, not a signed public release.

Windows: extract the entire ZIP into a local folder, then double-click Install.cmd as the current user. It installs into %LOCALAPPDATA%\Black Dolphin Forge, registers a per-user Task Scheduler task, creates a Desktop shortcut and opens the dashboard. Keep the bundle directory beside setup.mjs while installing. This is a CMD installer, not an MSI/EXE. Actual installation and login behavior still require verification on Windows.

Both: the dashboard provides service status, start/stop, logs and Download Skill. Stop disables login startup; Start enables it. Closing the dashboard does not stop the service. Existing project files and private user state are preserved. Installers do not install an AI client or change its MCP configuration.

Build from the source checkout on macOS with Python 3 available:

    npm ci
    npm run package:portable
    node scripts/build-installers.mjs

The output/installers-VERSION directory contains both installers. Build destinations must not already exist. Installer binaries are published on the installer Git branch; application source is on main. Verify SHA256SUMS before distribution. Checksums detect corruption, not publisher identity.
