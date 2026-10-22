const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:360,height:740}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    const requests = [];
    let mode = 'success';
    let release;
    await page.route('https://discord.com/api/webhooks/**', async route => {
      requests.push(route.request().postDataJSON());
      assert.equal(route.request().method(), 'POST');
      assert.equal(route.request().headers()['content-type'], 'application/json');
      assert(route.request().url().endsWith('?wait=true'));
      if (mode === 'offline') return route.abort();
      if (mode === 'pending') await new Promise(resolve => { release = resolve; });
      const status = mode === 'rate' ? 429 : mode === 'error' ? 500 : 200;
      await route.fulfill({status, contentType:'application/json', body:status === 429 ? '{"retry_after":0.1}' : '{}'});
    });
    const open = async () => {
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
      await page.locator('#aboutBtn').click();
      await page.locator('.cardIdea summary').click();
    };
    const submit = () => page.locator('#cardIdeaForm').evaluate(form => form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true})));
    const status = key => page.waitForFunction(key => document.getElementById('ideaStatus').dataset.i18n === key, key);
    await open();
    assert.equal(await page.locator('#cardIdeaForm').evaluate(el => getComputedStyle(el).display), 'grid');
    assert.equal(await page.locator('#ideaText').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(33, 22, 34)');
    assert.equal(await page.locator('#ideaType').evaluate(el => getComputedStyle(el).colorScheme), 'dark');
    assert.equal(await page.locator('#aboutScreen a[href*="github.com"]').count(), 0);
    const version = page.locator('#aboutScreen [data-app-version]');
    assert.equal(await version.textContent(), await page.evaluate(() => I18n.t('version', APP_VERSION)));
    const versionBox = await version.boundingBox();
    const controlsBox = await page.locator('#controls').boundingBox();
    assert(versionBox.y >= 0 && versionBox.y + versionBox.height <= controlsBox.y);
    assert(await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(nodes => nodes.every(node => /\?v=[a-f0-9]{12}$/.test(node.getAttribute('src') || node.getAttribute('href')))));
    const input = page.locator('#ideaText');
    for (const text of ['   ', 'a'.repeat(361), 'bad\u0001text', 'bad\u202etext']) {
      await input.fill(text); await submit(); await status('ideaInvalid');
    }
    assert.equal(requests.length, 0);
    await input.fill('x'.repeat(360));
    await page.locator('#ideaType').evaluate(el => el.add(new Option('Injected', 'Injected')));
    await page.locator('#ideaType').selectOption('Injected');
    await submit(); assert.equal(requests.length, 0);
    await page.locator('#ideaType').selectOption('Party');
    await submit(); await status('ideaSuccess');
    assert.equal(requests[0].content, 'Jutumasin · Party\n' + 'x'.repeat(360));
    assert.equal(await input.inputValue(), '');
    await input.fill('Another idea'); await submit(); await status('ideaWait');
    assert.equal(requests.length, 1);
    await open();
    const attack = '<script>alert(1)</script> @everyone <@123> {"embeds":[{"url":"https://example.com"}]} ``` **bold**';
    await input.fill(attack); mode = 'pending'; await submit();
    await page.waitForFunction(() => document.getElementById('ideaSend').disabled);
    await submit();
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(requests.length, 2);
    release(); await status('ideaSuccess');
    const payload = requests.at(-1);
    assert.deepEqual(Object.keys(payload).sort(), ['allowed_mentions','content','flags','tts']);
    assert.deepEqual(payload.allowed_mentions, {parse:[]});
    assert.equal(payload.flags, 4); assert.equal(payload.tts, false);
    assert(payload.content.includes('\\<script\\>'));
    assert.equal(await page.locator('#cardIdeaForm script').count(), 0);
    await open(); mode = 'error'; await input.fill('Keep this draft');
    await submit(); await status('ideaError');
    assert.equal(await input.inputValue(), 'Keep this draft');
    assert.equal(await page.locator('#ideaSend').isEnabled(), true);
    mode = 'offline'; await submit(); await status('ideaError');
    await page.waitForFunction(() => !document.getElementById('ideaSend').disabled);
    assert.equal(await input.inputValue(), 'Keep this draft');
    mode = 'rate'; await submit(); await status('ideaWait');
    await page.waitForTimeout(150); mode = 'success';
    await input.fill('😀'.repeat(360));
    assert.equal(await page.locator('#ideaCount').textContent(), '360 / 360');
    await submit(); await status('ideaSuccess');
    await page.locator('#languageToggle').click();
    assert.equal(await page.locator('.cardIdea summary').textContent(), 'Send your card idea');
    assert.equal(await page.locator('#ideaStatus').textContent(), 'Thank you! Your card idea has been sent.');
    await page.screenshot({path:path.join(root,'test-results/card-idea-mobile.png'),fullPage:true});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('Card idea: validation, Unicode limit, safe JSON, cooldown, duplicate prevention, errors and translations passed.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
