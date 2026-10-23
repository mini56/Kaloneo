!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define SEB_BUILD_NUMBER "162"
!define SEB_BUILD_LABEL "Build #${SEB_BUILD_NUMBER}"

# R159 : No legacy migration, no profile import and no old registry lookup.
# Native NSIS uninstallation removes app binaries/shortcuts, not user files.
!macro customUnInstall
  DetailPrint "Désinstallation de KALONÉO"
!macroend

!ifndef BUILD_UNINSTALLER
Var SebBrandingWelcomeDialog
Var SebBrandingWelcomeImage
Var SebBrandingWelcomeHandle
Var SebBrandingFinishDialog
Var SebBrandingFinishImage
Var SebBrandingFinishHandle
Var SebIntroShown
Var SebIntroActive
Var SebIntroFrame
Var SebIntroFramePath
Var SebIntroNextButton
Var SebIntroNewBitmapHandle
Var KaloneoCleanPathInitialized

!include "${BUILD_RESOURCES_DIR}\intro-frames\intro-meta.nsh"

# Install into KALONEO, ignoring previous product installations.
Function KaloneoDirectoryPre
  ${If} $KaloneoCleanPathInitialized != "1"
    StrCpy $KaloneoCleanPathInitialized "1"
    ${If} $installMode == "all"
      StrCpy $INSTDIR "$PROGRAMFILES64\KALONEO"
    ${Else}
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\KALONEO"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function KaloneoDirectoryShow
  # Leave the MUI native directory field and any user choice intact.
FunctionEnd

!macro customInstallMode
  StrCpy $perUserInstallationFolder "$LOCALAPPDATA\Programs\KALONEO"
  StrCpy $perMachineInstallationFolder "$PROGRAMFILES64\KALONEO"
!macroend

!macro customInstall
  # Intentionally empty: never migrate legacy programs or candidate files.
!macroend

!macro preInit
  # Only extract the approved logo and silent video frames.
  InitPluginsDir
  File /oname=$PLUGINSDIR\kaloneo-branding.bmp "${BUILD_RESOURCES_DIR}\installerBranding.bmp"
  SetOutPath "$PLUGINSDIR\kaloneo-intro"
  File "${BUILD_RESOURCES_DIR}\intro-frames\frame_*.bmp"
!macroend

!macro customWelcomePage
  Page custom SebBrandingWelcomeCreate
!macroend

# Show the static KALONÉO logo immediately, with NO dissolve/fade.
# The original installation pages and progress start only after "Suivant".
Function SebIntroComplete
  ${If} $SebIntroActive != 1
    Return
  ${EndIf}
  StrCpy $SebIntroActive 0
  ${NSD_KillTimer} SebIntroTick
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\kaloneo-branding.bmp" $SebIntroNewBitmapHandle
  ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
  StrCpy $SebBrandingWelcomeHandle $SebIntroNewBitmapHandle
  EnableWindow $SebIntroNextButton 1
FunctionEnd

# Timer-driven BMP animation: no MP4 codec/player/window during installation.
Function SebIntroTick
  ${If} $SebIntroActive != 1
    Return
  ${EndIf}
  IntOp $SebIntroFrame $SebIntroFrame + 1
  ${If} $SebIntroFrame > ${KALONEO_INTRO_FRAME_COUNT}
    Call SebIntroComplete
    Return
  ${EndIf}
  StrCpy $SebIntroFramePath "$PLUGINSDIR\kaloneo-intro\frame_$SebIntroFrame.bmp"
  IfFileExists "$SebIntroFramePath" +3 0
    Call SebIntroComplete
    Return
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$SebIntroFramePath" $SebIntroNewBitmapHandle
  ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
  StrCpy $SebBrandingWelcomeHandle $SebIntroNewBitmapHandle
FunctionEnd

Function SebBrandingWelcomeCreate
  nsDialogs::Create 1018
  Pop $SebBrandingWelcomeDialog
  ${If} $SebBrandingWelcomeDialog == error
    Abort
  ${EndIf}
  StrCpy $SebIntroActive 0

  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingWelcomeImage

  ; Le Build reste affiché dans le Setup unique sans réintroduire de choix d'édition.
  ${NSD_CreateLabel} 8u 172u 92% 18u "KALONÉO — ${SEB_BUILD_LABEL}"
  Pop $0

  GetDlgItem $SebIntroNextButton $HWNDPARENT 1
  SendMessage $SebIntroNextButton ${WM_SETTEXT} 0 "STR:Suivant >"

  # Play exactly ONCE, without sound. Going Back shows the logo immediately.
  ${If} $SebIntroShown != 1
    StrCpy $SebIntroShown 1
    IfFileExists "$PLUGINSDIR\kaloneo-intro\frame_1.bmp" 0 intro_fallback
    StrCpy $SebIntroFrame 1
    ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\kaloneo-intro\frame_1.bmp" $SebBrandingWelcomeHandle
    ${If} $SebBrandingWelcomeHandle == 0
      Goto intro_fallback
    ${EndIf}
    EnableWindow $SebIntroNextButton 0
    StrCpy $SebIntroActive 1
    ${NSD_CreateTimer} SebIntroTick ${KALONEO_INTRO_FRAME_MS}
    Goto intro_show
  ${EndIf}

intro_fallback:
  # Any missing/corrupt frame → never block installation: static logo + Next.
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\kaloneo-branding.bmp" $SebBrandingWelcomeHandle
  EnableWindow $SebIntroNextButton 1

intro_show:
  nsDialogs::Show
  # Cancel or leaving this page must never leave a running animation timer.
  ${If} $SebIntroActive == 1
    ${NSD_KillTimer} SebIntroTick
    StrCpy $SebIntroActive 0
  ${EndIf}
  ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
FunctionEnd

!macro customFinishPage
  Page custom SebBrandingFinishCreate
!macroend

Function SebBrandingFinishCreate
  nsDialogs::Create 1018
  Pop $SebBrandingFinishDialog
  ${If} $SebBrandingFinishDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingFinishImage
  ${NSD_SetBitmap} $SebBrandingFinishImage "$PLUGINSDIR\kaloneo-branding.bmp" $SebBrandingFinishHandle

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Fermer"
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 0

  nsDialogs::Show
  ${NSD_FreeBitmap} $SebBrandingFinishHandle
FunctionEnd
!endif
