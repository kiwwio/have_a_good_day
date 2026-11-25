# Have a Good Day: set up the Android SDK (command-line tools, platform 36, build tools, emulator, system image)
$ErrorActionPreference = 'Stop'
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = $sdk
$clt = "$sdk\cmdline-tools\latest"

if (-not (Test-Path "$clt\bin\android.exe")) {
  Write-Host '=== download command-line tools (155 MB, dl.google.com) ==='
  New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
  $zip = "$env:TEMP\commandlinetools-win.zip"
  curl.exe -L --fail -o $zip https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip
  $tmp = "$env:TEMP\clt-unzip"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  if (Test-Path $clt) { Remove-Item -Recurse -Force $clt }
  Move-Item "$tmp\cmdline-tools" $clt
  Remove-Item $zip
}

$cli = "$clt\bin\android.exe"
$pkgs = 'platform-tools', 'platforms/android-36', 'build-tools/36.0.0', 'emulator', 'system-images/android-36/google_apis/x86_64'
foreach ($p in $pkgs) {
  Write-Host "=== install $p ==="
  & $cli "--sdk=$sdk" sdk install $p
}

# tell Gradle where the SDK is (this file is git-ignored)
$proj = Split-Path -Parent $PSScriptRoot
"sdk.dir=" + ($sdk -replace '\\', '\\') | Set-Content -Encoding ascii "$proj\android\local.properties"

Write-Host '=== installed ==='
Get-ChildItem $sdk -Name
Write-Host 'SDK-INSTALL-DONE'
