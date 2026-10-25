!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define SEB_BUILD_NUMBER "175"
!define SEB_BUILD_LABEL "Build #${SEB_BUILD_NUMBER}"

# R164 : montrer les opérations réelles de copie et de finalisation.
ShowInstDetails show
ShowUninstDetails show
!define MUI_INSTFILESPAGE_SHOWDETAILS

# R172 - Conservation des donnees PAR DEFAUT (desinstallation ET mise a jour).
# L'effacement n'est disponible qu'en mode interactif : case decochee
# initialement + deuxieme confirmation explicite. /S conserve toujours.
Var KaloneoDeleteDataConfirmed
Var KaloneoDeleteDataCheckbox
Var KaloneoDeleteDataDialog

!macro customUnInit
  StrCpy $KaloneoDeleteDataConfirmed "0"
  # La commande --delete-app-data native d'electron-builder contourne le
  # dialogue : elle est bloquee au demarrage avant toute suppression.
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "KALONÉO : suppression automatique des données interdite. Lancez la désinstallation interactive et confirmez explicitement la suppression."
    Abort
  ${EndIf}
!macroend

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.KaloneoDataPageCreate un.KaloneoDataPageLeave
!macroend

Function un.KaloneoDataPageCreate
  # Ne jamais afficher d'ecran de choix pendant une mise a jour.
  ${If} ${Silent}
    Abort
  ${EndIf}
  ; Le programme de mise a jour appelle le desinstallateur en mode silencieux.
  ; L'uninstall silencieux ne presente jamais de question de suppression.
  nsDialogs::Create 1018
  Pop $KaloneoDeleteDataDialog
  ${If} $KaloneoDeleteDataDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 5u 100% 49u "Par défaut, KALONÉO conserve tous vos candidats, parcours, tests, images, résultats, bilans, documents et clés de chiffrement lors de la désinstallation. Vous pourrez les retrouver en réinstallant KALONÉO sous le même compte Windows."
  Pop $0
  ${NSD_CreateCheckbox} 0 62u 100% 28u "Je demande la SUPPRESSION DÉFINITIVE de toutes les données KALONÉO de ce compte Windows."
  Pop $KaloneoDeleteDataCheckbox
  ${NSD_Uncheck} $KaloneoDeleteDataCheckbox
  ${NSD_CreateLabel} 0 105u 100% 40u "ATTENTION : si vous cochez cette option, les candidats, parcours et bilans seront irrécupérables sans sauvegarde extérieure complète. Laissez la case vide pour conserver toutes vos données."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function un.KaloneoDataPageLeave
  StrCpy $KaloneoDeleteDataConfirmed "0"
  ${NSD_GetState} $KaloneoDeleteDataCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    MessageBox MB_YESNO|MB_ICONSTOP|MB_DEFBUTTON2 "DERNIÈRE CONFIRMATION : voulez-vous effacer DÉFINITIVEMENT toutes les données KALONÉO de ce compte Windows (candidats, évaluations, bilans, Word, parcours, tests, images et clés de chiffrement) ? Cette opération est irréversible sans sauvegarde. Non = retour au choix." IDYES +2
    Abort
    StrCpy $KaloneoDeleteDataConfirmed "1"
  ${EndIf}
FunctionEnd

!macro customUnInstall
  ${If} ${isUpdated}
    DetailPrint "Mise à jour KALONÉO : toutes les données utilisateur sont conservées."
  ${Else}
    ${If} $KaloneoDeleteDataConfirmed == "1"
      SetShellVarContext current
      DetailPrint "SUPPRESSION EXPLICITEMENT CONFIRMÉE : effacement des données KALONÉO de ce compte."
      RMDir /r "$APPDATA\KALONEO"
      RMDir /r "$LOCALAPPDATA\KALONEO"
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    ${Else}
      DetailPrint "Désinstallation du programme UNIQUEMENT : candidats, parcours, bilans et paramètres conservés."
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
