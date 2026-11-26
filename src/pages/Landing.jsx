import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SitePreview from './SitePreview';
import ProjectOverlay from './ProjectOverlay';
import { FUNDERS } from './partners';
import { canAnimate, expandToWindow } from './expand';
import './Landing.css';

/**
 * The looping drone footage of the site behind the page, served from `public/`, as H.264, which
 * every browser plays, and its first frame as a still that shows until it plays. Until the files are
 * there, or when the video fails to load, the page shows its plain backdrop instead.
 */
export const BACKGROUND_VIDEO = './balmoos.mp4';
export const BACKGROUND_POSTER = './balmoos.jpg';

/**
 * The background footage and its play state. The page opens on the still, and the video starts
 * downloading only once the rest of the page has loaded, then plays muted on a loop, unless the
 * visitor asks for reduced motion: then the still stays, and nothing downloads until they play it.
 * The button beside the credit pauses or plays it, as motion that runs on its own needs.
 */
function useBackgroundVideo() {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  // React sets `muted` as a property after the element exists, which some browsers do not count
  // for autoplay, so the video is muted and started here.
  const play = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.play?.()?.catch(() => {});
  };

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (document.readyState === 'complete') {
      play();
      return undefined;
    }
    window.addEventListener('load', play, { once: true });
    return () => window.removeEventListener('load', play);
  }, []);

  const toggle = () => (ref.current?.paused ? play() : ref.current?.pause());

  const element = (
    <div className="landing-background" aria-hidden="true">
      {!failed && (
        <video
          ref={ref}
          src={BACKGROUND_VIDEO}
          poster={BACKGROUND_POSTER}
          muted
          loop
          playsInline
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        />
      )}
      <div className="landing-background-shade" />
    </div>
  );
  return { element, failed, playing, toggle };
}

export default function Landing() {
  const navigate = useNavigate();
  const video = useBackgroundVideo();
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
      {video.element}
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
          <div className="landing-footer-start">
            {!video.failed && (
              <button
                type="button"
                className="landing-video-toggle"
                onClick={video.toggle}
                aria-label={video.playing ? 'Pause the background video' : 'Play the background video'}
              >
                {video.playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </button>
            )}
            <p className="landing-credit">
              Imagery and elevation &copy;{' '}
              <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer">
                swisstopo
              </a>
            </p>
          </div>
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
