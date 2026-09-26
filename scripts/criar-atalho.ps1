# Gera o ícone da Vitrine (scripts/vitrine.ico) e cria o atalho "Vitrine" na área de trabalho.
# Rodar de novo recria os dois (útil se mover a pasta do projeto).

param(
    # Pasta onde o atalho é criado (padrão: área de trabalho) e nome dele.
    [string]$Destino = [Environment]::GetFolderPath('Desktop'),
    [string]$Nome = 'Vitrine'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$icoPath = Join-Path $PSScriptRoot 'vitrine.ico'

function New-IconBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $s = $size / 32.0

    # Fundo: quadrado arredondado grafite.
    $r = 8 * $s
    $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bg.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $bg.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
    $bg.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $bg.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $bg.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 17, 20))), $bg)

    # Etiqueta de preço âmbar inclinada a -45° (mesmo desenho do public/favicon.svg).
    $amber = [System.Drawing.Color]::FromArgb(255, 245, 184, 61)
    $g.TranslateTransform(16 * $s, 16 * $s)
    $g.RotateTransform(-45)
    $g.TranslateTransform(-16 * $s, -16 * $s)
    $tag = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tag.AddPolygon([System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF (5 * $s), (16 * $s)),
        (New-Object System.Drawing.PointF (11 * $s), (9.5 * $s)),
        (New-Object System.Drawing.PointF (27 * $s), (9.5 * $s)),
        (New-Object System.Drawing.PointF (27 * $s), (22.5 * $s)),
        (New-Object System.Drawing.PointF (11 * $s), (22.5 * $s))
    ))
    $g.FillPath((New-Object System.Drawing.SolidBrush $amber), $tag)
    $round = New-Object System.Drawing.Pen $amber, (2 * $s)
    $round.LineJoin = 'Round'
    $g.DrawPath($round, $tag)

    # Furo da etiqueta.
    $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 17, 20))
    $d = if ($size -le 16) { 4.4 * $s } else { 4 * $s }
    $g.FillEllipse($dark, 11.5 * $s - $d / 2, 16 * $s - $d / 2, $d, $d)
    $g.ResetTransform()

    $g.Dispose()
    return $bmp
}

# 256 px vai como PNG; os menores como DIB 32 bits (BGRA de baixo para cima + máscara AND), o formato
# que qualquer leitor de .ico entende.
function ConvertTo-IcoEntry([System.Drawing.Bitmap]$bmp) {
    $size = $bmp.Width
    $ms = New-Object System.IO.MemoryStream
    if ($size -ge 256) {
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        return , $ms.ToArray()
    }
    $bw = New-Object System.IO.BinaryWriter $ms
    $maskStride = [int]([Math]::Ceiling($size / 32.0) * 4)
    $bw.Write([UInt32]40); $bw.Write([Int32]$size); $bw.Write([Int32]($size * 2))
    $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]0)
    $bw.Write([UInt32]($size * $size * 4 + $maskStride * $size))
    $bw.Write([Int32]0); $bw.Write([Int32]0); $bw.Write([UInt32]0); $bw.Write([UInt32]0)
    for ($y = $size - 1; $y -ge 0; $y--) {
        for ($x = 0; $x -lt $size; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $bw.Write([Byte]$c.B); $bw.Write([Byte]$c.G); $bw.Write([Byte]$c.R); $bw.Write([Byte]$c.A)
        }
    }
    $bw.Write((New-Object byte[] ($maskStride * $size)))
    $bw.Flush()
    return , $ms.ToArray()
}

# Monta o .ico com todos os tamanhos.
$sizes = 16, 24, 32, 48, 64, 128, 256
$images = $sizes | ForEach-Object { $b = New-IconBitmap $_; , (ConvertTo-IcoEntry $b); $b.Dispose() }
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
    $w.Write([Byte]$dim); $w.Write([Byte]$dim); $w.Write([Byte]0); $w.Write([Byte]0)
    $w.Write([UInt16]1); $w.Write([UInt16]32)
    $w.Write([UInt32]$images[$i].Length); $w.Write([UInt32]$offset)
    $offset += $images[$i].Length
}
foreach ($img in $images) { $w.Write([byte[]]$img) }
$w.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $out.ToArray())

# Atalho: PowerShell oculto rodando o iniciar.ps1.
$lnkPath = Join-Path $Destino "$Nome.lnk"
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot 'iniciar.ps1')`""
$lnk.WorkingDirectory = $root
$lnk.IconLocation = "$icoPath,0"
$lnk.Description = 'Vitrine - editor de anúncios para WhatsApp'
$lnk.WindowStyle = 7
$lnk.Save()

Write-Output "Ícone: $icoPath"
Write-Output "Atalho: $lnkPath"
