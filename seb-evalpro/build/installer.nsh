!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define SEB_BUILD_NUMBER "173"
!define SEB_BUILD_LABEL "Build #${SEB_BUILD_NUMBER}"

# R164 : montrer les opérations réelles de copie et de finalisation.
ShowInstDetails show
ShowUninstDetails show
!define MUI_INSTFILESPAGE_SHOWDETAILS

# R163: Full application removal without deleting any other software's data.
# Upgrades must NEVER erase candidates, bilans, or current user preferences.
# Only the uninstaller of this NEW version will execute this new macro.
!macro customUnInstall
  DetailPrint "Désinstallation complète de KALONÉO"
  ${IfNot} ${isUpdated}
    # Electron setPath('userData') points here, irrespective of package.json.
    # Also contains Documents, encrypted candidates, bilans, tests and images.
    # For a machine-wide setup, use the current profile, not all-users AppData.
    SetShellVarContext current
    DetailPrint "Suppression du profil KALONEO et des dossiers de cache"
    RMDir /r "$APPDATA\KALONEO"
    RMDir /r "$LOCALAPPDATA\KALONEO"
    # Restore electron-builder uninstall context for its remaining operations.
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
Var SebBrandingWelcomeDialog
Var SebBrandingWelcomeImage
Var SebBrandingWelcomeImageBack
Var SebBrandingWelcomeHandle
Var SebBrandingWelcomeBackHandle
Var SebIntroFrontIndex
Var SebIntroTargetImage
Var SebIntroOldImage
Var SebIntroBuildLabel
Var SebIntroNewBitmapFile
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
  # NSIS installMode n'est PAS encore déclaré à la construction de la page.
  # multiUser a déjà choisi le chemin depuis customInstallMode : le conserver.
  # Une installation vierge sans chemin retenu prend le dossier KALONEO.
  ${If} $KaloneoCleanPathInitialized != "1"
    StrCpy $KaloneoCleanPathInitialized "1"
    ${If} $INSTDIR == ""
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\KALONEO"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function KaloneoDirectoryShow
  # Leave the MUI native directory field and any user choice intact.
FunctionEnd

!macro customPageAfterChangeDir
  # Called by Electron assistedInstaller.nsh before MUI_PAGE_INSTFILES.
  # R164 declared ShowInstDetails but did not expand the progress-page list.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW KaloneoShowInstallDetails
!macroend
Function KaloneoShowInstallDetails
  SetDetailsPrint both
  SetDetailsView show
  DetailPrint "Préparation des fichiers KALONÉO..."
  DetailPrint "Extraction et copie des fichiers du programme..."
FunctionEnd

!macro customInstallMode
  StrCpy $perUserInstallationFolder "$LOCALAPPDATA\Programs\KALONEO"
  StrCpy $perMachineInstallationFolder "$PROGRAMFILES64\KALONEO"
!macroend

!macro customInstall
  SetDetailsView show
  DetailPrint "Fichiers KALONÉO installés."
  DetailPrint "Finalisation de KALONÉO et création des raccourcis Windows"
  # Ne jamais migrer les programmes historiques ni les dossiers candidats.
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

# R169 — Double tampon pour éviter les écrans blancs lors des transitions.
# Le nouveau bitmap est préparé sur une image MASQUÉE ; on l'affiche,
# on force sa peinture, puis seulement on masque l'image précédente.
# Il reste toujours une image visible, même si Windows est momentanément lent.
Function SebIntroSwapBitmap
  ${If} $SebIntroFrontIndex == 0
    StrCpy $SebIntroTargetImage $SebBrandingWelcomeImageBack
    StrCpy $SebIntroOldImage $SebBrandingWelcomeImage
  ${Else}
    StrCpy $SebIntroTargetImage $SebBrandingWelcomeImage
    StrCpy $SebIntroOldImage $SebBrandingWelcomeImageBack
  ${EndIf}
  ${NSD_SetBitmap} $SebIntroTargetImage "$SebIntroNewBitmapFile" $SebIntroNewBitmapHandle
  ${If} $SebIntroNewBitmapHandle == 0
    Return
  ${EndIf}
  ${If} $SebIntroFrontIndex == 0
    ${If} $SebBrandingWelcomeBackHandle != 0
      ${NSD_FreeBitmap} $SebBrandingWelcomeBackHandle
    ${EndIf}
    StrCpy $SebBrandingWelcomeBackHandle $SebIntroNewBitmapHandle
  ${Else}
    ${If} $SebBrandingWelcomeHandle != 0
      ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
    ${EndIf}
    StrCpy $SebBrandingWelcomeHandle $SebIntroNewBitmapHandle
  ${EndIf}
  # SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE : 0x13
  System::Call 'user32::SetWindowPos(p $SebIntroTargetImage,p 0,i 0,i 0,i 0,i 0,i 0x13)i.r0'
  ShowWindow $SebIntroTargetImage 1
  System::Call 'user32::UpdateWindow(p $SebIntroTargetImage)i.r0'
  ShowWindow $SebIntroOldImage 0
  # Le numéro de Build doit toujours rester au-dessus de l'animation.
  System::Call 'user32::SetWindowPos(p $SebIntroBuildLabel,p 0,i 0,i 0,i 0,i 0,i 0x13)i.r0'
  IntOp $SebIntroFrontIndex $SebIntroFrontIndex ^ 1
FunctionEnd

Function SebIntroComplete
  ${If} $SebIntroActive != 1
    Return
  ${EndIf}
  StrCpy $SebIntroActive 0
  ${NSD_KillTimer} SebIntroTick
  StrCpy $SebIntroNewBitmapFile "$PLUGINSDIR\kaloneo-branding.bmp"
  Call SebIntroSwapBitmap
  EnableWindow $SebIntroNextButton 1
FunctionEnd

# Timer-driven BMP animation: 12 fps from the ORIGINAL MP4, no extra player.
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
  StrCpy $SebIntroNewBitmapFile "$SebIntroFramePath"
  Call SebIntroSwapBitmap
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
  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingWelcomeImageBack
  ShowWindow $SebBrandingWelcomeImageBack 0
  StrCpy $SebBrandingWelcomeHandle 0
  StrCpy $SebBrandingWelcomeBackHandle 0
  StrCpy $SebIntroFrontIndex 0

  ; Le Build reste affiché dans le Setup unique sans réintroduire de choix d'édition.
  ${NSD_CreateLabel} 8u 172u 92% 18u "KALONÉO — ${SEB_BUILD_LABEL}"
  Pop $SebIntroBuildLabel

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
  ${If} $SebBrandingWelcomeHandle != 0
    ${NSD_FreeBitmap} $SebBrandingWelcomeHandle
  ${EndIf}
  ${If} $SebBrandingWelcomeBackHandle != 0
    ${NSD_FreeBitmap} $SebBrandingWelcomeBackHandle
  ${EndIf}
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
