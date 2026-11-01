@echo off
setlocal

set "ROOT=%~dp0.."
set "ASSETS=%ROOT%\website\assets"
set "FFMPEG=C:\youtube-dl\ffmpeg.exe"
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

if not exist "%FFMPEG%" (
  echo ffmpeg not found at %FFMPEG%
  exit /b 1
)

echo Generating demo video assets...
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "fps=12,scale=720:-2:flags=lanczos" -an -c:v libx264 -movflags +faststart -pix_fmt yuv420p -profile:v main -level 3.1 -preset slow -crf 34 "%ASSETS%\demo.mp4" || exit /b 1
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "fps=12,scale=720:-2:flags=lanczos" -an -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 "%ASSETS%\demo.webm" || exit /b 1
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "scale=720:-2:flags=lanczos" -frames:v 1 "%ASSETS%\demo-poster.png" || exit /b 1


echo Done.
