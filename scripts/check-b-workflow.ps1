$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$baseUrl = "http://localhost:3000"
$page = Invoke-WebRequest -Uri "$baseUrl/prototype/dashboard?variant=B" -UseBasicParsing

if ($page.StatusCode -ne 200) {
  throw "B workbench page is unavailable"
}

$workbench = Invoke-RestMethod -Uri "$baseUrl/api/workbench" -Method Get
if (-not $workbench.project.id -or -not $workbench.evidence.id) {
  throw "B workbench persistence snapshot is unavailable"
}

$payload = @{
  inspectionId = "inspection-smoke"
  evidenceId = "evidence-smoke"
  source = "smoke-test"
} | ConvertTo-Json

$result = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/api/vision/inspect" `
  -ContentType "application/json" `
  -Body $payload

if ($result.persons.Count -lt 3) {
  throw "Expected at least three people in the multi-person mock scene"
}
if ($result.findings.Count -ne 1) {
  throw "Expected exactly one no-helmet Finding"
}
if ($result.findings[0].status -ne "pending_confirmation") {
  throw "AI result must remain pending human confirmation"
}
if (-not $result.findings[0].model -or $null -eq $result.findings[0].confidence) {
  throw "Finding must expose model and confidence"
}

Write-Output "B workflow smoke check passed"
