const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 async function setup({width=1366,height=900,native=false,block=false}={}){
  const page=await browser.newPage({viewport:{width,height}});let loads=0;
  if(native)await page.addInitScript(()=>{window.AndroidApp={};});
  await page.route('https://jutumasin.com/**',route=>{
   let name=new URL(route.request().url()).pathname;if(name==='/')name='/index.html';
   const file=path.resolve(root,'.'+name);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
  });
  await page.route('https://pagead2.googlesyndication.com/**',route=>{
   loads++;if(block)return route.abort();
   return route.fulfill({contentType:'text/javascript',body:`window.adRequests=0;window.breaks=[];window.adsbygoogle.push=o=>{if(o.onReady)window.gameConfig=o;else if(o.type)window.breaks.push(o);else window.adRequests++;};window.googlefc.showRevocationMessage=()=>{window.revoked=true;};`});
  });
  await page.goto('https://jutumasin.com/');return {page,loads:()=>loads};
 }
 async function consent(page){await page.evaluate(()=>googlefc.callbackQueue.forEach(o=>{o.CONSENT_API_READY?.();o.CONSENT_DATA_READY?.();}));}
 const {page,loads}=await setup();
 assert.equal(loads(),1);assert.equal(await page.evaluate(()=>adRequests),0);
 const menuHeight=await page.locator('#menuScreen').evaluate(n=>n.scrollHeight);
 await consent(page);assert.equal(await page.evaluate(()=>adRequests),1,'one right-side placement only');
 assert.equal(await page.locator('.webAd').count(),1);
 const ad=page.locator('#webAd ins');
 assert.equal(await ad.getAttribute('data-ad-slot'),'2178160769');
 assert.equal(await ad.getAttribute('data-ad-client'),'ca-pub-4965975361805360');
 assert(await page.locator('#webAd').isHidden(),'unfilled/pending slot and label remain invisible');
 await ad.evaluate(n=>n.dataset.adStatus='filled');
 await page.waitForFunction(()=>document.querySelector('#webAd').classList.contains('isFilled'));
 assert(await page.locator('#webAd').isVisible());
 assert.equal(await page.locator('#menuScreen').evaluate(n=>n.scrollHeight),menuHeight,'ad never increases menu scroll height');
 for(const [width,height] of [[1000,600],[1212,1000],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});
  const bounds=await page.locator('#webAd').boundingBox();const app=await page.locator('.app').boundingBox();
  assert(bounds.x>=app.x+app.width+20,'ad is to the right with a gap');
  assert(bounds.x+bounds.width<=width && bounds.y>=0 && bounds.y+bounds.height<=height,'rail fits viewport');
  assert.equal(await page.evaluate(()=>adRequests),1,'resizing never refreshes ads');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.screenshot({path:path.join(root,'test-results/side-ad-desktop.png')});
 await page.getByRole('heading',{name:'Dating',exact:true}).click();
 assert(await page.locator('#webAd').isVisible(),'desktop rail stays outside gameplay');
 await page.locator('#btnMenu').click();
 await ad.evaluate(n=>n.dataset.adStatus='unfilled');
 await page.waitForFunction(()=>document.querySelector('#webAd').hidden);
 await page.locator('#aboutBtn').click();await page.locator('#webPrivacyOptions').click();
 await page.evaluate(()=>googlefc.callbackQueue.forEach(o=>o.CONSENT_API_READY?.()));
 assert(await page.evaluate(()=>revoked));assert.equal(await page.locator('#webAd ins').count(),0);
 await consent(page);await page.locator('#btnMenu').click();assert.equal(await page.evaluate(()=>adRequests),1);
 await page.goto('https://jutumasin.com/privacy.html');assert.equal(loads(),1);assert.equal(await page.locator('script').count(),0);
 await page.close();
 const mobile=await setup({width:393,height:780});await consent(mobile.page);
 assert.equal(await mobile.page.evaluate(()=>adRequests),0,'mobile has no banner or side ad');
 assert(await mobile.page.locator('#webAd').isHidden());
 await mobile.page.evaluate(()=>gameConfig.onReady());
 await mobile.page.getByRole('heading',{name:'Dating',exact:true}).click();
 await mobile.page.evaluate(()=>showAdCard());
 assert.equal(await mobile.page.evaluate(()=>breaks.length),1);
 await mobile.page.evaluate(()=>breaks[0].adBreakDone({breakStatus:'noAdPreloaded'}));
 assert.equal(await mobile.page.evaluate(()=>webBreakActive),false,'no-fill leaves game playable');
 await mobile.page.evaluate(()=>{showAdCard();breaks[1].beforeAd();});
 assert(await mobile.page.locator('#btnNext').isDisabled());
 const index=await mobile.page.evaluate(()=>State.index);
 await mobile.page.evaluate(()=>{completeCard(document.querySelector('#deck .swipeCard:last-child'),false);showScreen('menu');});
 assert.equal(await mobile.page.evaluate(()=>State.index),index);assert.equal(await mobile.page.evaluate(()=>State.viewMode),'game');
 await mobile.page.evaluate(()=>{breaks[1].afterAd();breaks[1].adBreakDone({breakStatus:'viewed'});});
 assert(await mobile.page.locator('#btnNext').isEnabled());
 await mobile.page.screenshot({path:path.join(root,'test-results/no-banner-phone.png')});
 await mobile.page.setViewportSize({width:1366,height:900});await mobile.page.waitForFunction(()=>adRequests===1);
 await mobile.page.close();
 for(const options of [{native:true},{block:true}]){
  const p=await setup(options);assert.equal(p.loads(),options.native?0:1);
  assert(await p.page.locator('#webAd').isHidden());
  await p.page.getByRole('heading',{name:'Dating',exact:true}).click();assert(await p.page.locator('#gameScreen').isVisible());await p.page.close();
 }
 console.log('PASS: one bounded right rail, no menu scroll added, 4 desktop widths, pending/no-fill/blocked collapse, consent gating, no refresh, mobile game ads/no banner, no-fill and pause/resume, Android isolation. Google is mocked; no live ad traffic.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
