$ErrorActionPreference = "Continue"
$h = @{
  "Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODk4OTMsImV4cCI6MjA4NjY2NTg5M30.twpFHzJqDL-M37THYNs1oC23ZktjGTYodcSJkxHUyR8"
  "apikey"="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpeGlwdmVlYmZodXJiYXJrc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwODk4OTMsImV4cCI6MjA4NjY2NTg5M30.twpFHzJqDL-M37THYNs1oC23ZktjGTYodcSJkxHUyR8"
}
$u = "https://qixipveebfhurbarksib.supabase.co/functions/v1/payroll_api"

# Real IDs from the database
$groupId = "e54e12d7-018e-434e-a166-d041a97854c2"
$entityId = "8d3d6997-38c5-40c4-9698-8657a0fde48c"

function CallApi($body) {
  try {
    $json = $body | ConvertTo-Json -Depth 5
    $r = Invoke-RestMethod -Uri $u -Method POST -Headers $h -Body $json -ContentType "application/json" -TimeoutSec 60
    return $r
  } catch {
    $msg = $_.Exception.Message
    $resp = ""
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $resp = $reader.ReadToEnd()
    }
    Write-Host "  FAIL: $msg" -ForegroundColor Red
    Write-Host "  Response: $resp" -ForegroundColor Red
    return $null
  }
}

Write-Host "===== PAYROLL E2E TEST =====" -ForegroundColor Cyan
Write-Host "Group: $groupId" -ForegroundColor Gray
Write-Host "Entity: $entityId (fardon B12345678)" -ForegroundColor Gray

# Step 1: Reset existing run if any
Write-Host "`n[1/10] Reset existing run..." -ForegroundColor Yellow
$r = CallApi @{action="reset_payroll"; payroll_run_id="fa53c908-0d5f-4158-9e95-aac768726cec"}
if ($r) { Write-Host "  OK: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green }

# Step 2: Seed Test Data
Write-Host "`n[2/10] Seed 20 employees with contracts/legal data..." -ForegroundColor Yellow
$r = CallApi @{action="seed_test_data"; group_id=$groupId; legal_entity_id=$entityId; period_year=2026; period_month=2}
if ($r) { Write-Host "  OK: employees=$($r.employees_count) contracts=$($r.contracts_created) legal=$($r.legal_data_created) inputs=$($r.inputs_created)" -ForegroundColor Green }

# Step 3: Create Payroll Run
Write-Host "`n[3/10] Create payroll run Feb 2026..." -ForegroundColor Yellow
$r = CallApi @{action="create_payroll_run"; group_id=$groupId; legal_entity_id=$entityId; period_year=2026; period_month=2}
if ($r -and $r.data) {
  $runId = $r.data.id
  Write-Host "  OK: Run ID = $runId (status: $($r.data.status))" -ForegroundColor Green
} else {
  Write-Host "  ABORT: Cannot create run" -ForegroundColor Red
  exit 1
}

# Step 4: Calculate
Write-Host "`n[4/10] Calculate payroll..." -ForegroundColor Yellow
$r = CallApi @{action="calculate"; payroll_run_id=$runId}
if ($r -and $r.success) {
  Write-Host "  OK: $($r.employees_calculated) employees" -ForegroundColor Green
  Write-Host "  Totals: Gross=$($r.totals.gross_pay) Net=$($r.totals.net_pay) SS_emp=$($r.totals.employer_ss) IRPF=$($r.totals.irpf_total)" -ForegroundColor Green
  Write-Host "  Total cost: $($r.totals.total_cost)" -ForegroundColor Green
} else {
  Write-Host "  Result: $($r | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor Yellow
}

# Step 5: Approve
Write-Host "`n[5/10] Approve payroll..." -ForegroundColor Yellow
$r = CallApi @{action="update_status"; payroll_run_id=$runId; status="approved"}
if ($r -and $r.success) { Write-Host "  OK: status=$($r.new_status)" -ForegroundColor Green }

# Step 6: Submit TGSS
Write-Host "`n[6/10] Submit TGSS (sandbox)..." -ForegroundColor Yellow
$r = CallApi @{action="create_submission"; payroll_run_id=$runId; agency="TGSS"; is_sandbox=$true}
if ($r -and $r.data) { Write-Host "  OK: $($r.data.agency) status=$($r.data.status)" -ForegroundColor Green }

# Step 7: Submit AEAT
Write-Host "`n[7/10] Submit AEAT (sandbox)..." -ForegroundColor Yellow
$r = CallApi @{action="create_submission"; payroll_run_id=$runId; agency="AEAT"; is_sandbox=$true}
if ($r -and $r.data) { Write-Host "  OK: $($r.data.agency) status=$($r.data.status)" -ForegroundColor Green }

# Step 8: Submit SEPE
Write-Host "`n[8/10] Submit SEPE (sandbox)..." -ForegroundColor Yellow
$r = CallApi @{action="create_submission"; payroll_run_id=$runId; agency="SEPE"; is_sandbox=$true}
if ($r -and $r.data) { Write-Host "  OK: $($r.data.agency) status=$($r.data.status)" -ForegroundColor Green }

# Step 8b: Mark submitted
Write-Host "`n[8b] Mark as submitted..." -ForegroundColor Yellow
$r = CallApi @{action="update_status"; payroll_run_id=$runId; status="submitted"}
if ($r -and $r.success) { Write-Host "  OK: status=$($r.new_status)" -ForegroundColor Green }

# Step 9: Generate SEPA
Write-Host "`n[9/10] Generate SEPA..." -ForegroundColor Yellow
$r = CallApi @{action="generate_sepa"; payroll_run_id=$runId}
if ($r -and $r.success) {
  Write-Host "  OK: $($r.sepa.numberOfTransactions) transfers, total EUR $($r.sepa.controlSum)" -ForegroundColor Green
  if ($r.sepa.payments) {
    foreach ($p in $r.sepa.payments[0..2]) {
      Write-Host "    - $($p.employee): EUR $($p.amount)" -ForegroundColor Gray
    }
    if ($r.sepa.payments.Count -gt 3) { Write-Host "    ... and $($r.sepa.payments.Count - 3) more" -ForegroundColor Gray }
  }
}

# Step 10: Mark Paid
Write-Host "`n[10/10] Mark as paid..." -ForegroundColor Yellow
$r = CallApi @{action="update_status"; payroll_run_id=$runId; status="paid"}
if ($r -and $r.success) { Write-Host "  OK: status=$($r.new_status)" -ForegroundColor Green }

Write-Host "`n===== ALL STEPS COMPLETE =====" -ForegroundColor Green
Write-Host "Run ID: $runId" -ForegroundColor Cyan
