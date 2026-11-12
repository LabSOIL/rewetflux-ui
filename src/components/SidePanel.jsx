import { useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import './SidePanel.css';
import ChoicePanel from './Panels/Choice';
import InfoPanel from './Panels/Info';
import DepthGauge from './DepthGauge';
import { useSelection } from '../contexts/SelectionContext';
import { useView } from '../contexts/ViewContext';
import { VARIABLES, optionLabel } from '../utils/selection';
import { hasDateBar } from '../utils/stops';

export default function SidePanel() {
  const { variable, option, options, stops, selectVariable, selectOption } = useSelection();
  const [activePanel, setActivePanel] = useState(null);
  const view = useView();
  const layers3D = view != null && view.mode !== '2d';

  const variableLabel = VARIABLES.find(v => v.key === variable)?.label ?? '';

  const handlePanelClick = panel => setActivePanel(activePanel === panel ? null : panel);
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
        <button onClick={() => handlePanelClick('variables')} className={activePanel === 'variables' ? 'active' : ''}>
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

      {activePanel === 'variables' && (
        <ChoicePanel
          title="Variable"
          choices={VARIABLES.map(v => ({ value: v.key, label: v.label }))}
          selected={variable}
          onSelect={selectVariable}
          onClose={close}
        />
      )}
      {activePanel === 'info' && <InfoPanel onClose={close} hasTimeline={hasDateBar(stops)} />}
    </div>
  );
}
