$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $repo 'services\mt5\deploy_release.ps1') -FunctionsOnly
$script:releaseCommit='1111111111111111111111111111111111111111'
$script:python=(Get-Command python.exe).Source
$fixtureRoot=Join-Path $repo '.debug\mt5-release-deploy'
New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null
$script:testRoot=Join-Path $fixtureRoot ('fixture-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $script:testRoot | Out-Null
function Assert-That($Condition,$Message){if(!$Condition){throw $Message}}
function Write-Utf8($Path,$Text){[IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding $false))}
function Get-ScheduledTask($TaskName){Assert-That ($TaskName -eq 'MMT Worker Account 2') 'Unexpected task touched';return $script:task}
function Export-ScheduledTask($TaskName){return '<Task><Principal>SYSTEM</Principal></Task>'}
function New-ScheduledTaskAction($Execute,$Argument,$WorkingDirectory){return [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
function Stop-ScheduledTask($TaskName,$ErrorAction){$script:stops++;$script:task.State='Ready';if($script:failStop -and $script:stops -eq 1){throw 'Stop reply failed after stopping'}}
function Set-ScheduledTask($TaskName,$Action){
 if($script:failInstall -and $Action.Arguments -ne $script:before.Arguments){throw 'Simulated install failure'}
 if($script:failRollback -and $Action.Arguments -eq $script:before.Arguments){throw 'Simulated rollback failure'}
 $script:task.Actions=@($Action);return $script:task
}
function Start-ScheduledTask($TaskName){
 $script:starts++
 $script:task.State=if($script:failStart -and $script:starts -eq 1){'Ready'}else{'Running'}
}
function Start-Sleep($Milliseconds,$Seconds){}
function Invoke-WebRequest($Uri,$OutFile,$TimeoutSec,[switch]$UseBasicParsing){
 $name=[IO.Path]::GetFileName(([uri]$Uri).AbsolutePath)
 Copy-Item -LiteralPath (Join-Path $script:payload $name) -Destination $OutFile
 if($script:corruptDownload -and $name -eq 'broker.py'){Add-Content -LiteralPath $OutFile -Value '# corrupt'}
}
function New-Fixture($Name,[switch]$AccountLauncher){
 $script:caseRoot=Join-Path $script:testRoot $Name
 $script:payload=Join-Path $script:caseRoot 'payload'
 $runtime=Join-Path $script:caseRoot 'app\services\mt5';$private=Join-Path $script:caseRoot 'private'
 New-Item -ItemType Directory -Force -Path $script:payload,$runtime,$private | Out-Null
 $envFolder=$private
 $launcher='worker_launcher.py';$tail=' --execute'
 $entryCall="runpy.run_path(str(runtime / 'worker.py'), run_name='__main__')"
 if($AccountLauncher){
  $launcher='account_worker_launcher.py';$tail=' --account-id 11111111-1111-1111-1111-111111111111 --execute'
  $envFolder=Join-Path $private 'accounts\11111111-1111-1111-1111-111111111111'
  New-Item -ItemType Directory -Force -Path $envFolder | Out-Null
  $entryCall="from worker import main`nfrom worker_lock import terminal_worker_lock, terminal_lock_path"
 }
 $terminal=Join-Path $script:caseRoot 'terminal64.exe';Write-Utf8 $terminal ''
 $journal=Join-Path $envFolder 'execution.sqlite3';Write-Utf8 $journal 'existing journal'
 Write-Utf8 (Join-Path $envFolder 'worker.env') ("MT5_JOURNAL_PATH=$journal`nMT5_TERMINAL_PATH=$terminal`nMT5_WORKER_TOKEN=fake-not-output`n")
 $script:canonical=Join-Path $script:caseRoot $launcher
 Write-Utf8 $script:canonical @"
from pathlib import Path
import os, runpy, sys
runtime = Path(r'$runtime')
os.chdir(runtime)
sys.path.insert(0, str(runtime))
sys.argv = [str(runtime / 'worker.py')] + ([] if args.execute else ['--monitor'])
$entryCall
"@
 $script:canonicalHash=(Get-FileHash $script:canonical).Hash
 $script:before=[pscustomobject]@{Execute=Join-Path ([IO.Path]::GetDirectoryName($script:python)) 'pythonw.exe';Arguments='-u "'+$script:canonical+'"'+$tail;WorkingDirectory=$runtime}
 $script:task=[pscustomobject]@{State='Running';Actions=@($script:before);Principal=[pscustomobject]@{UserId='SYSTEM'};Triggers=@('existing')}
 $script:stops=0;$script:starts=0;$script:failStop=$false;$script:failInstall=$false;$script:failRollback=$false;$script:failStart=$false;$script:corruptDownload=$false
 $hashes=[ordered]@{}
 $modules=Get-ChildItem (Join-Path $repo 'services\mt5') -Filter '*.py' | Where-Object { !$_.Name.StartsWith('test_') -and $_.Name -ne 'build_release_manifest.py' } | Sort-Object Name
 foreach($module in $modules){$path=Join-Path $script:payload $module.Name;Write-Utf8 $path ("VALUE = '"+$module.Name+"'`n");$hashes[$module.Name]=(Get-FileHash $path).Hash.ToLowerInvariant()}
 Write-Utf8 (Join-Path $script:payload 'release_manifest.json') (@{version=1;files=$hashes} | ConvertTo-Json -Depth 5)
 $script:manifestHash=(Get-FileHash (Join-Path $script:payload 'release_manifest.json')).Hash
}
function Deploy{Invoke-MmtReleaseDeployment $script:caseRoot $script:releaseCommit $script:manifestHash '2' | Out-Null}
function Expect-Failure{try{Deploy;throw 'Expected rejection not received'}catch{if($_.Exception.Message -eq 'Expected rejection not received'){throw}}}

foreach($accountStyle in @($false,$true)){
 New-Fixture ('success-'+$accountStyle) -AccountLauncher:$accountStyle
 Deploy
 Assert-That ($script:stops -eq 1 -and $script:starts -eq 1) 'Success task lifecycle wrong'
 Assert-That ($script:task.Actions[0].Execute -eq $script:before.Execute) 'Python executable changed'
 Assert-That ($script:task.Actions[0].WorkingDirectory -eq $script:before.WorkingDirectory) 'Working directory changed'
 Assert-That ($script:task.Principal.UserId -eq 'SYSTEM' -and $script:task.Triggers[0] -eq 'existing') 'Task identity changed'
 Assert-That ((Get-FileHash $script:canonical).Hash -eq $script:canonicalHash) 'Original private wrapper changed'
 $copy=[regex]::Match($script:task.Actions[0].Arguments,'-u "([^"]+)"').Groups[1].Value
 $changed=Get-Content -LiteralPath $copy -Raw
 Assert-That ($changed.Contains('os.chdir(runtime)')) 'Original runtime CWD removed'
 Assert-That (!$changed.Contains("str(runtime / 'worker.py')") -and !$changed.Contains('sys.path.insert(0, str(runtime))')) 'Old code binding remains'
 $release=Join-Path (Join-Path $script:caseRoot 'releases') $script:releaseCommit
 Assert-That ((Get-ChildItem $release -Filter '*.py').Count -eq (Get-ChildItem $script:payload -Filter '*.py').Count) 'Incomplete runtime bundle'
 Deploy
 Assert-That ($script:stops -eq 2 -and $script:starts -eq 2) 'Managed wrapper cannot be redeployed'
}
New-Fixture 'bad-manifest';$script:manifestHash='0'*64;Expect-Failure
Assert-That ($script:stops -eq 0) 'Invalid manifest stopped worker'
New-Fixture 'bad-module';$script:corruptDownload=$true;Expect-Failure
Assert-That ($script:stops -eq 0) 'Invalid module stopped worker'
New-Fixture 'syntax-failure'
Write-Utf8 (Join-Path $script:payload 'broker.py') 'def broken('
$broken=Get-Content (Join-Path $script:payload 'release_manifest.json') -Raw | ConvertFrom-Json
$broken.files.'broker.py'=(Get-FileHash (Join-Path $script:payload 'broker.py')).Hash.ToLowerInvariant()
Write-Utf8 (Join-Path $script:payload 'release_manifest.json') ($broken | ConvertTo-Json -Depth 5)
$script:manifestHash=(Get-FileHash (Join-Path $script:payload 'release_manifest.json')).Hash
Expect-Failure;Assert-That ($script:stops -eq 0) 'Invalid Python syntax stopped worker'
New-Fixture 'missing-state';Remove-Item -LiteralPath (Join-Path $script:caseRoot 'private\worker.env');Expect-Failure
Assert-That ($script:stops -eq 0) 'Missing environment stopped worker'
New-Fixture 'changed-wrapper';Add-Content -LiteralPath $script:canonical -Value '# __file__';Expect-Failure
Assert-That ($script:stops -eq 0) 'Unknown wrapper semantics stopped worker'
New-Fixture 'install-failure';$script:failInstall=$true;Expect-Failure
Assert-That ($script:task.Actions[0].Arguments -eq $script:before.Arguments -and $script:starts -eq 1 -and $script:task.State -eq 'Running') 'Original action not restored after install failure'
New-Fixture 'stop-reply-failure';$script:failStop=$true;Expect-Failure
Assert-That ($script:starts -eq 1 -and $script:task.State -eq 'Running') 'Ambiguous Stop reply left worker stopped'
New-Fixture 'startup-failure';$script:failStart=$true;Expect-Failure
Assert-That ($script:task.Actions[0].Arguments -eq $script:before.Arguments -and $script:starts -eq 2 -and $script:task.State -eq 'Running') 'Startup rollback failed'
New-Fixture 'rollback-failure';$script:failStart=$true;$script:failRollback=$true;Expect-Failure
Assert-That ($script:starts -eq 2) 'Rollback error skipped final worker restart'

New-Fixture 'early-imports'
Write-Utf8 (Join-Path $script:payload 'worker_environment.py') "def worker_settings(path):`n    return 'release helper'`n"
$updated=Get-Content (Join-Path $script:payload 'release_manifest.json') -Raw | ConvertFrom-Json
$updated.files.'worker_environment.py'=(Get-FileHash (Join-Path $script:payload 'worker_environment.py')).Hash.ToLowerInvariant()
Write-Utf8 (Join-Path $script:payload 'release_manifest.json') ($updated | ConvertTo-Json -Depth 5)
$script:manifestHash=(Get-FileHash (Join-Path $script:payload 'release_manifest.json')).Hash
Write-Utf8 (Join-Path $script:caseRoot 'private_probe.py') "VALUE = 'original parent'`n"
$result=Join-Path $script:caseRoot 'early-import-result.txt';$resultLiteral=$result | ConvertTo-Json -Compress
$prefix="from worker_environment import worker_settings`nfrom private_probe import VALUE`nfrom pathlib import Path`nPath($resultLiteral).write_text(worker_settings(None)+'|'+VALUE)`nraise SystemExit(0)`n"
Write-Utf8 $script:canonical ($prefix+(Get-Content $script:canonical -Raw))
Deploy
$copy=[regex]::Match($script:task.Actions[0].Arguments,'-u "([^"]+)"').Groups[1].Value
Push-Location $script:before.WorkingDirectory
try{& $script:python $copy;if($LASTEXITCODE -ne 0){throw 'Early import probe failed'}}finally{Pop-Location}
Assert-That ((Get-Content $result -Raw) -eq 'release helper|original parent') 'Early imports lost release module or private sibling'
Write-Output ('PASS PS '+$PSVersionTable.PSVersion+' real filesystem/compile/hash + mocked task lifecycle; fixture '+$script:testRoot)
