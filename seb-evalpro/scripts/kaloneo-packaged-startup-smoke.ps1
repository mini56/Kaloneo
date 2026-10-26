param(
 [Parameter(Mandatory=$true)][string]$Executable
)
# Contrôle Windows de l'exécutable réellement assemblé et non de Electron de développement.
$ErrorActionPreference='Stop'
$exe=(Resolve-Path $Executable).Path
if(-not(Test-Path $exe)){throw 'KALONEO.exe du dossier win-unpacked introuvable'}
$originalAppData=$env:APPDATA
$originalLocalAppData=$env:LOCALAPPDATA
$probeRoot=Join-Path $env:RUNNER_TEMP ('kaloneo-boot-'+[guid]::NewGuid().ToString('N'))
$env:APPDATA=Join-Path $probeRoot 'Roaming'
$env:LOCALAPPDATA=Join-Path $probeRoot 'Local'
New-Item -ItemType Directory -Force -Path $env:APPDATA,$env:LOCALAPPDATA | Out-Null
$started=$null
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class KaloneoBootWindows {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle,out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr handle,StringBuilder buffer,int maxCount);
  public static string[] Titles(uint processId) {
    List<string> titles=new List<string>();
    EnumWindows((hWnd,lParam)=>{
      uint pid=0;
      GetWindowThreadProcessId(hWnd,out pid);
      if(pid==processId&&IsWindowVisible(hWnd)) {
        StringBuilder buf=new StringBuilder(300);
        if(GetWindowText(hWnd,buf,buf.Capacity)>0)titles.Add(buf.ToString());
      }
      return true;
    },IntPtr.Zero);
    return titles.ToArray();
  }
}
'@
try {
  $started=Start-Process -FilePath $exe -PassThru
  $foundMain=0
  $titles=@()
  for($i=0;$i -lt 48;$i++){
    Start-Sleep -Milliseconds 750
    $started.Refresh()
    if($started.HasExited){throw "KALONEO_PACKAGED_STARTUP_FAILED: processus principal terminé (code $($started.ExitCode))"}
    $titles=@([KaloneoBootWindows]::Titles([uint32]$started.Id))
    if($titles|Where-Object{$_ -match 'JavaScript error|Démarrage impossible|^Error$|Uncaught Exception'}){
      throw "KALONEO_PACKAGED_STARTUP_FAILED: fenêtre d'erreur réelle : $($titles -join '; ')"
    }
    $isMain= @($titles | Where-Object {$_ -match 'KALON|SEB EvalPro' -and $_ -notmatch 'Démarrage impossible'}).Count -gt 0
    if($i -ge 12 -and $isMain){
      $foundMain++
      if($foundMain -ge 4)break
    }else{$foundMain=0}
  }
  if($foundMain -lt 4){throw "KALONEO_PACKAGED_STARTUP_FAILED: fenêtre principale absente; fenêtres visibles : $($titles -join '; ')"}
  Write-Host 'KALONEO_PACKAGED_STARTUP=OK — véritable exécutable Windows lancé, fenêtre principale visible sans erreur JS'
}finally{
  if($started){try{& taskkill.exe /PID $started.Id /T /F 2>$null | Out-Null}catch{}}
  $env:APPDATA=$originalAppData
  $env:LOCALAPPDATA=$originalLocalAppData
  Start-Sleep -Seconds 1
  Remove-Item -LiteralPath $probeRoot -Recurse -Force -ErrorAction SilentlyContinue
}
