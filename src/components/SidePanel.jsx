import { useState } from 'react';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import Slider from '@mui/material/Slider';
import './SidePanel.css';
import ChoicePanel from './Panels/Choice';
import InfoPanel from './Panels/Info';
import DepthGauge from './DepthGauge';
import { useSelection } from '../contexts/SelectionContext';
import { useView } from '../contexts/ViewContext';
import { theme } from '../theme';
import { VARIABLES, optionLabel } from '../utils/selection';
import { hasDateBar } from '../utils/stops';
import { useHoverPopup } from '../utils/hoverPopup';

const spacingSx = {
  color: theme.accent,
  height: 84,
  '& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible': { boxShadow: 'none' },
};

export default function SidePanel() {
  const { variable, option, options, stops, selectVariable, selectOption } = useSelection();
  const [activePanel, setActivePanel] = useState(null);
  const view = useView();
  const layers3D = view != null && view.mode !== '2d';

  const variableLabel = VARIABLES.find(v => v.key === variable)?.label ?? '';

  // The variables open on hover as well as on a click; one popup shows at a time.
  const variables = useHoverPopup({ onOpen: () => setActivePanel(null) });
  const handlePanelClick = panel => {
    variables.close();
    setActivePanel(activePanel === panel ? null : panel);
  };
  const close = () => setActivePanel(null);

  return (
    <div className="side-panel">
      {variable == null && (
        // The variable button is the first 70px button of the rail.
        <div className="arrow-note" style={{ top: 35 }}>
          <span>Select a variable</span>
        </div>
      )}
      <div className="button-group top">
        <button {...variables.triggerProps} className={variables.open ? 'active' : ''}>
          <div className="button-content">
            <LayersOutlinedIcon />
            <span>Variable</span>
            <span className="current-selection">{variableLabel}</span>
          </div>
        </button>
        {view && (
          <button onClick={view.toggle3D} className={layers3D ? 'active' : ''} aria-pressed={layers3D}>
            <div className="button-content">
              <ViewInArOutlinedIcon />
              <span>3D layers</span>
              <span className="current-selection">{layers3D ? 'On' : 'Off'}</span>
            </div>
          </button>
        )}
        {layers3D && (
          // The 3D layers' own option, opened under them while they are on.
          <button
            onClick={() => view.setCrossSection(!view.crossSection)}
            className={`sub-option${view.crossSection ? ' active' : ''}`}
            aria-pressed={view.crossSection}
          >
            <div className="button-content">
              <ContentCutOutlinedIcon />
              <span>Cross-section</span>
              <span className="current-selection">{view.crossSection ? 'On' : 'Off'}</span>
            </div>
          </button>
        )}
        {layers3D && (
          // How far apart the 3D slices hang: up spreads them, down closes them up.
          <div className="spacing-section">
            <div className="slot-label">Spacing</div>
            <Slider
              orientation="vertical"
              size="small"
              min={2}
              max={60}
              value={view.layerSpacing}
              onChange={(_, value) => view.setLayerSpacing(value)}
              aria-label="Layer spacing"
              getAriaValueText={value => `${value * 10} times`}
              sx={spacingSx}
            />
            <span className="current-selection">×{view.layerSpacing * 10}</span>
          </div>
        )}
      </div>

      <DepthGauge options={options} selected={option} onSelect={selectOption} />

      <div className="button-group bottom">
        <button onClick={() => handlePanelClick('info')} className={activePanel === 'info' ? 'active' : ''}>
          <div className="button-content">
            <InfoOutlinedIcon />
            <span>Info</span>
          </div>
        </button>
      </div>

      {variables.open && (
        <ChoicePanel
          title="Variable"
          choices={VARIABLES.map(v => ({ value: v.key, label: v.label }))}
          selected={variable}
          onSelect={selectVariable}
          onClose={variables.close}
          popupProps={variables.popupProps}
        />
      )}
      {activePanel === 'info' && <InfoPanel onClose={close} hasTimeline={hasDateBar(stops)} />}
    </div>
  );
}
