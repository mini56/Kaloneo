param(
  [Parameter(Mandatory=$true)][string]$Setup,
  [Parameter(Mandatory=$true)][string]$PreviousSetup
)
$ErrorActionPreference = 'Stop'
$legacy=Join-Path $env:LOCALAPPDATA 'Programs\seb-evalpro'
$target=Join-Path $env:LOCALAPPDATA 'Programs\KALONEO'
$exe=Join-Path $target 'KALONEO.exe'
$uninstaller=Join-Path $target 'Uninstall KALONEO.exe'
$desktop=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'KALONÉO.lnk'
$startmenu=Join-Path ([Environment]::GetFolderPath('Programs')) 'KALONÉO.lnk'
$shell=New-Object -ComObject WScript.Shell

function Invoke-Setup([string]$file,[string]$opts){
  $p=Start-Process -FilePath $file -ArgumentList $opts -PassThru -Wait
  if($p.ExitCode -ne 0){throw "Installer failed with exit code $($p.ExitCode): $file"}
}
function Test-PathAndShortcuts([string]$scenario){
  if(-not(Test-Path $exe -PathType Leaf)){throw "$scenario : KALONEO.exe missing in $target"}
  if(Test-Path $legacy){throw "$scenario : previous seb-evalpro directory still exists"}
  foreach($shortcut in @($desktop,$startmenu)){
    if(-not(Test-Path $shortcut -PathType Leaf)){throw "$scenario : shortcut missing: $shortcut"}
    $actual=$shell.CreateShortcut($shortcut).TargetPath
    if($actual -ine $exe){throw "$scenario : shortcut points to wrong executable: $actual"}
  }
  $matching=@(Get-ChildItem 'HKCU:\Software' -ErrorAction Stop | ForEach-Object {
    try {
      $v=Get-ItemProperty -Path $_.PSPath -Name InstallLocation -ErrorAction Stop
      if($v.InstallLocation -ieq $target){$v}
    } catch {}
  })
  if($matching.Count -ne 1){throw "$scenario : expected exactly one registered installation at $target, got $($matching.Count)"}
  if(-not(Test-Path $uninstaller -PathType Leaf)){throw "$scenario : uninstaller missing at $uninstaller"}
  Write-Host "$scenario : SUCCESS — installed folder, registry, shortcuts and uninstaller use KALONEO"
}

if((Test-Path $legacy) -or (Test-Path $target)){
  throw 'Windows runner already has a program install; the clean-install test requires a new machine.'
}
# First prove that a FRESH installation picks a new KALONEO folder.
Invoke-Setup $Setup '/S /currentuser'
Test-PathAndShortcuts 'CLEAN_INSTALL_R126'

# Remove application binaries only; the old candidate profile must remain untouched.
Invoke-Setup $uninstaller '/S /currentuser'
Start-Sleep -Seconds 2
if(Test-Path $exe){throw 'Clean uninstallation left KALONEO.exe behind'}
if(Test-Path $legacy){throw 'Unexpected old directory after clean uninstall'}

# Now recreate the actual original R125 default-directory problem.
Invoke-Setup $PreviousSetup '/S /currentuser'
if(-not(Test-Path $legacy -PathType Container)){
  throw 'R125 legacy install did not create the original seb-evalpro directory.'
}
if(Test-Path $target){throw 'R125 has unexpected KALONEO folder: cannot validate actual migration'}
$legacyUninstall=(Get-ChildItem $legacy -Filter 'Uninstall*.exe' -File | Select-Object -First 1)
if(-not $legacyUninstall){throw 'Original R125 uninstaller missing'}
Write-Host "BASELINE_R125=OK — legacy folder: $legacy"

# Add both a persisted profile marker and a file physically inside install tree.
$profile=Join-Path $env:APPDATA 'SEB EvalPro Kaloneo PILOTE 21'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$sentinel=Join-Path $profile 'kaloneo-upgrade-candidate-data-preserved.txt'
[IO.File]::WriteAllText($sentinel,'preserve-candidate-files-and-local-keys')
$treeFile=Join-Path $legacy 'kaloneo-existing-install-preservation.txt'
[IO.File]::WriteAllText($treeFile,'do-not-delete-on-migration')

Invoke-Setup $Setup '/S /currentuser'
Test-PathAndShortcuts 'UPGRADE_R125_TO_R126'

if(-not(Test-Path $sentinel -PathType Leaf) -or
   [IO.File]::ReadAllText($sentinel) -ne 'preserve-candidate-files-and-local-keys'){
  throw 'Candidate profile corrupted or lost after installation update.'
}
$treeMoved=Join-Path $target 'kaloneo-existing-install-preservation.txt'
if(-not(Test-Path $treeMoved -PathType Leaf) -or
  [IO.File]::ReadAllText($treeMoved) -ne 'do-not-delete-on-migration'){
  throw 'Original application folder not migrated atomically.'
}
Write-Host 'CANDIDATE_PROFILE_R126=OK — untouched original profile and preserved file tree'

# One final uninstall: no copy left under the old name, but userData stays.
Invoke-Setup $uninstaller '/S /currentuser'
Start-Sleep -Seconds 2
if(Test-Path $exe){throw 'Upgraded installation could not be uninstalled from new path.'}
if(-not(Test-Path $sentinel)){throw 'Uninstall unexpectedly deleted candidate profile'}
Write-Host 'KALONEO_R126_WINDOWS_INSTALL_AND_MIGRATION=OK'
