/* GST Bill Maker - "Install App" button + offline support (registers sw.js). */
(function () {
  function $(id) { return document.getElementById(id); }
  var deferred = null;

  function isInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  function makeButton() {
    if ($('installAppBtn') || isInstalled()) return;
    var pro = $('openProModalBtn');
    if (!pro || !pro.parentElement) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'installAppBtn';
    b.className = 'bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-lg shrink-0 no-print';
    b.textContent = '💻 Install App';
    b.addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; });
      } else {
        alert('To install on your computer:\n\n' +
          '• Chrome / Edge: click the install icon at the right end of the address bar, or open the menu (⋮) and choose "Install GST Bill Maker".\n' +
          '• Safari on Mac: File menu > Add to Dock.\n' +
          '• iPhone: tap Share > Add to Home Screen.\n' +
          '• Android: browser menu > Install app.');
      }
    });
    pro.parentElement.insertBefore(b, pro.parentElement.firstChild);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    makeButton();
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    var b = $('installAppBtn');
    if (b) b.remove();
  });

  makeButton();
})();
