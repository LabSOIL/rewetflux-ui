import PanelTitleWithTooltip from './Title';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import { COPY } from '../../copy';
import DeveloperCredit from '../DeveloperCredit';

// The text takes its size, weight and colour from SidePanel.css (`.popup.info-popup`), so it
// keeps the panels' type scale; only the links and icons below carry their own colour.
export default function InfoPanel({ onClose, hasTimeline = false }) {
  const anchor = hasTimeline ? 'popup-bottom' : 'popup-bottom-no-timeline';
  return (
    <div className={`popup info-popup ${anchor}`} aria-label="About RewetFlux">
      <PanelTitleWithTooltip title="RewetFlux" onClose={onClose} />
      <div className="about-body">
        <p>{COPY.overlay.lead}</p>
        <h3 className="info-heading">Monitoring data</h3>
        {COPY.overlay.measures.map(m => (
          <p key={m.name}>
            <strong>{m.name}</strong>: {m.detail}
          </p>
        ))}

        <h3 className="info-heading">Attribution</h3>

        <List dense sx={{ pl: 1, mb: 1 }}>
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <Link href="https://www.epfl.ch/labs/soil/" target="_blank" rel="noopener noreferrer">
              SOIL — Soil Biogeochemistry Laboratory, EPFL
            </Link>
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <Link href="https://www.epfl.ch/labs/change/" target="_blank" rel="noopener noreferrer">
              CHANGE — Laboratory of Catchment Hydrology and Geomorphology, EPFL
            </Link>
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <Link href="https://www.epfl.ch" target="_blank" rel="noopener noreferrer">
              EPFL — École polytechnique fédérale de Lausanne
            </Link>
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <Link href="https://e4s.center/" target="_blank" rel="noopener noreferrer">
              E4S — Enterprise for Society Center
            </Link>
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <Link
              href="https://www.pronatura-lu.ch/de/balmoos-regeneration-hochmoor"
              target="_blank"
              rel="noopener noreferrer"
            >
              Pro Natura
            </Link>
          </ListItem>
          <br />
          <ListItem disableGutters sx={{ py: 0.3 }}>
            <DeveloperCredit />
          </ListItem>
        </List>
      </div>
    </div>
  );
}
