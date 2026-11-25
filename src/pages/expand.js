/** The timing of a card growing into the page: quick out of the start, settling at the end. */
export const EXPAND = { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

/** Whether to animate at all: the browser can, and the visitor has not asked for reduced motion. */
export function canAnimate(element) {
  if (typeof element?.animate !== 'function') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The transform that draws an element whose box is `to` over the box `from` instead, with the
 * transform origin at its top left corner.
 */
export function boxTransform(from, to) {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}

/**
 * Grows a copy of `card` from where it sits to cover the window, then calls `onCovered`, then fades
 * the copy out. The copy lives on the body, outside React, so it outlasts the page that drew the card
 * and covers the next one while it mounts.
 */
export function expandToWindow(card, onCovered) {
  const box = card.getBoundingClientRect();
  const copy = card.cloneNode(true);
  copy.classList.add('landing-expander');
  copy.setAttribute('aria-hidden', 'true');
  Object.assign(copy.style, {
    position: 'fixed',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: '0',
    transform: 'none',
    transformOrigin: '0 0',
    transition: 'none',
    zIndex: '3000',
  });
  document.body.appendChild(copy);

  const viewport = {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  copy
    .animate([{ transform: 'none' }, { transform: boxTransform(viewport, box) }], { ...EXPAND, fill: 'forwards' })
    .finished.then(() => {
      onCovered();
      return copy.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 250,
        delay: 150,
        fill: 'forwards',
      }).finished;
    })
    .finally(() => copy.remove());
}
