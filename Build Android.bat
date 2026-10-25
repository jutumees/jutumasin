@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Run-Android.ps1" -Rebuild -BuildOnly
exit /b %errorlevel%
