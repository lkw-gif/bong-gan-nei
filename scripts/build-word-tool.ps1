$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework C# compiler is required.' }
$output = Join-Path $root 'native'
[IO.Directory]::CreateDirectory($output) | Out-Null
& $compiler /nologo /target:exe /platform:anycpu /codepage:65001 /optimize+ /reference:System.Windows.Forms.dll /reference:Microsoft.CSharp.dll /out:"$output\Word-to-PDF.exe" "$root\native\WordToPdf.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native Word tool build failed.' }
