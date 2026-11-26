/** The text sizes (px) the project overlay picks from, and the step it searches in. */
export const FIT = { min: 12, max: 18, step: 0.5 };

/**
 * The largest size from `min` to `max`, in steps of `step`, at which `fits(size)` holds, found by
 * halving; `min` when none does. `fits` must hold for every size below one it holds for, as text
 * that fits at one size fits at any smaller one.
 */
export function largestFitting(fits, { min, max, step } = FIT) {
  let low = 0;
  let high = Math.floor((max - min) / step);
  if (!fits(min)) return min;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(min + middle * step)) low = middle;
    else high = middle - 1;
  }
  return min + low * step;
}

/**
 * Sizes the text of `body` to the largest that fits inside `box` without scrolling, and again
 * whenever the box changes size. Returns the function that stops it.
 */
export function fitText(box, body) {
  const fit = () => {
    const size = largestFitting(px => {
      body.style.fontSize = `${px}px`;
      return box.scrollHeight <= box.clientHeight;
    });
    body.style.fontSize = `${size}px`;
  };
  fit();
  if (typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(fit);
  observer.observe(box);
  return () => observer.disconnect();
}
