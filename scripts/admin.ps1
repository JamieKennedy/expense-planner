param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet(
    "migrate",
    "reset-user",
    "sync-bank-holidays",
    "health"
  )]
  [string] $Command,

  [string] $Email
)

$ErrorActionPreference = "Stop"

$requiresEmail = $Command -eq "reset-user"
if ($requiresEmail -and [string]::IsNullOrWhiteSpace($Email)) {
  throw "-Email is required for $Command."
}

if (-not $requiresEmail -and -not [string]::IsNullOrWhiteSpace($Email)) {
  throw "-Email is supported only for reset-user."
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appHostProject = Join-Path $repositoryRoot `
  "src/orchestration/ExpensePlanner.AppHost/ExpensePlanner.AppHost.csproj"
$adminProject = Join-Path $repositoryRoot `
  "src/backend/ExpensePlanner.Admin/ExpensePlanner.Admin.csproj"

$adminArguments = @($Command)
if ($requiresEmail) {
  $adminArguments += @("--email", $Email)
}

Push-Location $repositoryRoot
try {
  & aspire exec `
    --project $appHostProject `
    --start-resource api `
    -- dotnet run --project $adminProject -- @adminArguments

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}
