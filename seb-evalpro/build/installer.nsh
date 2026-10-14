!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!define SEB_BUILD_NUMBER "104"
!define SEB_BUILD_LABEL "Build #${SEB_BUILD_NUMBER}"

# Désinstallation/mise à jour sûre.
# Les dossiers candidats et les données techniques nécessaires à leur déchiffrement
# et à la reprise d'un parcours ne sont jamais supprimés automatiquement.
!macro customUnInstall
  DetailPrint "Nettoyage des anciennes données SEB-éval-PRO..."

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

!macro customInstall
  # SEB_UNIFIED_SETUP : une seule installation contient toutes les fonctions.
  # Les anciens marqueurs Candidat/Admin sont supprimés lors de la mise à jour.
  Delete "$INSTDIR\edition-admin.flag"
  Delete "$INSTDIR\edition-candidate.flag"
  Delete "$INSTDIR\edition.json"
  DeleteRegValue HKCU "Software\SEB EvalPro" "Edition"
!macroend

!macro preInit
  # 0.3.8 : ne plus utiliser Documents pour les sauvegardes techniques.
  # Avant une mise à jour, les fichiers de récupération des anciennes versions
  # sont placés temporairement dans LocalAppData, hors des anciens dossiers
  # susceptibles d'être nettoyés par leur désinstalleur.
  SetShellVarContext current
  CreateDirectory "$DOCUMENTS\SEB EvalPro"
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
  File /oname=$PLUGINSDIR\seb-eval-pro-branding.bmp "${BUILD_RESOURCES_DIR}\installerBranding.bmp"
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
  ${NSD_SetBitmap} $SebBrandingWelcomeImage "$PLUGINSDIR\seb-eval-pro-branding.bmp" $SebBrandingWelcomeHandle

  ; Le Build reste affiché dans le Setup unique sans réintroduire de choix d'édition.
  ${NSD_CreateLabel} 8u 172u 92% 18u "SEB EvalPro — ${SEB_BUILD_LABEL}"
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
  ${NSD_SetBitmap} $SebBrandingFinishImage "$PLUGINSDIR\seb-eval-pro-branding.bmp" $SebBrandingFinishHandle

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
