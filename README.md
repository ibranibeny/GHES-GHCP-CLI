# GHES + GitHub Copilot CLI demo

[Step-by-step guide](https://ibranibeny.github.io/GHES-GHCP-CLI/) with six screenshots and a silent, captioned walkthrough video, generated automatically by GitHub Actions.

**This is a companion demo, not GitHub Enterprise Server in Docker.** GHES is a licensed VM appliance. Docker hosts this educational guide and an isolated Copilot CLI client. The review UI is an explicitly labeled illustration, not a native GHES pull request review. The public guide has no credentials and no live AI execution endpoint.

## Quick start

```powershell
git clone https://github.com/ibranibeny/GHES-GHCP-CLI.git
cd GHES-GHCP-CLI
docker compose up --build -d guide
# Open http://localhost:8080
docker compose --profile review run --rm review
```

In the CLI container, authenticate using `/login` to your licensed GitHub.com or GHE.com account. Ask it to review `totalBeforeReview` in `pricing.mjs`: a 10% discount on 2 x 100 must equal 180. Request findings and a test without editing or running commands. Container authentication is intentionally erased when it exits.

Use `gh auth login --hostname YOUR_GHES_HOST` separately for GHES Git operations. Only send synthetic or organization-approved source to Copilot. A GHES credential is not a cloud Copilot credential. Do not mount credentials, your entire home directory, or the Docker socket.

## Verify and regenerate visuals

Node.js 22+ is sufficient for the companion app without Docker:

```powershell
npm ci
npm test
npx playwright install chromium
npm run capture
npm start
```

With an authenticated host Copilot CLI, `npm run review` captures a real response to only the inline synthetic pricing function. All tools are filtered out; shell execution and file editing are denied. The captured report is published separately from the illustrative UI and contains no GHES credentials or private repository source.

The capture script renders the actual guide, clicks all six steps, creates six PNG screenshots and a WebM recording, and checks mobile navigation. Visuals show the guide itself, not Azure Portal, a live CLI review, or a real GHES appliance. Generated visuals are not committed; Pages regenerates them on every push. The transcript and caption track are included.

## Automated Azure deployment

See [.azure/pipeline-setup.md](.azure/pipeline-setup.md) for one-time passwordless OIDC setup and the guided release. The `Deploy companion guide to Azure` workflow runs manually on `main`; it tests and records the guide, pushes a versioned Docker image, updates Azure Container Apps, and checks `/healthz`. Azure login uses a user-assigned managed identity and GitHub OIDC, not saved passwords. The separate runtime image-pull identity has only `AcrPull`.

```powershell
az login
az account set --subscription YOUR_SUBSCRIPTION_ID
.\scripts\setup-azure-auth-for-pipeline.ps1 -SubscriptionId YOUR_SUBSCRIPTION_ID -ExpectedAccount YOUR_AZURE_LOGIN
```

The setup script requires Azure role-assignment privileges and GitHub repository Actions/environment administration access. It creates the deployment identity in a separate resource group and restricts GitHub OIDC to the `main` branch's `azure-demo` environment. The Azure release uses the already-provisioned resources in the exact dedicated resource group. No saved Azure secret is required.

ACR Basic has ongoing charges; Container Apps may incur request and compute charges. The Azure workflow is manual to avoid deployments and costs on every code push. This is a public educational guide, not a production architecture.

To remove the Azure demo, inspect the resource group first, then run `az group delete --name rg-ghes-ghcp-cli --subscription YOUR_SUBSCRIPTION_ID`. Keep the confirmation prompt. To stop local demo containers, run `docker compose down`.

## GitHub Pages automation

Enable Pages with **GitHub Actions** as the source. On every push to `main`, `.github/workflows/pages.yml` runs tests, generates the screenshots/video, and deploys `site/`. No Copilot token or Azure secret is needed by this workflow. Real CLI outputs are optional, manually generated from synthetic input and explicitly separate from illustrative findings.

## Real GHES prerequisites

Follow the [official GHES on Azure instructions](https://docs.github.com/en/enterprise-server@latest/admin/installing-your-enterprise-server/setting-up-a-github-enterprise-server-instance/installing-github-enterprise-server-on-azure). A trial/demo currently requires at least 4 x86-64 vCPUs, 32 GB RAM, a 400 GB root disk and 500 GB persistent data disk, plus a GitHub Enterprise license file, hostname, TLS and administrator setup. This repository does not provision an unlicensed appliance or claim one is running.

See [Copilot on GHES](https://docs.github.com/en/enterprise-server@latest/copilot/copilot-on-ghes/about-copilot-on-ghes) and [Copilot CLI usage](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview) for licensing, connectivity and product support. Native PR code review is distinct from a local CLI review.
