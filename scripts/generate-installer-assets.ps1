$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$petPath = Join-Path $root 'assets/default-pet/flower.png'
$outputDirectory = Join-Path $root 'assets/installer'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

Add-Type -AssemblyName System.Drawing

function New-BrandBitmap([int]$width, [int]$height) {
  return New-Object System.Drawing.Bitmap(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
}

function Set-BrandGraphics($graphics) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function New-CenterFormat {
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  return $format
}

$cream = [System.Drawing.ColorTranslator]::FromHtml('#fff8f3')
$creamDeep = [System.Drawing.ColorTranslator]::FromHtml('#f6e8db')
$brown = [System.Drawing.ColorTranslator]::FromHtml('#8b5a2b')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#7a6756')
$soft = [System.Drawing.ColorTranslator]::FromHtml('#b39a84')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#e8c9a8')
$pet = [System.Drawing.Image]::FromFile($petPath)

try {
  $sidebar = New-BrandBitmap 164 314
  $graphics = [System.Drawing.Graphics]::FromImage($sidebar)
  Set-BrandGraphics $graphics

  $bounds = New-Object System.Drawing.Rectangle(0, 0, 164, 314)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bounds,
    $cream,
    $creamDeep,
    90
  )
  $graphics.FillRectangle($gradient, $bounds)

  $halo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 228, 213))
  $graphics.FillEllipse($halo, 20, 34, 124, 124)

  $graphics.DrawImage($pet, 12, 48, 140, 100)

  $brownBrush = New-Object System.Drawing.SolidBrush($brown)
  $softBrush = New-Object System.Drawing.SolidBrush($soft)
  $mutedBrush = New-Object System.Drawing.SolidBrush($muted)
  $accentBrush = New-Object System.Drawing.SolidBrush($accent)

  $graphics.FillRectangle($brownBrush, 0, 0, 164, 5)
  $graphics.FillRectangle($brownBrush, 62, 180, 40, 2)

  $titleFont = New-Object System.Drawing.Font(
    'Microsoft YaHei UI',
    26,
    [System.Drawing.FontStyle]::Bold,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $subtitleFont = New-Object System.Drawing.Font(
    'Microsoft YaHei UI',
    10,
    [System.Drawing.FontStyle]::Regular,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $taglineFont = New-Object System.Drawing.Font(
    'Microsoft YaHei UI',
    9,
    [System.Drawing.FontStyle]::Regular,
    [System.Drawing.GraphicsUnit]::Pixel
  )

  $center = New-CenterFormat
  $graphics.DrawString(
    '花伴',
    $titleFont,
    $brownBrush,
    (New-Object System.Drawing.RectangleF(0, 192, 164, 36)),
    $center
  )
  $graphics.DrawString(
    '桌面宠物与个人信息助手',
    $subtitleFont,
    $mutedBrush,
    (New-Object System.Drawing.RectangleF(0, 230, 164, 18)),
    $center
  )
  $graphics.DrawString(
    '温柔陪伴每一天',
    $taglineFont,
    $softBrush,
    (New-Object System.Drawing.RectangleF(0, 264, 164, 16)),
    $center
  )

  $graphics.FillEllipse($accentBrush, 18, 296, 6, 6)
  $graphics.FillEllipse($brownBrush, 52, 298, 4, 4)
  $graphics.FillRectangle($brownBrush, 76, 299, 70, 1)

  $graphics.Dispose()
  $sidebar.Save((Join-Path $outputDirectory 'sidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $sidebar.Dispose()

  $header = New-BrandBitmap 150 57
  $graphics = [System.Drawing.Graphics]::FromImage($header)
  Set-BrandGraphics $graphics

  $headerBounds = New-Object System.Drawing.Rectangle(0, 0, 150, 57)
  $headerGradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $headerBounds,
    $cream,
    $creamDeep,
    0
  )
  $graphics.FillRectangle($headerGradient, $headerBounds)
  $graphics.FillEllipse($halo, 2, 4, 44, 44)
  $graphics.DrawImage($pet, 7, 9, 36, 30)
  $graphics.FillRectangle($brownBrush, 0, 55, 150, 2)

  $headerTitleFont = New-Object System.Drawing.Font(
    'Microsoft YaHei UI',
    18,
    [System.Drawing.FontStyle]::Bold,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $headerSubtitleFont = New-Object System.Drawing.Font(
    'Microsoft YaHei UI',
    9,
    [System.Drawing.FontStyle]::Regular,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $headerFormat = New-Object System.Drawing.StringFormat
  $headerFormat.Alignment = [System.Drawing.StringAlignment]::Near
  $headerFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString(
    '花伴',
    $headerTitleFont,
    $brownBrush,
    (New-Object System.Drawing.RectangleF(56, 4, 84, 26)),
    $headerFormat
  )
  $graphics.DrawString(
    '安装向导',
    $headerSubtitleFont,
    $mutedBrush,
    (New-Object System.Drawing.RectangleF(56, 30, 84, 16)),
    $headerFormat
  )
  $graphics.FillEllipse($accentBrush, 136, 10, 6, 6)

  $graphics.Dispose()
  $header.Save((Join-Path $outputDirectory 'header.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $header.Dispose()

  Write-Output (Join-Path $outputDirectory 'sidebar.bmp')
  Write-Output (Join-Path $outputDirectory 'header.bmp')
}
finally {
  $pet.Dispose()
}
