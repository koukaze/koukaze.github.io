(() => {
  'use strict';
  const root = document.documentElement;
  const main = document.getElementById('main');
  const sections = [...main.querySelectorAll(':scope > section')];
  const links = [...document.querySelectorAll('[data-section]')];
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-nav');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = ['Introduction', 'Research', 'Coursework', 'Education', 'Contact'];
  const indexFromHash = () => Math.max(0, sections.findIndex(s => '#' + s.id === location.hash));
  let current = indexFromHash();
  let busy = false;
  let pending = null;
  let finishTimer;
  let leaving = null;
  const wheelNavigator = createWheelNavigator();
  const controls = document.createElement('nav');
  controls.className = 'scene-controls';
  controls.setAttribute('aria-label', 'Page controls');
  controls.innerHTML = '<div class="chapter" aria-hidden="true"><strong>00</strong><span>Introduction</span></div><span class="scroll-hint">Scroll to explore</span><div class="page-buttons"><button type="button" aria-label="Previous section">↑</button><button type="button" aria-label="Next section">↓</button></div><span class="live-status" role="status" aria-live="polite" aria-atomic="true"></span>';
  const line = document.createElement('div');
  line.className = 'scene-line';
  line.setAttribute('aria-hidden', 'true');
  document.body.append(line, controls);
  const [previous, next] = controls.querySelectorAll('button');
  const hint = controls.querySelector('.scroll-hint');
  sections.at(-1).append(document.querySelector('.footer'));
  const closeMenu = () => {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
  };
  const canScroll = (section, direction) => direction > 0
    ? section.scrollTop + section.clientHeight < section.scrollHeight - 3
    : section.scrollTop > 3;
  function updateHint() {
    hint.textContent = canScroll(sections[current], 1) ? 'Scroll to read' : current < sections.length - 1 ? 'Scroll for next page' : 'Scroll up to return';
  }
  function sync() {
    document.body.dataset.currentSection = sections[current].id;
    links.forEach(link => {
      const active = link.dataset.section === sections[current].id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      link.dataset.surface = [1, 4].includes(current) ? 'light' : 'dark';
    });
    controls.querySelector('.chapter strong').textContent = String(current).padStart(2, '0');
    controls.querySelector('.chapter span').textContent = labels[current];
    controls.querySelector('.live-status').textContent = `${labels[current]}, section ${current + 1} of ${sections.length}`;
    previous.disabled = current === 0;
    next.disabled = current === sections.length - 1;
    updateHint();
  }
  function focusHeading() {
    const heading = sections[current].querySelector('h1,h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({preventScroll: true});
  }
  function focusReadingPosition() {
    if (sections[current].scrollTop < 3) { focusHeading(); return; }
    sections[current].setAttribute('tabindex', '-1');
    sections[current].focus({preventScroll: true});
  }
  function finish() {
    clearTimeout(finishTimer);
    leaving?.classList.remove('scene-leaving');
    leaving = null;
    sections.forEach(section => section.classList.remove('scene-entering'));
    document.body.classList.remove('scene-changing');
    busy = false;
    if (pending) {
      const request = pending;
      pending = null;
      goTo(request.index, request.options);
    }
  }
  function goTo(index, options = {}) {
    if (index < 0 || index >= sections.length) return;
    if (busy) {
      if (options.source === 'history' || options.source === 'link') pending = {index, options};
      return;
    }
    closeMenu();
    if (options.source !== 'history' && location.hash !== '#' + sections[index].id) {
      history.pushState(null, '', '#' + sections[index].id);
    }
    if (index === current) {
      if (options.source === 'link') { sections[current].scrollTop = 0; focusHeading(); }
      return;
    }
    const outgoing = sections[current];
    const incoming = sections[index];
    wheelNavigator.markNavigation(performance.now(), reducedMotion.matches ? 180 : 1250);
    const direction = index > current ? 1 : -1;
    root.style.setProperty('--scene-offset', `${direction * 40}px`);
    if (outgoing.contains(document.activeElement)) main.focus({preventScroll: true});
    outgoing.classList.remove('is-current');
    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.classList.add('is-current');
    incoming.inert = false;
    incoming.removeAttribute('aria-hidden');
    // Reading positions survive when returning; direct menu links start at the heading.
    if (options.source === 'link') incoming.scrollTop = 0;
    current = index;
    sync();
    if (options.focus) focusReadingPosition();
    if (reducedMotion.matches) return;
    busy = true;
    leaving = outgoing;
    outgoing.classList.add('scene-leaving');
    incoming.classList.add('scene-entering');
    document.body.classList.add('scene-changing');
    finishTimer = setTimeout(finish, 1200);
  }
  sections.forEach((section, index) => {
    section.classList.toggle('is-current', index === current);
    section.inert = index !== current;
    if (index !== current) section.setAttribute('aria-hidden', 'true');
    section.addEventListener('scroll', updateHint, {passive: true});
    section.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', updateHint));
  });
  root.classList.add('scene-mode');
  window.scrollTo(0, 0);
  history.scrollRestoration = 'manual';
  sync();
  menu.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', String(nav.classList.toggle('is-open')));
  });
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    const index = sections.findIndex(section => '#' + section.id === anchor.getAttribute('href'));
    if (index < 0) return;
    anchor.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      goTo(index, {source: 'link', focus: true});
    });
  });
  document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); focusHeading(); });
  previous.addEventListener('click', () => goTo(current - 1, {source: 'button', focus: true}));
  next.addEventListener('click', () => goTo(current + 1, {source: 'button', focus: true}));

  // Route vertical wheel input to the active panel even when the pointer is on
  // the fixed header, section rail or footer. The document itself cannot scroll.
  window.addEventListener('wheel', event => {
    if (nav.classList.contains('is-open')) return;
    const section = sections[current];
    const action = wheelNavigator.step({
      now: performance.now(), deltaY: event.deltaY, deltaX: event.deltaX,
      deltaMode: event.deltaMode, viewportHeight: section.clientHeight,
      ctrlKey: event.ctrlKey, busy, canScroll: canScroll(section, Math.sign(event.deltaY))
    });
    if (action.type === 'native') return;
    event.preventDefault();
    if (action.type === 'scroll') section.scrollBy({top: action.delta, behavior: 'instant'});
    else if (action.type === 'turn') goTo(current + action.direction, {source: 'wheel'});
  }, {passive: false});

  let touch = null;
  main.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    touch = {x: point.clientX, y: point.clientY, dx: 0, dy: 0, upEdge: !canScroll(sections[current], -1), downEdge: !canScroll(sections[current], 1), index: current};
  }, {passive: true});
  main.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    touch.dx = touch.x - event.touches[0].clientX;
    touch.dy = touch.y - event.touches[0].clientY;
    const edge = touch.dy > 0 ? touch.downEdge : touch.upEdge;
    if (edge && Math.abs(touch.dy) > Math.abs(touch.dx) * 1.3) event.preventDefault();
  }, {passive: false});
  main.addEventListener('touchend', () => {
    if (touch && !busy && touch.index === current && Math.abs(touch.dy) > 65 && Math.abs(touch.dy) > Math.abs(touch.dx) * 1.3) {
      if (touch.dy > 0 ? touch.downEdge : touch.upEdge) goTo(current + Math.sign(touch.dy), {source: 'touch'});
    }
    touch = null;
  }, {passive: true});
  main.addEventListener('touchcancel', () => { touch = null; }, {passive: true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menu.focus(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || nav.classList.contains('is-open') || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === ' ' && event.target.closest('a,button,summary')) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      goTo(event.key === 'Home' ? 0 : sections.length - 1, {source: 'keyboard', focus: true});
      return;
    }
    const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1 : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (busy) return;
    const section = sections[current];
    if (canScroll(section, direction)) section.scrollBy({top: direction * (event.key.startsWith('Arrow') ? 65 : section.clientHeight * .8), behavior: reducedMotion.matches ? 'auto' : 'smooth'});
    else if (!event.repeat) goTo(current + direction, {source: 'keyboard', focus: true});
  });
  const restore = () => goTo(indexFromHash(), {source: 'history'});
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  window.addEventListener('resize', () => { if (innerWidth > 760) closeMenu(); updateHint(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && busy) finish(); });
})();
