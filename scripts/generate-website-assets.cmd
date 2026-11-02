@echo off
setlocal

set "ROOT=%~dp0.."
set "ASSETS=%ROOT%\website\assets"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

rem og-cover.svg is the single source of the OG card; og-cover.png is rasterised from it.
if not exist "%EDGE%" (
  echo Microsoft Edge not found at %EDGE%
  exit /b 1
)

echo Generating og-cover.png from og-cover.svg...
set "OGSVG=%ASSETS%\og-cover.svg"
set "OGURL=file:///%OGSVG:\=/%"
if exist "%ASSETS%\og-cover.png" del "%ASSETS%\og-cover.png"
rem A separate profile keeps headless Edge away from a running browser session.
"%EDGE%" --headless --disable-gpu --hide-scrollbars --user-data-dir="%TEMP%\fenmark-og-edge" --screenshot="%ASSETS%\og-cover.png" --window-size=1200,630 "%OGURL%"
rem msedge.exe returns before the screenshot is written, so wait for the file.
set /a TRIES=0
:waitog
if exist "%ASSETS%\og-cover.png" goto ogdone
set /a TRIES+=1
if %TRIES% geq 30 (
  echo og-cover.png was not written
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto waitog
:ogdone

rem The homepage demo (demo-v2.mp4/.webm/-poster.png) and public/demo.gif are encoded
rem straight from a 1024x768 recording of the app's web view, not derived from a GIF,
rem so this script does not generate them. A new recording gets new file names.

echo Done.
