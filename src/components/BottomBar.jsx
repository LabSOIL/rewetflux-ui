import Slider from '@mui/material/Slider';
import { useSelection } from '../contexts/SelectionContext';
import { hasDateBar, isLogger, labelStops } from '../utils/stops';
import { RAIL_WIDTH, theme } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toValue = date => Date.parse(`${date}T00:00:00Z`);
const parts = iso => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: MONTHS[month - 1], day };
};
// '2030-03-02' → '2 Mar', the label of a campaign.
const shortDate = iso => {
  const { day, month } = parts(iso);
  return `${day} ${month}`;
};
// '2030-08-01' → 'Aug', the label of a month on a daily series.
const monthName = iso => parts(iso).month;
// '2030-08-15' → '15 Aug 2030', the selected date of a daily series.
const longDate = iso => {
  const { year, month, day } = parts(iso);
  return `${day} ${month} ${year}`;
};

/** Bottom bar that steps the map through the dates of the selected layer. */
export default function BottomBar() {
  const { variable, date, stops, selectDate } = useSelection();
  if (!hasDateBar(stops)) return null;

  const daily = isLogger(variable);
  const current = date ?? stops[stops.length - 1].date;
  const labels = new Map(
    labelStops(variable, stops).map(s => [s.date, daily ? monthName(s.date) : shortDate(s.date)]),
  );
  const marks = stops.map(s => ({ value: toValue(s.date), label: labels.get(s.date) }));
  const value = toValue(current);

  const handleChange = (_, next) => {
    const stop = stops.find(s => toValue(s.date) === next);
    if (stop) selectDate(stop.date);
  };

  return (
    <div className="bottom-bar" style={bottomBarStyle} role="group" aria-label="Date">
      <Slider
        min={marks[0].value}
        max={marks[marks.length - 1].value}
        step={null}
        marks={marks.length > 1 ? marks : false}
        value={value}
        onChange={handleChange}
        valueLabelDisplay="off"
        disabled={marks.length < 2}
        aria-label="Date"
        sx={sliderSx(marks, value)}
      />
      {daily && <span style={dateStyle}>{longDate(current)}</span>}
    </div>
  );
}

// The framework's slider styling: the track hidden, a teal thumb, every stop a teal mark,
// the labels white and the selected label light teal and bold.
function sliderSx(marks, value) {
  const selected = marks.findIndex(m => m.value === value);
  const perStop = marks.reduce((acc, mark, index) => {
    acc[`& .MuiSlider-mark[data-index="${index}"]`] = { backgroundColor: theme.accent };
    if (mark.label !== undefined) acc[`& .MuiSlider-markLabel[data-index="${index}"]`] = { color: theme.white };
    return acc;
  }, {});
  return {
    flex: 1,
    color: theme.accent,
    '& .MuiSlider-track': { display: 'none' },
    '& .MuiSlider-rail': { backgroundColor: theme.button },
    '& .MuiSlider-thumb': { backgroundColor: theme.accent, border: `2px solid ${theme.active}` },
    '& .MuiSlider-thumb:focus, & .MuiSlider-thumb:active, & .MuiSlider-thumb:hover': { boxShadow: 'none' },
    '& .MuiSlider-mark': { backgroundColor: theme.button },
    '& .MuiSlider-markLabel': { color: theme.muted, fontSize: '12px' },
    ...perStop,
    [`& .MuiSlider-markLabel[data-index="${selected}"]`]: { color: theme.accentText, fontWeight: 'bold' },
  };
}

const bottomBarStyle = {
  position: 'absolute',
  bottom: '30px',
  left: RAIL_WIDTH + 10,
  right: '50px',
  backgroundColor: theme.panel,
  color: theme.text,
  padding: '10px 40px',
  borderTop: `1px solid ${theme.panelBorder}`,
  display: 'flex',
  justifyContent: 'center',
  zIndex: '1000',
  boxSizing: 'border-box',
  overflow: 'hidden',
  borderRadius: '10px',
};

const dateStyle = {
  flexShrink: 0,
  marginLeft: '24px',
  alignSelf: 'center',
  whiteSpace: 'nowrap',
  color: theme.accentText,
  fontWeight: 'bold',
};
