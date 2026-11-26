import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { EXPAND, boxTransform, canAnimate } from './expand';
import { COPY } from '../copy';
import { fitText } from './fit';
import DeveloperCredit from '../components/DeveloperCredit';

/**
 * The project description over most of the page. It grows out of the box `from`, the card that
 * opened it, and shrinks back into it on Escape, the close button or a click outside it.
 */
export default function ProjectOverlay({ from, onClose }) {
  const backdropRef = useRef(null);
  const cardRef = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(null);
  const closing = useRef(false);

  // Runs the opening in both directions: forwards as it opens, backwards as it closes.
  const play = useCallback(
    direction => {
      const card = cardRef.current;
      const options = { ...EXPAND, direction, fill: 'both' };
      const start = boxTransform(from, card.getBoundingClientRect());
      backdropRef.current.animate([{ opacity: 0 }, { opacity: 1 }], options);
      bodyRef.current.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], options);
      return card.animate([{ transform: start }, { transform: 'none' }], options).finished;
    },
    [from],
  );

  // The text takes the largest size at which the whole description fits on the card, before it shows.
  useLayoutEffect(() => fitText(cardRef.current, bodyRef.current), []);

  useLayoutEffect(() => {
    if (from && canAnimate(cardRef.current)) play('normal');
  }, [from, play]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (from && canAnimate(cardRef.current)) play('reverse').then(onClose);
    else onClose();
  }, [from, play, onClose]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  return (
    <div ref={backdropRef} className="landing-overlay" onClick={close}>
      <article
        ref={cardRef}
        className="landing-overlay-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-overlay-title"
        onClick={event => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="landing-overlay-close" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
        <div ref={bodyRef} className="landing-overlay-body">
          <header className="landing-overlay-header">
            <span className="landing-overlay-kicker">{COPY.overlay.kicker}</span>
            <h2 id="landing-overlay-title">RewetFlux</h2>
            <p className="landing-overlay-lead">{COPY.overlay.lead}</p>
          </header>

          <section className="landing-overlay-site">
            <h3>The site</h3>
            <p>{COPY.overlay.site}</p>
          </section>

          <section className="landing-overlay-measured">
            <h3>What is measured</h3>
            <dl className="landing-overlay-measures">
              {COPY.overlay.measures.map(m => (
                <div key={m.name}>
                  <dt>{m.name}</dt>
                  <dd>{m.detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="landing-overlay-partnered">
            <h3>Partners</h3>
            <ul className="landing-overlay-partners">
              <li>
                <a href="https://www.epfl.ch/labs/soil/" target="_blank" rel="noopener noreferrer">
                  SOIL — Soil Biogeochemistry Laboratory, EPFL
                </a>
              </li>
              <li>
                <a href="https://www.epfl.ch/labs/change/" target="_blank" rel="noopener noreferrer">
                  CHANGE — Laboratory of Catchment Hydrology and Geomorphology, EPFL
                </a>
              </li>
              <li>
                <a href="https://e4s.center/" target="_blank" rel="noopener noreferrer">
                  E4S — Enterprise for Society Center
                </a>
              </li>
              <li>
                <a
                  href="https://www.pronatura-lu.ch/de/balmoos-regeneration-hochmoor"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pro Natura Luzern
                </a>
              </li>
            </ul>
          </section>

          <footer className="landing-overlay-footer">
            <Link to="/map" className="landing-button">
              Explore the site data
            </Link>
            <p className="landing-overlay-credit">
              <DeveloperCredit />
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}
