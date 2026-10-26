param([string]$NodePath,[string]$LauncherPath,[string]$IconPath,[string]$ShortcutPath)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $ShortcutPath) { throw 'Desktop shortcut already exists.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $NodePath
$shortcut.Arguments = '"' + $LauncherPath + '" desktop start'
$shortcut.WorkingDirectory = Split-Path -Parent $LauncherPath
$shortcut.IconLocation = $IconPath + ',0'
$shortcut.Description = 'Black Dolphin Forge — Service Control'
$shortcut.Save()
