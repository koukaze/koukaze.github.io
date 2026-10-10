// Keep wheel intent separate from DOM scrolling so boundary and inertia cases
// can be checked with deterministic input sequences.
function createWheelNavigator() {
  let last = -Infinity;
  let direction = 0;
  let amount = 0;
  let edgeSince = null;
  let needsHold = false;
  let lockedUntil = 0;
  return {
    markNavigation(now, duration = 1250) {
      lockedUntil = now + duration;
      amount = 0;
      edgeSince = null;
    },
    step({now, deltaY, deltaX = 0, deltaMode = 0, viewportHeight = 800, ctrlKey = false, busy = false, canScroll = false}) {
      if (ctrlKey || !deltaY || Math.abs(deltaX) > Math.abs(deltaY)) return {type: 'native'};
      const nextDirection = Math.sign(deltaY);
      const fresh = now - last > 180 || nextDirection !== direction;
      const delta = deltaY * (deltaMode === 1 ? 18 : deltaMode === 2 ? viewportHeight : 1);
      last = now;
      direction = nextDirection;
      if (fresh) { amount = 0; edgeSince = null; needsHold = false; }
      if (busy) { amount = 0; return {type: 'ignore'}; }
      // Content scrolling is never held hostage by the page-turn cooldown.
      if (canScroll) {
        amount = 0;
        edgeSince = null;
        needsHold = true;
        return {type: 'scroll', delta};
      }
      if (now < lockedUntil) { amount = 0; return {type: 'ignore'}; }
      if (edgeSince === null) edgeSince = now;
      if (Math.abs(delta) < 2) return {type: 'ignore'};
      amount += Math.abs(delta);
      // At the end of long content, consume the event that reached the edge.
      // A fresh gesture, or a deliberate continued push, can then turn the page.
      if (needsHold && now - edgeSince < 160) return {type: 'ignore'};
      if (amount < (needsHold ? 120 : 48)) return {type: 'ignore'};
      amount = 0;
      edgeSince = null;
      needsHold = true;
      return {type: 'turn', direction};
    }
  };
}

// CommonJS export is used only by local regression tests.
if (typeof module !== "undefined" && module.exports) module.exports = {createWheelNavigator};
