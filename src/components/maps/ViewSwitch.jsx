const MODES = [
  { id: '2d', label: '2D' },
  { id: '3d', label: '3D' },
];

/** Two joined buttons choosing the 2D map or the 3D scene. */
export default function ViewSwitch({ mode, onChange }) {
  return (
    <div className="view-switch" role="radiogroup" aria-label="View">
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          className={mode === id ? 'selected' : ''}
          onClick={() => mode !== id && onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
