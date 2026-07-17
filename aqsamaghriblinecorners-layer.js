/* ================================================================
   AQSA MAGHRIB CORNERS LAYER
   Loads line features from aqsamaghriblinecorners.geojson and applies
   the same draw-on-load animation style as the Maghrib guide line.
   ================================================================ */
(function(){
  const LINE_COLOR = '#67A2C5';
  const DRAW_DURATION_MS = 5200;
  const DRAW_DELAY_MS = 500;
  const GLOW_CORE_RADIUS = 8;
  const GLOW_TRAIL_BASE_RADIUS = 10;
  const GLOW_TRAIL_MAX_EXTRA = 8;
  const GLOW_RADIUS_SLOW_FACTOR = 1.5;
  const LABEL_REVEAL_START = 0;
  const LABEL_REVEAL_SPAN = 0.22;
  const LABEL_TEXT = 'زوايا اقصى المغرب';
  const GEOJSON_URL = 'aqsamaghriblinecorners.geojson';

  function easeInOutCubic(t){
    return t < 0.5
      ? (4 * t * t * t)
      : (1 - (Math.pow(-2 * t + 2, 3) / 2));
  }

  function hexToRgb(hexColor){
    const value = String(hexColor || '').trim();
    const hexMatch = /^#([0-9a-fA-F]{6})$/.exec(value);
    if (!hexMatch) return { r: 255, g: 255, b: 255 };

    const raw = hexMatch[1];
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function colorWithAlpha(hexColor, alpha){
    const rgb = hexToRgb(hexColor);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  function getPartialLineCoordinates(coords, progress){
    if (!coords || coords.length < 2) return coords;

    const p = Math.max(0, Math.min(1, progress));
    if (p <= 0) return [coords[0], coords[0]];
    if (p >= 1) return coords.slice();

    const segmentLengths = [];
    let totalLength = 0;

    for (let i = 1; i < coords.length; i += 1){
      const a = coords[i - 1];
      const b = coords[i];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segmentLengths.push(segLen);
      totalLength += segLen;
    }

    if (totalLength <= 0) return [coords[0], coords[0]];

    const targetLength = totalLength * p;
    const partial = [coords[0]];
    let consumed = 0;

    for (let i = 1; i < coords.length; i += 1){
      const a = coords[i - 1];
      const b = coords[i];
      const segLen = segmentLengths[i - 1];

      if (consumed + segLen < targetLength){
        partial.push(b);
        consumed += segLen;
        continue;
      }

      const remain = targetLength - consumed;
      const ratio = segLen > 0 ? (remain / segLen) : 0;
      partial.push([
        a[0] + ((b[0] - a[0]) * ratio),
        a[1] + ((b[1] - a[1]) * ratio)
      ]);
      break;
    }

    return partial;
  }

  function runWhenMapReady(map, callback){
    const overlay = document.getElementById('loading-overlay');

    function runAfterRender(){
      map.once('postrender', () => callback());
      map.render();
    }

    if (!overlay || overlay.classList.contains('hidden')){
      runAfterRender();
      return;
    }

    const observer = new MutationObserver(() => {
      if (overlay.classList.contains('hidden')){
        observer.disconnect();
        runAfterRender();
      }
    });

    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function animateLineDraw(feature, map, options){
    const duration = Number(options && options.duration) || DRAW_DURATION_MS;
    const delay = Number(options && options.delay) || 0;
    const geometry = feature.getGeometry();
    if (!geometry || geometry.getType() !== 'LineString') return;

    const projection = map.getView().getProjection();
    let fullCoords = geometry.getCoordinates().slice();

    if (fullCoords.length >= 2){
      const startLonLat = ol.proj.toLonLat(fullCoords[0], projection);
      const endLonLat = ol.proj.toLonLat(fullCoords[fullCoords.length - 1], projection);
      if (startLonLat[1] > endLonLat[1]){
        fullCoords = fullCoords.slice().reverse();
      }
    }

    feature.set('lineAnimProgress', 0);
    feature.setGeometry(new ol.geom.LineString(getPartialLineCoordinates(fullCoords, 0)));

    let start = null;
    function frame(now){
      if (start == null) start = now + delay;
      if (now < start){
        requestAnimationFrame(frame);
        return;
      }

      const rawT = Math.max(0, Math.min(1, (now - start) / duration));
      const easedT = easeInOutCubic(rawT);
      feature.set('lineAnimProgress', easedT);
      feature.setGeometry(new ol.geom.LineString(getPartialLineCoordinates(fullCoords, easedT)));
      feature.set('lineGlowPoint', new ol.geom.Point(feature.getGeometry().getLastCoordinate()));
      map.render();

      if (rawT < 1){
        requestAnimationFrame(frame);
      } else {
        feature.set('lineAnimProgress', 1);
        feature.setGeometry(new ol.geom.LineString(fullCoords));
        feature.set('lineGlowPoint', null);
      }
    }

    requestAnimationFrame(frame);
  }

  function styleForFeature(feature){
    const color = feature.get('color') || LINE_COLOR;
    const label = feature.get('label') || '';
    const labelPoint = feature.get('labelPoint');
    const progress = Number(feature.get('lineAnimProgress'));
    const hasAnim = Number.isFinite(progress);
    const opacity = hasAnim ? (0.2 + (0.8 * progress)) : 1;
    const width = hasAnim ? (1.8 + (1.7 * progress)) : 3;
    const labelProgress = hasAnim
      ? Math.max(0, Math.min(1, (progress - LABEL_REVEAL_START) / LABEL_REVEAL_SPAN))
      : 1;
    const labelOffsetY = -8 - (8 * (1 - labelProgress));
    const glowPoint = feature.get('lineGlowPoint');
    const trailProgress = hasAnim
      ? Math.pow(Math.max(0, Math.min(1, progress)), GLOW_RADIUS_SLOW_FACTOR)
      : 1;
    const trailRadius = GLOW_TRAIL_BASE_RADIUS + (GLOW_TRAIL_MAX_EXTRA * trailProgress);
    const trailFillAlpha = 0.12 + (0.2 * trailProgress);
    const trailStrokeAlpha = 0.25 + (0.45 * trailProgress);

    const styles = [
      new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: colorWithAlpha(color, opacity),
          width
        })
      }),
      new ol.style.Style({
        geometry: labelPoint || null,
        text: new ol.style.Text({
          text: labelProgress > 0 ? label : '',
          font: '700 16px Amiri, serif',
          fill: new ol.style.Fill({ color: colorWithAlpha('#FFFFFF', labelProgress) }),
          stroke: new ol.style.Stroke({ color: colorWithAlpha('#000000', 0.8 * labelProgress), width: 3 }),
          backgroundFill: new ol.style.Fill({ color: colorWithAlpha(color, labelProgress) }),
          padding: [3, 8, 3, 8],
          textAlign: 'center',
          textBaseline: 'bottom',
          offsetY: labelOffsetY,
          overflow: true
        })
      })
    ];

    if (glowPoint){
      styles.push(
        new ol.style.Style({
          geometry: glowPoint,
          image: new ol.style.Circle({
            radius: trailRadius,
            fill: new ol.style.Fill({ color: colorWithAlpha(color, trailFillAlpha) }),
            stroke: new ol.style.Stroke({ color: colorWithAlpha('#FFFFFF', trailStrokeAlpha), width: 2 })
          })
        }),
        new ol.style.Style({
          geometry: glowPoint,
          image: new ol.style.Circle({
            radius: GLOW_CORE_RADIUS,
            fill: new ol.style.Fill({ color: colorWithAlpha('#FFFFFF', 0.96) }),
            stroke: new ol.style.Stroke({ color: colorWithAlpha(color, 1), width: 3.4 })
          })
        })
      );
    }

    return styles;
  }

  window.initAqsaMaghribCornersLayer = function initAqsaMaghribCornersLayer(options){
    const map = options && options.map;
    if (!map || !window.ol){
      return null;
    }

    const source = new ol.source.Vector();
    const layer = new ol.layer.Vector({
      source,
      style: styleForFeature,
      properties: {
        title: 'زوايا اقصى المغرب',
        isAqsaMaghribCornersLayer: true
      },
      visible: true
    });

    layer.setZIndex(6);
    map.addLayer(layer);

    fetch(GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${GEOJSON_URL}`);
        return res.json();
      })
      .then((geojson) => {
        const format = new ol.format.GeoJSON();
        const features = format.readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection()
        });

        features.forEach((feature) => {
          const geom = feature.getGeometry();
          if (!geom || geom.getType() !== 'LineString') return;

          const labelPoint = new ol.geom.Point(geom.getCoordinateAt(0.03));

          feature.setProperties({
            color: LINE_COLOR,
            label: LABEL_TEXT,
            labelPoint,
            isGuideLine: true
          }, true);

          source.addFeature(feature);

          runWhenMapReady(map, () => {
            animateLineDraw(feature, map, {
              duration: DRAW_DURATION_MS,
              delay: DRAW_DELAY_MS
            });
          });
        });
      })
      .catch((err) => {
        console.error('Could not load aqsamaghriblinecorners.geojson:', err);
      });

    return {
      layer,
      setVisible(visible){
        layer.setVisible(Boolean(visible));
      },
      getVisible(){
        return layer.getVisible();
      },
      getSwatchColor(){
        return LINE_COLOR;
      }
    };
  };
})();
