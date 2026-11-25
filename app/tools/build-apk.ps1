# Have a Good Day: build a debug APK (for emulator / test phones)
# The Android build tools fail on Windows paths with non-ASCII characters,
# so the project is mirrored to an ASCII-only folder and built there.
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$work = "$env:USERPROFILE\hagd-build"
$jdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdk) { throw 'JDK 21 not found (winget install Microsoft.OpenJDK.21)' }
$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Write-Host "JAVA_HOME = $env:JAVA_HOME"

Set-Location $proj
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

Write-Host "=== mirror project to $work ==="
robocopy $proj $work /MIR /NFL /NDL /NJH /NJS /NP /XD "$proj\android\app\build" "$proj\android\.gradle" "$proj\android\build" "$proj\ios" | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'robocopy failed' }
"sdk.dir=" + ($env:ANDROID_HOME -replace '\\', '\\') | Set-Content -Encoding ascii "$work\android\local.properties"

Set-Location "$work\android"
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }

$apk = "$work\android\app\build\outputs\apk\debug\app-debug.apk"
Copy-Item $apk "$proj\have-a-good-day-v3.0-debug.apk" -Force
Get-Item "$proj\have-a-good-day-v3.0-debug.apk" | Select-Object Name, Length
Write-Host 'BUILD-DONE'
