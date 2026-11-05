param([Parameter(Mandatory=$true)][string]$ConfigDirectory,[Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference='Stop'
foreach($config in Get-ChildItem -LiteralPath $ConfigDirectory -Filter '*.reader.json') {
 $settings=Get-Content -LiteralPath $config.FullName -Raw | ConvertFrom-Json
 $terminal=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'terminal64.exe' -and $_.ExecutablePath -eq $settings.terminal_path }
 if(-not $terminal){
  Start-Process -FilePath $settings.terminal_path -ArgumentList @('/portable',('/config:"'+(Join-Path (Split-Path $settings.terminal_path) 'read-only.ini')+'"')) -WindowStyle Hidden | Out-Null
 }
 $settings=$null
 $running=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like ('*--config*'+$config.FullName+'*') }
 if($running){continue}
 Start-Process -FilePath $Python -ArgumentList @('-u',('"'+(Join-Path $PSScriptRoot 'reader.py')+'"'),'--config',('"'+$config.FullName+'"')) -WindowStyle Hidden -WorkingDirectory $PSScriptRoot -RedirectStandardOutput ($config.FullName+'.out.log') -RedirectStandardError ($config.FullName+'.err.log') | Out-Null
}
