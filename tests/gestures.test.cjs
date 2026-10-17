const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'text/plain');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:393,height:780},isMobile:true,hasTouch:true});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.getByRole('heading',{name:'Dating',exact:true}).click();
 const cdp=await page.context().newCDPSession(page);
 async function drag(selector,dx,dy,commit=true){
  const box=await page.locator(selector).boundingBox();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});
   await page.waitForTimeout(20);
  }
  const state=await page.locator(selector).evaluate(n=>{const card=n.closest('.swipeCard');const m=new DOMMatrix(getComputedStyle(card).transform);return {dragging:card.classList.contains('dragging'),x:m.m41,y:m.m42};});
  assert(state.dragging,'browser must not cancel the gesture to scroll card content');
  assert(Math.abs(state.x-dx)<3 && Math.abs(state.y-dy)<3,'card must follow the finger before release: '+JSON.stringify(state));
  await cdp.send('Input.dispatchTouchEvent',{type:commit?'touchEnd':'touchCancel',touchPoints:[]});
  await page.waitForTimeout(250);
 }
 await drag('#deck .swipeCard:last-child .desc',145,0);
 assert.equal(await page.evaluate(()=>State.index),1,'right swipe advances');
 await drag('#deck .swipeCard:last-child .desc',-145,0);
 assert.equal(await page.evaluate(()=>State.index),0,'left swipe returns');
 await drag('#deck .swipeCard:last-child .desc',0,-155);
 assert.equal(await page.evaluate(()=>State.bests.Dating.length),1,'up swipe favourites');
 await drag('#deck .swipeCard:last-child .desc',45,15);
 assert.equal(await page.evaluate(()=>State.index),1,'short drag snaps back');
 await drag('#deck .swipeCard:last-child .desc',145,0,false);
 assert.equal(await page.evaluate(()=>State.index),1,'cancelled gesture does not advance');
 await drag('#deck .swipeCard:last-child .desc',145,0);
 await page.evaluate(()=>openList('history','Dating'));
 await drag('#historyDeck .swipeCard .desc',145,0);
 assert.equal(await page.evaluate(()=>State.viewPos),1,'history supports touch drag');
 console.log('PASS: real touch input follows finger, forward/back/up swipes, snap-back, cancellation and history drag.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
