param(
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = [System.IO.Path]::GetFullPath($SourceRoot)
$output = [System.IO.Path]::GetFullPath($OutputRoot)
$publicFolder = Split-Path $output -Leaf
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
  throw "图库目录不存在：$source"
}
New-Item -ItemType Directory -Force -Path $output | Out-Null

$files = Get-ChildItem -LiteralPath $source -File -Recurse | Where-Object {
  $_.Extension -match '^\.(jpg|jpeg|png|webp|bmp|tif|tiff)$' -and
  $_.BaseName -notmatch '(^_|预览|总览|拼图|overview|contact)'
}

$seen = @{}
$entries = [System.Collections.Generic.List[object]]::new()
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$quality = [System.Drawing.Imaging.EncoderParameters]::new(1)
$quality.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]82)
$index = 0

foreach ($file in $files) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
  if ($seen.ContainsKey($hash)) { continue }
  $seen[$hash] = $true
  $index++

  $relative = [System.IO.Path]::GetRelativePath($source, $file.FullName)
  $section = ($relative -split '[\\/]')[0]
  $category = if ($relative -match '山水|风景|远山|云雾') { '山水风景' } elseif ($relative -match '花|植物|叶|荷') { '花卉植物' } else { '综合图案' }
  $date = if ($section -match '\d{4}-\d{2}-\d{2}') { $Matches[0] } else { '未标日期' }
  $thumbName = 'art-{0:D4}.jpg' -f $index
  $thumbPath = Join-Path $output $thumbName

  try {
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    try {
      $maxEdge = 560.0
      $scale = [Math]::Min(1.0, $maxEdge / [Math]::Max($image.Width, $image.Height))
      $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
      $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))
      $bitmap = [System.Drawing.Bitmap]::new($width, $height)
      try {
        $bitmap.SetResolution(96, 96)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.Clear([System.Drawing.Color]::White)
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $graphics.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $width, $height))
        } finally { $graphics.Dispose() }
        $bitmap.Save($thumbPath, $encoder, $quality)
      } finally { $bitmap.Dispose() }
    } finally { $image.Dispose() }
  } catch {
    Write-Warning "跳过无法生成缩略图的文件：$($file.FullName)"
    continue
  }

  $entries.Add([pscustomobject]@{
    id = "local-$($hash.Substring(0, 16))"
    name = $file.BaseName
    thumb = "/library/$publicFolder/$thumbName"
    sourcePath = $file.FullName
    category = $category
    collection = $section
    date = $date
    hash = $hash
    bytes = $file.Length
  })
}

$manifest = [pscustomobject]@{
  sourceRoot = $source
  generatedAt = (Get-Date).ToString('s')
  originalFiles = $files.Count
  uniqueImages = $entries.Count
  duplicatesSkipped = $files.Count - $entries.Count
  items = $entries
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'library-index.json') -Encoding utf8
$manifest | Select-Object sourceRoot, originalFiles, uniqueImages, duplicatesSkipped | Format-List
