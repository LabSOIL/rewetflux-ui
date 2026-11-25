import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import SitePreview from './SitePreview';
import ProjectOverlay from './ProjectOverlay';
import { FUNDERS } from '../components/maps/MapLogos';
import { canAnimate, expandToWindow } from './expand';
import './Landing.css';

/**
 * The looping drone footage of the site behind the page, served from `public/`. Until the file
 * is there, or when it fails to load, the page shows its plain backdrop instead.
 */
export const BACKGROUND_VIDEO = './balmoos.mp4';

function BackgroundVideo() {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // A visitor who asks for reduced motion sees the first frame, not the loop.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    video.pause();
  }, []);

  return (
    <div className="landing-background" aria-hidden="true">
      {!failed && (
        <video
          ref={videoRef}
          src={BACKGROUND_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
        />
      )}
      <div className="landing-background-shade" />
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  // The about card's box as it was clicked, which the overlay grows out of; null while closed.
  const [aboutFrom, setAboutFrom] = useState(null);
  const closeAbout = useCallback(() => setAboutFrom(null), []);

  // A plain click grows the map card to fill the window before the map opens; a click that opens
  // a new tab or window, or a visitor who asks for reduced motion, follows the link at once.
  const openMap = event => {
    const card = event.currentTarget;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!canAnimate(card)) return;
    event.preventDefault();
    expandToWindow(card, () => navigate('/map'));
  };

  return (
    <>
      <BackgroundVideo />
      <div className="landing-page">
        <header className="landing-header">
          <span className="landing-brand">RewetFlux</span>
          <h1 className="landing-title">
            <span>CARBON IN A</span>
            <span>REWETTED PEATLAND</span>
          </h1>
          <p className="landing-subtitle">
            Greenhouse gas fluxes, soil redox and microclimate at the Balmoos wetland, Lucerne
          </p>
        </header>

        <main className="landing-main">
          <div className="landing-row">
            <Link to="/map" className="landing-card landing-card-map" onClick={openMap}>
              <div className="landing-card-media">
                <SitePreview />
              </div>
              <h2 className="landing-card-title">Explore the site</h2>
              <div className="landing-card-detail">
                <p>
                  The map of the Balmoos monitoring site: gas flux, redox, temperature and moisture at each of its 25
                  positions, in 2D and 3D.
                </p>
              </div>
            </Link>

            <button
              type="button"
              className={`landing-card landing-card-about${aboutFrom ? ' landing-card-open' : ''}`}
              onClick={event => setAboutFrom(event.currentTarget.getBoundingClientRect())}
              aria-haspopup="dialog"
            >
              <div className="landing-card-media landing-card-about-media">
                <p className="landing-card-about-text">
                  Rewetting a drained peatland changes how its soil stores and releases carbon. RewetFlux follows that
                  change at Balmoos, a raised bog under regeneration, with field measurements across the site.
                </p>
              </div>
              <h2 className="landing-card-title">About the project</h2>
              <div className="landing-card-detail">
                <p>The site, what is measured and who is involved.</p>
              </div>
            </button>
          </div>
        </main>

        <footer className="landing-footer">
          <div className="landing-logos">
            {FUNDERS.map(f => (
              <a key={f.alt} href={f.href} target="_blank" rel="noopener noreferrer">
                <img src={f.src} alt={f.alt} />
              </a>
            ))}
          </div>
        </footer>
      </div>
      {aboutFrom && <ProjectOverlay from={aboutFrom} onClose={closeAbout} />}
    </>
  );
}
