// PWA Initialization Script for Olocus

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Handle PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show custom install button
  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'block';
    installButton.addEventListener('click', () => {
      // Hide the button
      installButton.style.display = 'none';
      // Show the prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        deferredPrompt = null;
      });
    });
  }
});

// Detect if app was installed
window.addEventListener('appinstalled', () => {
  console.log('Olocus PWA was installed');
  // Hide install button if visible
  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'none';
  }
});

// Check if running as standalone PWA
function isRunningStandalone() {
  return (window.matchMedia('(display-mode: standalone)').matches) ||
         (window.navigator.standalone) ||
         document.referrer.includes('android-app://');
}

// Log PWA status
if (isRunningStandalone()) {
  console.log('Running as standalone PWA');
  document.body.classList.add('pwa-standalone');
} else {
  console.log('Running in browser');
}

// Handle offline/online status
window.addEventListener('online', () => {
  console.log('Back online');
  document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
  console.log('Gone offline');
  document.body.classList.add('offline');
});