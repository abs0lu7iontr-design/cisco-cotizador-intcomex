param (
    [string]$File = "sample_test.pptx"
)

$fullPath = (Resolve-Path $File).Path
Write-Host "Testing opening file: $fullPath"

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    # Presentations.Open(FileName, ReadOnly, Untitled, WithWindow)
    $pres = $ppt.Presentations.Open($fullPath, 1, 0, 0)
    Write-Host "SUCCESS: PowerPoint opened file! Slide count: $($pres.Slides.Count)"
    $pres.Close()
    $ppt.Quit()
} catch {
    Write-Host "ERROR OPENING PPTX: $($_.Exception.Message)"
    if ($ppt) {
        try { $ppt.Quit() } catch {}
    }
}
