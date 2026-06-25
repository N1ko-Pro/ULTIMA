; ──────────────────────────────────────────────────────────────────────────
;  BG3 ULTIMA — custom NSIS include for electron-builder
; ──────────────────────────────────────────────────────────────────────────

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; ─── customHeader ─────────────────────────────────────────────────────────
!macro customHeader
  RequestExecutionLevel admin
  SpaceTexts none
!macroend

; ─── preInit ──────────────────────────────────────────────────────────────
!macro preInit
!macroend

; ─── customInit ───────────────────────────────────────────────────────────
!macro customInit

  ${If} ${isUpdated}
    StrCpy $LANGUAGE 1049
  ${EndIf}

  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  StrLen $R0 $INSTDIR
  StrLen $R1 "\${APP_FILENAME}"
  IntOp $R2 $R1 + $R1
  ${If} $R0 > $R2
    IntOp $R3 $R0 - $R2
    StrCpy $R4 $INSTDIR $R2 $R3
    ${If} $R4 == "\${APP_FILENAME}\${APP_FILENAME}"
      IntOp $R3 $R0 - $R1
      StrCpy $INSTDIR $INSTDIR $R3
    ${EndIf}
  ${EndIf}
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0

  !ifndef BUILD_UNINSTALLER
    ${IfNot} ${isUpdated}
      Push $R0
      Push $R1

      ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayName"
      ${If} $R0 == ""
        ReadRegStr $R0 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayName"
      ${EndIf}

      ${If} $R0 != ""
        ${If} $LANGUAGE = 1033
          StrCpy $R1 "ULTIMA is already installed.$\r$\nContinue and reinstall over the existing version?"
        ${Else}
          StrCpy $R1 "ULTIMA уже установлено.$\r$\nПродолжить и переустановить поверх?"
        ${EndIf}

        MessageBox MB_YESNO|MB_ICONQUESTION "$R1" /SD IDYES IDNO reinstall_cancel
        Pop $R1
        Pop $R0
        Goto reinstall_continue

        reinstall_cancel:
        Pop $R1
        Pop $R0
        Quit

        reinstall_continue:
      ${Else}
        Pop $R1
        Pop $R0
      ${EndIf}

    ${EndIf}
  !endif

!macroend

; ─── .onVerifyInstDir ─────────────────────────────────────────────────────
Function .onVerifyInstDir
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4

  StrCpy $0 $INSTDIR
  StrLen $1 $0
  ${If} $1 == 0
    Goto verify_done
  ${EndIf}

  verify_strip:
  ${If} $1 > 1
    StrCpy $2 $0 1 -1
    ${If} $2 == "\"
      StrCpy $0 $0 -1
      IntOp $1 $1 - 1
      Goto verify_strip
    ${EndIf}
  ${EndIf}

  StrLen $2 "\${APP_FILENAME}"
  ${If} $1 >= $2
    IntOp $3 $1 - $2
    StrCpy $4 $0 $2 $3
    ${If} $4 == "\${APP_FILENAME}"
      StrCpy $INSTDIR $0
      Goto verify_done
    ${EndIf}
  ${EndIf}

  ${If} $1 == 2
    StrCpy $2 $0 1 1
    ${If} $2 == ":"
      StrCpy $INSTDIR "$0\${APP_FILENAME}"
      Goto verify_done
    ${EndIf}
  ${EndIf}

  StrCpy $INSTDIR $0

  verify_done:
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; ─── customInstall ────────────────────────────────────────────────────────
!macro customInstall
  ; Ensure desktop shortcut always exists (especially after silent auto-updates)
  SetShellVarContext all
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_FILENAME}.exe" "" "$INSTDIR\${APP_FILENAME}.exe" 0
  SetShellVarContext current

  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "BG3InstallDir" "$INSTDIR"
  Delete "$INSTDIR\Uninstall.exe"
  Rename "$INSTDIR\Uninstall ULTIMA.exe" "$INSTDIR\Uninstall.exe"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayName" "ULTIMA"
!macroend

; ─── customUnWelcomePage ──────────────────────────────────────────────────
!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

; ─── customUnInit ─────────────────────────────────────────────────────────
!macro customUnInit
  SectionSetText 0 "ULTIMA"
!macroend

; ─── customUnInstallSection ───────────────────────────────────────────────
!macro customUnInstallSection
  Section /o "un.Очистить сохранённые данные ULTIMA"
    SetShellVarContext current
    RMDir /r "$APPDATA\ULTIMA"
    SetShellVarContext all
  SectionEnd
!macroend

; ─── customUnInstall ──────────────────────────────────────────────────────
!macro customUnInstall
  SetRegView 64

  ; ── 1. Убить процессы Ollama ──────────────────────────────────────────────
  nsExec::ExecToLog 'taskkill /F /IM ollama.exe /T'
  Pop $0
  Push $R0
  StrCpy $R0 "$TEMP\bg3_kill.ps1"
  FileOpen $R1 "$R0" w
  FileWrite $R1 "Get-Process | Where-Object { $$_.Name -like '*ollama*' } | Stop-Process -Force -ErrorAction SilentlyContinue$\r$\n"
  FileClose $R1
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$TEMP\bg3_kill.ps1"'
  Pop $0
  Delete "$R0"
  Pop $R0

  ; ── 2. Запустить родной деинсталлятор Ollama (если есть) ─────────────────
  Push $R0
  Push $R1
  Push $R2
  StrCpy $R2 ""

  StrCpy $R0 0
  ollama_find_hklm:
    EnumRegKey $R1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $R0
    StrCmp $R1 "" ollama_find_hkcu
    ReadRegStr $R2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "DisplayName"
    StrCmp $R2 "Ollama" ollama_found_hklm
    StrCpy $R2 ""
    IntOp $R0 $R0 + 1
    Goto ollama_find_hklm
  ollama_found_hklm:
    ReadRegStr $R2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "UninstallString"
    Goto ollama_exec

  ollama_find_hkcu:
  StrCpy $R0 0
  ollama_find_hkcu_loop:
    EnumRegKey $R1 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $R0
    StrCmp $R1 "" ollama_exec
    ReadRegStr $R2 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "DisplayName"
    StrCmp $R2 "Ollama" ollama_found_hkcu
    StrCpy $R2 ""
    IntOp $R0 $R0 + 1
    Goto ollama_find_hkcu_loop
  ollama_found_hkcu:
    ReadRegStr $R2 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R1" "UninstallString"

  ollama_exec:
  ${If} $R2 != ""
    StrCpy $R1 $R2 1
    ${If} $R1 == '"'
      ExecWait '$R2 /S'
    ${Else}
      ExecWait '"$R2" /S'
    ${EndIf}
  ${EndIf}

  Pop $R2
  Pop $R1
  Pop $R0

  ; ── 3. Удалить файлы Ollama вручную ──────────────────────────────────────
  RMDir /r "$LOCALAPPDATA\Programs\Ollama"
  RMDir /r "$LOCALAPPDATA\ollama"
  RMDir /r "$APPDATA\Ollama"
  RMDir /r "$APPDATA\ollama"
  RMDir /r "$APPDATA\ULTIMA\Ollama Core"
  Delete "$TEMP\OllamaSetup.exe"

  ; ── 4. Полная очистка реестра Ollama через .ps1 ───────────────────────────
  Push $R0
  StrCpy $R0 "$TEMP\bg3_regedit.ps1"
  FileOpen $R1 "$R0" w
  FileWrite $R1 "# Uninstall keys (by DisplayName or UninstallString containing 'ollama')$\r$\n"
  FileWrite $R1 "$$paths = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')$\r$\n"
  FileWrite $R1 "foreach ($$p in $$paths) {$\r$\n"
  FileWrite $R1 "  if (!(Test-Path $$p)) { continue }$\r$\n"
  FileWrite $R1 "  Get-ChildItem $$p -EA SilentlyContinue | ForEach-Object {$\r$\n"
  FileWrite $R1 "    $$props = Get-ItemProperty $$_.PSPath -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "    if ($$props.DisplayName -like '*ollama*' -or $$props.UninstallString -like '*ollama*') {$\r$\n"
  FileWrite $R1 "      Remove-Item $$_.PSPath -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "    }$\r$\n"
  FileWrite $R1 "  }$\r$\n"
  FileWrite $R1 "}$\r$\n"
  FileWrite $R1 "# Прямое удаление по известному GUID Ollama (Inno Setup _is1)$\r$\n"
  FileWrite $R1 "$$guid = '{44E83376-CE68-45EB-8FC1-393500EB558C}_is1'$\r$\n"
  FileWrite $R1 "Remove-Item -Path ('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\' + $$guid) -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "Remove-Item -Path ('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\' + $$guid) -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "# SOFTWARE\Ollama, HKCR, Run$\r$\n"
  FileWrite $R1 "Remove-Item 'HKLM:\SOFTWARE\Ollama' -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "Remove-Item 'HKCU:\SOFTWARE\Ollama' -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "Remove-Item 'HKCR:\ollama' -Recurse -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "Remove-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'Ollama' -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "Remove-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'Ollama' -Force -EA SilentlyContinue$\r$\n"
  FileWrite $R1 "# UFH\ARP — список ARP, очистить записи ollama$\r$\n"
  FileWrite $R1 "$$arpPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\UFH\ARP'$\r$\n"
  FileWrite $R1 "if (Test-Path $$arpPath) {$\r$\n"
  FileWrite $R1 "  Get-ItemProperty $$arpPath -EA SilentlyContinue | ForEach-Object { $$_.PSObject.Properties } |$\r$\n"
  FileWrite $R1 "  Where-Object { $$_.Value -like '*ollama*' -or $$_.Name -like '*ollama*' } |$\r$\n"
  FileWrite $R1 "  ForEach-Object { Remove-ItemProperty -Path $$arpPath -Name $$_.Name -Force -EA SilentlyContinue }$\r$\n"
  FileWrite $R1 "}$\r$\n"
  FileClose $R1
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$TEMP\bg3_regedit.ps1"'
  Pop $0
  Delete "$R0"
  Pop $R0

  ; ── 5. Очистить UFH\SHC, NotifyIconSettings, MuiCache через .ps1 ─────────
  Push $R0
  StrCpy $R0 "$TEMP\bg3_cleanup.ps1"
  FileOpen $R1 "$R0" w
  FileWrite $R1 "$$shcPath = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\UFH\SHC'$\r$\n"
  FileWrite $R1 "if (Test-Path $$shcPath) {$\r$\n"
  FileWrite $R1 "  Get-Item $$shcPath | Select-Object -ExpandProperty Property | Where-Object {$\r$\n"
  FileWrite $R1 "    (Get-ItemPropertyValue $$shcPath -Name $$_) -match 'ollama' } |$\r$\n"
  FileWrite $R1 "  ForEach-Object { Remove-ItemProperty -Path $$shcPath -Name $$_ -Force -EA SilentlyContinue }$\r$\n"
  FileWrite $R1 "}$\r$\n"
  FileWrite $R1 "$$nicPath = 'HKCU:\Control Panel\NotifyIconSettings'$\r$\n"
  FileWrite $R1 "if (Test-Path $$nicPath) {$\r$\n"
  FileWrite $R1 "  Get-ChildItem $$nicPath -EA SilentlyContinue | ForEach-Object {$\r$\n"
  FileWrite $R1 "    if ((Get-ItemProperty $$_.PSPath -EA SilentlyContinue).ExecutablePath -like '*ollama*') {$\r$\n"
  FileWrite $R1 "      Remove-Item $$_.PSPath -Force -EA SilentlyContinue } }$\r$\n"
  FileWrite $R1 "}$\r$\n"
  FileWrite $R1 "$$muiPath = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache'$\r$\n"
  FileWrite $R1 "if (Test-Path $$muiPath) {$\r$\n"
  FileWrite $R1 "  Get-ItemProperty $$muiPath -EA SilentlyContinue | ForEach-Object { $$_.PSObject.Properties } |$\r$\n"
  FileWrite $R1 "  Where-Object { $$_.Name -like '*ollama*' } |$\r$\n"
  FileWrite $R1 "  ForEach-Object { Remove-ItemProperty -Path $$muiPath -Name $$_.Name -Force -EA SilentlyContinue }$\r$\n"
  FileWrite $R1 "}$\r$\n"
  FileClose $R1
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$TEMP\bg3_cleanup.ps1"'
  Pop $0
  Delete "$R0"
  Pop $R0

  ; ── 6. Удалить реестровые записи ULTIMA ──────────────────────────────────
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"

  SetShellVarContext all
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  SetShellVarContext current
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  SetRegView default

  ; ── 7. Удалить кеш обновлений electron-updater ───────────────────────────
  SetShellVarContext current
  RMDir /r "$LOCALAPPDATA\bg3-ultima-updater"
  SetShellVarContext all

  ; ── 8. Удалить папку установки ───────────────────────────────────────────
  SetOutPath "$TEMP"
  RMDir /r "$INSTDIR"

!macroend