$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$baseUrl = "http://localhost:3000"
$root = Split-Path -Parent $PSScriptRoot
$resetScript = Join-Path $PSScriptRoot "db-reset.ts"
$demoImage = Join-Path $root "public\demo\ironworkers.jpg"

function Reset-Database {
  & node --experimental-strip-types $resetScript | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Database reset failed" }
}

function Send-Command($payload) {
  return Invoke-RestMethod -Method Post -Uri "$baseUrl/api/workbench/command" -ContentType "application/json; charset=utf-8" -Body ($payload | ConvertTo-Json)
}

Reset-Database
try {
  $snapshot = Invoke-RestMethod -Uri "$baseUrl/api/workbench" -Method Get
  if ($snapshot.projects.Count -lt 3 -or $snapshot.evidences.Count -lt 6 -or $snapshot.persons.Count -lt 40 -or $snapshot.findings.Count -lt 10) {
    throw "Seeded workbench snapshot is incomplete"
  }

  $findingId = $snapshot.findings[0].id
  $projectId = $snapshot.project.id
  $ownerId = $snapshot.members[0].id

  $snapshot = Send-Command @{ type = "review_finding"; projectId = $projectId; findingId = $findingId; decision = "confirmed" }
  if ($snapshot.findings[0].reviewState -ne "confirmed") { throw "Finding review did not persist" }

  $snapshot = Send-Command @{ type = "assign_rectification"; projectId = $projectId; findingId = $findingId; ownerId = $ownerId; dueDate = "24 hours" }
  if ($snapshot.findings[0].workflowState -ne "assigned") { throw "Rectification assignment did not persist" }

  $snapshot = Send-Command @{ type = "start_rectification"; projectId = $projectId; findingId = $findingId }
  if ($snapshot.findings[0].workflowState -ne "rectifying") { throw "Rectification start did not persist" }

  $rectificationJson = & curl.exe -sS -X POST "$baseUrl/api/workbench/evidence" -F "projectId=$projectId" -F "purpose=rectification" -F "findingId=$findingId" -F "image=@$demoImage;type=image/jpeg"
  if ($LASTEXITCODE -ne 0) { throw "Rectification evidence upload failed" }
  $snapshot = $rectificationJson | ConvertFrom-Json
  if ($snapshot.findings[0].workflowState -ne "pending_verification") { throw "Evidence upload did not enter verification" }
  if (-not $snapshot.findings[0].rectificationEvidenceUrl) { throw "Rectification evidence must expose a reviewable image URL" }

  $snapshot = Send-Command @{ type = "verify_rectification"; projectId = $projectId; findingId = $findingId; decision = "pass" }
  if ($snapshot.findings[0].workflowState -ne "closed") { throw "Verification did not close hazard" }

  $reloaded = Invoke-RestMethod -Uri "$baseUrl/api/workbench?projectId=$projectId" -Method Get
  if ($reloaded.findings[0].workflowState -ne "closed") { throw "Closed state was not durable after reload" }
  Write-Output "Database workflow check passed: Finding -> HazardCase -> RectificationOrder -> Verification -> Closure"
}
finally {
  Reset-Database
}
