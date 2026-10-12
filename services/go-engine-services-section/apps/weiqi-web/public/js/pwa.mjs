// Registers the service worker (public/sw.js, a build product) so the site
// installs to a home screen and study content stays available offline. The
// match API is never cached; see the worker's own header.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* offline support is a progressive enhancement */ });
  });
}
