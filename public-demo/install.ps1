# Makes the public demo start automatically whenever you log in to Windows, and starts it now.
# Undo with:  powershell -ExecutionPolicy Bypass -File public-demo\uninstall.ps1

$taskName = "Agreement Analyzer public demo"
$script = Join-Path $PSScriptRoot "run.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
# Also check every 5 minutes: if the demo is not running (crashed or killed), start it again.
# While it is running, these checks do nothing (MultipleInstances IgnoreNew).
$watchdog = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$trigger = @($atLogon, $watchdog)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed. The demo starts now and at every logon. Your link will appear in PUBLIC-LINK.txt and on your desktop."
