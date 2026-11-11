/* Kaaj Tools - automatic Pro unlock with Razorpay.
   Replaces the old pro-system.js (7-day trial + manual keys). Keep it as the LAST script line in index.html. */
(function () {
  function $(id) { return document.getElementById(id); }

  // ===== ONLY THING YOU MUST EDIT: your Cloudflare Worker address (no slash at the end) =====
  var API_BASE = 'https://kaaj-pay.dorpon365.workers.dev';
  // =======================================================================================
  var PRODUCT = 'gst-pro';          // must match the product name in worker.js
  var BRAND = 'Kaaj Tools';         // shown on the payment window
  var PRICE_TEXT = '₹299';

  var licOk = false;

  // ---------- device id (stays on this device) ----------
  function getDeviceId() {
    var id = '';
    try { id = localStorage.getItem('gst_device_id') || ''; } catch (e) {}
    if (!/^[A-Za-z0-9]{16}$/.test(id)) {
      var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
      var buf = new Uint8Array(16);
      (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(buf) : buf.forEach(function (_, i) { buf[i] = Math.floor(Math.random() * 256); });
      id = '';
      for (var i = 0; i < 16; i++) id += chars.charAt(buf[i] % chars.length);
      try { localStorage.setItem('gst_device_id', id); } catch (e) {}
    }
    return id;
  }

  // ---------- license token checking (works offline once the public key is saved) ----------
  function b64uToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function parseToken(t) {
    try {
      var parts = String(t || '').split('.');
      if (parts.length !== 2) return null;
      var p = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[0])));
      return { payload: p, data: parts[0], sig: parts[1] };
    } catch (e) { return null; }
  }
  function tokenMatchesDevice(tok) {
    return !!tok && tok.payload && tok.payload.pr === PRODUCT && tok.payload.d === getDeviceId();
  }
  async function getPublicKey() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('gst_pub_jwk') || 'null'); } catch (e) {}
    if (cached) return cached;
    var res = await fetch(API_BASE + '/public-key');
    if (!res.ok) throw new Error('no key');
    var jwk = await res.json();
    try { localStorage.setItem('gst_pub_jwk', JSON.stringify(jwk)); } catch (e) {}
    return jwk;
  }
  // returns true / false, or null when it could not be checked (no internet and no saved key)
  async function verifyToken(token) {
    var tok = parseToken(token);
    if (!tokenMatchesDevice(tok)) return false;
    var jwk;
    try { jwk = await getPublicKey(); } catch (e) { return null; }
    try {
      var key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64uToBytes(tok.sig), new TextEncoder().encode(tok.data));
    } catch (e) { return false; }
  }

  // ---------- Pro status ----------
  function refreshPro() {
    var t = appState.licToken;
    licOk = !!(t && appState.licOkToken === t && tokenMatchesDevice(parseToken(t)));
    appState.isPro = licOk;
  }
  async function verifyStored() {
    var t = appState.licToken;
    if (!t) { licOk = false; appState.isPro = false; renderAll(); return; }
    var ok = await verifyToken(t);
    if (ok === true) { appState.licOkToken = t; saveState(); }
    else if (ok === false) { appState.licToken = ''; appState.licOkToken = ''; saveState(); }
    renderAll();
  }
  function syncProFlag() {
    try { localStorage.setItem('isPro', appState.isPro === true ? 'true' : 'false'); } catch (e) {}
  }

  window.loadState = function () {
    try {
      var raw = localStorage.getItem('gst_invoice_maker_state_v3');
      if (raw) appState = Object.assign({}, appState, JSON.parse(raw));
    } catch (e) { console.warn('Could not load saved state:', e); }
    refreshPro();
    syncProFlag();
    verifyStored();
  };

  var origRender = window.renderAll;
  window.renderAll = function () {
    refreshPro();
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { proUi(); } catch (e) { console.warn('Pro UI:', e); }
    syncProFlag();
  };

  function proUi() {
    var badge = $('proStatusBadge'), btn = $('openProModalBtn');
    if (badge) { badge.textContent = '★ PRO UNLOCKED'; badge.style.background = ''; }
    var label = btn && btn.firstElementChild;
    if (label) label.textContent = '👑 Unlock Pro (' + PRICE_TEXT + ')';
  }

  // ---------- talking to the server ----------
  async function api(path, body) {
    var res = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) { var err = new Error(data.error || 'Server error. Please try again.'); err.code = data.code; throw err; }
    return data;
  }
  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) { resolve(); return; }
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load the payment window. Please check your internet.')); };
      document.head.appendChild(s);
    });
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
  function status(msg, good) {
    var el = $('proStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? '' : 'none';
    el.className = 'text-[11px] font-semibold rounded-lg px-3 py-2 ' + (good ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-50 text-amber-900');
  }
  function busy(on) {
    var b = $('proPayBtn'), r = $('proRestoreBtn');
    if (b) { b.disabled = on; b.style.opacity = on ? '0.6' : ''; }
    if (r) { r.disabled = on; r.style.opacity = on ? '0.6' : ''; }
  }

  async function storeToken(token) {
    var ok = await verifyToken(token);
    if (ok === false) throw new Error('The license could not be verified. Please contact support.');
    appState.licToken = token;
    appState.licOkToken = token;
    saveState();
    renderAll();
  }

  async function finishActivation(paymentId, email, resp) {
    status('Payment received. Unlocking Pro…', true);
    try {
      var out = await api('/activate', { paymentId: paymentId, email: email, deviceId: getDeviceId(),
        orderId: resp && resp.razorpay_order_id, signature: resp && resp.razorpay_signature });
      await storeToken(out.token);
      busy(false);
      status('Pro is unlocked. Thank you!', true);
      setTimeout(function () { closeProModal(); alert('Pro Edition Unlocked Successfully!'); }, 600);
    } catch (e) {
      busy(false);
      if ($('proRestoreEmail')) $('proRestoreEmail').value = email;
      if ($('proRestorePay')) $('proRestorePay').value = paymentId;
      status('Your payment went through (Payment ID: ' + paymentId + ') but unlocking did not finish: ' + e.message + ' Please tap "Restore Pro" below.');
    }
  }

  window.startProPayment = async function () {
    var email = ($('proEmailInput').value || '').trim().toLowerCase();
    if (!validEmail(email)) { status('Please enter a valid email address. Your receipt and license are linked to it.'); return; }
    busy(true);
    status('Starting secure payment…', true);
    try {
      var o = await api('/create-order', { email: email, product: PRODUCT });
      await loadRazorpay();
      var rzp = new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: o.currency, name: BRAND, description: o.description,
        order_id: o.orderId, prefill: { email: email }, theme: { color: '#1e3a8a' },
        handler: function (resp) { finishActivation(resp.razorpay_payment_id, email, resp); },
        modal: { ondismiss: function () { busy(false); status('Payment window closed. You can try again.'); } }
      });
      if (rzp.on) rzp.on('payment.failed', function (r) {
        busy(false);
        status('Payment failed' + (r && r.error && r.error.description ? ': ' + r.error.description : '') + '. You were not charged. Please try again.');
      });
      rzp.open();
    } catch (e) { busy(false); status(e.message || 'Could not start the payment. Please try again.'); }
  };

  window.restoreProLicense = async function () {
    var email = ($('proRestoreEmail').value || '').trim().toLowerCase();
    var pay = ($('proRestorePay').value || '').trim();
    if (!validEmail(email)) { status('Please enter the email you used for the payment.'); return; }
    if (!/^pay_/.test(pay)) { status('Payment ID starts with "pay_" and is in your Razorpay receipt email.'); return; }
    busy(true);
    status('Checking your payment…', true);
    try {
      var out = await api('/activate', { paymentId: pay, email: email, deviceId: getDeviceId() });
      await storeToken(out.token);
      busy(false);
      status('Pro is unlocked on this device. Thank you!', true);
      setTimeout(function () { closeProModal(); alert('Pro Edition Unlocked Successfully!'); }, 600);
    } catch (e) { busy(false); status(e.message); }
  };

  // ---------- new Pro popup ----------
  function buildModal() {
    var body = document.querySelector('#proModal .mt-3');
    if (!body || $('proPayBtn')) return;
    body.innerHTML =
      '<ul class="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium text-slate-700">' +
      '<li>✅ Removes the watermark from PDFs, prints &amp; WhatsApp bills</li>' +
      '<li>✅ Keeps unlimited saved bills</li>' +
      '<li>✅ One-time payment of ' + PRICE_TEXT + ' — lifetime, works on up to 3 of your devices</li></ul>' +
      '<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">' +
      '<div class="font-extrabold text-emerald-950 text-xs uppercase tracking-wider">Pay ' + PRICE_TEXT + ' &amp; unlock instantly</div>' +
      '<input type="email" id="proEmailInput" autocomplete="email" placeholder="Your email (for receipt &amp; license)" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-medium" />' +
      '<button type="button" id="proPayBtn" onclick="startProPayment()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-2.5 rounded-lg shadow transition">Pay ' + PRICE_TEXT + ' &amp; Unlock Pro →</button>' +
      '<div class="text-[11px] text-emerald-800">Secure payment by Razorpay: UPI, cards, netbanking. Pro unlocks as soon as the payment succeeds.</div></div>' +
      '<div id="proStatus" style="display:none"></div>' +
      '<div class="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2">' +
      '<div class="font-extrabold text-blue-950 text-xs uppercase tracking-wider">Already paid? Restore Pro</div>' +
      '<p class="text-[11px] text-blue-800">New phone or cleared browser? Enter the email you paid with and the Payment ID from your Razorpay receipt (starts with pay_).</p>' +
      '<input type="email" id="proRestoreEmail" placeholder="Email used for payment" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white" />' +
      '<input type="text" id="proRestorePay" placeholder="Payment ID (pay_XXXXXXXXXXXXXX)" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-mono" />' +
      '<button type="button" id="proRestoreBtn" onclick="restoreProLicense()" class="w-full bg-blue-800 hover:bg-blue-900 text-white font-extrabold text-xs py-2.5 rounded-lg shadow transition">Restore Pro</button></div>';
  }

  buildModal();
  try { loadState(); renderAll(); } catch (e) { console.warn('Pro system start:', e); }
})();
