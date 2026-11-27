# Have a Good Day: create (first time) and start an Android emulator, then install and open the app
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$cli = "$sdk\cmdline-tools\latest\bin\android.exe"
$adb = "$sdk\platform-tools\adb.exe"

$list = & $cli "--sdk=$sdk" emulator list 2>&1 | Out-String
Write-Host $list
if ($list -notmatch '\w') { Write-Host '=== create emulator (medium_phone) ==='; & $cli "--sdk=$sdk" emulator create medium_phone }
$list = & $cli "--sdk=$sdk" emulator list 2>&1 | Out-String
Write-Host $list
$avd = (& "$sdk\emulator\emulator.exe" -list-avds | Select-Object -First 1)
Write-Host "=== start $avd ==="
& $cli "--sdk=$sdk" emulator start $avd

& $adb wait-for-device
& $adb install -r "$proj\have-a-good-day-v3.2-debug.apk"
& $adb shell monkey -p tw.edu.nycu.haveagoodday -c android.intent.category.LAUNCHER 1
Write-Host 'EMULATOR-READY'
