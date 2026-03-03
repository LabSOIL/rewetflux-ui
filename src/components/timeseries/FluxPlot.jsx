import { useRef, useEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const CO2_COLOR = '#d62728';
const CH4_COLOR = '#2ca02c';

const LOADING_OVERLAY = {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.6)', zIndex: 10, pointerEvents: 'none',
};

function buildAligned(flux_data) {
  const sorted = [...flux_data].sort(
    (a, b) => new Date(a.measured_on) - new Date(b.measured_on)
  );
  const times = sorted.map(d => new Date(d.measured_on).getTime() / 1000);
  const co2 = sorted.map(d => d.flux_co2_umol_m2_s ?? null);
  const ch4 = sorted.map(d => d.flux_ch4_nmol_m2_s ?? null);
  return [times, co2, ch4];
}

export default function FluxPlot({ series, loading }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const prevIdRef = useRef(null);

  const sensorName = series.name || '';
  const fluxData = series.flux_data || [];

  useEffect(() => {
    if (!containerRef.current || !fluxData.length) return;

    const aligned = buildAligned(fluxData);
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
        scales: { x: { time: true }, co2: {}, ch4: {} },
        series: [
          { label: 'Time', value: () => '' },
          {
            label: 'CO\u2082 (\u03bcmol\u00b7m\u207b\u00b2\u00b7s\u207b\u00b9)',
            scale: 'co2',
            stroke: CO2_COLOR,
            width: 1.5,
            value: () => '',
            points: { show: true, size: 7, fill: CO2_COLOR, stroke: CO2_COLOR, width: 1 },
          },
          {
            label: 'CH\u2084 (nmol\u00b7m\u207b\u00b2\u00b7s\u207b\u00b9)',
            scale: 'ch4',
            stroke: CH4_COLOR,
            width: 1.5,
            value: () => '',
            points: { show: true, size: 7, fill: CH4_COLOR, stroke: CH4_COLOR, width: 1 },
          },
        ],
        axes: [
          { stroke: '#333', grid: { stroke: 'rgba(0,0,0,0.1)' } },
          {
            scale: 'co2',
            label: 'CO\u2082 (\u03bcmol m\u207b\u00b2 s\u207b\u00b9)',
            side: 3,
            size: 75,
            stroke: CO2_COLOR,
            grid: { stroke: 'rgba(0,0,0,0.1)' },
          },
          {
            scale: 'ch4',
            label: 'CH\u2084 (nmol m\u207b\u00b2 s\u207b\u00b9)',
            side: 1,
            size: 75,
            stroke: CH4_COLOR,
            grid: { show: false },
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
  }, [fluxData, sensorName, series.id]);

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

  if (!fluxData.length) return <div>No gas flux data available.</div>;

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
