/* GST Bill Maker - Round 2: counter workflow add-on.
   Adds: shop logo upload, auto invoice numbers + New Bill, recent bills with today's sales,
   better WhatsApp button, blank starting values for new users. */
(function () {
  function $(id) { return document.getElementById(id); }
  var STORE_KEY = 'gst_invoice_maker_state_v3';

  // ---------- New users start with blank shop details (not the owner's) ----------
  try {
    if (!localStorage.getItem(STORE_KEY)) {
      appState.bizLogo = '';
      appState.bizName = '';
      appState.bizAddress = '';
      appState.bizUpi = '';
      appState.items = [];
    }
  } catch (e) {}

  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#0f172a;color:#fff;' +
      'padding:10px 16px;border-radius:10px;font:600 13px sans-serif;z-index:99999;max-width:90%;text-align:center';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  // ---------- Invoice number: INV-101 -> INV-102 ----------
  function nextInvoiceNumber(s) {
    s = String(s || '').trim();
    var m = s.match(/^(.*?)(\d+)(\D*)$/);
    if (!m) return (s || 'INV') + '-1';
    var next = String(parseInt(m[2], 10) + 1);
    while (next.length < m[2].length) next = '0' + next;
    return m[1] + next + m[3];
  }
  window.nextInvoiceNumber = nextInvoiceNumber;

  // ---------- Saving bills (recent list) ----------
  function recordBill() {
    if (!appState.items || !appState.items.length) return false;
    var t = calculateTotals();
    var rec = {
      id: Date.now(),
      invNumber: appState.invNumber,
      invDate: appState.invDate,
      savedDay: formatTodayDate(),
      custName: appState.custName,
      grandTotal: t.grandTotal,
      itemsCount: appState.items.length,
      snapshot: JSON.parse(JSON.stringify({
        docTitle: appState.docTitle, custName: appState.custName, custPhone: appState.custPhone,
        custAddress: appState.custAddress, custGstin: appState.custGstin || '',
        isIgst: !!appState.isIgst, items: appState.items
      }))
    };
    var list = appState.savedBills || (appState.savedBills = []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].invNumber === rec.invNumber) {
        rec.id = list[i].id;
        rec.savedDay = list[i].savedDay || rec.savedDay;
        list.splice(i, 1);
        break;
      }
    }
    list.unshift(rec);
    var cap = appState.isPro ? 500 : 20;
    if (list.length > cap) list.length = cap;
    saveState();
    return true;
  }

  window.saveCurrentBill = function () {
    if (!recordBill()) { alert('Add at least one item before saving.'); return; }
    renderAll();
    toast('Invoice #' + appState.invNumber + ' saved');
  };

  window.startNewBill = function () {
    var has = appState.items && appState.items.length > 0;
    var nextNo = nextInvoiceNumber(appState.invNumber);
    if (has && !confirm('Save this bill and start a new one (' + nextNo + ')?')) return;
    if (has) recordBill();
    appState.invNumber = nextNo;
    appState.invDate = formatTodayDate();
    appState.custName = 'Walk-in Customer';
    appState.custPhone = '';
    appState.custAddress = '';
    appState.custGstin = '';
    appState.isIgst = false;
    appState.items = [];
    populateFormFromState();
    saveState();
    renderAll();
    switchTab('edit');
    toast('New bill ready: ' + nextNo);
  };

  window.openSavedBill = function (idx) {
    var b = (appState.savedBills || [])[idx];
    if (!b || !b.snapshot) return;
    var s = JSON.parse(JSON.stringify(b.snapshot));
    appState.docTitle = s.docTitle || appState.docTitle;
    appState.custName = s.custName || '';
    appState.custPhone = s.custPhone || '';
    appState.custAddress = s.custAddress || '';
    appState.custGstin = s.custGstin || '';
    appState.isIgst = !!s.isIgst;
    appState.items = s.items || [];
    appState.invNumber = b.invNumber;
    appState.invDate = b.invDate;
    populateFormFromState();
    saveState();
    renderAll();
    switchTab('edit');
    toast('Bill #' + b.invNumber + ' opened');
  };

  window.renderSavedBills = function () {
    var box = $('savedBillsContainer');
    if (!box) return;
    var list = appState.savedBills || [];
    var today = formatTodayDate(), n = 0, sum = 0;
    list.forEach(function (b) { if (b.savedDay === today) { n++; sum += Number(b.grandTotal) || 0; } });

    var sm = $('todaySummary');
    if (!sm) {
      sm = document.createElement('div');
      sm.id = 'todaySummary';
      sm.className = 'mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-950';
      box.parentElement.insertBefore(sm, box);
    }
    sm.innerHTML = 'Today (' + escapeHtml(today) + '): <strong>' + n + ' bill' + (n === 1 ? '' : 's') +
      '</strong> • Total sales <strong>₹' + sum.toFixed(2) + '</strong>';

    if (!list.length) {
      box.innerHTML = '<div class="text-slate-400 italic py-4 text-center">No saved bills yet. Bills are saved when you print, send on WhatsApp, or tap "Save Bill".</div>';
      return;
    }
    var html = '';
    list.forEach(function (b, idx) {
      html += '<div class="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">' +
        '<div><div class="font-bold text-slate-800">#' + escapeHtml(b.invNumber) + ' — ' + escapeHtml(b.custName) + '</div>' +
        '<div class="text-xs text-slate-500">' + escapeHtml(b.invDate) + ' • ' + b.itemsCount + ' items</div></div>' +
        '<div class="flex items-center gap-2"><span class="font-extrabold text-blue-900">₹' + Number(b.grandTotal).toFixed(2) + '</span>' +
        (b.snapshot ? '<button type="button" onclick="openSavedBill(' + idx + ')" class="text-xs font-bold bg-blue-800 text-white px-2.5 py-1 rounded">Open</button>' : '') +
        '<button type="button" onclick="deleteSavedBill(' + idx + ')" class="text-red-500 hover:text-red-700 font-bold">✕</button></div></div>';
    });
    if (!appState.isPro) {
      html += '<div class="text-[11px] text-slate-400 text-center pt-1">Free version keeps your last 20 bills. Pro keeps all of them.</div>';
    }
    box.innerHTML = html;
  };

  // Bills are saved automatically after printing / saving PDF
  window.addEventListener('afterprint', function () {
    if (recordBill()) renderAll();
  });

  // ---------- WhatsApp: send the bill to the customer ----------
  window.shareOnWhatsApp = function () {
    var t = calculateTotals();
    var money = function (n) { return '₹' + Number(n).toFixed(2); };
    var msg = '*' + (appState.bizName || 'INVOICE') + '*\n' +
      (appState.docTitle || 'TAX INVOICE') + ' #' + (appState.invNumber || '') + '\n' +
      'Date: ' + (appState.invDate || '') + '\n' +
      'Customer: ' + (appState.custName || 'Walk-in') + '\n---------------------------\n';
    appState.items.forEach(function (it, i) {
      var line = it.qty * it.price * (1 + it.gst / 100);
      msg += (i + 1) + '. ' + it.name + (it.hsn ? ' [HSN ' + it.hsn + ']' : '') +
        ' (' + it.qty + ' ' + (it.unit || 'pcs') + ' × ' + money(it.price) + ') = ' + money(line) + '\n';
    });
    msg += '---------------------------\nSubtotal: ' + money(t.subtotal) + '\n';
    msg += appState.isIgst ? ('IGST: ' + money(t.totalGst) + '\n')
                           : ('CGST: ' + money(t.cgst) + '\nSGST: ' + money(t.sgst) + '\n');
    msg += '*Grand Total: ' + money(t.grandTotal) + '*\n';
    if (typeof window.amountInWords === 'function') msg += window.amountInWords(t.grandTotal) + '\n';
    if (appState.bizUpi) {
      msg += '\nPay via UPI ID: ' + appState.bizUpi + '\n' +
        'upi://pay?pa=' + encodeURIComponent(appState.bizUpi) + '&pn=' + encodeURIComponent(appState.bizName || 'Merchant') +
        '&am=' + t.grandTotal.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('Invoice ' + (appState.invNumber || ''));
    }
    if (!appState.isPro) msg += '\n\n_Created with GST Invoice & Bill Maker_';

    if (recordBill()) renderAll();

    var p = String(appState.custPhone || '').replace(/\D/g, '');
    if (p.length === 11 && p.charAt(0) === '0') p = p.slice(1);
    if (p.length === 10) p = '91' + p;
    var base = 'https://wa.me/';
    if (p.length >= 11) {
      base += p;
    } else {
      alert('Customer phone number is missing or incomplete. WhatsApp will open so you can choose the customer yourself.');
    }
    window.open(base + '?text=' + encodeURIComponent(msg), '_blank');
  };

  // ---------- Shop logo ----------
  function handleLogoFile(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 200 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        appState.bizLogoImg = c.toDataURL('image/png');
        saveState();
        renderAll();
        toast('Logo saved');
      };
      img.onerror = function () { alert('Could not read this picture. Please try a JPG or PNG photo.'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function injectUi() {
    var upi = $('bizUpiInput');
    if (upi && !$('logoFileInput')) {
      var wrap = upi.parentElement;
      var box = document.createElement('div');
      box.className = 'sm:col-span-3';
      box.innerHTML = '<label class="block text-xs font-semibold text-slate-600 mb-1">Shop Logo (optional, from your gallery)</label>' +
        '<div class="flex items-center gap-3">' +
        '<img id="logoThumb" alt="Logo" class="w-12 h-12 rounded border border-slate-200 object-contain bg-white" style="display:none" />' +
        '<input type="file" id="logoFileInput" accept="image/*" class="text-xs flex-1" />' +
        '<button type="button" id="logoRemoveBtn" class="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-md" style="display:none">Remove</button></div>';
      wrap.parentElement.appendChild(box);
      $('logoFileInput').addEventListener('change', function () { handleLogoFile(this.files && this.files[0]); this.value = ''; });
      $('logoRemoveBtn').addEventListener('click', function () { appState.bizLogoImg = ''; saveState(); renderAll(); });
    }

    var saveBtn = document.querySelector('button[onclick="saveCurrentBill()"]');
    if (saveBtn && !$('newBillBtn')) {
      var nb = document.createElement('button');
      nb.type = 'button';
      nb.id = 'newBillBtn';
      nb.setAttribute('onclick', 'startNewBill()');
      nb.className = 'bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg shadow transition';
      nb.textContent = '➕ New Bill';
      saveBtn.insertAdjacentElement('beforebegin', nb);
    }

    var wa = document.querySelector('button[onclick="shareOnWhatsApp()"]');
    if (wa) wa.innerHTML = '<span>📲 Send to Customer on WhatsApp</span>';
  }

  function enhance() {
    var lg = $('prevBizLogo');
    var thumb = $('logoThumb'), rm = $('logoRemoveBtn');
    if (lg) {
      if (appState.bizLogoImg) {
        lg.contentEditable = 'false';
        lg.innerHTML = '';
        var im = document.createElement('img');
        im.src = appState.bizLogoImg;
        im.alt = 'Logo';
        im.className = 'w-full h-full object-contain';
        lg.appendChild(im);
        lg.style.background = '#ffffff';
      } else {
        lg.contentEditable = 'true';
        lg.style.background = '';
      }
    }
    if (thumb) { thumb.style.display = appState.bizLogoImg ? '' : 'none'; if (appState.bizLogoImg) thumb.src = appState.bizLogoImg; }
    if (rm) rm.style.display = appState.bizLogoImg ? '' : 'none';
  }

  var origRender = window.renderAll;
  window.renderAll = function () {
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { enhance(); } catch (err) { console.warn('Counter tools:', err); }
  };

  injectUi();
  try { renderAll(); } catch (err) { console.warn('Counter tools start:', err); }
})();
