const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain');res.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:780}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(url);
  const toggle=page.locator('#languageToggle');
  assert.equal(await toggle.textContent(),'English');
  await toggle.click();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert(await page.getByRole('heading',{name:'Start HERE'}).isVisible());
  await page.locator('#aboutBtn').click();
  assert((await page.locator('#aboutScreen').innerText()).includes('Recommended for ages 18+'));
  assert(!(await page.locator('#aboutScreen').innerText()).includes('renno.east@hotmail.com'));
  assert.equal(await page.locator('#childSafetyStandards').textContent(),'Child safety standards');
  assert.equal(await page.locator('#childSafetyStandards').getAttribute('href'),'https://jutumasin.com/privacy.html#child-safety');
  assert.equal(await page.locator('#aboutScreen a[href^="mailto:"]').count(),0);
  await toggle.click();
  assert.equal(await page.locator('#childSafetyStandards').textContent(),'Laste turvalisuse standardid');
  await toggle.click();
  assert(!(await page.locator('#aboutScreen').innerText()).includes('saved on this device'));
  assert.equal(await page.locator('#aboutScreen a[data-i18n="privacyPolicy"]').textContent(),'Chatmachine OÜ · Privacy policy');
  await page.locator('#btnMenu').click();
  await page.getByRole('heading',{name:'Dating',exact:true}).click();
  const before=await page.evaluate(()=>({ids:State.cards.map(c=>c.id),index:State.index}));
  await toggle.click();
  await toggle.click();
  assert.deepEqual(await page.evaluate(()=>({ids:State.cards.map(c=>c.id),index:State.index})),before);
  assert.equal(await page.locator('.swipeCard:last-child .title').textContent(),await page.evaluate(()=>I18n.cardText(State.cards[State.index]).title));
  await page.locator('.swipeCard:last-child .starBtn').dispatchEvent('pointerup');
  await page.waitForTimeout(250);
  const favouriteId=await page.evaluate(()=>State.bests.Dating[0].card.id);
  await page.locator('#btnMenu').click();
  await page.getByRole('heading',{name:'Favourites',exact:true}).click();
  assert.equal(await page.locator('#bestDeck .desc').textContent(),await page.evaluate(id=>JUTUMASIN_LOCALES.en.decks.Dating.find(c=>c.id===id).desc,favouriteId));
  await toggle.click();
  assert.equal(await page.locator('#bestDeck .desc').textContent(),await page.evaluate(id=>JUTUMASIN_LOCALES.et.decks.Dating.find(c=>c.id===id).desc,favouriteId));
  await toggle.click();
  await page.reload();
  assert.equal(await toggle.textContent(),'Eesti');
  assert.equal(await page.evaluate(()=>State.bests.Dating[0].card.id),favouriteId);
  // Every card, including all three kinds of card title and all footers, renders in English.
  assert.equal(await page.evaluate(()=>{
   let count=0;
   for(const [deck,cards] of Object.entries(DECKS2))for(const card of cards){
    const node=makeCard({...card,__deck:deck},false,'view');
    const translation=JUTUMASIN_LOCALES.en.decks[deck].find(c=>c.id===card.id);
    for(const [selector,key] of [['.title','title'],['.desc','desc'],['.foot span','foot']])if(node.querySelector(selector).textContent!==translation[key])throw Error(card.id+key);
    count++;
   }
   return count;
  }),await page.evaluate(()=>Object.values(DECKS2).reduce((total,cards)=>total+cards.length,0)));
  // Upgrade pre-language saves without losing progress, favourites or history.
  await page.evaluate(()=>{
   const saved=JSON.parse(localStorage.getItem('jutumasin.v2'));
   for(const c of saved.state.cards)delete c.id;
   for(const store of [saved.state.histories,saved.state.bests])for(const entries of Object.values(store))for(const entry of entries)delete entry.card.id;
   localStorage.setItem('jutumasin.v2',JSON.stringify(saved));
  });
  await page.reload();
  assert.equal(await page.evaluate(()=>State.index),1);
  assert.equal(await page.evaluate(()=>State.bests.Dating[0].card.id),favouriteId);
  assert.equal(await page.evaluate(()=>State.viewMode),'game','legacy save resumes automatically');
  await page.locator('#btnMenu').click();
  assert.equal(await page.getByRole('heading',{name:'Resume game',exact:true}).count(),0);
  await page.getByRole('heading',{name:'History',exact:true}).click();
  assert.equal(await page.locator('#historyDeck .desc').textContent(),await page.evaluate(()=>I18n.cardText(State.histories.Dating[0].card).desc));
  // Switching during an animation cancels it without advancing or recording twice.
  await page.reload();
  assert.equal(await page.evaluate(()=>State.viewMode),'game');
  await page.evaluate(()=>{document.getElementById('btnNext').click();document.getElementById('languageToggle').click();});
  await page.waitForTimeout(260);
  assert.equal(await page.evaluate(()=>State.index),1);
  assert.equal(await page.evaluate(()=>State.histories.Dating.length),1);
  // Native ad state survives translating the underlying page and its Continue control.
  await page.evaluate(()=>{window.AndroidApp={showAd(){},dismissAd(){},resizeAd(){}};showAdCard();});
  await toggle.click();
  assert.equal(await page.locator('#btnNext').textContent(),'Continue →');
  assert.equal(await page.locator('#progress').textContent(),'Advertisement');
  assert.equal(await page.evaluate(()=>adActive),true);
  await page.locator('#btnNext').click();
  assert.equal(await page.evaluate(()=>State.index),1);
  // Both empty states are translated.
  await page.evaluate(()=>{State.bests.Party=[];openList('best','Party');});
  assert.equal(await page.locator('#bestDeck .title').textContent(),'Nothing here yet');
  assert.equal(await page.locator('#bestDeck .desc').textContent(),'Start a game and swipe up to add favourites.');
  await page.evaluate(()=>{State.histories.Party=[];openList('history','Party');});
  assert.equal(await page.locator('#historyDeck .desc').textContent(),'Start a game and swipe through some cards.');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  for(const [width,height] of [[1440,900],[393,780],[320,568],[780,393]]){
   await page.setViewportSize({width,height});
   for(const lang of ['en','et']){
    if(await page.locator('html').getAttribute('lang')!==lang)await toggle.click();
    await page.locator('#brandHome').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const rect=await toggle.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width);
    await page.locator('#aboutBtn').click();
    assert(await page.locator('#aboutScreen').isVisible());
    await page.locator('#btnMenu').click();
    await page.screenshot({path:path.join(root,`test-results/language-${lang}-${width}.png`)});
   }
  }
  // Disabled storage must not prevent selecting English.
  const blocked=await browser.newPage();
  await blocked.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('blocked')};Storage.prototype.setItem=function(){throw Error('blocked')};});
  await blocked.goto(url);await blocked.locator('#languageToggle').click();
  assert.equal(await blocked.locator('html').getAttribute('lang'),'en');
  await blocked.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: translated cards, full UI, saved language, legacy saves, favourites/history, animation/ad switching, empty states, 4 viewport sizes in both languages, blocked storage.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
