import { chromium } from 'playwright';
import { mkdir, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createGuideServer } from '../server.mjs';

const media = resolve('site/media');
await mkdir(media, { recursive: true });
const server = createGuideServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    reducedMotion: 'reduce',
    recordVideo: { dir: resolve('artifacts/video'), size: { width: 1366, height: 900 } }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#walkthrough').scrollIntoViewIfNeeded();
  for (let index = 0; index < 6; index++) {
    await page.locator(`[data-step="${index}"]`).click();
    await page.locator('#step-label').waitFor();
    assert.match(await page.locator('#step-label').innerText(), new RegExp(`STEP 0${index + 1}`));
    await page.locator('#walkthrough').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(media, `step-${index + 1}.png`) });
    await page.waitForTimeout(4000);
  }
  const video = page.video();
  await context.close();
  await rename(await video.path(), resolve(media, 'walkthrough.webm'));
  assert.ok((await stat(resolve(media, 'walkthrough.webm'))).size > 10000);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await mobile.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout must not overflow');
  await mobile.locator('[data-step="3"]').click();
  assert.match(await mobile.locator('#step-title').innerText(), /review/);
  await mobile.screenshot({ path: resolve('artifacts/mobile.png'), fullPage: true });
  await mobile.close();
  assert.deepEqual(errors, [], 'Browser must not have uncaught errors');
  console.log('Captured six guide screenshots, a screen recording, and verified mobile navigation.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
