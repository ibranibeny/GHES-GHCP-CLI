param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ExpectedAccount,
    [string]$Location = 'southeastasia',
    [string]$ResourceGroup = 'rg-ghes-ghcp-cli'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Az {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    $result = & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure command failed: az $($Arguments -join ' ')"
    }
    return $result
}

$account = (Invoke-Az account show --output json) | ConvertFrom-Json
if ($account.user.name -ne $ExpectedAccount -or $account.id -ne $SubscriptionId) {
    throw 'Azure account or subscription does not match the requested target. Log in and select the authorized subscription before deploying.'
}
$suffix = $SubscriptionId.Replace('-', '').Substring(0, 12)
$registry = "ghcpdemo$suffix"
$image = "$registry.azurecr.io/ghcp-guide:latest"
Push-Location (Split-Path $PSScriptRoot)
try {
    foreach ($asset in @('site\media\walkthrough.webm', 'site\media\step-1.png', 'site\media\step-2.png', 'site\media\step-3.png', 'site\media\step-4.png', 'site\media\step-5.png', 'site\media\step-6.png')) {
        if (-not (Test-Path $asset)) { throw "Missing generated asset: $asset. Run npm run capture before deployment." }
    }
    Invoke-Az group create --name $ResourceGroup --location $Location --subscription $SubscriptionId --output none
    Invoke-Az acr create --name $registry --resource-group $ResourceGroup --location $Location --sku Basic --admin-enabled false --subscription $SubscriptionId --output none
    Invoke-Az acr build --registry $registry --image ghcp-guide:latest --file Dockerfile --subscription $SubscriptionId . --output none
    $identity = (Invoke-Az identity create --name ghcp-guide-pull --resource-group $ResourceGroup --location $Location --subscription $SubscriptionId --output json) | ConvertFrom-Json
    $registryId = Invoke-Az acr show --name $registry --resource-group $ResourceGroup --subscription $SubscriptionId --query id --output tsv
    $assignments = (Invoke-Az role assignment list --assignee $identity.principalId --scope $registryId --subscription $SubscriptionId --output json) | ConvertFrom-Json
    if (-not ($assignments | Where-Object { $_.roleDefinitionName -eq 'AcrPull' })) {
        Invoke-Az role assignment create --assignee-object-id $identity.principalId --assignee-principal-type ServicePrincipal --role AcrPull --scope $registryId --subscription $SubscriptionId --output none
    }
    Invoke-Az containerapp env create --name ghcp-demo-env --resource-group $ResourceGroup --location $Location --logs-destination none --subscription $SubscriptionId --output none
    Invoke-Az containerapp create --name ghcp-guide --resource-group $ResourceGroup --environment ghcp-demo-env --image $image --user-assigned $identity.id --registry-server "$registry.azurecr.io" --registry-identity $identity.id --target-port 8080 --ingress external --transport http --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi --subscription $SubscriptionId --output none
    $app = (Invoke-Az containerapp show --name ghcp-guide --resource-group $ResourceGroup --subscription $SubscriptionId --output json) | ConvertFrom-Json
    $url = "https://$($app.properties.configuration.ingress.fqdn)"
    $healthy = $false
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        try {
            $health = Invoke-RestMethod "$url/healthz" -TimeoutSec 30
            if ($health.status -eq 'ok' -and $health.mode -eq 'educational-demo') {
                $healthy = $true
                break
            }
        } catch {
            Write-Warning "Health check attempt $($attempt + 1) failed: $($_.Exception.Message)"
        }
        Start-Sleep -Seconds 10
    }
    if (-not $healthy) { throw "Deployment did not become healthy: $url" }
    @{ url = $url; resourceGroup = $ResourceGroup; mode = 'educational-demo' } | ConvertTo-Json | Set-Content deployment.json
    Write-Output "Verified Azure companion guide: $url"
} finally {
    Pop-Location
}
