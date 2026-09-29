$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$public=(Resolve-Path -LiteralPath (Join-Path $root 'public')).Path
$destination=[IO.Path]::GetFullPath((Join-Path $root 'source-assets/site-assets'))
if(!$destination.StartsWith($root+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid destination'}
$index=@{}
$images=@(Get-ChildItem -LiteralPath $public -Recurse -File | Where-Object {$_.Extension -in '.jpg','.jpeg','.png','.webp' -and $_.Name -notmatch '^screenshot\.jpe?g$'})
foreach($image in $images){
 $relative=[IO.Path]::GetRelativePath($public,$image.FullName).Replace('\','/')
 $target=[IO.Path]::GetFullPath((Join-Path $destination $relative))
 if(!$target.StartsWith($destination+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid target'}
 if(Test-Path -LiteralPath $target){throw ('Target exists: '+$relative)}
 $index['/'+$relative]=@{originalHash=(Get-FileHash -LiteralPath $image.FullName -Algorithm SHA256).Hash.ToLowerInvariant();originalBytes=$image.Length;originalDiskFile='source-assets/site-assets/'+$relative;originalStatus='verified';mime=if($image.Extension -eq '.png'){'image/png'}elseif($image.Extension -eq '.webp'){'image/webp'}else{'image/jpeg'}}
 New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
 Move-Item -LiteralPath $image.FullName -Destination $target
}
$index | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root 'lib/site-asset-index.json') -Encoding UTF8
Write-Output ('Preserved and staged '+$index.Count+' images')
