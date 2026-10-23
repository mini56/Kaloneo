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
if($LASTEXITCODE -ne 0){throw 'Clean interactive installation did not show the official KALONEO folder'}
$proc=Start-Process -FilePath $Setup -ArgumentList '/S','/currentuser' -Wait -PassThru
if($proc.ExitCode -ne 0){throw "Clean silent setup failed: $($proc.ExitCode)"}
$exe=Join-Path $target 'KALONEO.exe'
if(-not(Test-Path $exe -PathType Leaf)){throw "KALONEO.exe not installed at clean path: $exe"}
if(Test-Path $legacy){throw "Old SEB install folder created by fresh installation"}
if(Test-Path $recovery){throw "Fresh installation incorrectly recovered legacy profile"}
$registry='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$installed=@(Get-ChildItem $registry -ErrorAction SilentlyContinue | Where-Object {
    (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName -eq 'KALONÉO'
})
if($installed.Count -ne 1){throw "Expected one clean KALONÉO registration, found $($installed.Count)"}
$details=Get-ItemProperty $installed[0].PSPath
if($details.InstallLocation.TrimEnd('\') -ne $target.TrimEnd('\')){
  throw "Installer registered an incorrect directory: $($details.InstallLocation)"
}
if($details.PSChildName -match 'sebevalpro|pilot22'){throw 'Old Windows application ID was reused'}
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
