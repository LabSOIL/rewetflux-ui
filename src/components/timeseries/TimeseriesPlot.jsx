import React, { useRef, useEffect, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

function toAlignedData(data) {
  if (!data.times || !data.times.length || !data.parameters || !data.parameters.length) {
    return { aligned: null, labels: [] };
  }

  const times = data.times.map(t => new Date(t).getTime() / 1000);
  const aligned = [times, ...data.parameters.map(p => p.values)];
  const labels = data.parameters.map(p => p.name);
  return { aligned, labels };
}

function tooltipPlugin(tooltipRef, containerRef) {
  return {
    hooks: {
      setCursor: [(u) => {
        const tt = tooltipRef.current;
        const container = containerRef.current;
        if (!tt || !container) return;
        const { left, top, idx } = u.cursor;
        if (idx == null) {
          tt.style.display = 'none';
          return;
        }
        const ts = u.data[0][idx];
        let html = `<b>${new Date(ts * 1000).toLocaleString()}</b>`;
        for (let i = 1; i < u.series.length; i++) {
          if (!u.series[i].show) continue;
          const val = u.data[i][idx];
          html += `<br><span style="display:inline-block;width:12px;height:4px;background:${u.series[i].stroke(u, i)};margin:0 4px 2px;vertical-align:middle;border-radius:1px"></span> ${u.series[i].label}: ${val != null ? Number(val).toFixed(2) : '\u2014'}`;
        }
        tt.innerHTML = html;
        tt.style.display = 'block';
        const overRect = u.over.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const cx = overRect.left - cRect.left + left;
        const cy = overRect.top - cRect.top + top;
        const ttW = tt.offsetWidth;
        tt.style.left = (cx + ttW + 20 > cRect.width ? cx - ttW - 10 : cx + 15) + 'px';
        tt.style.top = Math.max(cy - tt.offsetHeight / 2, 0) + 'px';
      }],
    },
  };
}

const TOOLTIP_STYLE = {
  position: 'absolute',
  display: 'none',
  background: 'rgba(0,0,0,0.85)',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'system-ui, sans-serif',
  pointerEvents: 'none',
  zIndex: '100',
  lineHeight: '1.5',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

export default function TimeseriesPlot({ series, dataOption, onZoom, loading, resolution }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const onZoomRef = useRef(onZoom);
  const prevStructRef = useRef(null);
  onZoomRef.current = onZoom;

  const sensorName = series.sensor?.name || '';
  const { aligned, labels } = useMemo(() => toAlignedData(series), [series]);

  // Create tooltip element once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tt = document.createElement('div');
    Object.assign(tt.style, TOOLTIP_STYLE);
    el.appendChild(tt);
    tooltipRef.current = tt;
    return () => { tt.remove(); };
  }, []);

  // Create or update chart — reuse existing chart when only data changes
  useEffect(() => {
    if (!aligned || !containerRef.current) return;

    const structKey = `${labels.join(',')}_${dataOption}_${sensorName}`;

    // If chart exists and structure hasn't changed, just update the data
    if (chartRef.current && prevStructRef.current === structKey) {
      chartRef.current.setData(aligned);
      // Update title in-place for resolution changes
      const titleEl = chartRef.current.root.querySelector('.u-title');
      if (titleEl) titleEl.textContent = `${sensorName} \u2014 ${dataOption}`;
      return;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    prevStructRef.current = structKey;

    const title = `${sensorName} \u2014 ${dataOption}`;

    const tp = tooltipPlugin(tooltipRef, containerRef);

    const opts = {
      width: containerRef.current.clientWidth,
      height: 200,
      title,
      cursor: {
        drag: { x: true, y: false },
        points: {
          fill: (u, si) => u.series[si].stroke(u, si),
          stroke: (u, si) => '#fff',
          size: (u, si) => 7,
          width: (u, si, size) => 2,
        },
      },
      scales: { x: { time: true } },
      series: [
        { label: 'Time', value: () => '' },
        ...labels.map((label, i) => ({
          label,
          stroke: COLORS[i % COLORS.length],
          width: 1.5,
          spanGaps: false,
          value: () => '',
        })),
      ],
      axes: [
        { stroke: '#333', grid: { stroke: 'rgba(0,0,0,0.1)' } },
        {
          label: dataOption === 'Temperature' ? 'Temperature (\u00B0C)' : 'VWC (m\u00B3/m\u00B3)',
          size: 60,
          stroke: '#333',
          grid: { stroke: 'rgba(0,0,0,0.1)' },
        },
      ],
      legend: {
        show: true,
        markers: {
          width: 0,
          fill: (u, si) => u.series[si].stroke(u, si),
        },
      },
      hooks: {
        setSelect: [(u) => {
          if (u.select.width < 1) return;
          const min = u.posToVal(u.select.left, 'x');
          const max = u.posToVal(u.select.left + u.select.width, 'x');
          if (onZoomRef.current) {
            onZoomRef.current({
              start: new Date(min * 1000).toISOString(),
              end: new Date(max * 1000).toISOString(),
            });
          }
          u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
        }],
        setCursor: tp.hooks.setCursor,
      },
    };

    chartRef.current = new uPlot(opts, aligned, containerRef.current);
  }, [aligned, dataOption, resolution, sensorName]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, []);

  // Double-click to reset zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => { if (onZoomRef.current) onZoomRef.current(null); };
    el.addEventListener('dblclick', handler);
    return () => el.removeEventListener('dblclick', handler);
  }, []);

  // Resize handling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (chartRef.current) chartRef.current.setSize({ width: el.clientWidth, height: 200 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!aligned) {
    return <div>No {dataOption.toLowerCase()} data available.</div>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ position: 'relative' }} />
      {loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.6)', zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{ color: '#999', fontSize: 12 }}>Loading...</span>
        </div>
      )}
    </div>
  );
}
