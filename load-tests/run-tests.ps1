# ─── Wafaa Backend Load Test Runner ───────────────────────────────────────────
# Orchestrates all load test scenarios in sequence
# Usage: .\load-tests\run-tests.ps1 [-Scenario all|normal|high|peak|stress|spike] [-BaseUrl http://localhost:3000]

param(
    [string]$Scenario = "normal",
    [string]$BaseUrl = "http://localhost:3000",
    [string]$WsUrl = "",
    [string]$ApiPrefix = "api/v1",
    [switch]$SeedUsers,
    [int]$SeedCount = 500,
    [switch]$SkipRest,
    [switch]$SkipWs,
    [switch]$Combined
)

if (-not $WsUrl) {
    $WsUrl = $BaseUrl -replace "^http", "ws"
}

$sep = "=" * 70

Write-Host @"

$sep
  WAFAA BACKEND — LOAD TEST RUNNER
  Target:     $BaseUrl/$ApiPrefix
  WebSocket:  $WsUrl
  Scenario:   $Scenario
  Date:       $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$sep

"@

# ─── Pre-flight checks ───────────────────────────────────────────────────────

Write-Host "[1/5] Checking k6 installation..." -ForegroundColor Cyan
$k6Version = & k6 version 2>$null
if (-not $k6Version) {
    Write-Host "  ERROR: k6 not found. Install it:" -ForegroundColor Red
    Write-Host "    Windows:  choco install k6" -ForegroundColor Yellow
    Write-Host "    macOS:    brew install k6" -ForegroundColor Yellow
    Write-Host "    Linux:    https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  k6 found: $k6Version" -ForegroundColor Green

# ─── Health check ─────────────────────────────────────────────────────────────

Write-Host "`n[2/5] Health check on $BaseUrl..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/$ApiPrefix/auth/login" -Method POST -Body '{"email":"test","password":"test"}' -ContentType "application/json" -TimeoutSec 10 -SkipCertificateCheck -ErrorAction SilentlyContinue
    Write-Host "  Server is responding (status: $($health.StatusCode))" -ForegroundColor Green
} catch {
    $code = $_.Exception.Response.StatusCode.Value__
    if ($code) {
        Write-Host "  Server responding with status $code (expected for bad creds)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Server may not be running at $BaseUrl" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
        $continue = Read-Host "  Continue anyway? (y/n)"
        if ($continue -ne "y") { exit 1 }
    }
}

# ─── Create reports directory ─────────────────────────────────────────────────

$reportsDir = "$PSScriptRoot\reports"
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

# ─── Seed test users ─────────────────────────────────────────────────────────

if ($SeedUsers) {
    Write-Host "`n[3/5] Seeding $SeedCount test users..." -ForegroundColor Cyan
    & node "$PSScriptRoot\seed-test-users.js" $SeedCount $BaseUrl
} else {
    Write-Host "`n[3/5] Skipping user seeding (use -SeedUsers to enable)" -ForegroundColor DarkGray
}

# ─── Environment variables for k6 ────────────────────────────────────────────

$env:BASE_URL = $BaseUrl
$env:WS_URL = $WsUrl
$env:API_PREFIX = $ApiPrefix

# ─── Run scenarios ────────────────────────────────────────────────────────────

$scenarios = @()
if ($Scenario -eq "all") {
    $scenarios = @("normal", "high", "peak", "stress", "spike")
} else {
    $scenarios = @($Scenario)
}

Write-Host "`n[4/5] Running load tests..." -ForegroundColor Cyan

foreach ($s in $scenarios) {
    Write-Host "`n$sep" -ForegroundColor Magenta
    Write-Host "  SCENARIO: $($s.ToUpper())" -ForegroundColor Magenta
    Write-Host "$sep`n" -ForegroundColor Magenta

    if ($Combined) {
        Write-Host "  Running COMBINED test (REST + WebSocket)..." -ForegroundColor Yellow
        $env:SCENARIO = $s
        & k6 run --out json="$reportsDir\combined-$s-raw.json" "$PSScriptRoot\scenarios\combined.test.js"
    } else {
        if (-not $SkipRest) {
            Write-Host "  Running REST API test..." -ForegroundColor Yellow
            $env:SCENARIO = $s
            & k6 run --out json="$reportsDir\rest-$s-raw.json" "$PSScriptRoot\scenarios\rest-api.test.js"
        }

        if (-not $SkipWs) {
            Write-Host "`n  Running WebSocket test..." -ForegroundColor Yellow
            $wsScenario = "ws_normal"
            switch ($s) {
                "normal" { $wsScenario = "ws_normal" }
                "high"   { $wsScenario = "ws_normal" }
                "peak"   { $wsScenario = "ws_peak" }
                "stress" { $wsScenario = "ws_stress" }
                "spike"  { $wsScenario = "ws_peak" }
            }
            $env:WS_SCENARIO = $wsScenario
            & k6 run --out json="$reportsDir\ws-$s-raw.json" "$PSScriptRoot\scenarios\websocket.test.js"
        }
    }
}

# ─── Summary ──────────────────────────────────────────────────────────────────

Write-Host "`n[5/5] Tests complete!" -ForegroundColor Green
Write-Host @"

$sep
  ALL TESTS COMPLETED
  Reports saved to: $reportsDir
  
  To view reports:
    - JSON:  Get-Content $reportsDir\*.json | ConvertFrom-Json
    - k6 Cloud: k6 run --out cloud <script>
$sep

"@
