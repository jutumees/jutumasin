// Browser advertising only. Android uses its native AdMob SDK.
// Publish the site's consent message in AdSense > Privacy & messaging.
(() => {
  if (window.AndroidApp || !['jutumasin.com', 'www.jutumasin.com'].includes(location.hostname)) return;
  const publisher = 'ca-pub-4965975361805360';
  const slot = '2178160769';
  const hosts = [...document.querySelectorAll('.webAd')];
  const privacy = document.getElementById('webPrivacyOptions');
  const space = matchMedia('(min-width:1000px) and (min-height:400px)');
  const requested = new Set();
  let started = false, loaded = false, consentReady = false;
  let gameConfigured = false, gameReady = false, breakPending = false;

  window.adsbygoogle = window.adsbygoogle || [];
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];

  window.adBreak = window.adConfig = options => window.adsbygoogle.push(options);
  function configureGameAds() {
    if(!loaded || !consentReady || space.matches || gameConfigured) return;
    gameConfigured = true;
    window.adConfig({preloadAdBreaks:'on', onReady:() => { gameReady = true; }});
  }
  window.WebAds = {
    showBreak(callbacks) {
      if(!consentReady || !gameReady || space.matches || breakPending) return false;
      breakPending = true;
      let showing = false;
      const finish = () => { breakPending = false; if(showing){ showing = false; callbacks.after(); } };
      try {
        window.adBreak({type:'next', name:'question-break',
          beforeAd:() => { showing = true; callbacks.before(); },
          afterAd:finish, adBreakDone:finish});
      } catch(error) { finish(); console.warn('Game ad unavailable',error); }
      return true;
    }
  };
  function requestAds() {
    configureGameAds();
    if (!loaded || !consentReady || !space.matches || document.body.dataset.view === 'about') return;
    for (const host of hosts) {
      if (requested.has(host)) continue;
      host.hidden = false;
      const bounds = host.getBoundingClientRect();
      if (bounds.width < 160 || bounds.height < 274) { host.hidden = true; continue; }
      const ad = document.createElement('ins');
      ad.className = 'adsbygoogle';
      ad.dataset.adClient = publisher;
      ad.dataset.adSlot = slot;
      ad.dataset.fullWidthResponsive = 'false';
      host.appendChild(ad);
      // Explicit CSS width/height constrain the responsive unit to its side rail.
      // Each placement is requested once; navigation/resizing never refreshes ads.
      requested.add(host);
      new MutationObserver(() => {
        if (ad.dataset.adStatus === 'filled') host.classList.add('isFilled');
        if (ad.dataset.adStatus === 'unfilled') { host.classList.remove('isFilled'); host.hidden = true; }
      }).observe(ad, {attributes:true, attributeFilter:['data-ad-status']});
      try { window.adsbygoogle.push({}); }
      catch (error) { host.hidden = true; console.warn('Web ad could not be displayed', error); }
    }
  }
  window.googlefc.callbackQueue.push({CONSENT_API_READY: () => { privacy.hidden = false; }});
  window.googlefc.callbackQueue.push({CONSENT_DATA_READY: () => { consentReady = true; requestAds(); }});
  privacy.addEventListener('click', () => {
    consentReady = false;
    for (const host of hosts) {
      host.hidden = true;
      host.classList.remove('isFilled');
      host.querySelector('ins')?.remove();
    }
    window.googlefc.callbackQueue.push({CONSENT_API_READY: () => { window.googlefc.showRevocationMessage(); }});
  });
  function start() {
    if (!started) {
      started = true;
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.adClient = publisher;
      script.dataset.adFrequencyHint = '120s';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
      script.onload = () => { loaded = true; requestAds(); };
      script.onerror = () => { hosts.forEach(host => { host.hidden = true; }); };
      document.head.appendChild(script);
    }
    requestAds();
  }
  new MutationObserver(requestAds).observe(document.body, {attributes:true, attributeFilter:['data-view']});
  window.addEventListener('resize', start);
  start();
})();
