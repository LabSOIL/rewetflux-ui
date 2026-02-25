export function slugify(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // strip accents
      .replace(/[^a-z0-9]+/g, '_')         // non-alphanumeric → underscore
      .replace(/^_|_$/g, '')               // trim leading/trailing _
  }
  
  export function getStaticModelUrl(areaName, layerKey) {
    const s = slugify(areaName)
    switch (layerKey) {
      case 'socStock':
        return `/models/socstock_model_${s}_wgs.tif`
      case 'ndvi':
        return `/models/ndvi_${s}_wgs.tif`
      case 'soilType':
        return `/models/soil_${s}_wgs.geojson`
      case 'vegetation':
        return `/models/vegetation_${s}_wgs.geojson`
      default:
        return null
    }
  }