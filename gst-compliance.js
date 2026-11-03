/* GST Bill Maker - Round 1: GST compliance add-on.
   Adds: HSN/SAC code, IGST toggle, customer GSTIN, amount in words, authorized signatory box. */
(function () {
  function $(id) { return document.getElementById(id); }

  // ---------- Amount in words (Indian system: Thousand, Lakh, Crore) ----------
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }
  function threeDigits(n) {
    var h = Math.floor(n / 100), r = n % 100, out = '';
    if (h) out += ONES[h] + ' Hundred';
    if (r) out += (out ? ' ' : '') + twoDigits(r);
    return out;
  }
  function wordsIndian(n) {
    if (n === 0) return 'Zero';
    var parts = [];
    var cr = Math.floor(n / 10000000); n = n % 10000000;
    var lk = Math.floor(n / 100000); n = n % 100000;
    var th = Math.floor(n / 1000); n = n % 1000;
    if (cr) parts.push(wordsIndian(cr) + ' Crore');
    if (lk) parts.push(twoDigits(lk) + ' Lakh');
    if (th) parts.push(twoDigits(th) + ' Thousand');
    if (n) parts.push(threeDigits(n));
    return parts.join(' ');
  }
  function amountInWords(amount) {
    var total = Math.round((Number(amount) || 0) * 100);
    var rupees = Math.floor(total / 100), paise = total % 100;
    var s = 'Rupees ' + wordsIndian(rupees);
    if (paise) s += ' and ' + twoDigits(paise) + ' Paise';
    return s + ' Only';
  }
  window.amountInWords = amountInWords;

  // ---------- GSTIN check ----------
  var GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
  function markGstin(id) {
    var el = $(id);
    if (!el) return;
    var v = (el.value || '').trim().toUpperCase();
    var bad = v.length > 0 && !GSTIN_RE.test(v);
    el.style.borderColor = bad ? '#dc2626' : '';
    el.title = bad ? 'GSTIN should be 15 characters, e.g. 19ABCDE1234F1Z5' : '';
  }

  // ---------- Add new input boxes to the page ----------
  var INPUT_CLASS = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none';
  function injectInputs() {
    // Customer GSTIN + IGST checkbox
    var addr = $('custAddressInput');
    if (addr && !$('custGstinInput')) {
      var addrWrap = addr.parentElement;
      var lab = addrWrap.querySelector('label');
      if (lab) lab.textContent = 'Customer Address';
      var g = document.createElement('div');
      g.innerHTML = '<label class="block text-xs font-semibold text-slate-600 mb-1">Customer GSTIN (Optional)</label>' +
        '<input type="text" id="custGstinInput" maxlength="15" placeholder="e.g. 07ABCDE1234F1Z5" class="' + INPUT_CLASS + ' uppercase" />';
      addrWrap.parentElement.insertBefore(g, addrWrap.nextSibling);

      var box = document.createElement('div');
      box.className = 'sm:col-span-3';
      box.innerHTML = '<label class="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">' +
        '<input type="checkbox" id="igstInput" class="w-4 h-4" /> Out of State Sale (Apply IGST instead of CGST + SGST)</label>' +
        '<div id="igstHint" class="text-[11px] text-amber-700 mt-1"></div>';
      addrWrap.parentElement.appendChild(box);

      $('custGstinInput').addEventListener('input', function () {
        appState.custGstin = this.value.trim().toUpperCase();
        saveState();
        renderAll();
      });
      $('igstInput').addEventListener('change', function () {
        appState.isIgst = this.checked;
        saveState();
        renderAll();
      });
    }

    // HSN / SAC code box in "Add Products or Services"
    var gst = $('itemGstInput');
    if (gst && !$('itemHsnInput')) {
      var gstWrap = gst.parentElement;
      var h = document.createElement('div');
      h.className = 'sm:col-span-6';
      h.innerHTML = '<label class="block text-xs font-bold text-slate-700 mb-1">HSN / SAC Code (Optional)</label>' +
        '<input type="text" id="itemHsnInput" inputmode="numeric" maxlength="8" placeholder="e.g. 9983 or 1006" class="' + INPUT_CLASS + ' bg-white font-semibold" />';
      gstWrap.parentElement.insertBefore(h, gstWrap.nextSibling);
    }
  }

  // ---------- Keep new fields filled when the app reloads its form ----------
  var origPopulate = window.populateFormFromState;
  window.populateFormFromState = function () {
    if (typeof origPopulate === 'function') origPopulate.apply(this, arguments);
    if ($('custGstinInput')) $('custGstinInput').value = appState.custGstin || '';
    if ($('igstInput')) $('igstInput').checked = !!appState.isIgst;
  };

  // ---------- Save HSN with each new item ----------
  var origAdd = window.addItemFromForm;
  window.addItemFromForm = function () {
    var box = $('itemHsnInput');
    var hsn = box ? box.value.replace(/\D/g, '').slice(0, 8) : '';
    var before = appState.items.length;
    origAdd.apply(this, arguments);
    if (appState.items.length > before) {
      appState.items[appState.items.length - 1].hsn = hsn;
      saveState();
    }
    if (box) box.value = '';
    renderAll();
  };

  // ---------- Update the bill paper after every redraw ----------
  function enhance() {
    var items = appState.items || [];
    var t = calculateTotals();
    var igst = !!appState.isIgst;
    var anyHsn = items.some(function (i) { return i.hsn; });

    // 1) HSN/SAC column
    var body = $('previewTableBody');
    var headRow = body.closest('table').querySelector('thead tr');
    var th = headRow.querySelector('.col-hsn');
    if (!th) {
      th = document.createElement('th');
      th.className = 'col-hsn py-2.5 px-2';
      th.textContent = 'HSN/SAC';
      headRow.insertBefore(th, headRow.children[2]);
    }
    th.style.display = anyHsn ? '' : 'none';
    for (var r = 0; r < body.children.length; r++) {
      var td = document.createElement('td');
      td.className = 'col-hsn py-2.5 px-2 text-slate-600';
      td.textContent = (items[r] && items[r].hsn) || '';
      td.style.display = anyHsn ? '' : 'none';
      body.children[r].insertBefore(td, body.children[r].children[2]);
    }

    // show HSN in the edit list too
    var rows = $('editItemsList').children;
    if (rows.length === items.length) {
      for (var e = 0; e < rows.length; e++) {
        if (!items[e].hsn) continue;
        var line = rows[e].querySelector('.text-xs.text-slate-500');
        if (line) line.appendChild(document.createTextNode(' • HSN/SAC: ' + items[e].hsn));
      }
    }

    // 2) CGST+SGST or IGST
    var cgstRow = $('prevCgst').parentElement;
    var sgstRow = $('prevSgst').parentElement;
    var igstRow = $('prevIgstRow');
    if (!igstRow) {
      igstRow = cgstRow.cloneNode(true);
      igstRow.id = 'prevIgstRow';
      igstRow.children[0].textContent = 'IGST:';
      igstRow.children[1].id = 'prevIgst';
      sgstRow.parentElement.insertBefore(igstRow, sgstRow.nextSibling);
    }
    cgstRow.style.display = igst ? 'none' : '';
    sgstRow.style.display = igst ? 'none' : '';
    igstRow.style.display = igst ? '' : 'none';
    $('prevIgst').textContent = '₹' + t.totalGst.toFixed(2);

    // 3) Customer GSTIN line
    var cg = $('prevCustGstin');
    if (!cg) {
      cg = document.createElement('div');
      cg.id = 'prevCustGstin';
      cg.className = 'text-slate-600 font-semibold';
      $('prevCustAddress').insertAdjacentElement('afterend', cg);
    }
    cg.textContent = appState.custGstin ? 'GSTIN: ' + appState.custGstin : '';

    // 4) Amount in words + signatory box
    var ex = $('gstExtras');
    if (!ex) {
      var grid = $('prevGrandTotal').closest('.grid');
      ex = document.createElement('div');
      ex.id = 'gstExtras';
      ex.className = 'mt-4';
      ex.innerHTML = '<div class="text-xs"><span class="font-bold text-slate-500 uppercase tracking-wider">Amount in Words: </span>' +
        '<span id="prevAmountWords" class="font-semibold text-slate-800"></span></div>' +
        '<div class="mt-6 flex justify-end"><div class="w-56 text-center text-xs">' +
        '<div class="h-14 border-b border-slate-400"></div>' +
        '<div class="mt-1 font-bold text-slate-800">For <span id="prevSignBiz"></span></div>' +
        '<div class="text-slate-500">Authorized Signatory</div></div></div>';
      grid.insertAdjacentElement('afterend', ex);
    }
    $('prevAmountWords').textContent = amountInWords(t.grandTotal);
    $('prevSignBiz').textContent = appState.bizName || 'Your Business';

    // 5) GSTIN format check + IGST hint
    markGstin('bizGstinInput');
    markGstin('custGstinInput');
    var hint = $('igstHint');
    if (hint) {
      var a = (appState.bizGstin || '').slice(0, 2), b = (appState.custGstin || '').slice(0, 2);
      hint.textContent = (GSTIN_RE.test(appState.bizGstin || '') && GSTIN_RE.test(appState.custGstin || '') && a !== b)
        ? 'Your GSTIN state code (' + a + ') and customer state code (' + b + ') are different, so IGST usually applies.'
        : '';
    }
  }

  var origRender = window.renderAll;
  window.renderAll = function () {
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { enhance(); } catch (err) { console.warn('GST add-on:', err); }
  };

  injectInputs();
  try { populateFormFromState(); renderAll(); } catch (err) { console.warn('GST add-on start:', err); }
})();
