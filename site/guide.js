const steps = [
  {
    title: 'Check prerequisites and choose your target',
    description: 'You need Git, Docker with Linux containers, Node.js 22+, Azure CLI, and a licensed cloud Copilot account. The public guide has no credentials and never runs your commands.',
    command: 'git --version\ndocker version\nnode --version\naz account show --output table\ncopilot --version',
    expected: 'Each installed tool reports a version; Azure shows your intended account and subscription.',
    caution: 'A real GHES appliance additionally requires a GitHub Enterprise license. Do not provision an expensive VM until that prerequisite is available.'
  },
  {
    title: 'Start the companion guide in Docker',
    description: 'Clone the repository and start the read-only guide container. It binds only to loopback on your workstation. Docker runs the guide and the CLI, not GHES.',
    command: 'git clone https://github.com/ibranibeny/GHES-GHCP-CLI.git\ncd GHES-GHCP-CLI\ndocker compose up --build -d guide\n# Open http://localhost:8080\ndocker compose ps',
    expected: 'The guide service is healthy on port 8080. You can open this same walkthrough locally.',
    caution: 'To stop only these demo containers: docker compose down. Never mount the Docker socket or your entire home directory into the review container.'
  },
  {
    title: 'Authenticate Git and Copilot separately',
    description: 'GHES Git access and cloud Copilot access are separate. Replace GHES_HOST with your real server; omit the GHES commands if you only have this public demo.',
    command: 'gh auth login --hostname GHES_HOST\n# Clone your approved GHES repository using its Git URL.\n# For the synthetic exercise, launch the isolated CLI:\ndocker compose --profile review run --rm review\n# In the Copilot session: /login',
    expected: 'GitHub CLI can reach your GHES host. Copilot authenticates to your licensed GitHub.com or GHE.com account.',
    caution: 'Container login state is erased on exit. Do not store secrets in images, browser code, recordings, Git commits, or public Actions artifacts.'
  },
  {
    title: 'Ask for a review, not an automatic change',
    description: 'Inside the CLI session, ask for a bounded review of the synthetic pricing exercise. The public site shows an authored example; real Copilot findings vary.',
    command: 'Review totalBeforeReview in pricing.mjs.\nThe requirement is a percentage discount:\n100 x 2 with 10% off must equal 180.\nIdentify the defect and propose a minimal fix and test.\nDo not edit files, run commands, or post comments.',
    expected: 'A finding explains that discountPercent was subtracted as a currency amount instead of applied as a percentage.',
    caution: 'Use only synthetic or organization-approved source. Review proposed changes yourself. A local CLI review does not automatically create a GHES PR review comment.'
  },
  {
    title: 'Verify the corrected calculation',
    description: 'The repository includes before/after implementations and regression tests. The tests demonstrate the original incorrect value as well as the corrected behavior.',
    command: '# On the host, from the repository folder:\nnpm ci\nnpm test\n# Original example: 190\n# Corrected example: 180\n# Also covers invalid inputs and discount boundaries.',
    expected: 'Tests pass and verify the exact expected total: 180 for a 10% discount on a subtotal of 200.',
    caution: 'This minimal example is not a production billing engine. Human approval and appropriate business tests are still required.'
  },
  {
    title: 'Deploy Azure and publish GitHub Pages',
    description: 'The Azure script builds the Docker image in ACR and uses a managed identity to pull it into Container Apps. The Pages workflow separately generates fresh screenshots and a captioned guide recording on every push to main.',
    command: '# PowerShell: select your authorized subscription first.\naz login\naz account set --subscription YOUR_SUBSCRIPTION_ID\n.\\scripts\\deploy-azure.ps1 -SubscriptionId YOUR_SUBSCRIPTION_ID -ExpectedAccount YOUR_AZURE_LOGIN\n# Watch the Pages workflow:\ngh run list --repo ibranibeny/GHES-GHCP-CLI\n# Pages: https://ibranibeny.github.io/GHES-GHCP-CLI/',
    expected: 'Azure reports a healthy HTTPS guide URL; the Pages deployment publishes the guide, six screenshots, video, and captions.',
    caution: 'ACR and Azure compute can incur costs. This publishes the companion guide only; real GHES licensing, appliance setup, and cloud Copilot authentication are not automated away.'
  }
];

let current = 0;
function showStep(index) {
  current = index;
  const step = steps[index];
  document.getElementById('step-label').textContent = `STEP ${String(index + 1).padStart(2, '0')} / 06`;
  document.getElementById('step-title').textContent = step.title;
  document.getElementById('step-description').textContent = step.description;
  document.getElementById('step-command').textContent = step.command;
  document.getElementById('step-expected').textContent = step.expected;
  document.getElementById('step-caution').textContent = step.caution;
  document.getElementById('step-counter').textContent = `${index + 1} of ${steps.length}`;
  document.getElementById('previous').disabled = index === 0;
  document.getElementById('next').disabled = index === steps.length - 1;
  document.querySelectorAll('[data-step]').forEach(button => {
    if (Number(button.dataset.step) === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.step))));
document.getElementById('previous').addEventListener('click', () => showStep(current - 1));
document.getElementById('next').addEventListener('click', () => showStep(current + 1));
showStep(0);

fetch('media/review.txt').then(async response => {
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`Review report request failed: ${response.status}`);
  const report = await response.text();
  if (!report.trim()) throw new Error('Review report is empty');
  const status = document.getElementById('report-status');
  status.textContent = 'Actual CLI response to the synthetic exercise: ';
  const link = document.createElement('a');
  link.href = 'media/review.txt';
  link.textContent = 'Read the captured report';
  status.append(link);
}).catch(error => {
  console.error(error);
  document.getElementById('report-status').textContent = `Actual CLI report unavailable: ${error.message}`;
});
