[CmdletBinding()]
param(
    [string]$ArtifactPath = "dist/Cotizador-Cisco-Intcomex-Portable.exe",
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ArtifactPath)) {
    throw "No se encontro el ejecutable: $ArtifactPath"
}

$certificatePath = $env:CODE_SIGNING_CERTIFICATE
$certificatePassword = $env:CODE_SIGNING_PASSWORD
if ([string]::IsNullOrWhiteSpace($certificatePath)) {
    throw "Define CODE_SIGNING_CERTIFICATE con la ruta al certificado .pfx/.p12."
}
if (-not (Test-Path -LiteralPath $certificatePath)) {
    throw "No se encontro el certificado: $certificatePath"
}
if ([string]::IsNullOrWhiteSpace($certificatePassword)) {
    throw "Define CODE_SIGNING_PASSWORD solo en la sesion de Windows."
}

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
    throw "No se encontro signtool.exe. Instala Windows SDK y agrega su carpeta al PATH."
}

$artifactDirectory = Split-Path -Parent (Resolve-Path -LiteralPath $ArtifactPath)
$filesToSign = @(
    Get-ChildItem -LiteralPath $artifactDirectory -Recurse -File |
        Where-Object { $_.Extension -in @('.exe', '.dll') }
)

if ($filesToSign.Count -eq 0) {
    throw "No se encontraron binarios firmables en $artifactDirectory"
}

foreach ($file in $filesToSign) {
    Write-Host "Firmando $($file.FullName)"
    & $signtool.Source sign /fd SHA256 /td SHA256 /tr $TimestampUrl /f $certificatePath /p $certificatePassword $file.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "signtool fallo al firmar $($file.FullName)"
    }

    & $signtool.Source verify /pa /all $file.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo verificar la firma de $($file.FullName)"
    }
}

Write-Host "Firma completada y verificada para $($filesToSign.Count) binario(s)."
