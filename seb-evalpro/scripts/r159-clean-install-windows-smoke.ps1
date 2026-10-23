param(
  [Parameter(Mandatory=$true)][string]$Setup
)
$ErrorActionPreference='Stop'
$target=Join-Path $env:LOCALAPPDATA 'Programs\KALONEO'
$legacy=Join-Path $env:LOCALAPPDATA 'Programs\seb-evalpro'
$recovery=Join-Path $env:LOCALAPPDATA 'SEB EvalPro Recovery'
if(Test-Path $target){throw "R159 Windows runner is not clean: $target"}
if(Test-Path $legacy){throw "R159 previous SEB program unexpectedly exists: $legacy"}
if(Test-Path $recovery){throw "R159 recovered SEB files unexpectedly present"}
& ./scripts/kaloneo-r127-interactive-wizard-windows-smoke.ps1 -Setup $Setup
if(-not $?){throw 'Clean interactive installation did not show the official KALONEO folder'}
$proc=Start-Process -FilePath $Setup -ArgumentList '/S','/currentuser' -Wait -PassThru
if($proc.ExitCode -ne 0){throw "Clean silent setup failed: $($proc.ExitCode)"}
$exe=Join-Path $target 'KALONEO.exe'
if(-not(Test-Path $exe -PathType Leaf)){throw "KALONEO.exe not installed at clean path: $exe"}
if(Test-Path $legacy){throw "Old SEB install folder created by fresh installation"}
if(Test-Path $recovery){throw "Fresh installation incorrectly recovered legacy profile"}
# NSIS registers the application under the Windows Uninstall registry key.
# InstallLocation under HKCU:\Software is OPTIONAL and must never be the
# only way to recognize a clean, valid KALONÉO installation.
$uninstallRoots=@(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
$registered=@(foreach($root in $uninstallRoots){
  if(-not(Test-Path $root)){continue}
  foreach($key in (Get-ChildItem $root -ErrorAction Stop)){
    $info=Get-ItemProperty $key.PSPath -ErrorAction SilentlyContinue
    if($null -eq $info){continue}
    if([string]$info.DisplayName -match 'KALON[EÉ]O'){
      [pscustomobject]@{
        RegistryPath=$key.Name
        Id=$key.PSChildName
        DisplayName=[string]$info.DisplayName
        InstallLocation=[string]$info.InstallLocation
        UninstallString=[string]$info.UninstallString
      }
    }
  }
})
if($registered.Count -ne 1){
  Write-Host "R159_REGISTRY_DIAGNOSTIC=$($registered | ConvertTo-Json -Compress -Depth 5)"
  throw "Expected one clean KALONÉO uninstall registration, found $($registered.Count)"
}
$details=$registered[0]
if($details.Id -match 'sebevalpro|seb-evalpro|pilot22' -or
   $details.RegistryPath -match 'sebevalpro|seb-evalpro|pilot22'){
  throw 'Legacy SEB Windows application ID was reused'
}
if($details.InstallLocation -and
   -not [string]::Equals($details.InstallLocation.TrimEnd('\'),$target.TrimEnd('\'),
     [StringComparison]::OrdinalIgnoreCase)){
  throw "KALONÉO registry InstallLocation points outside fresh directory: $($details.InstallLocation)"
}
if(-not $details.UninstallString -or $details.UninstallString -notmatch 'KALON[EÉ]O'){
  throw "Unexpected or missing KALONÉO uninstall command: $($details.UninstallString)"
}
Write-Host "KALONEO_R159_REGISTRY=OK — identity=$($details.Id) name=$($details.DisplayName) location=$target"
$shortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'KALONÉO.lnk'
if(-not(Test-Path $shortcut)){throw "New KALONÉO desktop shortcut absent"}
$uninstaller=Get-ChildItem $target -File -Filter '*Uninstall*.exe' | Select-Object -First 1
if(-not $uninstaller){throw 'No clean KALONÉO uninstaller'}
$uninst=Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S','/currentuser' -Wait -PassThru
if($uninst.ExitCode -ne 0){throw "Uninstall failed $($uninst.ExitCode)"}
if(Test-Path $exe){throw 'KALONÉO executable not removed on uninstall'}
if(Test-Path $legacy){throw 'A legacy install tree was generated'}
if(Test-Path $recovery){throw 'A legacy recovery profile was created'}
Write-Host 'KALONEO_R159_WINDOWS_CLEAN_INSTALL=OK — correct path, native shortcuts, new registry identity, no SEB migration/recovery, clean uninstall'
