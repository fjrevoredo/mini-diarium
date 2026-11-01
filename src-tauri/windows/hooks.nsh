; NSIS installer hooks, wired through `bundle.windows.nsis.installerHooks` in tauri.conf.json.
;
; The Tauri NSIS template keys the uninstall entry and the install folder on `productName`.
; After the rename from "Mini Diarium" to "Fenmark", the new installer no longer sees the old
; install, so without this hook users end up with two entries in Installed Apps and two copies
; of the app. The hook runs the old uninstaller silently before the new files are copied.
;
; User data is safe: the old uninstaller deletes `$APPDATA\com.minidiarium` only when the user
; ticks its "delete app data" checkbox, and a silent run never shows that page, so the checkbox
; state stays unset. The data folder is keyed on the bundle identifier, which does not change.
;
; Temporary: remove this hook a few releases after the rename (see docs/todo/TODO.md).

!define LEGACY_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mini Diarium"

!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  Push $2

  ; The app installs perMachine (HKLM); HKCU covers an older per-user install.
  ReadRegStr $0 HKLM "${LEGACY_UNINSTKEY}" "UninstallString"
  ReadRegStr $1 HKLM "${LEGACY_UNINSTKEY}" "InstallLocation"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "${LEGACY_UNINSTKEY}" "UninstallString"
    ReadRegStr $1 HKCU "${LEGACY_UNINSTKEY}" "InstallLocation"
  ${EndIf}

  ${If} $0 != ""
  ${AndIf} $1 != ""
    ; InstallLocation is stored with surrounding quotes; strip them for `_?=`.
    StrCpy $2 $1 1
    ${If} $2 == '"'
      StrCpy $1 $1 -1 1
    ${EndIf}

    DetailPrint "Removing the previous Mini Diarium installation"
    ; `_?=` runs the uninstaller in place, so ExecWait really waits for it. Without it the
    ; uninstaller copies itself to a temp folder and returns at once.
    ExecWait '$0 /S _?=$1' $2

    ; Run in place, the uninstaller cannot delete itself or its folder.
    ${If} $2 = 0
      Delete "$1\uninstall.exe"
      RMDir "$1"
    ${EndIf}
  ${EndIf}

  Pop $2
  Pop $1
  Pop $0
!macroend
