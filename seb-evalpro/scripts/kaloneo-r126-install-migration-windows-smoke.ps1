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
# R127: inspect the actual interactive NSIS directory page before the migration.
& ./scripts/kaloneo-r127-interactive-wizard-windows-smoke.ps1 -Setup $Setup
if($LASTEXITCODE -ne 0){throw 'Old installation path is still visible in the interactive installer'}


# Add both a persisted profile marker and a file physically inside install tree.
$profile=Join-Path $env:APPDATA 'SEB EvalPro Kaloneo PILOTE 21'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$sentinel=Join-Path $profile 'kaloneo-upgrade-candidate-data-preserved.txt'
[IO.File]::WriteAllText($sentinel,'preserve-candidate-files-and-local-keys')
# Installed binaries are deliberately uninstalled/replaced during an update.
# Only persistent userData (separate from the program directory) must survive.

Invoke-Setup $Setup '/S /currentuser'
Test-PathAndShortcuts 'UPGRADE_R125_TO_R126'

if(-not(Test-Path $sentinel -PathType Leaf) -or
   [IO.File]::ReadAllText($sentinel) -ne 'preserve-candidate-files-and-local-keys'){
  throw 'Candidate profile corrupted or lost after installation update.'
}
Write-Host 'CANDIDATE_PROFILE_R126=OK — original encrypted candidate storage location and data marker preserved'

# One final uninstall: no copy left under the old name, but userData stays.
Invoke-Setup $uninstaller '/S /currentuser'
Start-Sleep -Seconds 2
if(Test-Path $exe){throw 'Upgraded installation could not be uninstalled from new path.'}
if(-not(Test-Path $sentinel)){throw 'Uninstall unexpectedly deleted candidate profile'}

# A chosen CUSTOM install directory must never be migrated.
$custom=Join-Path $env:RUNNER_TEMP 'kaloneo-custom-install-test'
if(Test-Path $custom){throw 'Custom installation test directory unexpectedly exists'}
Invoke-Setup $PreviousSetup ('/S /currentuser /D='+$custom)
if(-not(Test-Path (Join-Path $custom 'KALONÉO.exe'))){
  throw 'Old R125 did not install into the requested custom folder'
}
Invoke-Setup $Setup '/S /currentuser'
if(-not(Test-Path (Join-Path $custom 'KALONEO.exe'))){
  throw 'R126 improperly relocated the chosen custom installation folder'
}
if(Test-Path $target){throw 'R126 created a competing default installation beside the custom folder'}
if(-not(Test-Path $sentinel)){throw 'Candidate profile was lost after custom-folder update'}
$customUninstaller=Join-Path $custom 'Uninstall KALONEO.exe'
if(-not(Test-Path $customUninstaller)){throw 'Custom-folder upgraded uninstaller is missing'}
Invoke-Setup $customUninstaller '/S /currentuser'
Write-Host 'CUSTOM_INSTALL_R126=OK — user-chosen location preserved, no duplicate app and data retained'

Write-Host 'KALONEO_R126_WINDOWS_INSTALL_AND_MIGRATION=OK'
