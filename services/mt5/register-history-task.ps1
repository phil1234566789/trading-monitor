param(
 [Parameter(Mandatory=$true)][guid]$AccountId,
 [Parameter(Mandatory=$true)][string]$Config,
 [string]$Root='C:\MMT'
)
$ErrorActionPreference='Stop'
$private=[IO.Path]::GetFullPath((Join-Path $Root 'private'))+[IO.Path]::DirectorySeparatorChar
$configPath=(Resolve-Path -LiteralPath $Config).Path
if(-not $configPath.StartsWith($private,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $configPath -Leaf) -ne 'worker.env'){
 throw 'History configuration must be an existing private worker.env.'
}
$name='MMT History '+$AccountId.ToString()
if((Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue).State -eq 'Running'){
 Write-Output 'History task already running.'
 return
}
$launcher=Join-Path $Root 'app\services\mt5\windows_history_launcher.py'
$action=New-ScheduledTaskAction -Execute (Join-Path $Root 'venv\Scripts\pythonw.exe') -Argument ('-u "'+$launcher+'" --account-id '+$AccountId+' --config "'+$configPath+'"') -WorkingDirectory (Split-Path $launcher)
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -User SYSTEM -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Output ('Read-only history task started: '+$AccountId)
