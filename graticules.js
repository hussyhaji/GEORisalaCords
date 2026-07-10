/* ================================================================
   GRATICULE LAYER
   Creates a clean, low-clutter latitude/longitude grid that can be
   toggled from the layer panel.
   ================================================================ */
(function(){
  function formatLat(lat){
    const abs = Math.abs(lat);
    const rounded = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
    const dir = lat >= 0 ? 'N' : 'S';
    return `${rounded}°${dir}`;
  }

  function formatLon(lon){
    const abs = Math.abs(lon);
    const rounded = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
    const dir = lon >= 0 ? 'E' : 'W';
    return `${rounded}°${dir}`;
  }

  window.initMapGraticule = function initMapGraticule(options){
    const map = options && options.map;
    if (!map || !window.ol || !ol.layer || !ol.layer.Graticule){
      return null;
    }

    const latLabelStyle = new ol.style.Text({
      font: '700 10px Amiri, serif',
      fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.98)' }),
      stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.45)', width: 1.2 }),
      backgroundFill: new ol.style.Fill({ color: 'rgba(17, 20, 28, 0.38)' }),
      padding: [1, 4, 1, 4],
      offsetX: -8
    });

    const lonLabelStyle = new ol.style.Text({
      font: '700 10px Amiri, serif',
      fill: new ol.style.Fill({ color: 'rgba(255,255,255,0.98)' }),
      stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.45)', width: 1.2 }),
      backgroundFill: new ol.style.Fill({ color: 'rgba(17, 20, 28, 0.38)' }),
      padding: [1, 4, 1, 4],
      offsetY: -8
    });

    // Limited intervals keep the grid readable and avoid heavy clutter.
    const gridLayer = new ol.layer.Graticule({
      properties: {
        title: 'خطوط الطول والعرض',
        isGraticuleLayer: true
      },
      showLabels: true,
      lonLabelFormatter: formatLon,
      latLabelFormatter: formatLat,
      lonLabelStyle: lonLabelStyle,
      latLabelStyle: latLabelStyle,
      latLabelPosition: 0.99,
      lonLabelPosition: 0.02,
      visible: true,
      wrapX: true,
      targetSize: 170,
      intervals: [60, 30, 20, 10, 5, 2, 1, 0.5],
      strokeStyle: new ol.style.Stroke({
        color: 'rgba(255, 255, 255, 0.28)',
        width: 1,
        lineDash: [6, 6]
      })
    });

    gridLayer.setZIndex(3);
    map.addLayer(gridLayer);

    function setVisible(visible){
      gridLayer.setVisible(Boolean(visible));
    }

    function toggle(){
      setVisible(!gridLayer.getVisible());
    }

    function getVisible(){
      return gridLayer.getVisible();
    }

    function getSwatchColor(){
      return 'rgba(255,255,255,0.85)';
    }

    return {
      layer: gridLayer,
      setVisible,
      toggle,
      getVisible,
      getSwatchColor
    };
  };
})();
