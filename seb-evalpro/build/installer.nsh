!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define SEB_BUILD_NUMBER "155"
!define SEB_BUILD_LABEL "Build #${SEB_BUILD_NUMBER}"

# Désinstallation/mise à jour sûre.
# Les dossiers candidats et les données techniques nécessaires à leur déchiffrement
# et à la reprise d'un parcours ne sont jamais supprimés automatiquement.
!macro customUnInstall
  DetailPrint "Mise à jour de KALONÉO..."

  # Nettoyer les raccourcis du contexte d'installation courant.
  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
  RMDir "$SMPROGRAMS\SEB EvalPro"
  RMDir "$SMPROGRAMS\SEB-éval-PRO"

  # Electron conserve userData et les caches dans le profil de l'utilisateur.
  # Plusieurs noms ont été utilisés au cours des builds : on les nettoie tous.
  ${If} $installMode == "all"
    SetShellVarContext current
  ${EndIf}

  Delete "$DESKTOP\SEB EvalPro.lnk"
  Delete "$DESKTOP\SEB-éval-PRO.lnk"
  Delete "$SMPROGRAMS\SEB EvalPro.lnk"
  Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"

  ${If} $installMode == "all"
    SetShellVarContext all
    Delete "$DESKTOP\SEB EvalPro.lnk"
    Delete "$DESKTOP\SEB-éval-PRO.lnk"
    Delete "$SMPROGRAMS\SEB EvalPro.lnk"
    Delete "$SMPROGRAMS\SEB-éval-PRO.lnk"
    RMDir "$SMPROGRAMS\SEB EvalPro"
    RMDir "$SMPROGRAMS\SEB-éval-PRO"
  ${EndIf}
!macroend

!ifndef BUILD_UNINSTALLER
Var SebBrandingWelcomeDialog
Var SebBrandingWelcomeImage
Var SebBrandingWelcomeHandle
Var SebBrandingFinishDialog
Var SebBrandingFinishImage
Var SebBrandingFinishHandle

# R127: During an upgrade display the FINAL installation path.
# Keep previous binaries at the registered location until their uninstaller runs.
!ifndef BUILD_UNINSTALLER

# R133: This PRE callback runs BEFORE the standard NSIS directory text box
# is created. A SHOW handler alone cannot reliably replace its initial text.
# Only the exact original default folder is adjusted. The custom invisible
# page restores the previous path before the built-in updater operates.
Function KaloneoDirectoryPre
  StrCpy $R5 "$LOCALAPPDATA\Programs\seb-evalpro"
  StrCpy $R6 "$LOCALAPPDATA\Programs\KALONEO"
  ${If} $INSTDIR != $R5
    StrCpy $R5 "$PROGRAMFILES64\seb-evalpro"
    StrCpy $R6 "$PROGRAMFILES64\KALONEO"
  ${EndIf}
  ${If} $INSTDIR == $R5
    StrCpy $INSTDIR "$R6"
  ${EndIf}
FunctionEnd

Function KaloneoDirectoryShow
  # The install-mode variable belongs to NSIS multiUser.nsh (declared later).
  # Resolve the registered location directly to avoid forward-variable warnings.
  StrCpy $R5 "$LOCALAPPDATA\Programs\seb-evalpro"
  StrCpy $R6 "$LOCALAPPDATA\Programs\KALONEO"
  ${If} $INSTDIR != $R5
  ${AndIf} $INSTDIR != $R6
    StrCpy $R5 "$PROGRAMFILES64\seb-evalpro"
    StrCpy $R6 "$PROGRAMFILES64\KALONEO"
  ${EndIf}
  ${If} $INSTDIR == $R5
    # MUI's directory page is a nested #32770 dialog. Its edit control is
    # NOT a direct child of $HWNDPARENT; the previous handler did nothing.
    # Setting $INSTDIR covers MUI implementations that initialize the field
    # after the SHOW callback.
    StrCpy $INSTDIR "$R6"
    FindWindow $R9 "#32770" "" $HWNDPARENT
    GetDlgItem $R8 $R9 1019
    ${If} $R8 == 0
      GetDlgItem $R8 $HWNDPARENT 1019
    ${EndIf}
    ${If} $R8 != 0
      SendMessage $R8 ${WM_SETTEXT} 0 "STR:$R6"
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro customPageAfterChangeDir
  Page custom KaloneoDirectoryPostPage
!macroend

Function KaloneoDirectoryPostPage
  # Invisible custom page after directory selection, before InstFiles.
  # The install-mode variable belongs to NSIS multiUser.nsh (declared later).
  # Resolve the registered location directly to avoid forward-variable warnings.
  StrCpy $R5 "$LOCALAPPDATA\Programs\seb-evalpro"
  StrCpy $R6 "$LOCALAPPDATA\Programs\KALONEO"
  ${If} $INSTDIR != $R5
  ${AndIf} $INSTDIR != $R6
    StrCpy $R5 "$PROGRAMFILES64\seb-evalpro"
    StrCpy $R6 "$PROGRAMFILES64\KALONEO"
  ${EndIf}
  ${If} $INSTDIR == $R6
    # The visible path is the final one; safely upgrade via the old
    # registered directory, then relocate it after the extraction.
    StrCpy $INSTDIR "$R5"
  ${EndIf}
  Abort
FunctionEnd
!endif

!macro customInstall
  # SEB_UNIFIED_SETUP : une seule installation contient toutes les fonctions.
  # Les anciens marqueurs Candidat/Admin sont supprimés lors de la mise à jour.
  Delete "$INSTDIR\edition-admin.flag"
  Delete "$INSTDIR\edition-candidate.flag"
  Delete "$INSTDIR\edition.json"
  DeleteRegValue HKCU "Software\SEB EvalPro" "Edition"

  # R126: automatic, SAFE one-time migration ONLY for the default old folder.
  # The previous R125 version is upgraded normally in its original directory
  # first by electron-builder. When complete, move the whole installed tree.
  # No arbitrary customized directory, candidate profile, or external data moves.
  ${If} $installMode == "all"
    StrCpy $R0 "$PROGRAMFILES64\seb-evalpro"
    StrCpy $R1 "$PROGRAMFILES64\KALONEO"
    StrCpy $R2 "/allusers"
  ${Else}
    StrCpy $R0 "$LOCALAPPDATA\Programs\seb-evalpro"
    StrCpy $R1 "$LOCALAPPDATA\Programs\KALONEO"
    StrCpy $R2 "/currentuser"
  ${EndIf}

  ${If} $INSTDIR == $R0
    # Never merge two different installations or overwrite an existing folder.
    ${If} ${FileExists} "$R1"
      MessageBox MB_ICONSTOP|MB_OK "KALONÉO : le dossier $R1 existe déjà. La migration automatique est interrompue pour préserver les deux installations." /SD IDOK
      SetErrorLevel 3
      Quit
    ${EndIf}

    # NSIS's SetOutPath points into the old installed directory after extraction.
    # A Windows directory cannot be renamed while the installer itself keeps it as CWD.
    SetOutPath "$TEMP"
    ClearErrors
    Rename "$INSTDIR" "$R1"
    ${If} ${Errors}
      MessageBox MB_ICONSTOP|MB_OK "KALONÉO : impossible de déplacer l'installation vers $R1. Fermez le programme et recommencez. Aucun dossier candidat n'a été déplacé." /SD IDOK
      SetErrorLevel 4
      Quit
    ${EndIf}

    StrCpy $INSTDIR "$R1"
    SetOutPath "$INSTDIR"
    StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    # Registered install path and uninstaller MUST follow the successful move.
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString" '"$INSTDIR\${UNINSTALL_FILENAME}" $R2'
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTALL_FILENAME}" $R2 /S'
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$INSTDIR\uninstallerIcon.ico"

    # The default shortcut paths have already been created by electron-builder;
    # recreate their targets so none points to the removed seb-evalpro folder.
    ${If} ${FileExists} "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${EndIf}
    ${If} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}
    ${If} $launchLink == "$R0\${APP_EXECUTABLE_FILENAME}"
      StrCpy $launchLink "$appExe"
    ${EndIf}
    DetailPrint "KALONÉO : migration du dossier Windows terminée."
  ${EndIf}
!macroend

# Screen shown BEFORE installation: if upgrading an original default install,
# present the safe destination path, not the old seb-evalpro directory.
# Only the text of the already-registered legacy path is adjusted here;
# the actual, validated move occurs in customInstall after the upgrade.
!macro customInstallMode
  # Directory callback is bound by version-controlled
  # kaloneo-assisted-installer.nsh immediately before MUI_PAGE_DIRECTORY.
  ${If} $perUserInstallationFolder == "$LOCALAPPDATA\Programs\seb-evalpro"
    StrCpy $perUserInstallationFolder "$LOCALAPPDATA\Programs\KALONEO"
  ${EndIf}
  ${If} $perMachineInstallationFolder == "$PROGRAMFILES64\seb-evalpro"
    StrCpy $perMachineInstallationFolder "$PROGRAMFILES64\KALONEO"
  ${EndIf}
!macroend

!macro preInit
  # 0.3.8 : ne plus utiliser Documents pour les sauvegardes techniques.
  # Avant une mise à jour, les fichiers de récupération des anciennes versions
  # sont placés temporairement dans LocalAppData, hors des anciens dossiers
  # susceptibles d'être nettoyés par leur désinstalleur.
  SetShellVarContext current
  CreateDirectory "$LOCALAPPDATA\SEB EvalPro Recovery"

  IfFileExists "$LOCALAPPDATA\SEB EvalPro Recovery\candidate-local-key.sebkey" seb_key_recovery_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\candidate-local-key.sebkey" "$LOCALAPPDATA\SEB EvalPro Recovery\candidate-local-key.sebkey"
    Goto seb_key_recovery_done
  IfFileExists "$APPDATA\SEB EvalPro\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\candidate-local-key.sebkey" "$LOCALAPPDATA\SEB EvalPro Recovery\candidate-local-key.sebkey"
    Goto seb_key_recovery_done
  IfFileExists "$APPDATA\seb-evalpro\candidate-local-key.sebkey" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\candidate-local-key.sebkey" "$LOCALAPPDATA\SEB EvalPro Recovery\candidate-local-key.sebkey"
    Goto seb_key_recovery_done
  IfFileExists "$APPDATA\SEB-eval-PRO\candidate-local-key.sebkey" 0 seb_key_recovery_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\candidate-local-key.sebkey" "$LOCALAPPDATA\SEB EvalPro Recovery\candidate-local-key.sebkey"
seb_key_recovery_done:

  IfFileExists "$LOCALAPPDATA\SEB EvalPro Recovery\evaluation-state.json" seb_state_recovery_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\evaluation-state.json" "$LOCALAPPDATA\SEB EvalPro Recovery\evaluation-state.json"
    Goto seb_state_recovery_done
  IfFileExists "$APPDATA\SEB EvalPro\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\evaluation-state.json" "$LOCALAPPDATA\SEB EvalPro Recovery\evaluation-state.json"
    Goto seb_state_recovery_done
  IfFileExists "$APPDATA\seb-evalpro\evaluation-state.json" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\evaluation-state.json" "$LOCALAPPDATA\SEB EvalPro Recovery\evaluation-state.json"
    Goto seb_state_recovery_done
  IfFileExists "$APPDATA\SEB-eval-PRO\evaluation-state.json" 0 seb_state_recovery_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\evaluation-state.json" "$LOCALAPPDATA\SEB EvalPro Recovery\evaluation-state.json"
seb_state_recovery_done:

  IfFileExists "$LOCALAPPDATA\SEB EvalPro Recovery\active-candidate.json" seb_pointer_recovery_done 0
  IfFileExists "$APPDATA\SEB-éval-PRO\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB-éval-PRO\active-candidate.json" "$LOCALAPPDATA\SEB EvalPro Recovery\active-candidate.json"
    Goto seb_pointer_recovery_done
  IfFileExists "$APPDATA\SEB EvalPro\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\SEB EvalPro\active-candidate.json" "$LOCALAPPDATA\SEB EvalPro Recovery\active-candidate.json"
    Goto seb_pointer_recovery_done
  IfFileExists "$APPDATA\seb-evalpro\active-candidate.json" 0 +3
    CopyFiles /SILENT "$APPDATA\seb-evalpro\active-candidate.json" "$LOCALAPPDATA\SEB EvalPro Recovery\active-candidate.json"
    Goto seb_pointer_recovery_done
  IfFileExists "$APPDATA\SEB-eval-PRO\active-candidate.json" 0 seb_pointer_recovery_done
    CopyFiles /SILENT "$APPDATA\SEB-eval-PRO\active-candidate.json" "$LOCALAPPDATA\SEB EvalPro Recovery\active-candidate.json"
seb_pointer_recovery_done:

  InitPluginsDir
  File /oname=$PLUGINSDIR\kaloneo-branding.bmp "${BUILD_RESOURCES_DIR}\installerBranding.bmp"
!macroend

!macro customWelcomePage
  Page custom SebBrandingWelcomeCreate
!macroend

Function SebBrandingWelcomeCreate
  nsDialogs::Create 1018
  Pop $SebBrandingWelcomeDialog
  ${If} $SebBrandingWelcomeDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $SebBrandingWelcomeImage
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\kaloneo-branding.bmp" $SebBrandingWelcomeHandle

  ; Le Build reste affiché dans le Setup unique sans réintroduire de choix d'édition.
  ${NSD_CreateLabel} 8u 172u 92% 18u "KALONÉO — ${SEB_BUILD_LABEL}"
  Pop $0

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Suivant >"
  nsDialogs::Show
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
