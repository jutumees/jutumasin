const DECKS2 = window.DECKS;
const TINTS2 = window.TINTS;
const t = (key, values) => I18n.t(key, values);

let cadence = new AdCadence();
let transitionTimer = null;
let adRequest = 0;
let adActive = false;
let webBreakActive = false;
const SAVE_KEY = 'jutumasin.v2';

const State = {
  deckKey: null,
  cards: [],
  index: 0,
  histories: {},
  bests: {},
  viewDeckKey: null,
  viewMode: "menu",
  viewPos: 0
};

const el = {
  menu: document.getElementById("menuScreen"),
  about: document.getElementById("aboutScreen"),
  game: document.getElementById("gameScreen"),
  history: document.getElementById("historyScreen"),
  best: document.getElementById("bestScreen"),
  menuGrid: document.getElementById("menuGrid"),
  aboutBtn: document.getElementById("aboutBtn"),
  deck: document.getElementById("deck"),
  historyDeck: document.getElementById("historyDeck"),
  bestDeck: document.getElementById("bestDeck"),
  deckName: document.getElementById("deckName"),
  progress: document.getElementById("progress"),
  historyName: document.getElementById("historyName"),
  historyPos: document.getElementById("historyPos"),
  bestName: document.getElementById("bestName"),
  bestPos: document.getElementById("bestPos"),
  controls: document.getElementById("controls"),
  btnBack: document.getElementById("btnBack"),
  btnMenu: document.getElementById("btnMenu"),
  btnNext: document.getElementById("btnNext"),
  brandHome: document.getElementById("brandHome")
};

function setDeckTheme(key){
  if(key) document.body.setAttribute("data-deck", key);
  else document.body.removeAttribute("data-deck");
}

function showScreen(name){
  if(webBreakActive) return;
  cancelTransition();
  dismissAd();
  el.menu.classList.toggle("active", name === "menu");
  el.about.classList.toggle("active", name === "about");
  el.game.classList.toggle("active", name === "game");
  el.history.classList.toggle("active", name === "history");
  el.best.classList.toggle("active", name === "best");
  if(name === "menu") el.menu.scrollTop = 0;
  State.viewMode = name;
  document.body.setAttribute("data-view", name);

  if(name === "menu" || name === "about") setDeckTheme("");

  updateButtons();
  saveGame();
}

function totalCount(map){
  let n=0; Object.keys(map).forEach(k => n += (map[k]?.length || 0)); return n;
}

function buildMenu(){
  const hTotal = totalCount(State.histories);
  const bTotal = totalCount(State.bests);
  const items = [
    { title:t('mixTitle'), sub:t('mixSubtitle'), icon:'assets/mix.png', action:()=>startMixedGame(), big:true },
    ...['Dating', 'Spicy', 'Couples', 'Party'].map(key => ({
      title:t(key.toLowerCase() + 'Title'), sub:t(key.toLowerCase() + 'Subtitle'),
      icon:`assets/${key.toLowerCase()}.png`, action:()=>startGame(key)
    })),
    { title:t('historyTitle'), sub:t('historySubtitle', {count:hTotal}), icon:'assets/history.png', action:()=>openDeckPicker('history') },
    { title:t('bestTitle'), sub:t('bestSubtitle', {count:bTotal}), icon:'assets/best.png', action:()=>openDeckPicker('best') }
  ];
  el.menuGrid.innerHTML = "";
  items.forEach(it=>{
    const c=document.createElement("div");
    c.className="choice" + (it.big ? " big" : "");
    c.innerHTML = `
      <img class="choiceIcon" src="${it.icon}" alt="" aria-hidden="true">
      <div class="choiceText"><h3>${it.title}</h3><p>${it.sub}</p></div>
    `;
    c.addEventListener("click", it.action);
    el.menuGrid.appendChild(c);
  });
}

function openDeckPicker(mode){
  const keys = ["MIX","Dating","Spicy","Couples","Party"];
  const store = (mode==="history") ? State.histories : State.bests;

  let dk = State.deckKey || "Dating";
  if(!store[dk] || !store[dk].length){
    dk = keys.find(k => store[k] && store[k].length) || "Dating";
  }
  openList(mode, dk);
}

function updateButtons(){
  if(webBreakActive){ el.btnBack.disabled = true; el.btnNext.disabled = true; return; }
  if(transitionTimer !== null || adActive || webBreakActive){
    el.btnBack.disabled = true;
    el.btnNext.disabled = !adActive;
    el.btnNext.textContent = adActive ? t('continue') : t('next');
    return;
  }
  el.btnNext.textContent = t('next');
  if(State.viewMode === "history"){
    const list = State.histories[State.viewDeckKey] || [];
    el.btnBack.disabled = !(list.length && State.viewPos > 0);
    el.btnNext.disabled = !(list.length && State.viewPos < list.length - 1);
  } else if(State.viewMode === "best"){
    const list = State.bests[State.viewDeckKey] || [];
    el.btnBack.disabled = !(list.length && State.viewPos > 0);
    el.btnNext.disabled = !(list.length && State.viewPos < list.length - 1);
  } else if(State.viewMode === "game"){
    el.btnBack.disabled = (State.index <= 0);
    el.btnNext.disabled = (State.index >= State.cards.length);
  } else {
    el.btnBack.disabled = false;
    el.btnNext.disabled = false;
  }
}

function startGame(deckKey){
  cadence.newDeck();
  setDeckTheme(deckKey);

  State.deckKey = deckKey;
  State.cards = shuffle([...DECKS2[deckKey]].map(c => ({...c, __deck: deckKey})));
  State.index = 0;
  if(!State.histories[deckKey]) State.histories[deckKey] = [];
  if(!State.bests[deckKey]) State.bests[deckKey] = [];
  el.deckName.textContent = t('deckLabel', {deck:deckKey});
  showScreen("game");
  renderStack();
  updateProgress();
  buildMenu();
}

function startMixedGame(){
  cadence.newDeck();
  setDeckTheme("MIX");

  State.deckKey = "MIX";
  const mixed = [
    ...DECKS2["Dating"].map(c => ({...c, __deck:"Dating"})),
    ...DECKS2["Spicy"].map(c => ({...c, __deck:"Spicy"})),
    ...DECKS2["Couples"].map(c => ({...c, __deck:"Couples"})),
    ...DECKS2["Party"].map(c => ({...c, __deck:"Party"}))
  ];
  State.cards = shuffle([...mixed]);
  State.index = 0;
  if(!State.histories["MIX"]) State.histories["MIX"] = [];
  if(!State.bests["MIX"]) State.bests["MIX"] = [];
  el.deckName.textContent = t('deckLabel', {deck:'MIX'});
  showScreen("game");
  renderStack();
  updateProgress();
  buildMenu();
}

function openList(mode, deckKey){
  State.viewDeckKey = deckKey;
  State.viewPos = 0;

  setDeckTheme(deckKey === "MIX" ? "Dating" : deckKey);

  if(mode==="history"){
    el.historyName.textContent = t('historyLabel', {deck:deckKey});
    showScreen("history");
    renderViewCard();
    updateViewPos();
  } else {
    el.bestName.textContent = t('bestLabel', {deck:deckKey});
    showScreen("best");
    renderViewCard();
    updateViewPos();
  }
}

function updateProgress(){ el.progress.textContent = adActive ? t('ad') : String(State.index + 1); }

function renderStack(){
  el.deck.innerHTML = "";
  const top  = State.cards[State.index];
  const next = State.cards[State.index + 1];
  if(next) el.deck.appendChild(makeCard(next, true, "game"));
  if(top)  el.deck.appendChild(makeCard(top, false, "game"));
  if(!top){ showScreen("menu"); buildMenu(); }
  updateButtons();
}

function applyCardTint(innerEl, card){
  if(document.body.getAttribute("data-deck") !== "MIX") return;
  const src = card.__deck;
  const t = TINTS2[src];
  if(!t) return;
  innerEl.style.setProperty("--cardA", t.A);
  innerEl.style.setProperty("--cardB", t.B);
}

function deckIconForCard(card){
  const key = card.__deck || State.viewDeckKey || State.deckKey;
  const icons = {
    MIX: "assets/mix.png",
    Dating: "assets/dating.png",
    Spicy: "assets/spicy.png",
    Couples: "assets/couples.png",
    Party: "assets/party.png"
  };
  return icons[key] || icons[State.deckKey] || icons[State.viewDeckKey] || "";
}

function makeCard(card, isBehind, mode){
  const content = I18n.cardText(card);
  const wrap = document.createElement("div");
  wrap.className = "swipeCard";
  if(card.__emptyView) wrap.dataset.emptyView = "true";
  wrap.style.transform = isBehind ? "translate3d(0, 10px, 0) scale(0.96)" : "translate3d(0,0,0)";
  wrap.style.opacity = isBehind ? "0.93" : "1";

  const inner = document.createElement("div");
  inner.className = "inner";
  applyCardTint(inner, card);
  const footIcon = deckIconForCard(card);

  inner.innerHTML = `
    <div class="title"></div>
    <div class="desc"></div>
    <div class="foot">
      ${footIcon ? `<img class="cardTypeIcon" src="${footIcon}" alt="" aria-hidden="true">` : ""}
      <span></span>
    </div>
  `;
  inner.querySelector('.title').textContent = content.title;
  inner.querySelector('.desc').textContent = content.desc;
  inner.querySelector('.foot span').textContent = content.foot || '';
  wrap.appendChild(inner);

  if(mode === "game"){
    const starBtn = document.createElement("button");
    starBtn.className = "starBtn";
    starBtn.type = "button";
    starBtn.setAttribute("aria-label", t("favourite"));
    starBtn.innerHTML = "<span>⭐</span>";
    starBtn.addEventListener("pointerdown", (e)=>{ e.stopPropagation(); e.preventDefault(); });
    starBtn.addEventListener("pointerup", (e)=>{
      e.stopPropagation(); e.preventDefault();
      const top = el.deck.querySelector(".swipeCard:last-child");
      if(top === wrap) markBestAndNext(wrap);
    });
    wrap.appendChild(starBtn);
  }

  if(!isBehind){
    if(mode==="game") attachSwipeGame(wrap);
    if(mode==="view") attachSwipeView(wrap);
  }
  return wrap;
}

function attachSwipeGame(cardEl){
  let sx=0, sy=0, dx=0, dy=0, dragging=false;
  let rafId=0;

  function applyDrag(){
    rafId=0;
    const rot = clamp(dx/14, -18, 18);
    cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;
  }

  function scheduleDrag(){
    if(!rafId) rafId = requestAnimationFrame(applyDrag);
  }

  function finishDrag(){
    if(rafId){
      cancelAnimationFrame(rafId);
      rafId=0;
      applyDrag();
    }
    cardEl.classList.remove("dragging");
    document.body.classList.remove("isDraggingCard");
  }

  cardEl.addEventListener("pointerdown", (e)=>{
    if(transitionTimer !== null || adActive || webBreakActive) return;
    if(e.target && e.target.closest && e.target.closest(".starBtn")) return;
    dragging=true;
    cardEl.setPointerCapture(e.pointerId);
    sx=e.clientX; sy=e.clientY;
    dx=0; dy=0;
    cardEl.classList.add("dragging");
    document.body.classList.add("isDraggingCard");
    cardEl.style.transition="none";
  });

  cardEl.addEventListener("pointermove", (e)=>{
    if(!dragging) return;
    dx=e.clientX-sx; dy=e.clientY-sy;
    scheduleDrag();
  });

  cardEl.addEventListener("pointerup", ()=>{
    if(!dragging) return;
    dragging=false;
    finishDrag();
    cardEl.style.transition="transform 180ms ease, opacity 180ms ease";

    const tX=120, tY=130;
    if(dy < -tY && Math.abs(dx) < 140) markBestAndNext(cardEl);
    else if(dx > tX) nextCard(cardEl);
    else if(dx < -tX) prevCard();
    else cardEl.style.transform="translate3d(0,0,0) rotate(0deg)";
  });

  cardEl.addEventListener("pointercancel", ()=>{
    if(!dragging) return;
    dragging=false;
    finishDrag();
    cardEl.style.transition="transform 180ms ease, opacity 180ms ease";
    cardEl.style.transform="translate3d(0,0,0) rotate(0deg)";
  });
}

function nextCard(cardEl){
  completeCard(cardEl, false);
}

function markBestAndNext(cardEl){
  completeCard(cardEl, true);
}

function completeCard(cardEl, best){
  if(transitionTimer !== null || adActive || webBreakActive || State.viewMode !== 'game' || State.index >= State.cards.length) return;
  promoteNextCard(cardEl);
  animateOut(cardEl, best ? 0 : 520, best ? -620 : -40, best ? 0 : 18);
  transitionTimer = setTimeout(()=>{
    transitionTimer = null;
    pushHistory(best ? 'PARIM' : 'EDASI', best);
    syncPlayClock();
    const due = cadence.complete(State.index);
    State.index++;
    renderStack(); updateProgress(); buildMenu(); saveGame();
    if(due && State.viewMode === 'game') showAdCard();
  }, 210);
  updateButtons();
}

function promoteNextCard(cardEl){
  const nextEl = cardEl.previousElementSibling;
  if(!nextEl || !nextEl.classList.contains("swipeCard")) return;

  nextEl.style.transition = "transform 210ms cubic-bezier(.2,.8,.2,1), opacity 210ms ease";
  requestAnimationFrame(()=>{
    nextEl.style.transform = "translate3d(0,0,0) scale(1)";
    nextEl.style.opacity = "1";
  });
}

function prevCard(){
  if(transitionTimer !== null || adActive || webBreakActive) return;
  if(State.index <= 0){ renderStack(); return; }
  undoHistoryForIndex(State.index - 1);
  State.index--;
  updateProgress();
  renderStack();
  buildMenu();
  saveGame();
}

function animateOut(cardEl, tx, ty, rot){
  cardEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`;
  cardEl.style.opacity = "0";
}

function cardKey(card){
  return I18n.migrate(card).id || (card.title||"") + "||" + (card.desc||"");
}

function pushHistory(otsus, maybeBest){
  const dk = State.deckKey;
  const card = State.cards[State.index];
  if(!State.histories[dk]) State.histories[dk] = [];

  const entry = { idx: State.index, card, otsus };
  State.histories[dk].push(entry);

  if(maybeBest){
    if(!State.bests[dk]) State.bests[dk] = [];
    const key = cardKey(card);
    const exists = State.bests[dk].some(x => cardKey(x.card) === key);
    if(!exists) { State.bests[dk].push({ card }); entry.addedBest = true; }
  }
}

function undoHistoryForIndex(idx){
  const dk = State.deckKey;
  const h = State.histories[dk] || [];
  const last = h[h.length - 1];
  if(!last || last.idx !== idx) return;

  h.pop();

  if(last.addedBest){
    const key = cardKey(last.card);
    State.bests[dk] = (State.bests[dk] || []).filter(x => cardKey(x.card) !== key);
  }
}

function attachSwipeView(cardEl){
  let sx=0, dx=0, dragging=false;
  let rafId=0;

  function applyDrag(){
    rafId=0;
    const rot = clamp(dx/18, -12, 12);
    cardEl.style.transform = `translate3d(${dx}px, 0px, 0) rotate(${rot}deg)`;
  }

  function scheduleDrag(){
    if(!rafId) rafId = requestAnimationFrame(applyDrag);
  }

  function finishDrag(){
    if(rafId){
      cancelAnimationFrame(rafId);
      rafId=0;
      applyDrag();
    }
    cardEl.classList.remove("dragging");
    document.body.classList.remove("isDraggingCard");
  }

  cardEl.addEventListener("pointerdown",(e)=>{
    dragging=true; cardEl.setPointerCapture(e.pointerId);
    sx=e.clientX; dx=0;
    cardEl.classList.add("dragging");
    document.body.classList.add("isDraggingCard");
    cardEl.style.transition="none";
  });
  cardEl.addEventListener("pointermove",(e)=>{
    if(!dragging) return;
    dx=e.clientX-sx;
    scheduleDrag();
  });
  cardEl.addEventListener("pointerup",()=>{
    if(!dragging) return;
    dragging=false; finishDrag();
    cardEl.style.transition="transform 180ms ease, opacity 180ms ease";
    const t=110;
    if(dx<-t || dx>t){
      if(cardEl.dataset.emptyView === "true") closeEmptyView(cardEl, dx < 0 ? -1 : 1);
      else swipeViewStep(cardEl, dx < 0 ? -1 : 1);
    }
    else cardEl.style.transform = "translate3d(0,0,0) rotate(0deg)";
  });
  cardEl.addEventListener("pointercancel",()=>{
    if(!dragging) return;
    dragging=false; finishDrag();
    cardEl.style.transition="transform 180ms ease, opacity 180ms ease";
    cardEl.style.transform = "translate3d(0,0,0) rotate(0deg)";
  });
}

function closeEmptyView(cardEl, dir){
  if(transitionTimer !== null) return;
  cardEl.style.transform = `translate3d(${dir > 0 ? 520 : -520}px, 0, 0) rotate(${dir > 0 ? 12 : -12}deg)`;
  cardEl.style.opacity = "0";
  transitionTimer = setTimeout(()=>{
    transitionTimer = null;
    showScreen("menu");
    buildMenu();
  }, 190);
}

function swipeViewStep(cardEl, dir){
  if(transitionTimer !== null) return;
  const dk = State.viewDeckKey;
  const mode = State.viewMode;
  const list = (mode==="history") ? (State.histories[dk] || []) : (State.bests[dk] || []);
  if(!list.length) return;

  const nextPos = clamp(State.viewPos + dir, 0, list.length - 1);
  if(nextPos === State.viewPos){
    cardEl.style.transform = "translate3d(0,0,0) rotate(0deg)";
    return;
  }

  const tx = dir > 0 ? 520 : -520;
  cardEl.style.transform = `translate3d(${tx}px, 0, 0) rotate(${dir > 0 ? 12 : -12}deg)`;
  cardEl.style.opacity = "0";
  transitionTimer = setTimeout(()=>{
    transitionTimer = null;
    State.viewPos = nextPos;
    renderViewCard();
    updateViewPos();
  }, 190);
}

function renderViewCard(){
  const dk = State.viewDeckKey;
  const mode = State.viewMode;

  let list, host;
  if(mode==="history"){ list = State.histories[dk] || []; host = el.historyDeck; }
  else { list = State.bests[dk] || []; host = el.bestDeck; }

  host.innerHTML = "";
  const item = list[State.viewPos];

  if(!item){
    const emptyText = mode === "best"
      ? t('emptyBest')
      : t('emptyHistory');
    const empty = makeCard({title:t('emptyTitle'), desc:emptyText, foot:"• " + dk, __emptyView:true}, false, "view");
    host.appendChild(empty);
    updateButtons();
    return;
  }

  const c = makeCard(item.card, false, "view");
  host.appendChild(c);
  updateButtons();
}

function updateViewPos(){
  const dk = State.viewDeckKey;
  const mode = State.viewMode;
  const list = (mode==="history") ? (State.histories[dk] || []) : (State.bests[dk] || []);
  const pos = list.length ? (State.viewPos + 1) : 0;
  if(mode==="history") el.historyPos.textContent = String(pos);
  else el.bestPos.textContent = String(pos);
  updateButtons();
}

function viewStep(dir){
  if(transitionTimer !== null) return;
  const dk = State.viewDeckKey;
  const mode = State.viewMode;
  const list = (mode==="history") ? (State.histories[dk] || []) : (State.bests[dk] || []);
  if(!list.length) return;
  State.viewPos = clamp(State.viewPos + dir, 0, list.length - 1);
  renderViewCard();
  updateViewPos();
}

el.brandHome.addEventListener("click", ()=>{ showScreen("menu"); buildMenu(); });
el.aboutBtn.addEventListener("click", ()=>{ showScreen("about"); });

el.btnMenu.addEventListener("click", ()=>{ showScreen("menu"); buildMenu(); });

el.btnNext.addEventListener("click", ()=>{
  if(adActive){ dismissAd(); updateButtons(); return; }
  if(State.viewMode==="game"){
    const top = el.deck.querySelector(".swipeCard:last-child");
    if(top) nextCard(top);
  } else if(State.viewMode==="history" || State.viewMode==="best"){
    viewStep(+1);
  } else if(State.viewMode==="about"){
    showScreen("menu"); buildMenu();
  }
});

el.btnBack.addEventListener("click", ()=>{
  if(State.viewMode==="game"){
    prevCard();
  } else if(State.viewMode==="history" || State.viewMode==="best"){
    viewStep(-1);
  } else if(State.viewMode==="about"){
    showScreen("menu"); buildMenu();
  }
});

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }

function cancelTransition(){
  if(transitionTimer !== null) clearTimeout(transitionTimer);
  transitionTimer = null;
  document.body.classList.remove('isDraggingCard');
}

let playClockAt = performance.now();
let playClockRunning = false;
function syncPlayClock(){
  const now = performance.now();
  if(playClockRunning) cadence.addPlayTime(now - playClockAt);
  playClockAt = now;
  playClockRunning = State.viewMode === 'game' && !adActive && !webBreakActive && !document.hidden;
}
function saveGame(){
  syncPlayClock();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({state: State, cadence})); }
  catch(error){ console.warn('Game storage unavailable', error); }
}

function restoreGame(){
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const s = saved?.state;
    const validCard = c => c && typeof c.title === 'string' && typeof c.desc === 'string';
    const validMap = map => map && typeof map === 'object' && Object.entries(map).every(([key, entries]) =>
      ['MIX', ...Object.keys(DECKS2)].includes(key) && Array.isArray(entries) && entries.every(e => validCard(e.card)));
    if(!s || !Array.isArray(s.cards) || !s.cards.every(validCard) || !Number.isInteger(s.index)
      || s.index < 0 || s.index > s.cards.length || !validMap(s.histories) || !validMap(s.bests)
      || (s.deckKey !== null && !['MIX', ...Object.keys(DECKS2)].includes(s.deckKey))) return;
    Object.assign(State, {deckKey:s.deckKey, cards:s.cards, index:s.index, histories:s.histories, bests:s.bests});
    State.cards.forEach(I18n.migrate);
    for(const store of [State.histories, State.bests]) {
      Object.values(store).flat().forEach(entry => I18n.migrate(entry.card));
    }
    cadence = new AdCadence(saved.cadence);
  } catch(error){ console.warn('Saved game could not be restored', error); }
}

function showAdCard(){
  if(!window.AndroidApp) {
    window.WebAds?.showBreak({
      before(){ webBreakActive = true; syncPlayClock(); updateButtons(); },
      after(){ webBreakActive = false; syncPlayClock(); updateProgress(); updateButtons(); }
    });
    return;
  }
  adActive = true;
  syncPlayClock();
  const request = ++adRequest;
  el.deck.classList.add('adActive');
  el.progress.textContent = t('ad');
  updateButtons();
  const r = el.deck.getBoundingClientRect();
  window.AndroidApp.showAd(request, r.x, r.y, r.width, r.height);
}
function dismissAd(){
  if(!adActive) return;
  adActive = false;
  syncPlayClock();
  adRequest++;
  window.AndroidApp?.dismissAd();
  el.deck.classList.remove('adActive');
  updateProgress();
}
window.onNativeAdFinished = request => {
  if(request !== adRequest || !adActive) return;
  adActive = false;
  syncPlayClock();
  el.deck.classList.remove('adActive');
  updateProgress(); updateButtons();
};
window.androidBack = () => {
  if(adActive){ dismissAd(); updateButtons(); return true; }
  if(State.viewMode === 'menu') return false;
  showScreen('menu'); buildMenu(); return true;
};
window.setPrivacyOptionsRequired = required => {
  document.getElementById('privacyOptions').hidden = !required;
};
document.getElementById('privacyOptions').addEventListener('click', ()=>window.AndroidApp?.privacyOptions());
new ResizeObserver(()=>{
  if(adActive){
    const r = el.deck.getBoundingClientRect();
    window.AndroidApp.resizeAd(r.x, r.y, r.width, r.height);
  }
}).observe(el.deck);
document.addEventListener('visibilitychange', saveGame);
restoreGame();
I18n.apply();
refreshLanguageLabels();
buildMenu();
if(State.cards.length && State.index < State.cards.length){
  setDeckTheme(State.deckKey);
  showScreen('game');
  renderStack();
  updateProgress();
} else {
  showScreen('menu');
}

// Re-render translated text without changing shuffled cards, position or ad cadence.
function refreshLanguageLabels(){
  el.deckName.textContent = t('deckLabel', {deck:State.deckKey || '—'});
  el.historyName.textContent = t('historyLabel', {deck:State.viewDeckKey || '—'});
  el.bestName.textContent = t('bestLabel', {deck:State.viewDeckKey || '—'});
}
document.getElementById('languageToggle').addEventListener('click', () => {
  cancelTransition();
  I18n.setLanguage(I18n.language === 'et' ? 'en' : 'et');
  refreshLanguageLabels();
  buildMenu();
  if(State.viewMode === 'game') { renderStack(); updateProgress(); }
  if(State.viewMode === 'history' || State.viewMode === 'best') { renderViewCard(); updateViewPos(); }
  updateButtons();
  saveGame();
});
