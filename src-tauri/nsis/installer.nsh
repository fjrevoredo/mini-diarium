; installer.nsh — NSIS installer hook macros for Mini Diarium.
; Loaded by Tauri via `bundle.windows.nsis.installerHooks`.
;
; Supported hook names are documented by Tauri:
; - NSIS_HOOK_POSTINSTALL
; - NSIS_HOOK_POSTUNINSTALL
;
; installMode is "perMachine", so the installer runs elevated and `netsh`
; can modify firewall rules.

!macro NSIS_HOOK_POSTINSTALL
  ; Add outbound firewall block rule for the app process.
  ExecWait 'netsh advfirewall firewall add rule name="Mini Diarium - Block Outbound" dir=out action=block program="$INSTDIR\mini-diarium.exe" enable=yes'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove the outbound firewall rule on uninstall.
  ExecWait 'netsh advfirewall firewall delete rule name="Mini Diarium - Block Outbound"'
!macroend
