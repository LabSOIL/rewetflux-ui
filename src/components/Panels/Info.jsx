import PanelTitleWithTooltip from './Title';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LanguageIcon from '@mui/icons-material/Language';
import GitHubIcon from '@mui/icons-material/GitHub';
import { theme } from '../../theme';

// The text takes its size, weight and colour from SidePanel.css (`.popup.info-popup`), so it
// keeps the panels' type scale; only the links and icons below carry their own colour.
export default function InfoPanel({ onClose, hasTimeline = false }) {
  const anchor = hasTimeline ? 'popup-bottom' : 'popup-bottom-no-timeline';
  return (
    <div className={`popup info-popup ${anchor}`} aria-label="About RewetFlux">
      <PanelTitleWithTooltip title="RewetFlux" onClose={onClose} />
      <div className="about-body">
        <p>
          RewetFlux provides access to environmental monitoring data from the
          Balmoos wetland site in Lucerne, Switzerland.
          The project tracks greenhouse gas fluxes, soil redox conditions, and
          microclimate variables to understand carbon dynamics in rewetted peatlands.
        </p>
        <h3 className="info-heading">Monitoring data</h3>
        <p>
          <strong>Temperature and moisture</strong> are monitored continuously using{' '}
          <Link
            href="https://tomst.com/web/en/systems/tms/tms-4/"
            target="_blank"
            rel="noopener noreferrer"
          >
            TMS-4 TOMST loggers
          </Link>{' '}
          deployed across 25 measurement positions at the site.
          Soil moisture is presented as VWC (m³/m³).
        </p>
        <p>
          <strong>Gas flux</strong> measurements are collected at each collar position.
        </p>
        <p>
          <strong>Redox potential</strong> is measured at multiple depths to characterise
          soil aeration and biogeochemical conditions across the wetland.
        </p>

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
          <ListItem disableGutters sx={{ py: 0.3, display: 'flex', alignItems: 'center' }}>
            <Box component="span" sx={{ mr: 0.5 }}>Development: Evan Thomas</Box>
            <Link href="https://github.com/evanjt" target="_blank" rel="noopener noreferrer" sx={{ ml: 0.5 }}>
              <GitHubIcon sx={{ fontSize: '1rem', color: theme.link }} />
            </Link>
            <Link href="https://www.linkedin.com/in/evanjt" target="_blank" rel="noopener noreferrer" sx={{ ml: 0.5 }}>
              <LinkedInIcon sx={{ fontSize: '1rem', color: theme.link }} />
            </Link>
            <Link href="https://evanjt.com" target="_blank" rel="noopener noreferrer" sx={{ ml: 0.5 }}>
              <LanguageIcon sx={{ fontSize: '1rem', color: theme.link }} />
            </Link>
          </ListItem>
        </List>
      </div>
    </div>
  );
}
