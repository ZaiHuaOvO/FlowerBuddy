!include LogicLib.nsh

; electron-builder already restores $INSTDIR from Software\${APP_GUID} for an
; existing installation. Older or partially registered installs may only have
; the uninstall entry, so fall back to its InstallLocation before the directory
; page is shown.
!macro customInit
  ${IfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ReadRegStr $0 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $0 != ""
    ${AndIf} ${FileExists} "$0\${APP_EXECUTABLE_FILENAME}"
      StrCpy $INSTDIR $0
      ; Persist the recovered path so the install-mode page, which runs after
      ; customInit, keeps the existing directory instead of the default one.
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstallmode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 花伴"
  !define MUI_WELCOMEPAGE_TEXT "花伴是一款桌面宠物与个人信息助手。$\r$\n$\r$\n如果检测到已安装的旧版本，安装程序会自动找到原安装目录并覆盖更新；个人数据、设置和已导入的桌宠图片都会保留。"
  !insertmacro MUI_PAGE_WELCOME
!macroend
