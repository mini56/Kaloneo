param(
  [Parameter(Mandatory=$true)][string]$Setup
)
$ErrorActionPreference='Stop'
# Check the ACTUAL R127 NSIS dialog instead of assuming that a silent installer
# proves the old visible path has disappeared.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class KaloWindowsUi {
  public delegate bool EnumCallback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p,EnumCallback callback,IntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr p,int id);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,int msg,IntPtr wp,IntPtr lp);
  [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")]
  public static extern IntPtr SendMessageText(IntPtr h,int msg,int wp,StringBuilder result);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)]
  public static extern int GetClassName(IntPtr h,StringBuilder name,int len);
  public static string Read(IntPtr h) {
    if(h==IntPtr.Zero)return "";
    var sb=new StringBuilder(4096);
    SendMessageText(h,0x000D,sb.Capacity,sb);
    return sb.ToString();
  }
  public static string[] EditTexts(IntPtr parent) {
    var output=new List<string>();
    EnumChildWindows(parent,(h,_)=>{
      var n=new StringBuilder(128);
      GetClassName(h,n,n.Capacity);
      if(n.ToString().Equals("Edit",StringComparison.OrdinalIgnoreCase))
        output.Add(Read(h));
      return true;
    },IntPtr.Zero);
    return output.ToArray();
  }
}
'@
$proc=Start-Process -FilePath $Setup -ArgumentList '/currentuser' -PassThru
try {
  $handle=[IntPtr]::Zero
  for($w=0;$w -lt 50;$w++){
    $proc.Refresh()
    $handle=$proc.MainWindowHandle
    if($handle -ne [IntPtr]::Zero){break}
    Start-Sleep -Milliseconds 250
  }
  if($handle -eq [IntPtr]::Zero){throw 'NSIS installation wizard did not open.'}
  $seen=$false
  for($step=0;$step -lt 3;$step++){
    Start-Sleep -Milliseconds 900
    $texts=@([KaloWindowsUi]::EditTexts($handle))
    $paths=@($texts | Where-Object {$_ -match '[\\/]Programs[\\/]|[\\/]KALONEO|[\\/]seb-evalpro'})
    if($paths.Count -gt 0){
      $value=[string]$paths[0]
      Write-Host "WIZARD_DIRECTORY_FIELD: $value"
      if($value -match '(?i)[\\/]seb-evalpro(?:[\\/]|$)'){throw "Old visible installation path: $value"}
      if($value -notmatch '(?i)[\\/]KALONEO(?:[\\/]|$)'){throw "Wrong final installation directory: $value"}
      $seen=$true
      break
    }
    $next=[KaloWindowsUi]::GetDlgItem($handle,1)
    if($next -eq [IntPtr]::Zero){throw "Wizard Next button missing on step $step"}
    $buttonLabel=[KaloWindowsUi]::Read($next)
    if($buttonLabel -match 'Install|Installer'){throw 'Installer step reached without validating directory.'}
    [void][KaloWindowsUi]::SendMessage($next,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)
  }
  if(-not $seen){throw 'No NSIS installation directory field was shown within three pages.'}
  Write-Host 'KALONEO_R127_INTERACTIVE_DIRECTORY_GUI=OK — real wizard displays final KALONEO path'
} finally {
  try {if(-not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}}catch{}
}
