// Browser advertising only. Android uses its native AdMob SDK.
// Publish the site's consent message in AdSense > Privacy & messaging.
(() => {
  if (window.AndroidApp || !['jutumasin.com', 'www.jutumasin.com'].includes(location.hostname)) return;

  const publisher = 'ca-pub-4965975361805360';
  const slot = '2178160769';
  const host = document.getElementById('webAd');
  const privacy = document.getElementById('webPrivacyOptions');
  let loaded = false;
  let consentReady = false;
  let requested = false;

  window.adsbygoogle = window.adsbygoogle || [];
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];

  function requestAd() {
    if (!loaded || !consentReady || requested || document.body.dataset.view !== 'menu') return;
    host.hidden = false;
    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle';
    ad.style.display = 'block';
    ad.dataset.adClient = publisher;
    ad.dataset.adSlot = slot;
    ad.dataset.adFormat = 'auto';
    ad.dataset.fullWidthResponsive = 'false';
    host.appendChild(ad);
    // One request per document, never refresh ads when swiping or changing language.
    requested = true;
    try {
      window.adsbygoogle.push({});
      new MutationObserver(() => {
        if (ad.dataset.adStatus === 'unfilled') host.hidden = true;
      }).observe(ad, {attributes:true, attributeFilter:['data-ad-status']});
    } catch (error) {
      host.hidden = true;
      console.warn('Web ad could not be displayed', error);
    }
  }

  window.googlefc.callbackQueue.push({
    CONSENT_API_READY: () => {
      privacy.hidden = false;
    }
  });
  window.googlefc.callbackQueue.push({
    CONSENT_DATA_READY: () => {
      // Google consumes the CMP's consent choices, including rejection/limited ads.
      consentReady = true;
      requestAd();
    }
  });
  privacy.addEventListener('click', () => {
    consentReady = false;
    host.hidden = true;
    host.querySelector('ins')?.remove();
    window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
      window.googlefc.showRevocationMessage();
    }});
  });

  new MutationObserver(requestAd).observe(document.body, {attributes:true, attributeFilter:['data-view']});
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
  script.onload = () => { loaded = true; requestAd(); };
  script.onerror = () => { host.hidden = true; };
  document.head.appendChild(script);
})();
