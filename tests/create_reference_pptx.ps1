$ppt = New-Object -ComObject PowerPoint.Application
$pres = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)
$slide1 = $pres.Slides.Add(1, 12) # 12 = ppLayoutBlank
$slide2 = $pres.Slides.Add(2, 12)
$slide3 = $pres.Slides.Add(3, 12)

$savePath = (Join-Path (Get-Location) "reference_valid.pptx")
if (Test-Path $savePath) { Remove-Item $savePath }
$pres.SaveAs($savePath)
$pres.Close()
$ppt.Quit()
Write-Host "Created reference PPTX at: $savePath"
