$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$base = Join-Path $root 'public/library/2026-08-27-v2'
$manifest = Get-Content -LiteralPath (Join-Path $base 'library-index.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$entries = @{}
$report = @()
function Inspect-Image([string]$path) {
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  try {
    $img = [System.Drawing.Image]::FromFile($path)
    try { $w=$img.Width; $h=$img.Height } finally { $img.Dispose() }
    return @{width=$w;height=$h;bytes=(Get-Item -LiteralPath $path).Length;hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
  } catch { return $null }
}
foreach ($row in $manifest.items) {
  $preview = Inspect-Image (Join-Path $root ('public'+$row.thumb))
  $source = Inspect-Image $row.sourcePath
  $status='missing'; $url=$null; $original=$null
  if ($preview -and $preview.hash -eq $row.hash) {
    $status='verified'; $url=$row.thumb; $original=$preview
  } elseif ($source -and $source.hash -eq $row.hash) {
    $dir=Join-Path $base 'originals'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $name=$row.id+[System.IO.Path]::GetExtension($row.sourcePath).ToLowerInvariant()
    Copy-Item -LiteralPath $row.sourcePath -Destination (Join-Path $dir $name)
    $status='verified'; $url='/library/2026-08-27-v2/originals/'+$name; $original=$source
  }
  $entries[$row.id]=@{originalStatus=$status;originalFile=$url;originalWidth=$original.width;originalHeight=$original.height;originalHash=$original.hash}
  $report+=@{id=$row.id;name=$row.name;status=$status;thumbnail=$preview;source=$source;originalFile=$url;manifestHash=$row.hash}
}
$entries | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $base 'originals-index.json') -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $root 'docs') | Out-Null
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'docs/original-audit-20260929.json') -Encoding UTF8
$report | Group-Object status | Select-Object Name,Count
$report | Where-Object {$_.originalFile -like '*/originals/*'} | Measure-Object | Select-Object Count
($report | Where-Object {$_.originalFile -like '*/originals/*'} | ForEach-Object {$_.source.bytes} | Measure-Object -Sum).Sum
