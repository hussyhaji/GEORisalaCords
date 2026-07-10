/* ================================================================
   AQALEEM BOUNDARIES LAYER
   Builds 8 rectangular climate-zone polygons and exposes a
   small controller API for visibility + color synchronization.
   ================================================================ */
(function(){
  const ZONES = [
    { name: 'ما تنسب الى الاقاليم', northFrom: 0, northTo: 12 },
    { name: 'الاقليم الاول', northFrom: 12, northTo: 20 },
    { name: 'الاقليم الثاني', northFrom: 20, northTo: 27.3 },
    { name: 'الاقليم الثالث', northFrom: 27.3, northTo: 33.3 },
    { name: 'الاقليم الرابع', northFrom: 33.3, northTo: 39 },
    { name: 'الاقليم الخامس', northFrom: 39, northTo: 43.3 },
    { name: 'الاقليم السادس', northFrom: 43.3, northTo: 47.15 },
    { name: 'الاقليم السابع', northFrom: 47.15, northTo: 49 }
  ];

  const WEST_BOUNDARY = -20;
  const EAST_BOUNDARY = 160;
  const NUMBER_FONT_MIN = 8;
  const NUMBER_FONT_MAX = 18;
  const ZOOM_REF_MIN = 2;
  const ZOOM_REF_MAX = 16;
  const FALLBACK_COLORS = [
    '#4FAE8C', '#8B7FD1', '#E2789A', '#34A99D',
    '#FF8A5B', '#44A1F2', '#F7B538', '#7B8CDE'
  ];

  function clamp(value, min, max){
    return Math.min(max, Math.max(min, value));
  }

  function toRgba(color, alpha){
    const str = String(color || '').trim();

    const shortHex = /^#([0-9a-fA-F]{3})$/.exec(str);
    if (shortHex){
      const hex = shortHex[1];
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const longHex = /^#([0-9a-fA-F]{6})$/.exec(str);
    if (longHex){
      const hex = longHex[1];
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgb = /^rgb\(([^)]+)\)$/i.exec(str);
    if (rgb){
      return str.replace(/^rgb/i, 'rgba').replace(')', `, ${alpha})`);
    }

    const rgba = /^rgba\(([^)]+)\)$/i.exec(str);
    if (rgba){
      const values = rgba[1].split(',').map(v => v.trim());
      if (values.length >= 3){
        return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
      }
    }

    return `rgba(255, 82, 82, ${alpha})`;
  }

  function normalizeUsingHost(normalizeColor, color, fallback){
    if (typeof normalizeColor === 'function'){
      return normalizeColor(color, fallback);
    }
    return color || fallback || '#ff5252';
  }

  function formatDegree(value){
    const num = Number(value);
    if (!Number.isFinite(num)) return '';

    const rounded = Number.isInteger(num)
      ? String(num)
      : String(parseFloat(num.toFixed(2)));

    return `${rounded}°`;
  }

  function getReadableLabelColor(color){
    const hex = String(color || '').trim();
    const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
    const long = /^#([0-9a-fA-F]{6})$/.exec(hex);

    if (short){
      const chars = short[1];
      const r = parseInt(chars[0] + chars[0], 16);
      const g = parseInt(chars[1] + chars[1], 16);
      const b = parseInt(chars[2] + chars[2], 16);
      const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
      return luminance > 170 ? '#2E2A3D' : '#FFFFFF';
    }

    if (long){
      const value = long[1];
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
      return luminance > 170 ? '#2E2A3D' : '#FFFFFF';
    }

    return '#FFFFFF';
  }

  window.initAqaleemBoundaries = function initAqaleemBoundaries(options){
    const map = options && options.map;
    const subLayerGroup = options && options.subLayerGroup;
    const normalizeColor = options && options.normalizeColor;
    const pointLayers = (options && options.pointLayers) || [];

    if (!map || !subLayerGroup || !window.ol){
      return null;
    }

    const colorsByZoneName = {};
    const orderedZoneColors = [];

    pointLayers.forEach((layer, idx) => {
      const title = layer && layer.get && layer.get('title');
      const features = layer && layer.getSource ? layer.getSource().getFeatures() : [];
      const firstFeature = features && features.length ? features[0] : null;
      const pointColor = normalizeUsingHost(
        normalizeColor,
        firstFeature && firstFeature.get ? firstFeature.get('Pincolor') : null,
        firstFeature && firstFeature.get ? firstFeature.get('color') : null
      );

      if (title){
        colorsByZoneName[title] = pointColor;
      }
      orderedZoneColors[idx] = pointColor;
    });

    const features = ZONES.map((zone, index) => {
      const color = normalizeUsingHost(
        normalizeColor,
        colorsByZoneName[zone.name] || orderedZoneColors[index],
        FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      );

      const ring = [
        ol.proj.fromLonLat([WEST_BOUNDARY, zone.northFrom]),
        ol.proj.fromLonLat([WEST_BOUNDARY, zone.northTo]),
        ol.proj.fromLonLat([EAST_BOUNDARY, zone.northTo]),
        ol.proj.fromLonLat([EAST_BOUNDARY, zone.northFrom]),
        ol.proj.fromLonLat([WEST_BOUNDARY, zone.northFrom])
      ];

      const feature = new ol.Feature({
        geometry: new ol.geom.Polygon([ring])
      });

      feature.setProperties({
        zoneName: zone.name,
        northFrom: zone.northFrom,
        northTo: zone.northTo,
        westBoundary: WEST_BOUNDARY,
        eastBoundary: EAST_BOUNDARY,
        boundaryColor: color,
        isBoundaryZone: true
      });

      return feature;
    });

    const boundaryLayer = new ol.layer.Vector({
      source: new ol.source.Vector({ features }),
      style: (feature, resolution) => {
        const color = normalizeUsingHost(normalizeColor, feature.get('boundaryColor'), '#8B7FD1');
        const textColor = getReadableLabelColor(color);
        const extent = feature.getGeometry().getExtent();
        const labelPoint = new ol.geom.Point([extent[2], (extent[1] + extent[3]) / 2]);
        const northFromPoint = new ol.geom.Point([extent[2], extent[1]]);
        const northToPoint = new ol.geom.Point([extent[2], extent[3]]);
        const northFromText = formatDegree(feature.get('northFrom'));
        const northToText = formatDegree(feature.get('northTo'));

        const view = map.getView();
        const zoom = (typeof resolution === 'number')
          ? view.getZoomForResolution(resolution)
          : view.getZoom();
        const safeZoom = Number.isFinite(zoom) ? zoom : ZOOM_REF_MIN;
        const t = clamp((safeZoom - ZOOM_REF_MIN) / (ZOOM_REF_MAX - ZOOM_REF_MIN), 0, 1);
        const numberFontSize = Math.round(NUMBER_FONT_MIN + ((NUMBER_FONT_MAX - NUMBER_FONT_MIN) * t));

        return [
          new ol.style.Style({
            fill: new ol.style.Fill({ color: toRgba(color, 0.2) }),
            stroke: new ol.style.Stroke({ color, width: 2 })
          }),
          new ol.style.Style({
            geometry: labelPoint,
            text: new ol.style.Text({
              text: feature.get('zoneName') || '',
              font: '700 14px Amiri, serif',
              fill: new ol.style.Fill({ color: textColor }),
              stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.18)', width: 1.2 }),
              backgroundFill: new ol.style.Fill({ color: toRgba(color, 0.88) }),
              backgroundStroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.35)', width: 1 }),
              padding: [4, 10, 4, 10],
              textAlign: 'left',
              textBaseline: 'middle',
              offsetX: 10,
              offsetY: 0,
              overflow: true
            })
          }),
          new ol.style.Style({
            geometry: northFromPoint,
            text: new ol.style.Text({
              text: northFromText,
              font: `700 ${numberFontSize}px Amiri, serif`,
              fill: new ol.style.Fill({ color: textColor }),
              backgroundFill: new ol.style.Fill({ color: toRgba(color, 0.9) }),
              backgroundStroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.35)', width: 1 }),
              padding: [3, 7, 3, 7],
              textAlign: 'left',
              textBaseline: 'bottom',
              offsetX: 8,
              offsetY: -4,
              overflow: true
            })
          }),
          new ol.style.Style({
            geometry: northToPoint,
            text: new ol.style.Text({
              text: northToText,
              font: `700 ${numberFontSize}px Amiri, serif`,
              fill: new ol.style.Fill({ color: textColor }),
              backgroundFill: new ol.style.Fill({ color: toRgba(color, 0.9) }),
              backgroundStroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.35)', width: 1 }),
              padding: [3, 7, 3, 7],
              textAlign: 'left',
              textBaseline: 'top',
              offsetX: 8,
              offsetY: 4,
              overflow: true
            })
          })
        ];
      },
      properties: {
        title: 'حدود الاقاليم',
        isBoundaryLayer: true
      },
      visible: false
    });

    boundaryLayer.setZIndex(5);

    // Insert at the start so points remain visually above boundaries.
    subLayerGroup.getLayers().insertAt(0, boundaryLayer);

    const toggleButton = document.getElementById('boundaries-toggle-btn');

    function setVisible(visible){
      boundaryLayer.setVisible(Boolean(visible));
      if (!toggleButton) return;

      toggleButton.classList.toggle('is-active', Boolean(visible));
      toggleButton.setAttribute('aria-pressed', String(Boolean(visible)));
      toggleButton.title = visible ? 'إخفاء حدود الاقاليم' : 'إظهار حدود الاقاليم';
      toggleButton.querySelector('.btn-text').textContent = visible ? 'إخفاء حدود الاقاليم' : 'إظهار حدود الاقاليم';
    }

    function toggle(){
      setVisible(!boundaryLayer.getVisible());
    }

    function getVisible(){
      return boundaryLayer.getVisible();
    }

    function getPrimaryColor(){
      const feat = features[0];
      return feat ? feat.get('boundaryColor') : '#8B7FD1';
    }

    if (toggleButton){
      toggleButton.addEventListener('click', () => toggle());
    }

    setVisible(false);

    return {
      layer: boundaryLayer,
      toggle,
      setVisible,
      getVisible,
      getPrimaryColor
    };
  };
})();
