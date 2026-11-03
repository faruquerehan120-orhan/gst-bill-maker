/* GST Bill Maker - Optional extra: upload your own payment QR (PhonePe / Paytm / Google Pay etc.) */
(function () {
  function $(id) { return document.getElementById(id); }

  function handleQrFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('This picture is too big. Please choose one under 5 MB.'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 500 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        appState.bizQrImg = c.toDataURL('image/png');
        saveState();
        renderAll();
      };
      img.onerror = function () { alert('Could not read this picture. Please try a JPG or PNG screenshot of your QR.'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function injectUi() {
    var upi = $('bizUpiInput');
    if (!upi || $('qrFileInput')) return;
    var box = document.createElement('div');
    box.className = 'sm:col-span-3';
    box.innerHTML = '<label class="block text-xs font-semibold text-slate-600 mb-1">Your Own Payment QR Image (optional)</label>' +
      '<div class="flex items-center gap-3">' +
      '<img id="qrThumb" alt="QR" class="w-12 h-12 rounded border border-slate-200 object-contain bg-white" style="display:none" />' +
      '<input type="file" id="qrFileInput" accept="image/*" class="text-xs flex-1" />' +
      '<button type="button" id="qrRemoveBtn" class="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-md" style="display:none">Remove</button></div>' +
      '<div class="text-[11px] text-slate-500 mt-1">Upload a screenshot of your QR from PhonePe, Paytm or Google Pay. It replaces the automatic QR. Note: your own QR has no bill amount, so the customer types the amount.</div>';
    upi.parentElement.parentElement.appendChild(box);
    $('qrFileInput').addEventListener('change', function () { handleQrFile(this.files && this.files[0]); this.value = ''; });
    $('qrRemoveBtn').addEventListener('click', function () { appState.bizQrImg = ''; saveState(); renderAll(); });
  }

  function enhance() {
    var has = !!appState.bizQrImg;
    var thumb = $('qrThumb'), rm = $('qrRemoveBtn');
    if (thumb) { thumb.style.display = has ? '' : 'none'; if (has) thumb.src = appState.bizQrImg; }
    if (rm) rm.style.display = has ? '' : 'none';
    if (!has) return;
    var qr = $('custUpiQrImg'), txt = $('prevUpiIdText');
    if (qr) { qr.src = appState.bizQrImg; qr.classList.remove('hidden'); }
    if (txt) txt.innerText = appState.bizUpi ? ('UPI ID: ' + appState.bizUpi) : 'Scan the QR to pay';
  }

  var origRender = window.renderAll;
  window.renderAll = function () {
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { enhance(); } catch (err) { console.warn('QR upload:', err); }
  };

  injectUi();
  try { renderAll(); } catch (err) { console.warn('QR upload start:', err); }
})();
