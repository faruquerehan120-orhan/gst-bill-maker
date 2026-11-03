/* GST Bill Maker - Round 3: print modes add-on.
   Adds a paper switch in Preview: A4 Full Page / 3-inch (80mm) / 2-inch (58mm) thermal receipt. */
(function () {
  function $(id) { return document.getElementById(id); }

  var MODES = {
    a4: { label: 'A4 Full Page' },
    t80: { label: '3-inch (80mm)', w: '80mm' },
    t58: { label: '2-inch (58mm)', w: '58mm' }
  };

  var CSS =
    '.th-sub{display:none}' +
    'body.thermal-mode #printableArea{width:var(--rw,80mm);max-width:100%;margin:0 auto;padding:10px !important;font-size:11px}' +
    'body.thermal-mode #printableArea > div:first-child{flex-direction:column !important;align-items:flex-start !important}' +
    'body.thermal-mode #printableArea > div:first-child > div{text-align:left !important}' +
    'body.thermal-mode #printableArea .c-sno,body.thermal-mode #printableArea .c-unit,body.thermal-mode #printableArea .c-gst,body.thermal-mode #printableArea .col-hsn{display:none !important}' +
    'body.thermal-mode #printableArea table{font-size:10px}' +
    'body.thermal-mode #printableArea th,body.thermal-mode #printableArea td{padding:3px 2px !important}' +
    'body.thermal-mode #printableArea .grid{display:block !important}' +
    'body.thermal-mode #printableArea .grid > div{margin-bottom:8px}' +
    'body.thermal-mode #printableArea h2{font-size:15px !important}' +
    'body.thermal-mode #prevBizLogo{width:40px !important;height:40px !important;font-size:13px !important}' +
    'body.thermal-mode #gstExtras .w-56{width:100% !important}' +
    'body.thermal-mode #gstExtras .h-14{height:32px !important}' +
    'body.thermal-mode .th-sub{display:block;font-size:9px;color:#64748b;font-weight:500}' +
    '@media print{' +
    'body.thermal-mode{margin:0 !important}' +
    'body.thermal-mode #printableArea{width:var(--rw,80mm) !important;max-width:none !important;margin:0 !important;padding:3mm !important}' +
    'body.thermal-mode #centerPrintWatermark.active-free-watermark{font-size:18px !important;padding:4px 8px !important;border-width:2px !important;letter-spacing:1px !important}' +
    'body.thermal-mode #centerPrintWatermark.active-free-watermark span{font-size:8px !important}' +
    '}';

  var st = document.createElement('style');
  st.id = 'printModesCss';
  st.textContent = CSS;
  document.head.appendChild(st);

  var pageStyle = document.createElement('style');
  pageStyle.id = 'printModePage';
  document.head.appendChild(pageStyle);

  var BTN_ON = 'px-2 py-1 rounded font-bold bg-blue-900 text-white';
  var BTN_OFF = 'px-2 py-1 rounded font-bold bg-slate-100 text-slate-700 hover:bg-slate-200';

  window.setPrintMode = function (m) {
    appState.printMode = MODES[m] ? m : 'a4';
    saveState();
    renderAll();
  };

  function injectBar() {
    var pb = document.querySelector('button[onclick="window.print()"]');
    if (!pb || $('printModeBar')) return;
    var bar = document.createElement('div');
    bar.id = 'printModeBar';
    bar.className = 'flex flex-wrap items-center gap-1 text-[11px]';
    var lab = document.createElement('span');
    lab.className = 'font-bold text-slate-500';
    lab.textContent = 'Paper:';
    bar.appendChild(lab);
    Object.keys(MODES).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-mode', k);
      b.textContent = MODES[k].label;
      b.addEventListener('click', function () { window.setPrintMode(k); });
      bar.appendChild(b);
    });
    var hint = document.createElement('div');
    hint.id = 'printModeHint';
    hint.className = 'w-full text-[11px] text-amber-700';
    hint.style.display = 'none';
    hint.textContent = 'In the print window, pick your receipt printer and its roll paper size (80mm or 58mm).';
    bar.appendChild(hint);
    pb.parentElement.insertBefore(bar, pb.parentElement.firstChild);
  }

  // Marks table columns so thermal mode can hide the extra ones, and adds a short detail line under each item
  function tagTable() {
    var body = $('previewTableBody');
    if (!body) return;
    var head = body.closest('table').querySelector('thead tr');
    var ths = head.children, map = {}, itemIdx = -1, i;
    for (i = 0; i < ths.length; i++) {
      var tx = ths[i].textContent.trim(), cls = '';
      if (tx === '#') cls = 'c-sno';
      else if (tx === 'Unit Price') cls = 'c-unit';
      else if (tx === 'GST') cls = 'c-gst';
      else if (tx.indexOf('Item') === 0) itemIdx = i;
      if (cls) { ths[i].classList.add(cls); map[i] = cls; }
    }
    var items = appState.items || [];
    for (var r = 0; r < body.children.length; r++) {
      var row = body.children[r];
      for (var k in map) {
        if (row.children[k]) row.children[k].classList.add(map[k]);
      }
      var it = items[r];
      if (itemIdx > -1 && row.children[itemIdx] && it) {
        var sub = document.createElement('div');
        sub.className = 'th-sub';
        sub.textContent = it.qty + ' ' + (it.unit || 'pcs') + ' × ₹' + Number(it.price).toFixed(2) +
          ' • GST ' + it.gst + '%' + (it.hsn ? ' • HSN ' + it.hsn : '');
        row.children[itemIdx].appendChild(sub);
      }
    }
  }

  function applyMode() {
    var m = MODES[appState.printMode] ? appState.printMode : 'a4';
    var thermal = m !== 'a4';
    document.body.classList.toggle('thermal-mode', thermal);
    if (thermal) document.body.style.setProperty('--rw', MODES[m].w);
    else document.body.style.removeProperty('--rw');
    pageStyle.textContent = thermal ? '@page { size: auto; margin: 0; }' : '';
    var bar = $('printModeBar');
    if (bar) {
      var bs = bar.querySelectorAll('button[data-mode]');
      for (var i = 0; i < bs.length; i++) {
        bs[i].className = bs[i].getAttribute('data-mode') === m ? BTN_ON : BTN_OFF;
      }
      $('printModeHint').style.display = thermal ? '' : 'none';
    }
  }

  var origRender = window.renderAll;
  window.renderAll = function () {
    if (typeof origRender === 'function') origRender.apply(this, arguments);
    try { tagTable(); applyMode(); } catch (err) { console.warn('Print modes:', err); }
  };

  injectBar();
  try { renderAll(); } catch (err) { console.warn('Print modes start:', err); }
})();
