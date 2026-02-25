import React from 'react';
import Plot from 'react-plotly.js';

export default function TimeseriesPlot({ series, dataOption }) {
  // pick the correct field
  const key = 'data_by_depth_cm';
  const byDepth = series[key] || {};

  // build one trace per depth
  const traces = Object.entries(byDepth).map(([depth, records]) => ({
    x: records.map(r => r.time_utc),
    y: records.map(r => r.y),
    name: `${depth} cm`,
    type: 'scatter',
    mode: 'lines',
  }));

  if (traces.length === 0) {
    return <div>No {dataOption.toLowerCase()} data available.</div>;
  }
  return (
    <Plot
      data={traces}
      layout={{
        // title as object, so you can style it later if you like
        title: {
          text: `${series.name} — ${dataOption}`,
          font: { size: 14 } // Adjust the font size here
        },

        // axis labels with units
        xaxis: {
          title: { text: 'Time (UTC)' },
          automargin: true,
        },
        yaxis: {
          title: { text: dataOption === 'Temperature' ? 'Temperature (°C)' : 'VWC (m³/m³)' },
          automargin: true,
        },
        showlegend: true,   

        // legend styling
        legend: { orientation: 'h', xanchor: 'center', x: 0.5, y: -0.2 },

        // make sure there's room for your title
        margin: { t: 50, b: 50, l: 50, r: 20 },

        // you can also explicitly set a minimum height
        height: 200,
      }}
      style={{ width: '100%' }}
      config={{ responsive: true }}
    />
  );
}
