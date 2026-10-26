# Stops the public demo and removes the automatic start.

$taskName = "Agreement Analyzer public demo"
$root = Split-Path -Parent $PSScriptRoot

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='node.exe' OR Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$root*" -or $_.CommandLine -like "*localhost:3000*") } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Remove-Item (Join-Path ([Environment]::GetFolderPath("Desktop")) "Agreement Analyzer - public link.url") -ErrorAction SilentlyContinue
Write-Host "Stopped and removed. The app no longer starts automatically."
