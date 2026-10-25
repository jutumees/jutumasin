param([switch]$Rebuild, [switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $codeRoot = Split-Path -Parent $PSScriptRoot
    $workspace = Split-Path -Parent $codeRoot
    $toolRoot = Join-Path $workspace 'tools'
    $releaseRoot = Join-Path $workspace 'releases'
    $buildRoot = Join-Path $toolRoot 'build'
    $logRoot = Join-Path $toolRoot 'logs'
    New-Item -ItemType Directory -Path $releaseRoot, $logRoot -Force | Out-Null
    $env:JAVA_HOME = Join-Path $toolRoot 'jdk-17.0.18+8'
    $env:ANDROID_HOME = Join-Path $toolRoot 'android-sdk'
    $env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
    $env:ANDROID_AVD_HOME = Join-Path $toolRoot 'avd'
    $env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-home'
    $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    $emulator = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
    $apk = Join-Path $releaseRoot 'Jutumasin.apk'
    $serial = 'emulator-5580'

    foreach ($required in @($adb, $emulator, (Join-Path $env:ANDROID_AVD_HOME 'JutumasinTest.ini'))) {
        if (!(Test-Path -LiteralPath $required)) { throw "Missing Android runtime: $required. Development tools belong in $toolRoot." }
    }
    if ($Rebuild) {
        $project = Join-Path $codeRoot 'android'
        $sdkProperty = $env:ANDROID_HOME.Replace('\', '/').Replace(':', '\:')
        Set-Content -LiteralPath (Join-Path $project 'local.properties') -Value "sdk.dir=$sdkProperty" -Encoding ascii
        $signingFile = Join-Path $toolRoot 'signing\signing.properties'
        if (!(Test-Path -LiteralPath $signingFile)) { throw 'Release signing configuration is missing in tools\signing.' }
        $gradle = Join-Path $toolRoot 'gradle-8.13\bin\gradle.bat'
        Write-Host 'Building the signed Google Play bundle and matching APK...'
        & $gradle -p $project --project-cache-dir (Join-Path $toolRoot 'project-cache') "-PjutumasinBuildRoot=$buildRoot" "-PjutumasinSigningFile=$signingFile" assembleRelease bundleRelease lintRelease
        if ($LASTEXITCODE -ne 0) { throw "Android build failed with exit code $LASTEXITCODE. Previous output files were not replaced." }
        Copy-Item -LiteralPath (Join-Path $buildRoot 'app\outputs\apk\release\app-release.apk') -Destination $apk
        Copy-Item -LiteralPath (Join-Path $buildRoot 'app\outputs\bundle\release\app-release.aab') -Destination (Join-Path $releaseRoot 'Jutumasin.aab')
    }
    if ($BuildOnly) { Write-Host "Signed APK and AAB are ready in $releaseRoot"; exit 0 }
    if (!(Test-Path -LiteralPath $apk)) { throw 'Jutumasin.apk is missing. Run Test Android.bat -Rebuild to build it.' }

    & $adb start-server
    if ($LASTEXITCODE -ne 0) { throw 'Could not start Android Debug Bridge.' }
    $devices = (& $adb devices) -join "`n"
    $existing = $devices -match "(?m)^$serial\s"
    if ($existing) {
        $avdName = (& $adb -s $serial emu avd name 2>&1) -join "`n"
        if ($avdName -notmatch '(?m)^JutumasinTest\r?$') {
            throw 'Emulator port 5580 is occupied by another device. Close that emulator and try again.'
        }
        Write-Host 'Using the running Jutumasin emulator...'
    } else {
        # Never try to boot the same writable AVD twice on different ports.
        foreach ($line in ($devices -split "`n")) {
            if ($line -match '^(emulator-\d+)\s+device') {
                $otherSerial = $Matches[1]
                $otherName = (& $adb -s $otherSerial emu avd name 2>&1) -join "`n"
                if ($otherName -match '(?m)^JutumasinTest\r?$') {
                    throw "JutumasinTest is already running on $otherSerial. Close that emulator and run this launcher again."
                }
            }
        }
        Write-Host 'Opening Android. First startup may take a minute...'
        $emulatorProcess = Start-Process -FilePath $emulator -ArgumentList @('-avd','JutumasinTest','-port','5580','-no-audio','-no-boot-anim','-gpu','swiftshader','-no-snapshot') -WindowStyle Normal -PassThru -RedirectStandardOutput (Join-Path $logRoot 'emulator.log') -RedirectStandardError (Join-Path $logRoot 'emulator-error.log')
    }

    $deadline = [DateTime]::UtcNow.AddMinutes(4)
    $booted = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        if (!$existing -and $emulatorProcess.HasExited) {
            throw "The emulator exited with code $($emulatorProcess.ExitCode). See emulator-error.log and emulator.log in this folder."
        }
        $online = ((& $adb devices) -join "`n") -match "(?m)^$serial\s+device\s*$"
        if ($online) {
            $boot = (& $adb -s $serial shell getprop sys.boot_completed 2>&1) -join ''
            if ($LASTEXITCODE -eq 0 -and $boot.Trim() -eq '1') { $booted = $true; break }
        }
        Start-Sleep -Seconds 2
    }
    if (!$booted) { throw 'Android did not finish starting within four minutes. See emulator.log for details.' }

    Write-Host 'Installing Jutumasin (saved progress is preserved)...'
    & $adb -s $serial install -r $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK installation failed. No existing app or saved data was removed.' }
    & $adb -s $serial shell input keyevent KEYCODE_WAKEUP
    & $adb -s $serial shell wm dismiss-keyguard
    & $adb -s $serial shell am start -W -n com.jutumasin.app/.MainActivity
    if ($LASTEXITCODE -ne 0) { throw 'Android could not launch Jutumasin.' }
    Write-Host ''
    Write-Host 'Jutumasin is running in the Android window. Use the mouse to tap or drag cards.'
    Write-Host 'Close the Android window when finished. Run this BAT again whenever you want to test.'
    Write-Host 'Google Play upload file: Jutumasin.aab'
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
