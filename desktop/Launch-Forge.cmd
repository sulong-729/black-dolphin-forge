@echo off
node "%~dp0..\dist\cli\main.js" desktop start
if errorlevel 1 pause
