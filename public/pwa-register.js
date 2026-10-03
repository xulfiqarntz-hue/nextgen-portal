(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(error => {
        console.error('PWA service worker registration failed:', error);
      });
    });
  }

  const installButton = document.getElementById('pwa-install-button');
  const iosHint = document.getElementById('ios-install-hint');
  if (!installButton) return;

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return;

  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;

  if (isAppleMobile) installButton.hidden = false;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
    installButton.textContent = 'Install app';
  });

  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    if (iosHint) iosHint.hidden = true;
  });

  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      if (iosHint) iosHint.hidden = !iosHint.hidden;
      return;
    }

    installButton.disabled = true;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') installButton.hidden = true;
    installButton.disabled = false;
    installPrompt = null;
  });
})();
