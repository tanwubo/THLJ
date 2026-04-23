$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'restart-dev.ps1'

if (-not (Test-Path $scriptPath)) {
  throw "Missing script under test: $scriptPath"
}

. $scriptPath

function Assert-Equal {
  param(
    [Parameter(Mandatory = $true)]
    $Actual,
    [Parameter(Mandatory = $true)]
    $Expected,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if ($Actual -ne $Expected) {
    throw "$Message`nExpected: $Expected`nActual: $Actual"
  }
}

function Assert-True {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

$projectRoot = Get-ProjectRoot
Assert-Equal -Actual (Split-Path $projectRoot -Leaf) -Expected 'THLJ' -Message 'Project root should resolve to repository root.'

$backendInfo = Get-ServiceLaunchInfo -ProjectRoot $projectRoot -Name 'backend' -RelativePath 'backend' -Port 3001 -Url 'http://localhost:3001'
Assert-Equal -Actual $backendInfo.Name -Expected 'backend' -Message 'Backend launch info should preserve service name.'
Assert-Equal -Actual $backendInfo.WorkingDirectory -Expected (Join-Path $projectRoot 'backend') -Message 'Backend working directory should point at backend folder.'
Assert-Equal -Actual $backendInfo.Command -Expected 'npm run dev' -Message 'Backend should start with npm run dev.'
Assert-Equal -Actual $backendInfo.Port -Expected 3001 -Message 'Backend should use port 3001.'

$frontendInfo = Get-ServiceLaunchInfo -ProjectRoot $projectRoot -Name 'frontend' -RelativePath 'frontend' -Port 5173 -Url 'http://localhost:5173'
Assert-Equal -Actual $frontendInfo.Name -Expected 'frontend' -Message 'Frontend launch info should preserve service name.'
Assert-Equal -Actual $frontendInfo.WorkingDirectory -Expected (Join-Path $projectRoot 'frontend') -Message 'Frontend working directory should point at frontend folder.'
Assert-Equal -Actual $frontendInfo.Command -Expected 'npm run dev' -Message 'Frontend should start with npm run dev.'
Assert-Equal -Actual $frontendInfo.Port -Expected 5173 -Message 'Frontend should use port 5173.'

$backendEnv = Get-BackendEnvironmentOverrides
Assert-Equal -Actual $backendEnv.ADMIN_USERNAMES -Expected 'admin' -Message 'Backend launch config should expose ADMIN_USERNAMES for local admin setup.'

$dryRunOutput = Restart-DevStack -ProjectRoot $projectRoot -NoNewWindow -DryRun
Assert-Equal -Actual $dryRunOutput.Count -Expected 2 -Message 'Dry run should return two service definitions.'
Assert-True -Condition ($dryRunOutput[0].Action -eq 'start') -Message 'Dry run should mark backend for start.'
Assert-True -Condition ($dryRunOutput[1].Action -eq 'start') -Message 'Dry run should mark frontend for start.'
Assert-Equal -Actual $dryRunOutput[0].Environment.ADMIN_USERNAMES -Expected 'admin' -Message 'Dry run should carry backend ADMIN_USERNAMES into launch metadata.'

Write-Host 'restart-dev tests passed'
