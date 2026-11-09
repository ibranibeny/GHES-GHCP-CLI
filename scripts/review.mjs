import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const prompt = 'Review only this synthetic JavaScript function: function totalBeforeReview(price, quantity, discountPercent) { return price * quantity - discountPercent; }. Requirement: percentage discount; (100, 2, 10) must return 180. Identify the correctness bug, propose a minimal fix, and a regression test. Do not use tools, read files, edit files, run commands, access accounts, or post comments. Return just your code review.';
const result = spawnSync('copilot', [
  '--trust-folder', '--no-ask-user', '--available-tools',
  '--deny-tool', 'shell', 'write', '--silent', '--prompt', prompt
], { encoding: 'utf8', timeout: 120000 });
if (result.error) throw result.error;
if (result.status !== 0 || !result.stdout.trim()) {
  throw new Error(`Copilot review failed (${result.status}): ${result.stderr}`);
}
await writeFile(new URL('../site/media/review.txt', import.meta.url), `${result.stdout.trim()}\n`);
console.log('Captured a real, tool-free CLI response to the synthetic exercise.');
