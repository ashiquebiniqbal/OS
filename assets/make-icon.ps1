# Generates a 512x512 "Halo" icon PNG using GDI+. No external deps.
# Run from repo root: powershell -ExecutionPolicy Bypass -File assets/make-icon.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot 'icon.png'
$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Dark background (radial-ish via 2-color gradient)
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bgRect,
    [System.Drawing.Color]::FromArgb(255, 26, 36, 54),
    [System.Drawing.Color]::FromArgb(255, 10, 13, 20),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
)
$g.FillRectangle($bg, $bgRect)

# Rounded mask: fill a rounded rect so the corners are dark-bg, then overlay rings
$radius = 84
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $radius, $radius, 180, 90)
$path.AddArc($size - $radius, 0, $radius, $radius, 270, 90)
$path.AddArc($size - $radius, $size - $radius, $radius, $radius, 0, 90)
$path.AddArc(0, $size - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()

# Clear outside the rounded rect to transparent
$bmp2 = New-Object System.Drawing.Bitmap($size, $size)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.SetClip($path)
$g2.DrawImage($bmp, 0, 0)

# Outer ring
$accent = [System.Drawing.Color]::FromArgb(255, 0, 229, 255)
$ring = New-Object System.Drawing.Pen($accent, 16)
$g2.DrawEllipse($ring, 80, 80, $size - 160, $size - 160)

# Inner ring (dimmer)
$accentDim = [System.Drawing.Color]::FromArgb(180, 0, 229, 255)
$ring2 = New-Object System.Drawing.Pen($accentDim, 8)
$g2.DrawEllipse($ring2, 140, 140, $size - 280, $size - 280)

# Center dot
$dotBrush = New-Object System.Drawing.SolidBrush($accent)
$g2.FillEllipse($dotBrush, 226, 226, 60, 60)

# Save PNG
$bmp2.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$g2.Dispose()
$bmp.Dispose()
$bmp2.Dispose()
Write-Host "Wrote $out"
