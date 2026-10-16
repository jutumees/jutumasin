const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  async function setup(native=false,block=false){
   const page=await browser.newPage({viewport:{width:393,height:780}});
   let loads=0;
   if(native)await page.addInitScript(()=>{window.AndroidApp={};});
   await page.route('https://jutumasin.com/**',route=>{
    let name=new URL(route.request().url()).pathname;
    if(name==='/')name='/index.html';
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
   });
   await page.route('https://pagead2.googlesyndication.com/**',route=>{
    loads++;
    if(block)return route.abort();
    return route.fulfill({contentType:'text/javascript',body:`window.adRequests=0;window.adsbygoogle.push=()=>{window.adRequests++;};window.googlefc.showRevocationMessage=()=>{window.revoked=true;};`});
   });
   await page.goto('https://jutumasin.com/');
   return {page,loads:()=>loads};
  }
  const {page,loads}=await setup();
  assert.equal(loads(),1);
  assert.equal(await page.evaluate(()=>adRequests),0,'no ad request before CMP data');
  assert(await page.locator('#webAd').isHidden());
  await page.evaluate(()=>googlefc.callbackQueue.forEach(item=>item.CONSENT_API_READY?.()));
  await page.locator('#aboutBtn').click();
  await page.locator('#webPrivacyOptions').click();
  await page.evaluate(()=>googlefc.callbackQueue.forEach(item=>item.CONSENT_API_READY?.()));
  assert(await page.evaluate(()=>revoked));
  await page.evaluate(()=>googlefc.callbackQueue.forEach(item=>item.CONSENT_DATA_READY?.()));
  assert.equal(await page.evaluate(()=>adRequests),0,'wait for visible menu to size ad');
  await page.locator('#btnMenu').click();
  await page.waitForFunction(()=>adRequests===1);
  const ad=page.locator('#webAd ins');
  assert.equal(await ad.getAttribute('data-ad-client'),'ca-pub-4965975361805360');
  assert.equal(await ad.getAttribute('data-ad-slot'),'2178160769');
  await page.locator('#languageToggle').click();
  await page.getByRole('heading',{name:'Dating',exact:true}).click();
  assert(await page.locator('#webAd').isHidden());
  await page.locator('#btnMenu').click();
  assert.equal(await page.evaluate(()=>adRequests),1,'no automatic refresh on navigation/language');
  await ad.evaluate(node=>node.dataset.adStatus='unfilled');
  await page.waitForFunction(()=>document.getElementById('webAd').hidden);
  await page.locator('#aboutBtn').click();
  await page.locator('#webPrivacyOptions').click();
  assert.equal(await page.locator('#webAd ins').count(),0,'existing ad is removed when reviewing consent');
  await page.evaluate(()=>googlefc.callbackQueue.forEach(item=>item.CONSENT_DATA_READY?.()));
  await page.locator('#btnMenu').click();
  assert.equal(await page.evaluate(()=>adRequests),1,'consent review does not refresh the ad');
  await page.goto('https://jutumasin.com/privacy.html');
  assert.equal(loads(),1,'privacy page loads no advertising');
  assert.equal(await page.locator('script').count(),0);
  await page.close();
  for(const [native,block] of [[true,false],[false,true]]){
   const result=await setup(native,block);
   assert.equal(result.loads(),native?0:1);
   assert(await result.page.locator('#webAd').isHidden());
   await result.page.getByRole('heading',{name:'Dating',exact:true}).click();
   assert(await result.page.locator('#gameScreen').isVisible());
   await result.page.close();
  }
  console.log('PASS: supplied AdSense IDs, consent gate, one request per load, privacy settings, no-fill collapse, ad blocking, no browser SDK in Android or privacy page. All Google responses mocked; no live ad traffic.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
