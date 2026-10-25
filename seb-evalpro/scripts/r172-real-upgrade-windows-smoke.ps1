param(
 [Parameter(Mandatory=$true)][string]$PreviousSetup,
 [Parameter(Mandatory=$true)][string]$NewSetup
)
$ErrorActionPreference='Stop'
$root=Join-Path $env:APPDATA 'KALONEO'
$target=Join-Path $env:LOCALAPPDATA 'Programs\KALONEO'
$exe=Join-Path $target 'KALONEO.exe'
$env:KALONEO_R172_MANIFEST=Join-Path $env:RUNNER_TEMP 'kaloneo-r172-profile-inventory.json'
function Run-Setup([string]$file){
  $p=Start-Process -FilePath $file -ArgumentList @('/S','/currentuser') -Wait -PassThru
  if($p.ExitCode -ne 0){throw "Setup a échoué : $file (code $($p.ExitCode))"}
  if(-not(Test-Path $exe)){throw 'Binaire KALONEO.exe absent après installation'}
}
function Verify-Data([string]$label){
  & npx electron --no-sandbox scripts/r172-update-fixture-electron-main.js --verify
  if($LASTEXITCODE -ne 0){throw "PERTE DE DONNÉES $label"}
  Write-Host "R172_DATA_PRESERVED_$label=OK"
}
if(Test-Path $exe){throw 'Windows runner non vierge : une application est déjà installée'}
if(Test-Path $root){throw 'Windows runner non vierge : profil KALONEO déjà présent'}
Run-Setup $PreviousSetup
& npx electron --no-sandbox scripts/r172-update-fixture-electron-main.js --seed
if($LASTEXITCODE -ne 0){throw 'Création jeu de données réel échouée'}
Verify-Data 'BEFORE'
Run-Setup $NewSetup
Verify-Data 'UPGRADE_R171_TO_R172'
$uninstaller=Get-ChildItem -Path $target -File -Filter 'Uninstall*.exe' | Select-Object -First 1
if(-not $uninstaller){throw 'Désinstallateur nouveau absent'}
# L'ancienne version désinstalle pendant l'update; la nouvelle lors du test ci-dessous.
$p=Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S','/currentuser') -Wait -PassThru
if($p.ExitCode -ne 0){throw 'Désinstallation normale échouée'}
if(Test-Path $exe){throw 'Binaire encore présent après désinstallation'}
Verify-Data 'DEFAULT_UNINSTALL'
Run-Setup $NewSetup
Verify-Data 'REINSTALL'
# L'option native electron-builder doit être refusée au lieu d'effacer les données.
$uninstaller=Get-ChildItem -Path $target -File -Filter 'Uninstall*.exe' | Select-Object -First 1
$p=Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S','/currentuser','--delete-app-data') -Wait -PassThru
Verify-Data 'FORBIDDEN_DELETE_SWITCH'
if(-not(Test-Path $exe)){throw 'Le programme a été effacé via le paramètre interdit'}
Write-Host 'KALONEO_R172_REAL_WINDOWS_UPGRADE_AND_UNINSTALL_PRESERVATION=SUCCESS'
