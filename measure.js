(function(){
  const EARTH_RADIUS_METERS = 6371008.8;
  const ACTIVE_BUTTON_CLASS = 'is-active';
  const DEFAULT_TOOLTIP_MESSAGE = 'ابدأ الرسم للقياس';

  function formatNumber(value, decimals){
    return Number(value).toFixed(decimals);
  }

  function toLonLatCoordinates(geometry){
    if (!geometry || typeof geometry.getCoordinates !== 'function') return [];
    return geometry.getCoordinates().map((coord) => ol.proj.toLonLat(coord));
  }

  function getAngularDistanceDegrees(start, end){
    if (!start || !end) return 0;

    const distanceMeters = ol.sphere.getDistance(start, end, EARTH_RADIUS_METERS);
    return (distanceMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  }

  function getAxisDifferences(geometry){
    const lonLatCoords = toLonLatCoordinates(geometry);
    if (lonLatCoords.length < 2){
      return null;
    }

    const start = lonLatCoords[0];
    const end = lonLatCoords[lonLatCoords.length - 1];
    const latitudeDegrees = Math.abs(end[1] - start[1]);
    const longitudeDegrees = Math.abs(end[0] - start[0]);
    const totalKilometers = ol.sphere.getLength(geometry, { projection: 'EPSG:3857' }) / 1000;

    return {
      kilometers: totalKilometers,
      degrees: {
        latitude: latitudeDegrees,
        longitude: longitudeDegrees
      }
    };
  }

  function formatMeasureMarkup(geometry){
    const axisDiffs = getAxisDifferences(geometry);
    if (!axisDiffs){
      return DEFAULT_TOOLTIP_MESSAGE;
    }

    return [
      '<div class="measure-tooltip-line"><span class="measure-tooltip-label">KM:</span><span class="measure-tooltip-values">' + formatNumber(axisDiffs.kilometers, 3) + ' km</span></div>',
      '<div class="measure-tooltip-line"><span class="measure-tooltip-label">Degrees:</span><span class="measure-tooltip-values">Lat ' + formatNumber(axisDiffs.degrees.latitude, 4) + '° | Lon ' + formatNumber(axisDiffs.degrees.longitude, 4) + '°</span></div>'
    ].join('');
  }

  function setTooltipContent(element, content, isMarkup){
    if (isMarkup){
      element.innerHTML = content;
      return;
    }

    element.textContent = content;
  }

  function makeTooltipElement(){
    const element = document.createElement('div');
    element.className = 'measure-tooltip';
    element.textContent = DEFAULT_TOOLTIP_MESSAGE;
    return element;
  }

  window.initMapMeasure = function initMapMeasure(options){
    const map = options && options.map;
    const button = document.getElementById('measure-toggle-btn');

    if (!map || !button || !window.ol){
      return null;
    }

    const source = new ol.source.Vector();
    const layer = new ol.layer.Vector({
      source,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: 'rgba(15, 139, 141, 0.92)',
          width: 3,
          lineDash: [10, 8]
        }),
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: '#ffffff' }),
          stroke: new ol.style.Stroke({ color: '#0F8B8D', width: 3 })
        })
      }),
      properties: {
        title: 'Measure Layer',
        isMeasureLayer: true
      }
    });
    layer.setZIndex(60);
    map.addLayer(layer);

    const tooltipElement = makeTooltipElement();
    const tooltipOverlay = new ol.Overlay({
      element: tooltipElement,
      offset: [16, -16],
      positioning: 'bottom-left',
      stopEvent: false
    });
    map.addOverlay(tooltipOverlay);

    let draw = null;
    let sketchFeature = null;
    let sketchChangeKey = null;
    let active = false;

    function detachSketchListener(){
      if (sketchChangeKey){
        ol.Observable.unByKey(sketchChangeKey);
        sketchChangeKey = null;
      }
    }

    function resetTooltip(message){
      setTooltipContent(tooltipElement, message || DEFAULT_TOOLTIP_MESSAGE, false);
      tooltipOverlay.setPosition(undefined);
    }

    function syncButtonState(){
      button.classList.toggle(ACTIVE_BUTTON_CLASS, active);
      button.setAttribute('aria-pressed', String(active));
      button.title = active ? 'إيقاف القياس' : 'تشغيل القياس';
      const label = button.querySelector('.btn-text');
      if (label){
        label.textContent = active ? 'إيقاف القياس' : 'القياس';
      }
    }

    function teardownDraw(){
      if (draw){
        map.removeInteraction(draw);
        draw = null;
      }
      detachSketchListener();
      sketchFeature = null;
      resetTooltip();
    }

    function activate(){
      if (active) return;
      active = true;
      source.clear();

      draw = new ol.interaction.Draw({
        source,
        type: 'LineString',
        stopClick: true,
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#0F8B8D',
            width: 3,
            lineDash: [10, 8]
          }),
          image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({ color: '#ffffff' }),
            stroke: new ol.style.Stroke({ color: '#0F8B8D', width: 2 })
          })
        })
      });

      draw.on('drawstart', (evt) => {
        source.clear();
        sketchFeature = evt.feature;
        resetTooltip('اختر النقطة التالية');

        detachSketchListener();
        sketchChangeKey = sketchFeature.getGeometry().on('change', (changeEvt) => {
          const geometry = changeEvt.target;
          const coordinates = geometry.getLastCoordinate();
          setTooltipContent(tooltipElement, formatMeasureMarkup(geometry), true);
          tooltipOverlay.setPosition(coordinates);
        });
      });

      draw.on('drawend', (evt) => {
        const geometry = evt.feature.getGeometry();
        setTooltipContent(tooltipElement, formatMeasureMarkup(geometry), true);
        tooltipOverlay.setPosition(geometry.getLastCoordinate());
        sketchFeature = null;
        detachSketchListener();
      });

      map.addInteraction(draw);
      syncButtonState();
    }

    function deactivate(){
      if (!active) return;
      active = false;
      teardownDraw();
      source.clear();
      syncButtonState();
    }

    function toggle(){
      if (active){
        deactivate();
      } else {
        activate();
      }
    }

    map.on('pointermove', (evt) => {
      if (!active || sketchFeature || evt.dragging) return;
      tooltipElement.textContent = 'انقر لبدء القياس';
      tooltipOverlay.setPosition(evt.coordinate);
    });

    map.on('movestart', () => {
      if (!active || sketchFeature) return;
      tooltipOverlay.setPosition(undefined);
    });

    document.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Escape') return;
      deactivate();
    });

    button.addEventListener('click', () => toggle());
    syncButtonState();
    resetTooltip();

    return {
      layer,
      toggle,
      activate,
      deactivate,
      isActive: () => active
    };
  };
})();