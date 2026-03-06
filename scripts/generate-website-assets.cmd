@echo off
setlocal

set "ROOT=%~dp0.."
set "ASSETS=%ROOT%\website\assets"
set "FFMPEG=C:\youtube-dl\ffmpeg.exe"
set "POWERSHELL=C:\Program Files\PowerShell\7\pwsh.exe"

if not exist "%FFMPEG%" (
  echo ffmpeg not found at %FFMPEG%
  exit /b 1
)

if not exist "%POWERSHELL%" (
  echo PowerShell not found at %POWERSHELL%
  exit /b 1
)

echo Generating demo video assets...
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "fps=12,scale=720:-2:flags=lanczos" -an -c:v libx264 -movflags +faststart -pix_fmt yuv420p -profile:v main -level 3.1 -preset slow -crf 34 "%ASSETS%\demo.mp4" || exit /b 1
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "fps=12,scale=720:-2:flags=lanczos" -an -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 "%ASSETS%\demo.webm" || exit /b 1
"%FFMPEG%" -y -i "%ASSETS%\demo.gif" -vf "scale=720:-2:flags=lanczos" -frames:v 1 "%ASSETS%\demo-poster.png" || exit /b 1

echo Generating og-cover.png...
"%POWERSHELL%" -NoProfile -Command ^
  "Add-Type -AssemblyName System.Drawing; $bmp = New-Object Drawing.Bitmap 1200,630; $g = [Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $rect = New-Object Drawing.Rectangle 0,0,1200,630; $brush = New-Object Drawing.Drawing2D.LinearGradientBrush($rect, [Drawing.ColorTranslator]::FromHtml('#0e0e0e'), [Drawing.ColorTranslator]::FromHtml('#1a1a1a'), 35); $g.FillRectangle($brush, $rect); $panelBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#161616')); $panelPen = New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml('#2a2a2a'), 2); $g.FillRectangle($panelBrush, 74, 74, 1052, 482); $g.DrawRectangle($panelPen, 74, 74, 1052, 482); $circleBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(40, 245, 201, 77)); $g.FillEllipse($circleBrush, 134, 130, 56, 56); $logoOuter = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#f5c94d')); $logoInner = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#0e0e0e')); $g.FillEllipse($logoOuter, 138, 134, 48, 48); $g.FillRectangle($logoInner, 151, 146, 22, 22); $textBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#f0ede6')); $mutedBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#c9c4b8')); $subtleBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#888888')); $titleFont = New-Object Drawing.Font('Segoe UI', 54, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel); $headlineFont = New-Object Drawing.Font('Segoe UI', 42, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel); $bodyFont = New-Object Drawing.Font('Segoe UI', 28, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel); $buttonFont = New-Object Drawing.Font('Segoe UI', 26, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel); $footerFont = New-Object Drawing.Font('Segoe UI', 24, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel); $g.DrawString('Mini Diarium', $titleFont, $textBrush, 220, 120); $g.DrawString('Encrypted offline journal for Windows, macOS and Linux', $headlineFont, $textBrush, 138, 220); $g.DrawString('AES-256-GCM encryption - Offline-only - No telemetry', $bodyFont, $mutedBrush, 138, 300); $g.DrawString('No cloud - No tracking - No subscriptions', $bodyFont, $mutedBrush, 138, 344); $buttonBrush = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#f5c94d')); $g.FillRectangle($buttonBrush, 138, 398, 320, 56); $format = New-Object Drawing.StringFormat; $format.Alignment = 'Center'; $format.LineAlignment = 'Center'; $g.DrawString('Open Source', $buttonFont, $logoInner, ([Drawing.RectangleF]::new(138,398,320,56)), $format); $g.DrawString('mini-diarium.com', $footerFont, $subtleBrush, 138, 500); $bmp.Save('%ASSETS%\og-cover.png', [Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose(); $brush.Dispose(); $panelBrush.Dispose(); $panelPen.Dispose(); $circleBrush.Dispose(); $logoOuter.Dispose(); $logoInner.Dispose(); $textBrush.Dispose(); $mutedBrush.Dispose(); $subtleBrush.Dispose(); $titleFont.Dispose(); $headlineFont.Dispose(); $bodyFont.Dispose(); $buttonFont.Dispose(); $footerFont.Dispose(); $format.Dispose();"

echo Done.
