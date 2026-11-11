import { useState } from 'react';

const STEPS = 10;

/** A colour scale with its title and its minimum, middle and maximum, which folds away behind a toggle. */
export default function Legend({ title, colorScale, minVal, maxVal }) {
  const [isVisible, setIsVisible] = useState(true);
  const mid = Math.round((minVal + maxVal) / 2);
  const labels = [maxVal, mid === minVal || mid === maxVal ? '' : mid, minVal];
  const stops = colorScale.colors(STEPS).reverse().join(', ');

  return (
    <div className={`legend-container${isVisible ? '' : ' legend-collapsed'}`}>
      <button
        type="button"
        className="toggle-button"
        aria-label={isVisible ? 'Hide legend' : 'Show legend'}
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? '▾' : '▴'}
      </button>
      {isVisible && (
        <div className="legend-content">
          <div className="legend-title">{title}</div>
          <div className="legend-color-bar-container">
            <div className="legend-color-bar" style={{ background: `linear-gradient(to bottom, ${stops})` }} />
            <div className="legend-labels">
              {labels.map((value, index) => (
                <div key={index} className="legend-label">{value}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
