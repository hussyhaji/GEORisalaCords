@echo off
chcp 65001 >nul
set "SCRIPTDIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0',[Text.Encoding]::UTF8); iex $t.Substring($t.IndexOf('#PS'+'-START')+9)"
echo.
pause
exit /b
#PS-START
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = $env:SCRIPTDIR.TrimEnd('\')
$jsonPath = Join-Path $dir '3MapsJson.json'
if (-not (Test-Path $jsonPath)) { Write-Host "3MapsJson.json not found in $dir" -ForegroundColor Red; return }

# one-time backup of the original file
$backup = Join-Path $dir '3MapsJson.backup.json'
if (-not (Test-Path $backup)) { Copy-Item $jsonPath $backup; Write-Host "Backup saved: 3MapsJson.backup.json" }

$data = [IO.File]::ReadAllText($jsonPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$done = 0
Write-Host ""
foreach ($p in $data.PSObject.Properties) {
  $e = $p.Value
  if ($e.unit -eq 'percent') { Write-Host "Already converted : $($e.filename)"; continue }

  $f = Get-ChildItem -Path $dir -Recurse -File -Filter $e.filename -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $f) { Write-Host "IMAGE NOT FOUND   : $($e.filename)  (left unchanged)" -ForegroundColor Yellow; continue }

  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $w = $img.Width; $h = $img.Height; $img.Dispose()

  # sanity check: regions must fit inside the ORIGINAL image size
  $bad = $false
  foreach ($r in $e.regions) {
    $a = $r.shape_attributes
    if (($a.x + $a.width) -gt ($w + 1) -or ($a.y + $a.height) -gt ($h + 1)) { $bad = $true }
  }
  if ($bad) {
    Write-Host "SKIPPED           : $($e.filename) is ${w}x${h}, but regions go outside it. Use the ORIGINAL full-size image." -ForegroundColor Yellow
    continue
  }

  foreach ($r in $e.regions) {
    $a = $r.shape_attributes
    $a.x      = [math]::Round($a.x / $w * 100, 4)
    $a.y      = [math]::Round($a.y / $h * 100, 4)
    $a.width  = [math]::Round($a.width / $w * 100, 4)
    $a.height = [math]::Round($a.height / $h * 100, 4)
  }
  $e | Add-Member -NotePropertyName unit         -NotePropertyValue 'percent' -Force
  $e | Add-Member -NotePropertyName image_width  -NotePropertyValue $w -Force
  $e | Add-Member -NotePropertyName image_height -NotePropertyValue $h -Force
  Write-Host "Converted         : $($e.filename)  (${w} x ${h})" -ForegroundColor Green
  $done++
}

if ($done -gt 0) {
  $json = $data | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($jsonPath, $json, (New-Object Text.UTF8Encoding $false))
  Write-Host ""
  Write-Host "Done. $done image(s) converted. 3MapsJson.json updated." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Nothing converted. 3MapsJson.json was not changed."
}
