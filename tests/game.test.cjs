const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if(!file.startsWith(root + path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel: 'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:393,height:780},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.adCalls=[];
      window.AndroidApp={showAd:(...args)=>window.adCalls.push(args),dismissAd:()=>{},resizeAd:()=>{},privacyOptions:()=>{}};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.getByRole('heading',{name:'Dating',exact:true}).click();
    const advance = async()=>{await page.locator('#btnNext').click(); await page.waitForTimeout(250);};
    await advance();await advance();
    assert.equal(await page.evaluate(()=>adCalls.length),0);
    await advance();
    assert.equal(await page.evaluate(()=>adCalls.length),1);
    assert.equal(await page.locator('#progress').textContent(),'Reklaam');
    assert.equal(await page.evaluate(()=>State.histories.Dating.length),3);
    await advance(); // Continue ad without consuming a question.
    assert.equal(await page.evaluate(()=>State.index),3);
    for(let i=0;i<4;i++) await advance();
    assert.equal(await page.evaluate(()=>adCalls.length),2);
    await page.evaluate(()=>onNativeAdFinished(adCalls[0][0]));
    assert.equal(await page.evaluate(()=>adActive),true,'stale callback must not dismiss current ad');
    await page.evaluate(()=>onNativeAdFinished(adCalls[1][0]));
    assert.equal(await page.evaluate(()=>adActive),false);
    await page.locator('#btnBack').click();await advance();
    assert.equal(await page.evaluate(()=>adCalls.length),2,'revisited question is not counted twice');
    await page.evaluate(()=>{document.getElementById('btnNext').click();document.getElementById('btnNext').click();});
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>State.index),8,'rapid taps must only consume one question');
    await page.evaluate(()=>{document.getElementById('btnNext').click();document.getElementById('btnMenu').click();});
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>State.index),8,'menu cancels pending transition');
    await page.reload();
    assert.equal(await page.evaluate(()=>State.viewMode),'game','unfinished game opens automatically');
    await page.locator('.swipeCard:last-child .starBtn').dispatchEvent('pointerup');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>State.bests.Dating.length),1);
    await page.reload();
    assert.equal(await page.evaluate(()=>State.index),9);
    assert.equal(await page.evaluate(()=>State.bests.Dating.length),1);
    assert.equal(await page.evaluate(()=>State.viewMode),'game','unfinished game resumes without a menu tile');
    await advance();
    assert.equal(await page.evaluate(()=>adCalls.length),1,'persisted cadence triggers next slot');
    await page.locator('#btnMenu').click();
    await page.getByRole('heading',{name:'Parimad',exact:true}).click();
    assert.equal(await page.evaluate(()=>adActive),false);
    assert.equal(await page.locator('#bestPos').textContent(),'1');
    await page.evaluate(()=>{showScreen('menu');buildMenu();startMixedGame();});
    assert.equal(await page.evaluate(()=>State.cards.length),await page.evaluate(()=>Object.values(DECKS2).reduce((sum,deck)=>sum+deck.length,0)));
    await page.evaluate(()=>{State.index=State.cards.length-1;renderStack();});
    await advance();
    assert.equal(await page.evaluate(()=>State.viewMode),'menu','last question finishes game');
    await page.setViewportSize({width:320,height:568});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await page.getByRole('heading',{name:'Party',exact:true}).click();
    await page.screenshot({path:path.join(root,'test-results','phone.png')});
    await page.setViewportSize({width:780,height:393});
    assert.equal(await page.locator('#btnNext').isVisible(),true);
    await page.screenshot({path:path.join(root,'test-results','landscape.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: cadence, ad dismiss/no-fill callback, stale callbacks, backtracking, rapid taps, menu cancellation, favourites, restart, MIX, last card, phone and landscape.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
