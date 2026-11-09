import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideServer } from '../server.mjs';

test('guide, health endpoint, assets, errors and method restrictions', async () => {
  const server = createGuideServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /GHES \+ Copilot CLI/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: 'ok', mode: 'educational-demo' });
    assert.match((await fetch(`${base}/style.css`)).headers.get('content-type'), /text\/css/);
    assert.equal((await fetch(`${base}/not-found`)).status, 404);
    assert.equal((await fetch(`${base}/%ZZ`)).status, 400);
    assert.equal((await fetch(`${base}/..%5Cpackage.json`)).status, process.platform === 'win32' ? 403 : 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal(await (await fetch(base, { method: 'HEAD' })).text(), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
