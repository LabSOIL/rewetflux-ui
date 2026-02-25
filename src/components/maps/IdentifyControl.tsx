import proj4 from 'proj4';
import React, { useState, useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// 1. Register Swiss LV95 / EPSG:2056 in proj4
proj4.defs(
  'EPSG:2056',
  '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 ' +
  '+x_0=2600000 +y_0=1200000 +ellps=bessel ' +
  '+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs'
)

export default function IdentifyControl({
  targetLayerName = 'SwissTopo Lithology GeoCover',
}) {
  const map = useMap()
  const [activeBase, setActiveBase] = useState('')

  // 2. Listen for which base-layer is active
  useEffect(() => {
    function onBaseChange(e) {
      setActiveBase(e.name)
    }
    map.on('baselayerchange', onBaseChange)
    return () => map.off('baselayerchange', onBaseChange)
  }, [map])

  // 3. Only identify on click when the chosen base-layer is active
  useMapEvents({
    click: async (e) => {
      if (activeBase !== targetLayerName) return

      const { lat, lng } = e.latlng
      const [x, y] = proj4('EPSG:4326', 'EPSG:2056', [lng, lat])
      const size = map.getSize()
      const b = map.getBounds()
      const [minX, minY] = proj4('EPSG:4326', 'EPSG:2056', [
        b.getWest(),
        b.getSouth(),
      ])
      const [maxX, maxY] = proj4('EPSG:4326', 'EPSG:2056', [
        b.getEast(),
        b.getNorth(),
      ])

      const params = new URLSearchParams({
        layers: 'all:ch.swisstopo.geologie-geocover',
        sr: '2056',
        geometry: `${x},${y}`,
        mapExtent: `${minX},${minY},${maxX},${maxY}`,
        imageDisplay: `${size.x},${size.y},96`,
        geometryFormat: 'geojson',
        geometryType: 'esriGeometryPoint',
        limit: '1',
        tolerance: '10',
        returnGeometry: 'true',
        lang: 'en',
      })

      try {
        const res = await fetch(
          `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?${params}`
        )
        const json = await res.json()
        const feature = json.results && json.results[0]
        if (!feature) return

        const p = feature.properties
        const titleDe = p.litho_de || '–'
        const descDe = p.description_de || ''
        const titleFr = p.litho_fr || '–'
        const descFr = p.description_fr || ''

        const html = `
          <div style="font-size:0.9rem; line-height:1.3">
            <div><strong>Deutsch:</strong> ${titleDe}</div>
            <div style="margin-bottom:0.5em">${descDe}</div>
            <hr style="margin:0.5em 0"/>
            <div><strong>Français:</strong> ${titleFr}</div>
            <div>${descFr}</div>
            <div style="margin-top:0.75em; font-size:0.8rem; color:#555">
              <em>Source:
                <a href="https://www.swisstopo.admin.ch/en/geological-model-2d-geocover"
                   target="_blank"
                   rel="noopener noreferrer">
                  SwissTopo GeoCover
                </a>
              </em>
            </div>
          </div>
        `
        L.popup()
          .setLatLng(e.latlng)
          .setContent(html)
          .openOn(map)
      } catch (err) {
        console.error('Identify request failed', err)
      }
    },
  })

  return null
}
