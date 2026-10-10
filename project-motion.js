(() => {
  'use strict';
  const section = document.getElementById('studies');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = 'cubic-bezier(.2,.7,.2,1)';
  const states = [...section.querySelectorAll('.study-item')].map((detail, index) => {
    const summary = detail.querySelector('summary');
    const body = detail.querySelector('.study-body');
    body.id = `project-detail-${index + 1}`;
    summary.setAttribute('aria-controls', body.id);
    return {detail, summary, body, children: [...body.children], target: detail.open,
      heightAnimation: null, contentAnimations: [], revision: 0};
  });

  function refreshScrollHint() {
    section.dispatchEvent(new Event('scroll'));
  }

  function cancelAnimations(state) {
    if (state.heightAnimation) {
      state.heightAnimation.onfinish = null;
      state.heightAnimation.cancel();
      state.heightAnimation = null;
    }
    state.contentAnimations.forEach(animation => animation.cancel());
    state.contentAnimations = [];
  }

  function settle(state) {
    cancelAnimations(state);
    state.detail.open = state.target;
    state.detail.style.height = '';
    state.detail.classList.remove('is-animating');
    state.detail.classList.toggle('is-open-target', state.target);
    state.detail.dataset.motionState = state.target ? 'expanded' : 'collapsed';
    state.summary.setAttribute('aria-expanded', String(state.target));
    state.body.inert = !state.target;
    refreshScrollHint();
  }

  function setExpanded(state, expanded) {
    const {detail, summary, body, children} = state;
    const wasVisible = detail.open;
    const interrupted = Boolean(state.heightAnimation);
    const fromHeight = detail.getBoundingClientRect().height;
    const fromContent = children.map(child => {
      const style = getComputedStyle(child);
      return {opacity: style.opacity, transform: style.transform};
    });
    state.target = expanded;
    const revision = ++state.revision;
    if (!expanded && body.contains(document.activeElement)) summary.focus({preventScroll: true});
    cancelAnimations(state);
    if (reducedMotion.matches || !detail.getClientRects().length) {
      settle(state);
      return;
    }

    // Keep native details open until the shrinking panel has finished.
    detail.open = true;
    detail.style.height = '';
    const border = parseFloat(getComputedStyle(detail).borderBottomWidth) || 0;
    const toHeight = expanded ? detail.getBoundingClientRect().height
      : summary.getBoundingClientRect().height + border;
    detail.style.height = `${fromHeight}px`;
    detail.classList.add('is-animating');
    detail.classList.toggle('is-open-target', expanded);
    detail.dataset.motionState = expanded ? 'expanding' : 'collapsing';
    summary.setAttribute('aria-expanded', String(expanded));
    body.inert = !expanded;

    children.forEach((child, index) => {
      const from = !wasVisible ? {opacity: 0, transform: 'translateY(10px)'} : fromContent[index];
      const to = expanded ? {opacity: 1, transform: 'translateY(0px)'}
        : {opacity: 0, transform: 'translateY(-5px)'};
      state.contentAnimations.push(child.animate([from, to], {
        duration: expanded ? 250 : 140,
        delay: interrupted ? 0 : expanded ? 60 + index * 40 : index * 12,
        easing, fill: 'both'
      }));
    });
    state.heightAnimation = detail.animate([
      {height: `${fromHeight}px`}, {height: `${toHeight}px`}
    ], {duration: expanded ? 440 : 310, delay: expanded || interrupted ? 0 : 65,
      easing, fill: 'forwards'});
    state.heightAnimation.onfinish = () => {
      if (state.revision === revision) settle(state);
    };
    refreshScrollHint();
  }

  states.forEach(state => {
    settle(state);
    // Native keyboard activation also produces a click on summary.
    state.summary.addEventListener('click', event => {
      event.preventDefault();
      setExpanded(state, !state.target);
    });
    state.detail.addEventListener('toggle', () => {
      if (!state.heightAnimation && state.detail.open !== state.target) {
        state.target = state.detail.open;
        settle(state);
      }
    });
  });
  document.documentElement.classList.add('projects-motion');
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) states.forEach(state => { state.revision += 1; settle(state); });
  });
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      states.filter(state => state.heightAnimation).forEach(state => setExpanded(state, state.target));
      refreshScrollHint();
    });
  });
})();
