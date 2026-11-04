/* GST Bill Maker - Pro system (temporary 7-day Pro + permanent device key).
   Replaces the idea of pro-lock.js. Add it LAST, after your other script lines. */
(function () {
  function $(id) { return document.getElementById(id); }

  // ===== ONLY THING YOU MUST EDIT: your WhatsApp number =====
  // Write 91 followed by your 10 digits. No spaces, no + sign. Example: '919800000000'
  var SELLER_WHATSAPP = '91XXXXXXXXXX';
  // How many days of Pro after the customer sends payment proof
  var TRIAL_DAYS = 7;
  // =========================================================

  // Secret (already matches your private seller-key-generator.html). Do not share.
  var PRO_SECRET = 'OEB785UR5ALZ96802RNOY9VE';
  var DAY = 86400000;
  var mode = 'free', trialDays = 0;

  function getDeviceCode() {
    var code = '';
    try { code = localStorage.getItem('gst_device_code') || ''; } catch (e) {}
    if (!code) {
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      try { localStorage.setItem('gst_device_code', code); } catch (e) {}
    }
    return code;
  }

  function proHash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36).toUpperCase().padStart(7, '0') +
           (h1 >>> 0).toString(36).toUpperCase().padStart(7, '0');
  }
  function makeProKey(deviceCode) {
    var clean = String(deviceCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    var h = proHash(clean + '|' + PRO_SECRET);
    return 'GSTPRO-' + h.substring(0, 4) + '-' + h.substring(4, 8);
  }
  function isValidProKey(deviceCode, key) {
    if (!deviceCode || !key) return false;
    return String(key).trim().toUpperCase() === makeProKey(deviceCode);
  }

  // ---------- Trial state ----------
  function trialInfo() {
    var now = Date.now(), s = appState.trialStart;
    if (!s) return { state: 'none' };
    if (appState.trialTampered) return { state: 'ended' };
    var last = appState.trialLastSeen || s;
    if (now < last - 3600000) { appState.trialTampered = true; return { state: 'ended' }; }
    var end = s + TRIAL_DAYS * DAY;
    if (now >= end) return { state: 'ended' };
    return { state: 'active', daysLeft: Math.max(1, Math.ceil((end - now) / DAY)) };
  }

  function refreshPro() {
    var perm = isValidProKey(getDeviceCode(), appState.proKey);
    var ti = trialInfo();
    mode = perm ? 'perm' : (ti.state === 'active' ? 'trial' : 'free');
    trialDays = ti.daysLeft || 0;
    appState.isPro = (mode !== 'free');
    var now = Date.now();
    if (ti.state === 'active' && now > (appState.trialLastSeen || 0) + 60000) {
      appState.trialLastSeen = now;
      saveState();
    }
    if (ti.state === 'ended' && !perm && appState.trialStart && !appState.trialEndNotified) {
      appState.trialEndNotified = true;
      saveState();
      setTimeout(function () {
        alert('Your ' + TRIAL_DAYS + '-day Pro trial has ended. If you have paid, please enter the permanent key you received on WhatsApp, or message us for it.');
      }, 300);
    }
  }

  // Keeps the app's print-watermark check in step with real Pro status
  function syncProFlag() {
    try { localStorage.setItem('isPro', appState.isPro === true ? 'true' : 'false'); } catch (e) {}
  }

  // ---------- Replace the app's functions ----------
  window.loadState = function () {
    try {
      var raw = localStorage.getItem('gst_invoice_maker_state_v3');
      if (raw) appState = Object.assign({}, appState, JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load saved state:', e);
    }
    refreshPro();
    syncProFlag();
  };

  var origRender = window.renderAll;
  window.renderAll = function () {
    refreshPro();
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { proUi(); } catch (err) { console.warn('Pro UI:', err); }
    syncProFlag();
  };

  function proUi() {
    var badge = $('proStatusBadge'), btn = $('openProModalBtn');
    var label = btn && btn.firstElementChild;
    if (mode === 'trial') {
      if (badge) {
        badge.textContent = '★ PRO TRIAL: ' + trialDays + ' day' + (trialDays === 1 ? '' : 's') + ' left';
        badge.style.background = '#d97706';
        badge.classList.remove('hidden');
      }
      if (btn) { btn.classList.remove('hidden'); if (label) label.textContent = '🔑 Enter Pro Key'; }
    } else {
      if (badge) { badge.textContent = '★ PRO UNLOCKED'; badge.style.background = ''; }
      if (label) label.textContent = '👑 Unlock Pro (₹299)';
    }
  }

  var origOpen = window.openProModal;
  window.openProModal = function () {
    if (typeof origOpen === 'function') origOpen.apply(this, arguments);
    var el = $('deviceCodeText');
    if (el) el.textContent = getDeviceCode();
  };

  window.verifyUtrAndAutoUnlock = function () {
    var shop = ($('utrBizNameInput').value || '').trim();
    var utr = ($('utrNumberInput').value || '').replace(/\D/g, '');
    if (!shop) { alert('Please enter your Shop / Business Name.'); return; }
    if (utr.length !== 12) { alert('Please enter the 12-digit UPI Reference / UTR number from your payment screen.'); return; }
    if (!/^91\d{10}$/.test(SELLER_WHATSAPP)) { alert('Seller WhatsApp number is not set yet. Please contact the app owner.'); return; }

    var startedNow = false;
    if (!appState.trialStart) {
      appState.trialStart = Date.now();
      appState.trialLastSeen = Date.now();
      appState.trialUtr = utr;
      startedNow = true;
      saveState();
      renderAll();
    }

    var msg = 'Hello, I paid Rs 299 for GST Invoice Pro.\n' +
              'Shop Name: ' + shop + '\n' +
              'UPI Ref / UTR: ' + utr + '\n' +
              'Device Code: ' + getDeviceCode() + '\n' +
              'Please confirm and send my permanent activation key.';
    window.open('https://wa.me/' + SELLER_WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');

    var box = $('autoKeyResultBox');
    if (box) {
      box.classList.remove('hidden');
      box.textContent = startedNow
        ? TRIAL_DAYS + '-day Pro is now ON. Your request was sent on WhatsApp. When your payment is confirmed you will get a permanent key. Enter it below.'
        : 'Request sent again on WhatsApp. (The free ' + TRIAL_DAYS + '-day Pro can be started only once on a device.) Enter your key below when you receive it.';
    }
  };

  window.activateManualKey = function () {
    var val = ($('manualKeyInput').value || '').trim().toUpperCase();
    if (isValidProKey(getDeviceCode(), val)) {
      appState.proKey = val;
      saveState();
      renderAll();
      closeProModal();
      alert('Pro Edition Unlocked Successfully!');
    } else {
      alert('Wrong activation key for this device. Please check and try again.');
    }
  };

  // ---------- Tidy the Pro popup ----------
  function patchModal() {
    var i, nodes = document.querySelectorAll('#proModal div');
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length === 0 && nodes[i].textContent.trim().indexOf('Step 2:') === 0) {
        nodes[i].textContent = 'Step 2: Start ' + TRIAL_DAYS + '-Day Pro + Get Your Key';
        break;
      }
    }
    nodes = document.querySelectorAll('#proModal p');
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].textContent.trim().indexOf('After paying') === 0) {
        nodes[i].textContent = 'After paying ₹299, enter your Shop Name and the 12-digit UPI Ref / UTR Number from your payment screen. Tap the button: Pro starts right away for ' + TRIAL_DAYS + ' days and your payment proof goes to us on WhatsApp. After we confirm the payment, you get a permanent key.';
        break;
      }
    }
    var btn = document.querySelector('#proModal button[onclick="verifyUtrAndAutoUnlock()"]');
    if (btn) btn.textContent = 'Send Payment Proof & Start ' + TRIAL_DAYS + '-Day Pro';
    var utrInput = $('utrNumberInput');
    if (utrInput && !$('deviceCodeText')) {
      var d = document.createElement('div');
      d.className = 'text-[11px] text-blue-900 font-semibold';
      d.innerHTML = 'Your Device Code: <span id="deviceCodeText" class="font-mono font-extrabold"></span> (sent to us automatically)';
      utrInput.insertAdjacentElement('afterend', d);
    }
    var sb = $('sellerToolBox');
    if (sb && sb.parentElement) sb.parentElement.remove();
  }

  patchModal();
  try { loadState(); renderAll(); } catch (err) { console.warn('Pro system start:', err); }
})();
