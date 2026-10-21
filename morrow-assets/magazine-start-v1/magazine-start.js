/* Kiss magazine startup v1. No account, storage, wallpaper or chat data is modified. */
(() => {
  'use strict';

  const root = document.getElementById('kiss-magazine-start');
  if (!root || root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';

  const cover = root.querySelector('.qm-open');
  const book = root.querySelector('.qm-book');
  const turn = root.querySelector('.qm-turn');
  const phone = document.querySelector('.phone-screen');
  const wasInert = phone ? phone.hasAttribute('inert') : false;
  let phase = 'cover';
  let holdStarted = false;
  let animationFallback;
  let desktopObserver;
  const timers = new Set();

  function timer(callback, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      callback();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearTimer(id) {
    window.clearTimeout(id);
    timers.delete(id);
  }

  function wait(ms) {
    return new Promise(resolve => timer(resolve, ms));
  }

  function setPhase(next) {
    phase = next;
    root.dataset.phase = next;
  }

  function desktopExists() {
    const home = document.getElementById('home-screen');
    return !!(home && home.querySelector('.app-icon, .home-screen-swiper, [data-home-ready]'));
  }

  const desktopReady = new Promise(resolve => {
    if (desktopExists()) return resolve();
    desktopObserver = new MutationObserver(() => {
      if (!desktopExists()) return;
      desktopObserver.disconnect();
      desktopObserver = null;
      resolve();
    });
    desktopObserver.observe(document.documentElement, { childList: true, subtree: true });
  });

  const assetBase = new URL('./', document.currentScript ? document.currentScript.src :
    new URL('morrow-assets/magazine-start-v1/magazine-start.js', document.baseURI));
  const picturesReady = Promise.all(['waves.jpg', 'forest.jpg', 'mountains.jpg', 'masthead.png'].map(name =>
    new Promise(resolve => {
      const picture = new Image();
      picture.onload = picture.onerror = resolve;
      picture.src = new URL(name, assetBase).href;
      if (picture.complete) resolve();
    })));
  const fontsReady = document.fonts ? Promise.all([
    document.fonts.load('400 32px "KissStartSerif"'),
    document.fonts.load('italic 400 32px "KissStartSerif"'),
  ]).catch(() => {}) : Promise.resolve();
  const assetsReady = Promise.race([
    Promise.all([picturesReady, fontsReady]),
    wait(2500),
  ]);

  function cleanUp() {
    if (phase === 'done') return;
    setPhase('done');
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    if (desktopObserver) desktopObserver.disconnect();
    if (phone && !wasInert) phone.removeAttribute('inert');
    root.remove();
    window.dispatchEvent(new CustomEvent('kiss:startup-complete'));
  }

  async function enterDesktop() {
    if (phase === 'leaving' || phase === 'done') return;
    setPhase('waiting-for-desktop');
    // Normal startup renders the home screen behind the cover. Only wait longer
    // if that existing initialization has not completed; never initialize it twice.
    let limit;
    await Promise.race([desktopReady, new Promise(resolve => { limit = timer(resolve, 8000); })]);
    if (limit) clearTimer(limit);
    if (!root.isConnected) return;
    setPhase('leaving');
    root.classList.add('is-leaving');
    root.addEventListener('transitionend', event => {
      if (event.target === root && event.propertyName === 'opacity') cleanUp();
    });
    timer(cleanUp, 650);
  }

  async function holdAfterZoom() {
    if (holdStarted || phase === 'done') return;
    holdStarted = true;
    clearTimer(animationFallback);
    setPhase('hold');
    await wait(2000);
    await enterDesktop();
  }

  async function openMagazine(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (phase !== 'cover') return;
    setPhase('preparing');
    cover.disabled = true;
    await assetsReady;
    if (!root.isConnected) return;
    setPhase('opening');
    root.classList.add('is-opening');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animationFallback = timer(() => {
      // Recover if a device suppresses animationend. Still reveal the exact right page.
      book.style.transform = 'translateX(0) scale(1)';
      turn.style.transform = 'rotateY(-180deg)';
      holdAfterZoom();
    }, reduced ? 100 : 3400);
  }

  if (!cover || !book || !turn) {
    root.remove();
    return;
  }
  if (phone) phone.setAttribute('inert', '');
  root.addEventListener('click', event => event.stopPropagation());
  cover.addEventListener('click', openMagazine);
  book.addEventListener('animationend', event => {
    if (event.target === book && event.animationName === 'kissmag-spread') holdAfterZoom();
  });
})();
