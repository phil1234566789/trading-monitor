param(
 [ValidatePattern('^[a-f0-9]{40}$')][string]$Commit,
 [ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,
 [ValidateSet('2','3','4')][string]$Account='2',
 [string]$Root='C:\MMT',
 [string]$EnvironmentFile,
 [switch]$FunctionsOnly
)
$ErrorActionPreference='Stop'

function Assert-MmtContainedPath($Base,$Path){
 $prefix=[IO.Path]::GetFullPath($Base).TrimEnd('\')+'\'
 if(![IO.Path]::GetFullPath($Path).StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside MMT directory'}
}

function Assert-MmtHash($Path,$Expected){
 if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Expected){throw 'Release hash mismatch; no worker stopped'}
}

function Get-MmtRelease($Root,$Commit,$ManifestSha256,$Python,$Backup){
 $manifestPath=Join-Path $Backup 'release_manifest.json'
 $baseUri='https://raw.githubusercontent.com/phil1234566789/trading-monitor/'+$Commit+'/services/mt5/'
 Invoke-WebRequest -UseBasicParsing -Uri ($baseUri+'release_manifest.json') -OutFile $manifestPath -TimeoutSec 30 | Out-Null
 Assert-MmtHash $manifestPath $ManifestSha256
 $manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
 if($manifest.version -ne 1 -or !$manifest.files){throw 'Invalid release manifest'}
 $modules=@($manifest.files.PSObject.Properties)
 if($modules.Count -lt 2 -or $modules.Count -gt 64){throw 'Invalid release module count'}
 foreach($module in $modules){
  if($module.Name -notmatch '^[a-z][a-z0-9_]*\.py$' -or $module.Value -notmatch '^[a-f0-9]{64}$'){throw 'Invalid release module'}
 }
 if(!($modules.Name -contains 'worker.py')){throw 'Worker missing from release'}
 if(!($modules.Name -contains 'windows_account_launcher.py')){throw 'Account launcher missing from release'}
 $parent=Join-Path $Root 'releases'
 New-Item -ItemType Directory -Force -Path $parent | Out-Null
 $release=Join-Path $parent $Commit
 if(Test-Path -LiteralPath $release){
  Assert-MmtHash (Join-Path $release 'release_manifest.json') $ManifestSha256
  foreach($module in $modules){Assert-MmtHash (Join-Path $release $module.Name) $module.Value}
  return $release
 }
 $stage=Join-Path $Backup 'modules'
 New-Item -ItemType Directory -Path $stage | Out-Null
 foreach($module in $modules){
  $file=Join-Path $stage $module.Name
  Invoke-WebRequest -UseBasicParsing -Uri ($baseUri+$module.Name) -OutFile $file -TimeoutSec 30 | Out-Null
  Assert-MmtHash $file $module.Value
  & $Python -m py_compile $file
  if($LASTEXITCODE -ne 0){throw 'Release syntax check failed; no worker stopped'}
 }
 Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $stage 'release_manifest.json')
 # Nur komplett geprüfte Codeverzeichnisse werden sichtbar; laufende Worker behalten ihre alte Version.
 Assert-MmtContainedPath $Root $stage
 Assert-MmtContainedPath $Root $release
 [IO.Directory]::Move($stage,$release)
 return $release
}

function New-MmtAction($Execute,$Arguments,$WorkingDirectory){
 $parameters=@{Execute=$Execute;Argument=$Arguments}
 if($WorkingDirectory){$parameters.WorkingDirectory=$WorkingDirectory}
 return New-ScheduledTaskAction @parameters
}

function Wait-MmtTaskStopped($TaskName){
 for($attempt=0;$attempt -lt 30;$attempt++){
  if((Get-ScheduledTask -TaskName $TaskName).State -ne 'Running'){return}
  Start-Sleep -Milliseconds 200
 }
 throw 'Worker task did not stop'
}

function Assert-MmtExistingState($Root,$EnvironmentFile){
 if(!$EnvironmentFile){throw 'Existing private environment file required'}
 Assert-MmtContainedPath (Join-Path $Root 'private') $EnvironmentFile
 $settings=@{}
 foreach($line in Get-Content -LiteralPath $EnvironmentFile -Encoding UTF8){
  if(!$line.Trim() -or $line.StartsWith('#')){continue}
  $pair=$line.Split('=',2)
  if($pair.Length -ne 2){throw 'Invalid existing environment file'}
  $settings[$pair[0]]=$pair[1]
 }
 $journal=$settings['MT5_JOURNAL_PATH'];$terminal=$settings['MT5_TERMINAL_PATH']
 if(!$journal -or ![IO.Path]::IsPathRooted($journal) -or !(Test-Path -LiteralPath $journal -PathType Leaf)){throw 'Existing absolute journal file required'}
 Assert-MmtContainedPath (Join-Path $Root 'private') $journal
 if(!$terminal -or ![IO.Path]::IsPathRooted($terminal) -or !(Test-Path -LiteralPath $terminal -PathType Leaf)){throw 'Existing absolute terminal path required'}
 # Keine Konfiguration kopieren oder Werte protokollieren; der unveränderte Launcher lädt dieselbe Datei.
}

function New-MmtPrivateLauncher($Root,$Script,$Release,$Backup,$Python){
 $name=[IO.Path]::GetFileName($Script)
 $canonical=Join-Path $Root $name
 $sourcePath=$Script
 if([IO.Path]::GetFullPath($Script) -ne [IO.Path]::GetFullPath($canonical)){
  $metadataPath=Join-Path ([IO.Path]::GetDirectoryName($Script)) 'launcher.managed.json'
  $metadata=Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
  if($metadata.source -ne $canonical){throw 'Unknown private launcher origin'}
  Assert-MmtHash $Script $metadata.wrapper_sha256
  Assert-MmtHash $canonical $metadata.source_sha256
  $sourcePath=$canonical
 }
 $source=Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8
 if($source.Contains('__file__')){throw 'Self-relative private launcher requires review'}
 $patterns=@('(?m)^(\s*sys\.path\.insert\(0,\s*)str\(runtime\)(\)\s*)$',
             '(?m)^(\s*sys\.argv\s*=\s*\[)str\(runtime\s*/\s*[''\"]worker\.py[''\"]\)(\].*)$')
 $replacements=@(($Release | ConvertTo-Json -Compress),((Join-Path $Release 'worker.py') | ConvertTo-Json -Compress))
 if($name -eq 'worker_launcher.py'){
  $patterns+='(?m)^(\s*runpy\.run_path\()str\(runtime\s*/\s*[''\"]worker\.py[''\"]\)(,\s*run_name=[''\"]__main__[''\"]\)\s*)$'
  $replacements+=((Join-Path $Release 'worker.py') | ConvertTo-Json -Compress)
 }elseif($source -notmatch '(?m)^\s*from worker import main\s*$' -or $source -notmatch '(?m)^\s*from worker_lock import terminal_worker_lock, terminal_lock_path\s*$'){
  throw 'Private account launcher import binding changed; review required'
 }
 for($index=0;$index -lt $patterns.Count;$index++){
  $pattern=[regex]$patterns[$index]
  if($pattern.Matches($source).Count -ne 1){throw 'Private launcher code-path binding changed; review required'}
  $value=$replacements[$index]
  $source=$pattern.Replace($source,[Text.RegularExpressions.MatchEvaluator]{param($match) $match.Groups[1].Value+$value+$match.Groups[2].Value})
 }
 # Bereits Imports vor der bisherigen sys.path-Zeile brauchen Release-Module und private Geschwister.
 $parent=([IO.Path]::GetDirectoryName($sourcePath) | ConvertTo-Json -Compress)
 $code=($Release | ConvertTo-Json -Compress)
 $source="import sys`nsys.path.insert(0, $parent)`nsys.path.insert(0, $code)`n"+$source
 $copy=Join-Path $Backup $name
 [IO.File]::WriteAllText($copy,$source,(New-Object Text.UTF8Encoding $false))
 & $Python -m py_compile $copy
 if($LASTEXITCODE -ne 0){throw 'Private launcher syntax check failed; no worker stopped'}
 @{source=$canonical;source_sha256=(Get-FileHash -LiteralPath $canonical -Algorithm SHA256).Hash;wrapper_sha256=(Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash} |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Backup 'launcher.managed.json') -Encoding Unicode
 return $copy
}

function Get-MmtEnvironmentFile($Root,$Launcher,$Arguments){
 if($Launcher -eq 'worker_launcher.py'){
  $stem=if($Arguments -match '(^|\s)--execute(\s|$)'){'worker'}else{'monitor'}
  return Join-Path (Join-Path $Root 'private') ($stem+'.env')
 }
 $id=[regex]::Match($Arguments,'(?:^|\s)--account-id\s+"?([a-fA-F0-9-]{36})"?(?:\s|$)')
 if(!$id.Success){throw 'Existing account-id argument required'}
 $accountId=[guid]::Parse($id.Groups[1].Value).ToString()
 return Join-Path (Join-Path (Join-Path (Join-Path $Root 'private') 'accounts') $accountId) 'worker.env'
}

function Invoke-MmtReleaseDeployment($Root,$Commit,$ManifestSha256,$Account,$EnvironmentFile){
 if($Commit -notmatch '^[a-f0-9]{40}$' -or $ManifestSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'Pinned commit and manifest hash required'}
 if($Account -notin @('2','3','4')){throw 'Unknown worker account'}
 $taskName='MMT Worker Account '+$Account
 $task=Get-ScheduledTask -TaskName $taskName
 if($task.State -ne 'Running' -or @($task.Actions).Count -ne 1){throw 'Expected one running worker task'}
 $action=$task.Actions[0]
 $original=@{Execute=[string]$action.Execute;Arguments=[string]$action.Arguments;WorkingDirectory=[string]$action.WorkingDirectory}
 if($original.Execute -notmatch '(?i)\\pythonw?\.exe$'){throw 'Unexpected worker executable'}
 $match=[regex]::Match($original.Arguments,'^(?<prefix>\s*(?:(?:-u|-B)\s+)*)(?:"(?<quoted>[^"]+\.py)"|(?<plain>\S+\.py))(?<tail>[\s\S]*)$')
 if(!$match.Success){throw 'Unrecognized worker arguments; nothing changed'}
 $script=$match.Groups['quoted'].Value
 if(!$script){$script=$match.Groups['plain'].Value}
 $launcher=[IO.Path]::GetFileName($script)
 if($launcher -notin @('windows_account_launcher.py','worker_launcher.py','account_worker_launcher.py')){throw 'Unsupported worker launcher; nothing changed'}
 Assert-MmtContainedPath $Root $script
 $existingEnvironment=Get-MmtEnvironmentFile $Root $launcher $match.Groups['tail'].Value
 if($EnvironmentFile -and [IO.Path]::GetFullPath($EnvironmentFile) -ne [IO.Path]::GetFullPath($existingEnvironment)){throw 'Environment file does not match existing launcher arguments'}
 Assert-MmtExistingState $Root $existingEnvironment
 $python=Join-Path ([IO.Path]::GetDirectoryName($original.Execute)) 'python.exe'
 if(!(Test-Path -LiteralPath $python)){throw 'Python syntax checker missing'}
 $private=Join-Path $Root 'private'
 if(!(Test-Path -LiteralPath $private)){throw 'Existing private directory missing'}
 $backup=Join-Path $private ('release-deploy-'+[guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $backup | Out-Null
 Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath (Join-Path $backup 'task.before.xml') -Encoding Unicode
 $original | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'action.before.json') -Encoding Unicode
 $release=Get-MmtRelease $Root $Commit $ManifestSha256 $python $backup
 $entry=if($launcher -ne 'windows_account_launcher.py'){New-MmtPrivateLauncher $Root $script $release $backup $python}else{Join-Path $release $launcher}
 $arguments=$match.Groups['prefix'].Value+'"'+$entry+'"'+$match.Groups['tail'].Value
 $replacement=New-MmtAction $original.Execute $arguments $original.WorkingDirectory
 $restore=New-MmtAction $original.Execute $original.Arguments $original.WorkingDirectory
 Write-Output ('VERIFIED '+$Commit+'; restarting only '+$taskName)
 $latest=Get-ScheduledTask -TaskName $taskName
 if($latest.State -ne 'Running' -or @($latest.Actions).Count -ne 1 -or
    $latest.Actions[0].Execute -ne $original.Execute -or $latest.Actions[0].Arguments -ne $original.Arguments -or
    $latest.Actions[0].WorkingDirectory -ne $original.WorkingDirectory){throw 'Worker task changed during staging; nothing stopped'}
 $stopped=$false
 try{
  # Auch ein fehlerhaft beantworteter Stop kann den Task bereits beendet haben.
  $stopped=$true
  Stop-ScheduledTask -TaskName $taskName
  Wait-MmtTaskStopped $taskName
  Set-ScheduledTask -TaskName $taskName -Action $replacement | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Start-Sleep -Seconds 3
  if((Get-ScheduledTask -TaskName $taskName).State -ne 'Running'){throw 'Updated worker task did not remain running'}
  Write-Output ('UPDATED '+$taskName+'; verified release '+$Commit+'; read fresh heartbeat before success')
 }catch{
  if($stopped){
   try{
    try{Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop}catch{}
    Wait-MmtTaskStopped $taskName
    Set-ScheduledTask -TaskName $taskName -Action $restore | Out-Null
   }finally{Start-ScheduledTask -TaskName $taskName}
   Write-Output 'ROLLBACK: original task action restored; worker start requested'
  }
  throw
 }
}

if(!$FunctionsOnly){Invoke-MmtReleaseDeployment $Root $Commit $ManifestSha256 $Account $EnvironmentFile}
