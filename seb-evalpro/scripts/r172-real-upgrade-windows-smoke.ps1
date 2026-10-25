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
  Write-Host "R172_LAUNCH_SETUP=$file"
  $p=Start-Process -FilePath $file -ArgumentList @('/S','/currentuser') -PassThru
  if(-not $p.WaitForExit(180000)){try{Stop-Process -Id $p.Id -Force}catch{};throw "Setup bloqué (180s): $file"}
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
Write-Host 'R172_BEGIN_DEFAULT_SILENT_UNINSTALL'
$p=Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S','/currentuser') -PassThru
if(-not $p.WaitForExit(120000)){try{Stop-Process -Id $p.Id -Force}catch{};throw 'Désinstallation normale bloquée'}
if($p.ExitCode -ne 0){throw 'Désinstallation normale échouée'}
# NSIS lance un processus enfant de nettoyage : attendre la suppression réelle.
for($i=0;$i -lt 60;$i++){
  if(-not(Test-Path $exe)){break}
  Start-Sleep -Milliseconds 500
}
if(Test-Path $exe){throw 'Binaire encore présent 30 secondes après désinstallation'}
Verify-Data 'DEFAULT_UNINSTALL'
Run-Setup $NewSetup
Verify-Data 'REINSTALL'
# L'option native electron-builder doit être refusée au lieu d'effacer les données.
$uninstaller=Get-ChildItem -Path $target -File -Filter 'Uninstall*.exe' | Select-Object -First 1
Write-Host 'R172_BEGIN_BLOCK_FORBIDDEN_NATIVE_DELETION'
$p=Start-Process -FilePath $uninstaller.FullName -ArgumentList @('/S','/currentuser','--delete-app-data') -PassThru
if(-not $p.WaitForExit(30000)){try{Stop-Process -Id $p.Id -Force}catch{};throw 'Option dangereuse bloque le désinstallateur : défaut sécurité'}
Verify-Data 'FORBIDDEN_DELETE_SWITCH'
if(-not(Test-Path $exe)){throw 'Le programme a été effacé via le paramètre interdit'}
Write-Host 'KALONEO_R172_REAL_WINDOWS_UPGRADE_AND_UNINSTALL_PRESERVATION=SUCCESS'
