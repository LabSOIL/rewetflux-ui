import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import { EXPAND, boxTransform, canAnimate } from './expand';

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
        <div ref={bodyRef}>
          <header className="landing-overlay-header">
            <span className="landing-overlay-kicker">The project</span>
            <h2 id="landing-overlay-title">RewetFlux</h2>
            <p className="landing-overlay-lead">
              Carbon dynamics in a rewetted peatland: greenhouse gas fluxes, soil redox conditions and microclimate at
              the Balmoos wetland in Lucerne, Switzerland.
            </p>
          </header>

          <section>
            <h3>The site</h3>
            <p>
              Balmoos is a raised bog in the canton of Lucerne that{' '}
              <a
                href="https://www.pronatura-lu.ch/de/balmoos-regeneration-hochmoor"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pro Natura
              </a>{' '}
              is regenerating. Rewetting a drained peatland changes how its soil stores and releases carbon, and the
              monitoring here follows that change at 25 measurement positions across the site.
            </p>
          </section>

          <section>
            <h3>What is measured</h3>
            <dl className="landing-overlay-measures">
              <div>
                <dt>Gas flux</dt>
                <dd>CO₂ and CH₄ exchange between the soil and the air, measured at a collar at each position.</dd>
              </div>
              <div>
                <dt>Redox potential</dt>
                <dd>Measured at several depths to characterise soil aeration and biogeochemical conditions.</dd>
              </div>
              <div>
                <dt>Temperature and moisture</dt>
                <dd>
                  Recorded continuously by{' '}
                  <a href="https://tomst.com/web/en/systems/tms/tms-4/" target="_blank" rel="noopener noreferrer">
                    TMS-4 TOMST loggers
                  </a>
                  ; soil moisture is given as volumetric water content (m³/m³).
                </dd>
              </div>
            </dl>
          </section>

          <section>
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
          </footer>
        </div>
      </article>
    </div>
  );
}
