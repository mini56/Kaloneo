param(
  [Parameter(Mandatory=$true)][string]$SetupPath,
  [Parameter(Mandatory=$true)][string]$ExpectedPassword
)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class KaloneoInstallerWin32 {
  public delegate bool EnumProc(IntPtr h,IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb,IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,EnumProc cb,IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h,StringBuilder b,int size);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h,StringBuilder b,int size);
  [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")] public static extern IntPtr SetText(IntPtr h,uint m,IntPtr a,string value);
  [DllImport("user32.dll",EntryPoint="SendMessageW")] public static extern IntPtr Send(IntPtr h,uint m,IntPtr a,IntPtr b);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h,int id);
  [DllImport("user32.dll")] public static extern int GetWindowLongW(IntPtr h,int n);
  public class Item { public IntPtr H;public string Text;public string Class;public int Style; }
  public static string TextOf(IntPtr h){
    var b=new StringBuilder(2048);GetWindowTextW(h,b,b.Capacity);return b.ToString();
  }
  public static IntPtr Window(int processId){
    IntPtr found=IntPtr.Zero;
    EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);
      if(id==(uint)processId && IsWindowVisible(h) && TextOf(h).Length>0){found=h;return false;}
      return true;
    },IntPtr.Zero);return found;
  }
  public static List<Item> Children(IntPtr h){
    var ret=new List<Item>();
    EnumChildWindows(h,(c,p)=>{
      if(!IsWindowVisible(c))return true;
      var type=new StringBuilder(96);GetClassNameW(c,type,type.Capacity);
      ret.Add(new Item{H=c,Text=TextOf(c),Class=type.ToString(),Style=GetWindowLongW(c,-16)});
      return true;
    },IntPtr.Zero);return ret;
  }
}
'@

function Next([IntPtr]$top){
  $h=[KaloneoInstallerWin32]::GetDlgItem($top,1)
  if($h -eq [IntPtr]::Zero){throw 'Bouton Suivant non trouvé'}
  if(-not [KaloneoInstallerWin32]::IsWindowEnabled($h)){return $false}
  [void][KaloneoInstallerWin32]::Send($h,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
  return $true
}

$proc=Start-Process -FilePath $SetupPath -ArgumentList @('/currentuser') -PassThru
$licenseSeen=$false
$acceptedLicence=$false
$passwordSeen=$false
$passed=$false
$lastClick=[DateTime]::MinValue
try {
  $deadline=(Get-Date).AddMinutes(3)
  while((Get-Date) -lt $deadline){
    Start-Sleep -Milliseconds 400
    if($proc.HasExited){throw "Setup terminé sans page password (code $($proc.ExitCode))"}
    $top=[KaloneoInstallerWin32]::Window($proc.Id)
    if($top -eq [IntPtr]::Zero){continue}
    $c=@([KaloneoInstallerWin32]::Children($top))
    $body=[string]::Join([Environment]::NewLine,@($c|ForEach-Object {$_.Text}))
    if($body -like '*mot de passe d*installation*' -or $body -like '*mot de passe valide*'){
      $passwordSeen=$true
      $edit=@($c | Where-Object {$_.Class -eq 'Edit' -and ($_.Style -band 0x20) -ne 0})|Select-Object -First 1
      if(-not $edit){throw 'Aucun champ password masqué NSIS trouvé'}
      [void][KaloneoInstallerWin32]::SetText($edit.H,0xC,[IntPtr]::Zero,$ExpectedPassword)
      Start-Sleep -Milliseconds 500
      if(-not(Next $top)){throw 'Suivant désactivé sur la page password'}
      break
    }
    $box=@($c|Where-Object {$_.Class -eq 'Button' -and $_.Text -like '*accepte*licence*'})|Select-Object -First 1
    if($box){
      $licenseSeen=$true
      if(-not $acceptedLicence){
        [void][KaloneoInstallerWin32]::Send($box.H,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
        $acceptedLicence=$true
        Start-Sleep -Milliseconds 300
      }
      [void](Next $top)
      continue
    }
    if((Get-Date)-$lastClick -gt [TimeSpan]::FromSeconds(1)){
      [void](Next $top)
      $lastClick=Get-Date
    }
  }
  if(-not $licenseSeen){throw 'Page licence non reconnue'}
  if(-not $passwordSeen){throw 'Page password non reconnue'}
  $end=(Get-Date).AddSeconds(12)
  while((Get-Date) -lt $end){
    Start-Sleep -Milliseconds 500
    if($proc.HasExited){$passed=$true;break}
    $top=[KaloneoInstallerWin32]::Window($proc.Id)
    if($top -eq [IntPtr]::Zero){continue}
    $c=@([KaloneoInstallerWin32]::Children($top))
    $body=[string]::Join([Environment]::NewLine,@($c|ForEach-Object {$_.Text}))
    if($body -like '*mot de passe d*installation*' -or $body -like '*mot de passe valide*'){continue}
    if($body -like '*Mot de passe d*installation incorrect*'){throw 'Mot de passe majuscule refusé'}
    $passed=$true
    break
  }
  if(-not $passed){throw 'La fenêtre mot de passe reste bloquée malgré la bonne saisie en majuscules'}
  Write-Host 'KALONEO_PASSWORD_GUI_UPPERCASE=SUCCESS : licence, champ masqué, saisie majuscule, page suivante'
}finally{
  try{if(-not $proc.HasExited){& taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null}}catch{}
}
