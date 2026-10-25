@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Run-Android.ps1" %*
set "result=%errorlevel%"
if not "%result%"=="0" (
  echo.
  echo Android launch failed. Read the error above.
  if not defined JUTUMASIN_NO_PAUSE pause
)
exit /b %result%
