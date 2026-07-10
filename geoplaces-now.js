/* ================================================================
   GEO PLACES NOW LAYER
   Builds a dedicated point layer from LatitudeNOW/LongitudeNOW with
   Name labels always visible and styled for contrast.
   ================================================================ */
(function(){
  const BASE_RADIUS = 7;
  const BASE_FONT_SIZE = 12;
  const MIN_RENDERED_FONT = 4;

  function parseNowCoordinate(value){
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw || raw.toUpperCase() === '#N/A') return null;
    const num = parseFloat(raw);
    return Number.isFinite(num) ? num : null;
  }

  function getScale(options, resolution){
    const resolver = options && options.getZoomResponsiveScale;
    if (typeof resolver === 'function'){
      return resolver(resolution);
    }
    return 1;
  }

  window.initGeoPlacesNow = function initGeoPlacesNow(options){
    const map = options && options.map;
    const rows = (options && options.rows) || [];
    const normalizeColor = options && options.normalizeColor;

    if (!map || !window.ol){
      return null;
    }

    const groupedFeatures = {};
    const orderedSubLayers = [];

    rows.forEach((row) => {
      const name = String(row.Name || '').trim();
      const lat = parseNowCoordinate(row.LatitudeNOW);
      const lon = parseNowCoordinate(row.LongitudeNOW);

      // Ignore rows where NOW coordinates are not available.
      if (!name || name.toUpperCase() === '#N/A' || lat == null || lon == null) return;

      const subLayerName = (String(row.SubLayer || '').trim()) || 'Uncategorised';

      const pinColor = typeof normalizeColor === 'function'
        ? normalizeColor(row.PincolorNOW, row.Pincolor || row.color)
        : (row.PincolorNOW || row.Pincolor || row.color || '#06202B');

      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
      });

      feature.setProperties({
        Name: name,
        Latitude: row.LatitudeNOW,
        Longitude: row.LongitudeNOW,
        LongORG: row.LongitudeNOW,
        SubLayer: subLayerName,
        Information: row.categoryNOW || 'GeoPlaces NOW point',
        Pincolor: pinColor,
        PincolorNOW: pinColor,
        anim_scale: 1,
        isGeoPlacesNowFeature: true
      });

      if (!groupedFeatures[subLayerName]){
        groupedFeatures[subLayerName] = [];
        orderedSubLayers.push(subLayerName);
      }

      groupedFeatures[subLayerName].push(feature);
    });

    function nowStyle(feature, resolution){
        const animScale = feature.get('anim_scale') ?? 1;
        const zoomScale = getScale(options, resolution);
        const scale = animScale * zoomScale;
        const pinColor = typeof normalizeColor === 'function'
          ? normalizeColor(feature.get('PincolorNOW'), feature.get('Pincolor'))
          : (feature.get('PincolorNOW') || feature.get('Pincolor') || '#06202B');

        return new ol.style.Style({
          image: new ol.style.Circle({
            radius: BASE_RADIUS * scale,
            fill: new ol.style.Fill({ color: pinColor }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
          }),
          text: new ol.style.Text({
            text: feature.get('Name') || '',
            font: `700 ${Math.max(MIN_RENDERED_FONT, Math.round(BASE_FONT_SIZE * scale))}px Amiri, serif`,
            fill: new ol.style.Fill({ color: '#FFFFFF' }),
            backgroundFill: new ol.style.Fill({ color: 'rgba(0,0,0,0.9)' }),
            backgroundStroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.18)', width: 1 }),
            padding: [3, 6, 3, 6],
            offsetX: 0,
            offsetY: (-16 * scale) - BASE_RADIUS,
            textAlign: 'center'
          }),
          zIndex: scale
        });
    }

    const layer = new ol.layer.Group({
      visible: true,
      properties: {
        title: 'GeoPlaces NOW',
        isGeoPlacesNowLayer: true
      },
      layers: []
    });

    const subLayers = [];
    orderedSubLayers.forEach((subLayerName) => {
      const vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: groupedFeatures[subLayerName] }),
        style: nowStyle,
        visible: false,
        properties: {
          title: subLayerName,
          isGeoPlacesNowSubLayer: true
        }
      });
      subLayers.push(vectorLayer);
      layer.getLayers().push(vectorLayer);
    });

    // Keep this layer behind RisalaCoordinates.
    layer.setZIndex(9);
    map.addLayer(layer);

    function setVisible(visible){
      const isVisible = Boolean(visible);
      layer.setVisible(isVisible);
      subLayers.forEach((subLayer) => subLayer.setVisible(isVisible));
    }

    function getVisible(){
      return layer.getVisible();
    }

    function getFirstColor(){
      if (!subLayers.length) return '#06202B';
      const features = subLayers[0].getSource().getFeatures();
      if (!features.length) return '#06202B';
      return features[0].get('PincolorNOW') || features[0].get('Pincolor') || '#06202B';
    }

    function getSubLayers(){
      return subLayers.slice();
    }

    return {
      layer,
      setVisible,
      getVisible,
      getFirstColor,
      getSubLayers
    };
  };
})();