# HiveRouter desktop launcher
# Starts the local server if it is not already healthy, then opens the app in a
# dedicated Chrome app window (no tabs/address bar) sized to this screen. The
# Chrome profile lives under data/browser-profile, so localStorage (draft brief,
# last preset/model/thinking/cost) and window sizing persist across launches.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 8787
$url = "http://127.0.0.1:$port/"
$logDir = Join-Path $root 'data\logs'
$logFile = Join-Path $logDir 'desktop-server.log'
$errFile = Join-Path $logDir 'desktop-server.err.log'
$launchLog = Join-Path $logDir 'launch.log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Log([string]$message) {
  Add-Content -Path $launchLog -Value ("{0} {1}" -f (Get-Date).ToString('o'), $message) -Encoding UTF8
}
function Test-HiveRouter {
  try {
    $response = Invoke-RestMethod -Uri "${url}api/health" -TimeoutSec 2
    return $null -ne $response -and $response.status -eq 'ok'
  } catch {
    return $false
  }
}

Log 'launcher start'
if (-not (Test-HiveRouter)) {
  Log 'server unhealthy; locating npm.cmd'
  $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
  if (-not $npm) { $npm = 'C:\Program Files\nodejs\npm.cmd' }
  if (-not (Test-Path $npm)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('npm.cmd was not found. Install Node.js 26.7 or start HiveRouter manually.', 'HiveRouter') | Out-Null
    Log 'npm.cmd missing'
    exit 1
  }
  Log "starting npm start via $npm"
  Start-Process -FilePath $npm -ArgumentList 'start' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errFile
  $healthy = $false
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-HiveRouter) { $healthy = $true; break }
  }
  if (-not $healthy) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("HiveRouter did not become healthy on port $port. See $logFile", 'HiveRouter') | Out-Null
    Log 'server failed to become healthy'
    exit 1
  }
  Log 'server healthy'
} else {
  Log 'server already healthy'
}

$chromeCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  Log 'chrome missing; opening default browser'
  Start-Process $url
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$width = [Math]::Min(1440, [Math]::Max(900, $area.Width - 80))
$height = [Math]::Min(1000, [Math]::Max(640, $area.Height - 80))
$x = $area.X + [int](($area.Width - $width) / 2)
$y = $area.Y + [int](($area.Height - $height) / 2)
$profile = Join-Path $root 'data\browser-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$arguments = "--app=$url --window-size=$width,$height --window-position=$x,$y --user-data-dir=`"$profile`" --no-first-run --no-default-browser-check --disable-features=Translate"
Log "opening chrome $width x $height at $x,$y"
Start-Process -FilePath $chrome -ArgumentList $arguments
Log 'launcher done'
