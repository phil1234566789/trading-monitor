param(
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [string]$Python = "$PSScriptRoot\.venv\Scripts\python.exe",
    [switch]$Probe
)
$ErrorActionPreference='Stop'
$allowed=@('MT5_TERMINAL_PATH','MT5_WORKER_URL','MT5_WORKER_TOKEN','MT5_ALLOW_LIVE','MT5_JOURNAL_PATH')
foreach($line in Get-Content -LiteralPath $ConfigPath) {
    if(-not $line.Trim() -or $line.Trim().StartsWith('#')) {continue}
    $pair=$line.Split('=',2)
    if($pair.Count -ne 2 -or $allowed -notcontains $pair[0]) {throw 'Unexpected worker configuration field'}
    [Environment]::SetEnvironmentVariable($pair[0],$pair[1],'Process')
}
if($Probe) {& $Python "$PSScriptRoot\worker.py" --probe}
else {& $Python "$PSScriptRoot\worker.py"}
exit $LASTEXITCODE
