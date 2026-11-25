# Test helper: run adb actions listed in tools\adb-steps.txt, then save a screenshot and UI dump
# Each line of adb-steps.txt is the arguments for one adb call, e.g.:  shell input tap 540 1200
# Lines starting with "sleep N" wait N seconds.
$proj = Split-Path -Parent $PSScriptRoot
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$out = "$proj\tools\shots"
New-Item -ItemType Directory -Force $out | Out-Null
$log = "$out\log.txt"
"" | Set-Content $log
foreach ($line in Get-Content "$proj\tools\adb-steps.txt") {
  $line = $line.Trim()
  if (-not $line) { continue }
  if ($line -match '^sleep (\d+)$') { Start-Sleep -Seconds $matches[1]; continue }
  if ($line -match '^shot (\S+)$') {
    $n = $matches[1]
    & $adb shell screencap -p /sdcard/shot.png
    & $adb pull /sdcard/shot.png "$out\$n.png" | Out-Null
    & $adb shell uiautomator dump /sdcard/ui.xml | Out-Null
    & $adb pull /sdcard/ui.xml "$out\$n.xml" | Out-Null
    continue
  }
  ">> adb $line" | Add-Content $log
  Push-Location "$proj\tools"; $r = cmd /c "`"$adb`" $line 2>&1"; Pop-Location
  $r | Add-Content $log
}
'ADB-STEPS-DONE' | Add-Content $log
Write-Host 'ADB-STEPS-DONE'
