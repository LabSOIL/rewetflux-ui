import { optionLabel } from '../utils/selection';

const ARROWS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * The rail's slot under Variable: a vertical gauge of depths, shallowest at the top, for a
 * depth layer, or two stacked buttons for the chamber setting of a flux layer.
 */
export default function DepthGauge({ options, selected, onSelect }) {
  const { kind, values } = options;
  if (values.length === 0) return null;

  const label = <div className="slot-label">{kind === 'setting' ? 'Chamber' : 'Depth'}</div>;

  if (kind === 'setting') {
    return (
      <div className="depth-slot depth-section">
        {label}
        <div className="button-group setting-buttons">
          {values.map(value => (
            <button key={value} className={value === selected ? 'active' : ''} onClick={() => onSelect(value)}>
              {optionLabel(kind, value)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const index = values.indexOf(selected);
  const onKeyDown = event => {
    const step = ARROWS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Math.min(values.length - 1, Math.max(0, (index < 0 ? 0 : index) + step));
    onSelect(values[next]);
  };

  return (
    <div className="depth-slot depth-section">
      {label}
      <div
        className="depth-gauge"
        role="radiogroup"
        aria-label="Depth below surface"
        aria-valuetext={index < 0 ? undefined : optionLabel(kind, selected)}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className="depth-surface" aria-hidden="true">
          <span className="depth-surface-tick" />
          Surface
        </div>
        <div className="depth-line" aria-hidden="true" />
        {values.map(value => (
          <button
            key={value}
            type="button"
            role="radio"
            tabIndex={-1}
            aria-checked={value === selected}
            aria-label={optionLabel(kind, value)}
            className={`depth-stop${value === selected ? ' selected' : ''}`}
            onClick={() => onSelect(value)}
          >
            <span className="depth-dot" />
            <span className="depth-label">{optionLabel(kind, value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
