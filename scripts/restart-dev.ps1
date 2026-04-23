[CmdletBinding()]
param(
  [switch]$NoNewWindow,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Local dev startup config.
# Edit ADMIN_USERNAMES to set which local accounts should be treated as admins.
$script:LocalDevConfig = @{
  Backend = @{
    ADMIN_USERNAMES = 'tanwubo_admin'
  }
}

function Get-ProjectRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-BackendEnvironmentOverrides {
  return $script:LocalDevConfig.Backend
}

function Get-ServiceLaunchInfo {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  $workingDirectory = Join-Path $ProjectRoot $RelativePath

  if (-not (Test-Path $workingDirectory)) {
    throw "Service directory not found: $workingDirectory"
  }

  return [pscustomobject]@{
    Name = $Name
    WorkingDirectory = $workingDirectory
    Command = 'npm run dev'
    Port = $Port
    Url = $Url
    Environment = if ($Name -eq 'backend') { Get-BackendEnvironmentOverrides } else { @{} }
  }
}

function Get-ListeningProcessIds {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-PortProcesses {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [switch]$DryRun
  )

  $processIds = Get-ListeningProcessIds -Port $Port
  foreach ($processId in $processIds) {
    if ($DryRun) {
      Write-Host "[dry-run] stop process $processId on port $Port"
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $processId on port $Port"
    } catch {
      Write-Warning "Failed to stop process $processId on port ${Port}: $($_.Exception.Message)"
    }
  }
}

function Start-ServiceProcess {
  param(
    [Parameter(Mandatory = $true)]
    $Service,
    [switch]$NoNewWindow,
    [switch]$DryRun
  )

  if ($DryRun) {
    Write-Host "[dry-run] start $($Service.Name) in $($Service.WorkingDirectory)"
    return [pscustomobject]@{
      Action = 'start'
      Name = $Service.Name
      WorkingDirectory = $Service.WorkingDirectory
      Command = $Service.Command
      Port = $Service.Port
      Url = $Service.Url
      Environment = $Service.Environment
    }
  }

  $escapedWorkingDirectory = $Service.WorkingDirectory.Replace("'", "''")
  $environmentAssignments = @()
  foreach ($entry in $Service.Environment.GetEnumerator()) {
    $escapedValue = [string]$entry.Value
    $escapedValue = $escapedValue.Replace("'", "''")
    $environmentAssignments += "`$env:$($entry.Key) = '$escapedValue'"
  }

  $commandParts = @("Set-Location -LiteralPath '$escapedWorkingDirectory'")
  if ($environmentAssignments.Count -gt 0) {
    $commandParts += $environmentAssignments
  }
  $commandParts += 'npm run dev'
  $innerCommand = [string]::Join('; ', $commandParts)
  $arguments = @(
    '-NoExit'
    '-ExecutionPolicy'
    'Bypass'
    '-Command'
    $innerCommand
  )

  if ($NoNewWindow) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $Service.WorkingDirectory
  } else {
    Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $Service.WorkingDirectory
  }

  Write-Host "Started $($Service.Name) dev server on port $($Service.Port)"
  return [pscustomobject]@{
    Action = 'start'
    Name = $Service.Name
    WorkingDirectory = $Service.WorkingDirectory
    Command = $Service.Command
    Port = $Service.Port
    Url = $Service.Url
    Environment = $Service.Environment
  }
}

function Restart-DevStack {
  param(
    [string]$ProjectRoot = (Get-ProjectRoot),
    [switch]$NoNewWindow,
    [switch]$DryRun
  )

  $services = @(
    (Get-ServiceLaunchInfo -ProjectRoot $ProjectRoot -Name 'backend' -RelativePath 'backend' -Port 3001 -Url 'http://localhost:3001'),
    (Get-ServiceLaunchInfo -ProjectRoot $ProjectRoot -Name 'frontend' -RelativePath 'frontend' -Port 5173 -Url 'http://localhost:5173')
  )

  foreach ($service in $services) {
    Stop-PortProcesses -Port $service.Port -DryRun:$DryRun
  }

  $results = @()
  foreach ($service in $services) {
    $results += Start-ServiceProcess -Service $service -NoNewWindow:$NoNewWindow -DryRun:$DryRun
  }

  return $results
}

function Invoke-Main {
  param(
    [switch]$NoNewWindow,
    [switch]$DryRun
  )

  $results = Restart-DevStack -NoNewWindow:$NoNewWindow -DryRun:$DryRun

  if (-not $DryRun) {
    Write-Host ''
    Write-Host 'Development services restarted:'
    foreach ($result in $results) {
      Write-Host "- $($result.Name): $($result.Url)"
    }
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  Invoke-Main -NoNewWindow:$NoNewWindow -DryRun:$DryRun
}
