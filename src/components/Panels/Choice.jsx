import Chip from '@mui/material/Chip';
import PanelTitleWithTooltip from './Title';

/** A popup beside the rail with one chip per choice; picking a chip selects it and closes the popup. */
export default function ChoicePanel({ title, tooltip, choices, selected, onSelect, onClose }) {
  const handleChipClick = choice => {
    onSelect(choice.value);
    onClose();
  };

  return (
    <div className="popup">
      <PanelTitleWithTooltip title={title} tooltip={tooltip} onClose={onClose} />
      <div className="chips-list">
        {choices.map(choice => (
          <Chip
            key={choice.value}
            label={choice.label}
            clickable
            className={selected === choice.value ? 'active' : ''}
            onClick={() => handleChipClick(choice)}
          />
        ))}
      </div>
    </div>
  );
}
