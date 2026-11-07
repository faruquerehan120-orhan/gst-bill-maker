/* GST Bill Maker - print fixes:
   1) 2-inch receipt: UPI ID no longer cut off   2) A4: at least 1 cm left space
   3) White paper, bill printed in black (no gray)   4) No extra blank page */
(function () {
  var css =
    '@media print{' +
      // 4) no extra blank page: the page itself must not be taller than the bill
      'html,body{height:auto !important;min-height:0 !important;margin:0 !important;padding:0 !important;overflow:visible !important}' +
      'main,main > section{height:0 !important;min-height:0 !important;margin:0 !important;padding:0 !important;overflow:visible !important}' +
      // 3) white paper, black bill
      'html,body,main,main > section{background:#ffffff !important}' +
      '#printableArea{background:#ffffff !important}' +
      '#printableArea *:not(img){background:transparent !important;color:#000000 !important;border-color:#000000 !important;box-shadow:none !important;text-shadow:none !important}' +
      '#printableArea #prevDocTitle,#printableArea #prevBizLogo{border:1px solid #000000 !important}' +
      // 2) A4: 12 mm left and right, 10 mm top and bottom
      'body:not(.thermal-mode) #printableArea{padding:10mm 12mm 10mm 12mm !important}' +
      // keep table rows and the signature area from splitting across pages
      '#printableArea tr,#gstExtras{break-inside:avoid;page-break-inside:avoid}' +
    '}' +
    // 1) long UPI IDs wrap instead of being cut off (screen and print)
    '#prevUpiIdText{overflow-wrap:anywhere;word-break:break-all}' +
    'body.thermal-mode .qr-box{flex-direction:column !important;align-items:flex-start !important}' +
    // receipt: the table has only Item + Amount (quantity and price are in the small line under each item), so nothing is clipped
    'body.thermal-mode #printableArea td.text-center,body.thermal-mode #printableArea th.text-center{display:none !important}' +
    'body.thermal-mode #printableArea td.text-right,body.thermal-mode #printableArea th.text-right{white-space:nowrap}' +
    'body.thermal-mode #printableArea .overflow-x-auto{overflow:visible !important}' +
    'body.thermal-mode #printableArea table{width:100%}' +
    // receipt: long totals wrap instead of running off the paper
    'body.thermal-mode #printableArea .flex.justify-between{flex-wrap:wrap;column-gap:6px}' +
    'body.thermal-mode #printableArea .border-t.pt-2{font-size:14px !important}';

  var st = document.createElement('style');
  st.id = 'printFixCss';
  st.textContent = css;
  document.head.appendChild(st);

  var q = document.getElementById('custUpiQrImg');
  if (q && q.parentElement) q.parentElement.classList.add('qr-box');
})();
