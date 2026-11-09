param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [Parameter(Mandatory)][string]$ExpectedAccount,
    [string]$Owner = 'ibranibeny',
    [string]$Repository = 'GHES-GHCP-CLI',
    [string]$Location = 'southeastasia',
    [string]$ResourceGroup = 'rg-ghes-ghcp-cli',
    [string]$IdentityResourceGroup = 'rg-ghes-ghcp-cli-identity',
    [string]$RegistryName = 'ghcpdemo439cf6ec8907',
    [string]$ContainerApp = 'ghcp-guide'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-AzJson {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    $result = & az @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Azure command failed: az $($Arguments -join ' ')" }
    return ($result | ConvertFrom-Json)
}

function Ensure-RoleAssignment {
    param(
        [string]$PrincipalId,
        [string]$Role,
        [string]$Scope
    )
    $assignments = Invoke-AzJson role assignment list --scope $Scope --query "[?principalId=='$PrincipalId'].roleDefinitionName" --output json
    if ($assignments -contains $Role) { return }
    Invoke-AzJson role assignment create --assignee-object-id $PrincipalId --assignee-principal-type ServicePrincipal --role $Role --scope $Scope --output json | Out-Null
}

$account = Invoke-AzJson account show --output json
if ($account.user.name -ne $ExpectedAccount -or $account.id -ne $SubscriptionId) {
    throw 'Azure account or subscription mismatch. Select the authorized account before configuring pipeline identity.'
}
Invoke-AzJson account get-access-token --resource-type arm --output json | Out-Null
$repositoryName = "$Owner/$Repository"
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Sign in with gh and grant repository administration access first.' }
$repoMetadataJson = gh api "repos/$repositoryName" --jq '{id:.id,owner_id:.owner.id}'
if ($LASTEXITCODE -ne 0) { throw "Cannot read GitHub repository identity for $repositoryName." }
$repoMetadata = $repoMetadataJson | ConvertFrom-Json

$groupId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
$acr = Invoke-AzJson acr show --name $RegistryName --resource-group $ResourceGroup --subscription $SubscriptionId --output json
$pullIdentity = Invoke-AzJson identity show --name ghcp-guide-pull --resource-group $ResourceGroup --subscription $SubscriptionId --output json
if (-not $pullIdentity.principalId) { throw 'The app image-pull identity has no principal.' }
Invoke-AzJson group create --name $IdentityResourceGroup --location $Location --subscription $SubscriptionId --output json | Out-Null
$deployer = Invoke-AzJson identity create --name ghcp-gha-deployer --resource-group $IdentityResourceGroup --location $Location --subscription $SubscriptionId --output json
$federatedName = 'github-azure-demo'
$subject = "repo:$Owner@$($repoMetadata.owner_id)/$Repository@$($repoMetadata.id):environment:azure-demo"
$credentials = Invoke-AzJson identity federated-credential list --identity-name ghcp-gha-deployer --resource-group $IdentityResourceGroup --subscription $SubscriptionId --output json
$credential = $credentials | Where-Object { $_.name -eq $federatedName } | Select-Object -First 1
if ($credential -and ($credential.issuer -ne 'https://token.actions.githubusercontent.com' -or $credential.subject -ne $subject -or $credential.audiences -notcontains 'api://AzureADTokenExchange')) {
    Invoke-AzJson identity federated-credential update --name $federatedName --identity-name ghcp-gha-deployer --resource-group $IdentityResourceGroup --subscription $SubscriptionId --issuer 'https://token.actions.githubusercontent.com' --subject $subject --audiences api://AzureADTokenExchange --output json | Out-Null
} elseif (-not $credential) {
    Invoke-AzJson identity federated-credential create --name $federatedName --identity-name ghcp-gha-deployer --resource-group $IdentityResourceGroup --subscription $SubscriptionId --issuer 'https://token.actions.githubusercontent.com' --subject $subject --audiences api://AzureADTokenExchange --output json | Out-Null
}

$acrId = $acr.id
Ensure-RoleAssignment -PrincipalId $deployer.principalId -Role 'Contributor' -Scope $groupId
Ensure-RoleAssignment -PrincipalId $deployer.principalId -Role 'AcrPush' -Scope $acrId
Ensure-RoleAssignment -PrincipalId $deployer.principalId -Role 'Managed Identity Operator' -Scope $pullIdentity.id

$environment = gh api --method PUT "repos/$repositoryName/environments/azure-demo" --field 'deployment_branch_policy[protected_branches]=false' --field 'deployment_branch_policy[custom_branch_policies]=true'
if ($LASTEXITCODE -ne 0) { throw 'Could not create the azure-demo GitHub environment.' }
$policies = gh api "repos/$repositoryName/environments/azure-demo/deployment-branch-policies"
if ($LASTEXITCODE -ne 0) { throw 'Could not read the environment branch policy.' }
$branchPolicies = $policies | ConvertFrom-Json
if (-not ($branchPolicies.branch_policies | Where-Object { $_.name -eq 'main' -and $_.type -eq 'branch' })) {
    gh api --method POST "repos/$repositoryName/environments/azure-demo/deployment-branch-policies" --raw-field name=main --raw-field type=branch | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict azure-demo to main.' }
}

$variables = @{
    AZURE_CLIENT_ID = $deployer.clientId
    AZURE_TENANT_ID = $account.tenantId
    AZURE_SUBSCRIPTION_ID = $SubscriptionId
    AZURE_RESOURCE_GROUP = $ResourceGroup
    AZURE_ACR_NAME = $RegistryName
    AZURE_CONTAINER_APP = $ContainerApp
}
foreach ($name in $variables.Keys) {
    gh variable set $name --repo $repositoryName --env azure-demo --body $variables[$name]
    if ($LASTEXITCODE -ne 0) { throw "Could not set the non-secret Actions variable $name." }
}

Write-Output "Configured GitHub OIDC deployment for $repositoryName on refs/heads/main."
Write-Output "Deployment identity: $($deployer.id)"
Write-Output "The app identity remains separate: $($pullIdentity.id)"
Write-Output 'No Azure client secret or registry password was created.'
