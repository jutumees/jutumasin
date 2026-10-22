(() => {
  'use strict';
  const endpoint = 'https://discord.com/api/webhooks/1562698452620812368/ek5H5LkPYUp7MVy1hRLXIpPQ7Qpphpw8zLCS82dXm2eD1TZzcKydJZfXKj0e_EAJezAV?wait=true';
  const form = document.getElementById('cardIdeaForm');
  const type = document.getElementById('ideaType');
  const input = document.getElementById('ideaText');
  const count = document.getElementById('ideaCount');
  const send = document.getElementById('ideaSend');
  const status = document.getElementById('ideaStatus');
  let pending = false;
  let nextSend = 0;

  function message(key) {
    status.dataset.i18n = key;
    status.textContent = I18n.t(key);
  }
  function validate() {
    const length = Array.from(input.value).length;
    count.textContent = `${length} / 360`;
    // Reject hidden controls, bidi overrides and invalid UTF-16; allow normal line breaks.
    const invalid = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]|[\ud800-\udfff]/u.test(input.value);
    const valid = length <= 360 && input.value.trim().length > 0 && !invalid;
    input.setCustomValidity(valid ? '' : I18n.t('ideaInvalid'));
    return valid && ['Dating', 'Spicy', 'Couples', 'Party'].includes(type.value);
  }
  input.addEventListener('input', validate);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    if (!validate()) { message('ideaInvalid'); form.reportValidity(); return; }
    if (Date.now() < nextSend) { message('ideaWait'); return; }
    // User text is never parsed as JSON, HTML or code. Escape Discord formatting.
    const text = input.value.trim().replace(/[\\`*_{}\[\]()<>#+.!|~\-]/g, '\\$&');
    const payload = {
      content: `Jutumasin · ${type.value}\n${text}`,
      allowed_mentions: {parse: []},
      flags: 4,
      tts: false
    };
    pending = true;
    send.disabled = type.disabled = input.disabled = true;
    message('ideaSending');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload), credentials: 'omit', referrerPolicy: 'no-referrer',
        redirect: 'error', signal: controller.signal
      });
      if (response.status === 429) {
        let seconds = 60;
        try {
          const result = await response.json();
          if (Number.isFinite(result.retry_after) && result.retry_after > 0) seconds = result.retry_after;
        } catch (_) { /* Keep the conservative cooldown if Discord returns no JSON. */ }
        nextSend = Date.now() + seconds * 1000;
        message('ideaWait');
      } else if (response.ok) {
        nextSend = Date.now() + 30000;
        input.value = '';
        count.textContent = '0 / 360';
        input.setCustomValidity('');
        message('ideaSuccess');
      } else {
        message('ideaError');
      }
    } catch (_) {
      message('ideaError');
    } finally {
      clearTimeout(timeout);
      pending = false;
      send.disabled = type.disabled = input.disabled = false;
    }
  });
})();
