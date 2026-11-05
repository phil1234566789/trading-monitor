param(
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [Parameter(Mandatory=$true)][string[]]$AccountIds,
    [Parameter(Mandatory=$true)][string]$TerminalRoot,
    [string]$Python = '',
    [switch]$Monitor
)
$ErrorActionPreference='Stop'
if(-not $Python){$Python=Join-Path $PSScriptRoot '.venv/Scripts/python.exe'}
$settings=@{}
foreach($line in Get-Content -LiteralPath $ConfigPath){
    if(-not $line.Trim() -or $line.Trim().StartsWith('#')){continue}
    $pair=$line.Split('=',2)
    if($pair.Count -ne 2){throw 'Invalid worker configuration'}
    $settings[$pair[0]]=$pair[1]
}
$template=$settings.MT5_TERMINAL_PATH
if(-not (Test-Path -LiteralPath $template -PathType Leaf)){throw 'Terminal template missing'}
$root=[IO.Path]::GetFullPath($TerminalRoot)
foreach($id in ($AccountIds | Select-Object -Unique)){
    $parsed=[guid]::Empty
    if(-not [guid]::TryParse($id,[ref]$parsed)){throw 'Invalid account ID'}
    $folder=Join-Path $root $parsed.ToString()
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    $terminal=Join-Path $folder 'terminal64.exe'
    if(-not (Test-Path -LiteralPath $terminal)){
        Copy-Item -LiteralPath $template -Destination $terminal
        $servers=Join-Path (Split-Path $template) 'config/servers.dat'
        if(Test-Path -LiteralPath $servers){
            New-Item -ItemType Directory -Force -Path (Join-Path $folder 'config') | Out-Null
            Copy-Item -LiteralPath $servers -Destination (Join-Path $folder 'config/servers.dat')
        }
    }
    $environment=@{}
    foreach($name in @('MT5_WORKER_URL','MT5_WORKER_TOKEN','MT5_ALLOW_LIVE','MT5_SERVER_TIME_OFFSET_SEC')){
        if($settings.ContainsKey($name)){$environment[$name]=$settings[$name]}
    }
    $environment.MT5_ACCOUNT_ID=$parsed.ToString()
    $environment.MT5_TERMINAL_PATH=$terminal
    $environment.MT5_JOURNAL_PATH=Join-Path $folder 'execution.sqlite3'
    $arguments=@('"'+(Join-Path $PSScriptRoot 'worker.py')+'"')
    if($Monitor){$arguments+='--monitor'}
    Start-Process -FilePath $Python -ArgumentList $arguments -Environment $environment -WindowStyle Hidden |
        Out-Null
    Write-Output ('Worker gestartet für Konto '+$parsed.ToString())
}
