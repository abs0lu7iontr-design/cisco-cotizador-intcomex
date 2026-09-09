[CmdletBinding()]
param(
    [string]$CertificatePath = $env:CODE_SIGNING_CERTIFICATE,
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CertificatePath)) {
    throw "Indica -CertificatePath o define CODE_SIGNING_CERTIFICATE."
}

npm run build
if ($LASTEXITCODE -ne 0) {
    throw "El build web fallo."
}

python -m PyInstaller --noconfirm GravityDesktopPortable.spec
if ($LASTEXITCODE -ne 0) {
    throw "La compilacion de PyInstaller fallo."
}

$env:CODE_SIGNING_CERTIFICATE = (Resolve-Path -LiteralPath $CertificatePath).Path
& "$PSScriptRoot/sign-windows.ps1" `
    -ArtifactPath "dist/Cotizador-Cisco-Intcomex-Portable.exe" `
    -TimestampUrl $TimestampUrl
