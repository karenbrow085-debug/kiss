/* Kiss magazine startup v2. No account, storage, wallpaper or chat data is modified. */
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
  let curlFrame;
  let paperHost;
  let castShadow;
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
    if (curlFrame) window.cancelAnimationFrame(curlFrame);
    if (paperHost) paperHost.remove();
    if (castShadow) castShadow.remove();
    if (desktopObserver) desktopObserver.disconnect();
    if (phone && !wasInert) phone.removeAttribute('inert');
    root.remove();
    window.dispatchEvent(new CustomEvent('kiss:startup-complete'));
  }

  function animatePaper() {
    const width = book.clientWidth;
    const height = book.clientHeight;
    // Mobile WebViews can rasterize each face as a full viewport layer.
    // Keep the curved turn while bounding duplicate page surfaces.
    const mobile = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
    const count = mobile || (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 8 : 16;
    const stripWidth = width / count;
    const frontSource = turn.querySelector('.qm-front');
    const backSource = turn.querySelector('.qm-back');
    paperHost = document.createElement('div');
    paperHost.className = 'qm-curved-paper';
    paperHost.setAttribute('aria-hidden', 'true');
    castShadow = document.createElement('div');
    castShadow.className = 'qm-paper-shadow';
    book.append(castShadow, paperHost);
    const strips = [];

    function face(source, index, reverse) {
      const side = document.createElement('div');
      side.className = 'qm-paper-face ' + (reverse ? 'qm-paper-verso' : 'qm-paper-recto');
      const page = source.cloneNode(true);
      page.querySelectorAll('button').forEach(button => button.remove());
      const offset = reverse ? width - (index + 1) * stripWidth : index * stripWidth;
      Object.assign(page.style, {
        position: 'absolute', top: '0', bottom: 'auto', right: 'auto',
        left: -offset + 'px', width: width + 'px', height: height + 'px',
        transform: 'none', boxShadow: 'none', backfaceVisibility: 'visible',
      });
      side.append(page);
      return side;
    }

    for (let i = 0; i < count; i++) {
      const strip = document.createElement('div');
      strip.className = 'qm-paper-strip';
      // A subpixel overlap keeps the curved surface continuous on phone GPUs.
      strip.style.width = (stripWidth + 1.5) + 'px';
      strip.append(face(frontSource, i, false), face(backSource, i, true));
      paperHost.append(strip);
      strips.push(strip);
    }

    root.classList.add('has-curved-paper');
    const start = performance.now() + 150;

    function frame(now) {
      if (!root.isConnected || phase === 'done') return;
      const t = Math.max(0, Math.min(1, (now - start) / 1550));
      const progress = (1 - Math.cos(Math.PI * t)) / 2;
      const base = -Math.PI * progress;
      const bend = .9 * Math.sin(Math.PI * progress);
      let x = 0;
      let z = 0;
      for (let i = 0; i < count; i++) {
        const s = (i + .5) / count;
        const angle = base + bend * s;
        const shade = 0;
        strips[i].style.transform = 'translate3d(' + x + 'px,0,' + z + 'px) rotateY(' + angle + 'rad)';
        strips[i].style.setProperty('--paper-shade', String(shade));
        x += stripWidth * Math.cos(angle);
        z -= stripWidth * Math.sin(angle);
      }
      castShadow.style.opacity = String(.28 * Math.sin(Math.PI * progress));
      castShadow.style.transform = 'translateX(' + Math.max(0, x * .55) + 'px)';
      if (t < 1) {
        curlFrame = window.requestAnimationFrame(frame);
      } else {
        turn.style.transform = 'rotateY(-180deg)';
        root.classList.remove('has-curved-paper');
        paperHost.remove();
        castShadow.remove();
        paperHost = castShadow = null;
        curlFrame = null;
      }
    }
    frame(start - 150);
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
    if (!reduced) animatePaper();
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
