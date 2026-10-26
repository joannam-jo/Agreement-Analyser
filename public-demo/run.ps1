# Keeps the public demo running: backend, website and public link.
# Restarts any part that stops, keeps the PC awake, and saves the current link to
# PUBLIC-LINK.txt and a desktop shortcut. Normally started automatically at logon by install.ps1.
#
# Manual start:  powershell -ExecutionPolicy Bypass -File public-demo\run.ps1
# Rebuild after code changes:  powershell -ExecutionPolicy Bypass -File public-demo\run.ps1 -Rebuild

param([switch]$Rebuild)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$linkFile = Join-Path $root "PUBLIC-LINK.txt"
$shortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Agreement Analyzer - public link.url"
$node = (Get-Command node -ErrorAction Stop).Source
$cloudflared = Join-Path $env:APPDATA "npm\node_modules\cloudflared\bin\cloudflared.exe"
if (-not (Test-Path $cloudflared)) { $cloudflared = (Get-Command cloudflared.exe -ErrorAction Stop).Source }
$nextBin = Join-Path $root "node_modules\next\dist\bin\next"

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -Path (Join-Path $logDir "supervisor.log") -Value $line
  Write-Host $line
}

# Stop the PC from sleeping while the demo runs (released automatically when this script exits).
Add-Type -Namespace FaaWin32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[FaaWin32.Power]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null

# Settings for the public demo: private guest sessions, website forwards /api to the backend.
$env:GUEST_MODE = "true"
$env:PORT = "4000"
$env:NEXT_DIST_DIR = ".next-public"
$env:NEXT_PUBLIC_API_URL = ""
$env:NEXT_PUBLIC_GUEST_MODE = "true"
$env:NEXT_TELEMETRY_DISABLED = "1"

# Stop leftovers from an earlier run of this project (never touches other programs).
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$root*" -or $_.CommandLine -like "*localhost:3000*") } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
# Anything else of ours still holding the app's ports (e.g. started by an older version of this script).
Get-NetTCPConnection -State Listen -LocalPort 3000, 4000 -ErrorAction SilentlyContinue | ForEach-Object {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  if ($proc -and $proc.Name -eq "node.exe" -and ($proc.CommandLine -like "*dist/index.js*" -or $proc.CommandLine -like "*dist\index.js*" -or $proc.CommandLine -like "*next*start*")) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 1

# Build if needed.
Push-Location $root
if ($Rebuild -or -not (Test-Path "$root\shared\dist\index.js")) { Log "Building shared..."; npm run build --workspace=@faa/shared *> "$logDir\build-shared.log" }
if ($Rebuild -or -not (Test-Path "$root\backend\dist\index.js")) { Log "Building backend..."; npm run build --workspace=@faa/backend *> "$logDir\build-backend.log" }
if ($Rebuild -or -not (Test-Path "$root\frontend\.next-public\BUILD_ID")) {
  Log "Building website (takes a minute or two)..."
  Push-Location "$root\frontend"; & $node $nextBin build *> "$logDir\build-frontend.log"; Pop-Location
}
Pop-Location

$parts = @{}

function Start-Part($name) {
  switch ($name) {
    "backend" {
      # Full path, so leftover copies can always be recognised and cleaned up.
      $p = Start-Process -FilePath $node -ArgumentList "`"$root\backend\dist\index.js`"" -WorkingDirectory "$root\backend" -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$logDir\backend.out.log" -RedirectStandardError "$logDir\backend.err.log"
    }
    "website" {
      $p = Start-Process -FilePath $node -ArgumentList "`"$nextBin`" start -p 3000" -WorkingDirectory "$root\frontend" -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$logDir\website.out.log" -RedirectStandardError "$logDir\website.err.log"
    }
    "tunnel" {
      Remove-Item "$logDir\tunnel.log" -ErrorAction SilentlyContinue
      $p = Start-Process -FilePath $cloudflared -ArgumentList "tunnel --no-autoupdate --url http://localhost:3000 --logfile `"$logDir\tunnel.log`"" -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "$logDir\tunnel.out.log" -RedirectStandardError "$logDir\tunnel.err.log"
    }
  }
  $parts[$name] = $p
  Log "Started $name (pid $($p.Id))"
}

function Test-Url($url) {
  try { return (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20).StatusCode -eq 200 } catch { return $false }
}

function Save-Link($url) {
  Set-Content -Path $linkFile -Value $url -Encoding UTF8
  Set-Content -Path $shortcut -Value "[InternetShortcut]`r`nURL=$url" -Encoding ASCII
  Log "Public link: $url"
}

Start-Part "backend"
for ($i = 0; $i -lt 30 -and -not (Test-Url "http://localhost:4000/health"); $i++) { Start-Sleep -Seconds 2 }
if (-not (Test-Url "http://localhost:4000/health")) {
  Log "backend slow to start; restarting it once"
  Stop-Process -Id $parts["backend"].Id -Force -ErrorAction SilentlyContinue
  Start-Part "backend"
}
Start-Part "website"
for ($i = 0; $i -lt 60 -and -not (Test-Url "http://localhost:3000"); $i++) { Start-Sleep -Seconds 2 }
Start-Part "tunnel"

$currentUrl = $null
$publicFailures = 0
$tick = 0
$healthy = @{ backend = Get-Date; website = Get-Date }
while ($true) {
  Start-Sleep -Seconds 10
  $tick++

  foreach ($name in @("backend", "website", "tunnel")) {
    if ($parts[$name].HasExited) {
      Log "$name stopped (exit $($parts[$name].ExitCode)); restarting"
      if ($name -eq "tunnel") { $currentUrl = $null }
      Start-Part $name
      $healthy[$name] = Get-Date
    }
  }

  # A process can be alive but stuck; restart any part that has not answered for over a minute.
  foreach ($check in @(@{ name = "backend"; url = "http://localhost:4000/health" }, @{ name = "website"; url = "http://localhost:3000" })) {
    if (Test-Url $check.url) { $healthy[$check.name] = Get-Date }
    elseif (((Get-Date) - $healthy[$check.name]).TotalSeconds -gt 60) {
      Log "$($check.name) not responding; restarting"
      Stop-Process -Id $parts[$check.name].Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
      Start-Part $check.name
      $healthy[$check.name] = Get-Date
    }
  }

  # Pick up the tunnel address (it changes only when the tunnel restarts).
  if (-not $currentUrl -and (Test-Path "$logDir\tunnel.log")) {
    $found = Select-String -Path "$logDir\tunnel.log" -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) { $currentUrl = $found.Matches[0].Value; Save-Link $currentUrl; $publicFailures = 0 }
  }

  # Every minute, check the link really works from the internet; replace a dead tunnel.
  if ($currentUrl -and ($tick % 6 -eq 0)) {
    if (Test-Url $currentUrl) { $publicFailures = 0 }
    else {
      $publicFailures++
      Log "Public link check failed ($publicFailures)"
      if ($publicFailures -ge 3) {
        Log "Replacing the tunnel"
        Stop-Process -Id $parts["tunnel"].Id -Force -ErrorAction SilentlyContinue
        $currentUrl = $null
        $publicFailures = 0
        Start-Sleep -Seconds 2
        Start-Part "tunnel"
      }
    }
  }
}
