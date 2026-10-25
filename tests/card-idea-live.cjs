// Explicit delivery test: sends one labelled test message to the configured channel.
// Run manually with node tests/card-idea-live.cjs; excluded from the normal test suite.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:393,height:780}});
    await page.route('https://**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'discord.com') return route.continue();
      if (url.hostname !== 'jutumasin.com') return route.abort();
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'text/plain',body:fs.readFileSync(file)});
    });
    await page.goto('https://jutumasin.com/');
    await page.locator('#aboutBtn').click();
    await page.locator('.cardIdea summary').click();
    const text = `DELIVERY TEST ${new Date().toISOString()} — Jutumasin card-idea form verification. This is a test, not a card suggestion.`;
    await page.locator('#ideaType').selectOption('Party');
    await page.locator('#ideaText').fill(text);
    const received = page.waitForResponse(response => response.url().startsWith('https://discord.com/api/webhooks/') && response.request().method() === 'POST');
    await page.locator('#ideaSend').click();
    const response = await received;
    assert.equal(response.status(), 200, 'Discord must confirm a saved message');
    const message = await response.json();
    assert(message.id && message.channel_id, 'Discord must return a saved message ID and channel');
    assert(message.content.includes('DELIVERY TEST'));
    assert(message.content.endsWith('Nickname: (anonymous)\nPublish nickname with card: NO'));
    assert.equal(message.attachments.length, 0);
    assert.equal(message.embeds.length, 0);
    assert.equal(message.mention_everyone, false);
    await page.waitForFunction(() => document.getElementById('ideaStatus').dataset.i18n === 'ideaSuccess');
    assert.equal(await page.locator('#ideaText').inputValue(), '');
    console.log(`PASS: real browser form delivered one text-only test message; Discord confirmed message ${message.id}.`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error.message);process.exitCode=1;});
