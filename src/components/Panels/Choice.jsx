import Chip from '@mui/material/Chip';
import PanelTitleWithTooltip from './Title';

/**
 * A popup beside the rail with one chip per choice; picking a chip selects it and closes the
 * popup. `popupProps` come from useHoverPopup when the popup opens on hover.
 */
export default function ChoicePanel({ title, tooltip, choices, selected, onSelect, onClose, popupProps }) {
  const handleChipClick = choice => {
    onSelect(choice.value);
    onClose();
  };

  return (
    <div className={popupProps ? 'popup hover-popup' : 'popup'} role="dialog" aria-label={title} {...popupProps}>
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
