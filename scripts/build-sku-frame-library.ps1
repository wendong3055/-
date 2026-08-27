param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = [System.IO.Path]::GetFullPath($SourceRoot)
$output = [System.IO.Path]::GetFullPath($OutputRoot)
if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "SKU目录不存在：$source" }
New-Item -ItemType Directory -Force -Path $output | Out-Null

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$quality = [System.Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]84)
$entries = [System.Collections.Generic.List[object]]::new()

foreach ($file in (Get-ChildItem -LiteralPath $source -File -Filter '*.jpg' | Sort-Object Name)) {
  if ($file.BaseName -notmatch '^(?<width>[0-9+]+)-(?<height>200|220|230)$') { continue }
  $widthSpec = $Matches.width
  $height = [int]$Matches.height
  $totalWidth = (($widthSpec -split '\+') | ForEach-Object { [int]$_ } | Measure-Object -Sum).Sum
  $safeName = $file.BaseName.Replace('+', '_') + '.jpg'
  $thumbPath = Join-Path $output $safeName
  $image = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    $maxEdge = 760.0
    $scale = [Math]::Min(1.0, $maxEdge / [Math]::Max($image.Width, $image.Height))
    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
    $thumbHeight = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))
    $bitmap = [System.Drawing.Bitmap]::new($width, $thumbHeight)
    try {
      $bitmap.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $width, $thumbHeight))
      } finally { $graphics.Dispose() }
      $bitmap.Save($thumbPath, $encoder, $quality)
    } finally { $bitmap.Dispose() }
  } finally { $image.Dispose() }

  $entries.Add([pscustomobject]@{
    id = "fubao-$($file.BaseName.Replace('+', '-'))"
    name = $file.BaseName
    widthSpec = $widthSpec
    totalWidth = $totalWidth
    height = $height
    depth = 30
    thumb = "/frames/fubao-ankang/$safeName"
    sourcePath = $file.FullName
  })
}

[pscustomobject]@{
  seriesId = 'fubao-ankang-cabinet'
  seriesName = '福报安康双门抽屉玄关柜'
  sourceRoot = $source
  skuCount = $entries.Count
  defaultSkuId = 'fubao-80-200'
  items = $entries
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'sku-frame-index.json') -Encoding utf8

[pscustomobject]@{ Series = '福报安康双门抽屉玄关柜'; SkuCount = $entries.Count; Heights = '200 / 220 / 230 cm' } | Format-List
