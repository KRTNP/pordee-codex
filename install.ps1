param(
  [string]$Project,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $Root 'tools/install-codex-plugin.js'
$ForwardedArgs = @()

if ($Project) {
  $ForwardedArgs += '--project'
  $ForwardedArgs += $Project
}

if ($RemainingArgs) {
  $ForwardedArgs += $RemainingArgs
}

node $Installer @ForwardedArgs
