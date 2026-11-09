# Azure deployment automation

The `Deploy companion guide to Azure` GitHub Actions workflow rebuilds, tests, captures the walkthrough, pushes an immutable image, updates the existing Azure Container App, and verifies its health. It runs only when manually dispatched on `main`; pull requests never deploy. Manual dispatch avoids provisioning billable infrastructure on every code push. The Azure app scales to zero, but Azure Container Registry Basic incurs an ongoing charge.

## One-time OIDC bootstrap

The workflow uses short-lived GitHub OIDC tokens, not saved Azure passwords. The CI identity is separate from the app's image-pull identity and lives in a separate resource group. Sign in as an Azure administrator who can create role assignments, select the exact existing subscription, and authenticate `gh` with permission to administer this repository's GitHub Actions variables and environment:

```powershell
az login
az account set --subscription 439cf6ec-8907-40ee-bae2-7efd9656cd09
gh auth login --hostname github.com
.\scripts\setup-azure-auth-for-pipeline.ps1 `
  -SubscriptionId 439cf6ec-8907-40ee-bae2-7efd9656cd09 `
  -ExpectedAccount YOUR_AZURE_LOGIN
```

The script verifies the signed-in account and subscription, creates the CI user-assigned managed identity in `rg-ghes-ghcp-cli-identity`, and pins its federated credential to the repository's `azure-demo` environment. It grants only `Contributor` within the dedicated demo resource group, `AcrPush` at the single demo registry, and `Managed Identity Operator` on the existing app-pull identity. The runtime `ghcp-guide-pull` identity retains only `AcrPull`. GitHub receives non-secret OIDC identifiers as environment variables; **no client secret or registry password is stored**. The GitHub environment is restricted to `main`.

The `azure-demo` workflow environment is the explicit deployment gate. Trigger the `Deploy companion guide to Azure` workflow from `main` under **Actions**. Review the run and its published Environment URL. Azure resource creation, image push and deployment are limited to the named dedicated demo resources.

## Verify and clean up

After a workflow succeeds, verify the URL, `/healthz`, image tag, and revision shown in its logs. Verify Pages separately at `https://ibranibeny.github.io/GHES-GHCP-CLI/`. The Azure application hosts the same documented, non-production companion guide; it is not a GHES instance.

To disable recurring deploy access, delete only the `github-azure-demo` federated credential or remove the `ghcp-gha-deployer` role assignments. To tear down the demo itself, inspect both dedicated resource groups before deleting them; deleting `rg-ghes-ghcp-cli` removes the Azure guide, ACR, app identity, and Container Apps resources. **Do not remove the identity resource group until the workflow federation is no longer needed.** Keep Azure's confirmation prompt when deleting resources.

## Permissions and troubleshooting

Azure deployment preparation and tests use the explicitly selected subscription and `southeastasia`. Azure MCP policy/quota lookup was denied because its connected principal differs from the verified Azure CLI identity; the Container Apps quota lookup also returned unavailable quota data. The existing app, environment and registry provisioning have been verified through Azure CLI. Do not select another subscription to bypass the connector limitation.

If GitHub Actions login fails, confirm that the federated credential subject exactly matches `repo:ibranibeny/GHES-GHCP-CLI:environment:azure-demo`, that the selected workflow runs on `main`, and that its environment variables match the same tenant and subscription. If registry login fails, check the deployer's `AcrPush` assignment. If Container Apps cannot pull the image, check the distinct app identity's `AcrPull` assignment and its registry configuration. Never replace workload identity with a committed password.
