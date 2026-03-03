import { useRef, useEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const DEPTH_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
const DEPTH_LABELS = ['5 cm', '15 cm', '25 cm', '35 cm'];
const DEPTH_KEYS = ['ch1_5cm_mv', 'ch2_15cm_mv', 'ch3_25cm_mv', 'ch4_35cm_mv'];

const LOADING_OVERLAY = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.6)', zIndex: 10, pointerEvents: 'none',
};

function buildAligned(redox_data) {
  const sorted = [...redox_data].sort(
    (a, b) => new Date(a.measured_on) - new Date(b.measured_on)
  );
  const times = sorted.map(d => new Date(d.measured_on).getTime() / 1000);
  const channels = DEPTH_KEYS.map(key => sorted.map(d => d[key] ?? null));
  return [times, ...channels];
}

export default function RedoxPlot({ series, loading }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const prevIdRef = useRef(null);

  const sensorName = series.name || '';
  const redoxData = series.redox_data || [];

  useEffect(() => {
    if (!containerRef.current || !redoxData.length) return;

    const aligned = buildAligned(redoxData);
    const width = containerRef.current.clientWidth;

    if (chartRef.current && prevIdRef.current === series.id) {
      chartRef.current.setData(aligned);
      return;
    }
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    prevIdRef.current = series.id;

    chartRef.current = new uPlot(
      {
        width,
        height: 160,
        title: sensorName,
        cursor: { drag: { x: false, y: false } },
        scales: { x: { time: true } },
        series: [
          { label: 'Time', value: () => '' },
          ...DEPTH_LABELS.map((label, i) => ({
            label,
            stroke: DEPTH_COLORS[i],
            width: 0,
            value: () => '',
            points: { show: true, size: 7, fill: DEPTH_COLORS[i], stroke: DEPTH_COLORS[i], width: 1 },
          })),
        ],
        axes: [
          { stroke: '#333', grid: { stroke: 'rgba(0,0,0,0.1)' } },
          {
            label: 'E\u2095 (mV)',
            size: 60,
            stroke: '#333',
            grid: { stroke: 'rgba(0,0,0,0.1)' },
          },
        ],
        legend: {
          show: true,
          markers: { width: 0, fill: (u, si) => u.series[si].stroke },
        },
      },
      aligned,
      containerRef.current,
    );
  }, [redoxData, sensorName, series.id]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.setSize({ width: el.clientWidth, height: 160 });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    },
    [],
  );

  if (!redoxData.length) return <div>No redox data available.</div>;

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} />
      {loading && (
        <div style={LOADING_OVERLAY}>
          <span style={{ color: '#999', fontSize: 12 }}>Loading...</span>
        </div>
      )}
    </div>
  );
}
