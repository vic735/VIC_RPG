# Run each suite separately: several older suites intentionally modify fixture data.
$ErrorActionPreference = 'Stop'
$releaseData = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'data.js') -Raw
$releaseVersion = [regex]::Match($releaseData, "release: \{ version: '([^']+)'").Groups[1].Value
$logRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../archive-unused-2026-09-30/verification'))
$logFolder = Join-Path $logRoot ($releaseVersion + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
$results = @()
Push-Location -LiteralPath $PSScriptRoot
try {
    foreach ($suite in (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.test.js' | Sort-Object Name)) {
        $testOutput = (& node --test --test-isolation=none $suite.Name 2>&1 | Out-String)
        $status = $LASTEXITCODE
        $testOutput | Set-Content -LiteralPath (Join-Path $logFolder ($suite.Name + '.log')) -Encoding utf8
        $results += [pscustomobject]@{ file=$suite.Name; status=$status; tests=[int]([regex]::Match($testOutput,'tests (\d+)').Groups[1].Value); pass=[int]([regex]::Match($testOutput,'pass (\d+)').Groups[1].Value); fail=[int]([regex]::Match($testOutput,'fail (\d+)').Groups[1].Value) }
        Write-Output ($suite.Name + ': ' + $(if ($status -eq 0) {'PASS'} else {'FAIL'}))
    }
} finally { Pop-Location }
$summary = [pscustomobject]@{ version=$releaseVersion; files=$results.Count; tests=($results | Measure-Object tests -Sum).Sum; pass=($results | Measure-Object pass -Sum).Sum; fail=($results | Measure-Object fail -Sum).Sum; failedFiles=@($results | Where-Object status -ne 0); results=$results; folder=$logFolder }
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $logFolder 'summary.json') -Encoding utf8
Write-Output ($summary | Select-Object -ExcludeProperty results | ConvertTo-Json -Depth 5 -Compress)
if ($summary.failedFiles.Count) { exit 1 }
