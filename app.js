/* ================================================================
   CONFIGURATION
   Centralised, easy-to-edit constants: card vocabulary, CSV path,
   basemap URL, and a few style knobs. Change these, not the logic.
   ================================================================ */

// Path to the local CSV data source (columns documented in README).
const CSV_URL = 'RisalaCoordinates.csv';

// Display labels for the popup card — rename here to change vocabulary
// anywhere in the UI without touching the rendering logic below.
const LABELS = {
  header: {
    name: 'Name',
    sublayer: 'Category'
  },
  mini: {
    Latitude: 'العرض حسب الرسالة الشريفة',
    Longitude: 'Longitude',
    LongORG: 'الطول حسب الرسالة الشريفة'
  },
  info: ''
};

// Google Satellite (no labels) XYZ endpoint. "lyrs=s" = satellite only.
const BASEMAP_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

// Marker / label style tuning.
const BASE_RADIUS = 7;          // px, un-hovered pin radius
const BASE_FONT_SIZE = 12;      // px, un-hovered label size
const HOVER_SCALE = 1.45;       // scale multiplier applied on hover
const ANIM_EASE = 0.22;         // 0-1, higher = snappier hover animation
const ZOOM_REF_MIN = 2;         // map zoom considered "fully zoomed out"
const ZOOM_REF_MAX = 16;        // map zoom considered "fully zoomed in"
const ZOOM_SCALE_MIN = 0.2;    // tiny symbols/labels at far zoom-out
const ZOOM_SCALE_MAX = 3;     // enlarged symbols/labels when zoomed in
const MIN_RENDERED_FONT = 4;    // keep text drawable at very small sizes

// Label offset used by default when no adjust value is provided.
const BASE_LABEL_OFFSET_Y = -16;

function getLabelPlacement(adjustRaw, scale){
  const adjust = String(adjustRaw || '').trim().toLowerCase();
  const offset = 16 * scale;

  if (adjust === 'left'){
    return {
      offsetX: -offset,
      offsetY: -(8 * scale),
      textAlign: 'right'
    };
  }

  if (adjust === 'right'){
    return {
      offsetX: offset,
      offsetY: -(8 * scale),
      textAlign: 'left'
    };
  }

  if (adjust === 'down' || adjust === 'bottom'){
    return {
      offsetX: 0,
      offsetY: (16 * scale) + BASE_RADIUS,
      textAlign: 'center'
    };
  }

  if (adjust === 'up' || adjust === 'top'){
    return {
      offsetX: 0,
      offsetY: -(24 * scale) - BASE_RADIUS,
      textAlign: 'center'
    };
  }

  return {
    offsetX: 0,
    offsetY: (BASE_LABEL_OFFSET_Y * scale) - BASE_RADIUS,
    textAlign: 'center'
  };
}

// Ensure color values from CSV are valid CSS colors.
function normalizeColor(primary, fallback){
  const tryColor = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    if (!str) return null;

    // Convert plain hex like "8140DC" into "#8140DC".
    if (/^[0-9a-fA-F]{6}$/.test(str) || /^[0-9a-fA-F]{3}$/.test(str)) {
      return `#${str}`;
    }

    // Accept already-valid CSS color strings (#hex, rgb(), hsl(), names, etc).
    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', str)) {
      return str;
    }

    return null;
  };

  return tryColor(primary) || tryColor(fallback) || '#ff5252';
}

function getReadableTextColor(color){
  const hex = normalizeColor(color);
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

/* ================================================================
   MAP INITIALISATION
   ================================================================ */

// --- Basemap: Google Satellite, no labels ---------------------------------
const satelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: BASEMAP_URL,
    attributions: '© Google',
    maxZoom: 20
  }),
  properties: { title: 'Google Satellite', isBasemap: true }
});
satelliteLayer.setZIndex(0);

// --- Map object -------------------------------------------------------------
const map = new ol.Map({
  target: 'map',
  layers: [satelliteLayer], // vector sublayers are added after CSV parsing
  view: new ol.View({
    center: ol.proj.fromLonLat([0, 20]), // temporary; refit after data loads
    zoom: 3
  }),
  controls: ol.control.defaults.defaults({
    zoom: false,
    attributionOptions: { collapsible: true }
  })
});

function setSatelliteVisibility(visible){
  satelliteLayer.setVisible(visible);

  const targetEl = map.getTargetElement();
  if (targetEl){
    targetEl.style.backgroundColor = visible ? '#0d1117' : '#ffffff';
  }

  if (graticuleController && typeof graticuleController.setLineColor === 'function'){
    graticuleController.setLineColor(!visible);
  }
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function getZoomResponsiveScale(resolution){
  const view = map.getView();
  const zoom = (typeof resolution === 'number')
    ? view.getZoomForResolution(resolution)
    : view.getZoom();

  const safeZoom = Number.isFinite(zoom) ? zoom : ZOOM_REF_MIN;
  const t = clamp(
    (safeZoom - ZOOM_REF_MIN) / (ZOOM_REF_MAX - ZOOM_REF_MIN),
    0,
    1
  );

  return ZOOM_SCALE_MIN + ((ZOOM_SCALE_MAX - ZOOM_SCALE_MIN) * t);
}

/* ================================================================
   HOVER ANIMATION ENGINE
   Each feature carries an 'anim_scale' property (default 1). On
   hover we ease it towards HOVER_SCALE; on hover-out we ease it
   back to 1. The style function below reads this property so the
   marker + label visually "grow" smoothly rather than snapping.
   ================================================================ */
const animTargets = {}; // uid -> { feature, target }
let rafId = null;

function setAnimTarget(feature, target){
  const uid = ol.util.getUid(feature);
  animTargets[uid] = { feature, target };
  if (!rafId) rafId = requestAnimationFrame(stepAnimation);
}

function stepAnimation(){
  let stillAnimating = false;
  for (const uid in animTargets){
    const { feature, target } = animTargets[uid];
    const current = feature.get('anim_scale') ?? 1;
    const diff = target - current;
    if (Math.abs(diff) < 0.01){
      feature.set('anim_scale', target);
      delete animTargets[uid];
    } else {
      feature.set('anim_scale', current + diff * ANIM_EASE); // triggers re-render
      stillAnimating = true;
    }
  }
  rafId = stillAnimating ? requestAnimationFrame(stepAnimation) : null;
}

/* ================================================================
   FEATURE STYLE FUNCTION
   Pin colour comes from the CSV "Pincolor" column. Label text is
   black on a semi-transparent white background so it stays legible
   over the satellite imagery.
   ================================================================ */
function featureStyle(feature, resolution){
  const animScale = feature.get('anim_scale') ?? 1;
  const zoomScale = getZoomResponsiveScale(resolution);
  const scale = animScale * zoomScale;
  const pinColor = normalizeColor(feature.get('Pincolor'), feature.get('color'));
  const name = feature.get('Name') || '';
  const labelPlacement = getLabelPlacement(feature.get('adjust'), scale);

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: BASE_RADIUS * scale,
      fill: new ol.style.Fill({ color: pinColor }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
    }),
    text: new ol.style.Text({
      text: name,
      font: `700 ${Math.max(MIN_RENDERED_FONT, Math.round(BASE_FONT_SIZE * scale))}px Amiri, serif`,
      fill: new ol.style.Fill({ color: '#000000' }),           // black text
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
      backgroundFill: new ol.style.Fill({ color: 'rgba(255,255,255,0.5)' }), // white 50% bg
      padding: [3, 6, 3, 6],
      offsetX: labelPlacement.offsetX,
      offsetY: labelPlacement.offsetY,
      textAlign: labelPlacement.textAlign
    }),
    zIndex: scale // larger/hovered feature draws above neighbours
  });
}

/* ================================================================
   CSV LOADING + PARSING (PapaParse)
   Rows are grouped by "SubLayer" into one ol.layer.Vector per group,
   all nested inside a parent ol.layer.Group named "RisalaCoordinates".
   ================================================================ */
const subLayerGroup = new ol.layer.Group({
  properties: { title: 'RisalaCoordinates' },
  layers: []
});
subLayerGroup.setZIndex(10);
map.addLayer(subLayerGroup);

let boundariesController = null;
let graticuleController = null;
let geoPlacesNowController = null;
let arabicLinesController = null;
let measureController = null;
const panelCollapseState = {
  geoPlacesNow: false,
  risalaCoordinates: false
};

if (typeof window.initMapGraticule === 'function'){
  graticuleController = window.initMapGraticule({ map });
}

if (typeof window.initArabicLinesLayer === 'function'){
  arabicLinesController = window.initArabicLinesLayer({ map });
}

setSatelliteVisibility(satelliteLayer.getVisible());

if (typeof window.initMapMeasure === 'function'){
  measureController = window.initMapMeasure({ map });
}

const sourceExtentFeatures = []; // used to fit the view once loaded

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results){
    buildLayersFromRows(results.data);
    document.getElementById('loading-overlay').classList.add('hidden');
  },
  error: function(err){
    console.error('CSV load/parse error:', err);
    document.getElementById('loading-overlay').innerHTML =
      `<div style="max-width:320px;text-align:center;">
         Could not load <b>${CSV_URL}</b>.<br>
         Make sure the file sits next to this HTML page and that you are
         viewing it over http:// (not file://).
       </div>`;
  }
});

function buildLayersFromRows(rows){
  if (!geoPlacesNowController && typeof window.initGeoPlacesNow === 'function'){
    geoPlacesNowController = window.initGeoPlacesNow({
      map,
      rows,
      normalizeColor,
      getZoomResponsiveScale
    });
  }

  // Group raw CSV rows by their SubLayer value.
  const groups = {};
  const orderedSubLayerNames = [];
  rows.forEach(row => {
    const lat = parseFloat(row.Latitude);
    const lon = parseFloat(row.Longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return; // skip malformed rows

    const sub = (row.SubLayer && row.SubLayer.trim()) || 'Uncategorised';
    if (!groups[sub]){
      groups[sub] = [];
      orderedSubLayerNames.push(sub);
    }

    const feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
    });
    feature.setProperties({
      Name: row.Name,
      Latitude: row.Latitude,
      Longitude: row.Longitude,
      LongORG: row.LongORG,
      SubLayer: sub,
      Information: row.Information,
      Pincolor: normalizeColor(row.Pincolor, row.color),
      color: row.color,
      adjust: row.adjust,
      anim_scale: 1
    });
    groups[sub].push(feature);
    sourceExtentFeatures.push(feature);
  });

  // One vector layer per SubLayer, all parented under subLayerGroup.
  const pointLayers = [];
  orderedSubLayerNames.forEach(subName => {
    const vectorLayer = new ol.layer.Vector({
      source: new ol.source.Vector({ features: groups[subName] }),
      style: featureStyle,
      properties: { title: subName, isSubLayer: true }
    });
    pointLayers.push(vectorLayer);
    subLayerGroup.getLayers().push(vectorLayer);
  });

  if (typeof window.initAqaleemBoundaries === 'function'){
    boundariesController = window.initAqaleemBoundaries({
      map,
      subLayerGroup,
      normalizeColor,
      pointLayers
    });
  }

  buildLayerPanel();

  // Fit the view to all loaded points with extra breathing room.
  if (sourceExtentFeatures.length){
    const extent = ol.extent.boundingExtent(
      sourceExtentFeatures.map(f => f.getGeometry().getCoordinates())
    );
    map.getView().fit(extent, { padding: [90, 90, 260, 90], maxZoom: 4, duration: 500 });
  }
}

/* ================================================================
   LAYER CONTROL PANEL (right side, tree of checkboxes)
   RisalaCoordinates (parent) -> individual SubLayers (children)
   Google Satellite basemap gets its own top-level checkbox.
   ================================================================ */
function buildLayerPanel(){
  const tree = document.getElementById('layer-tree');
  tree.innerHTML = '';

  function ensureParentVisible(parentCheckbox, setParentVisible){
    parentCheckbox.checked = true;
    setParentVisible(true);
  }

  if (geoPlacesNowController && geoPlacesNowController.layer){
    const geoChildControllers = [];
    const geoGroup = makeCollapsibleLayerGroup({
      label: 'GeoPlaces NOW',
      checked: geoPlacesNowController.getVisible(),
      onToggle: (checked) => geoPlacesNowController.setVisible(checked),
      swatchColor: normalizeColor(geoPlacesNowController.getFirstColor(), '#06202B'),
      collapseKey: 'geoPlacesNow'
    });

    const geoSubLayers = geoPlacesNowController.getSubLayers();
    geoSubLayers.forEach((layer) => {
      const swatchColor = firstPinColor(layer) || '#06202B';
      const row = makeLayerRow({
        label: layer.get('title'),
        checked: layer.getVisible(),
        onToggle: (checked) => {
          layer.setVisible(checked);
          if (checked){
            ensureParentVisible(geoGroup.parentCheckbox, (visible) => geoPlacesNowController.setVisible(visible));
          }
        },
        rowClass: 'child',
        swatchColor
      });
      const checkbox = row.querySelector('input');
      geoChildControllers.push({
        checkbox,
        setVisible: (visible) => layer.setVisible(visible)
      });
      geoGroup.childrenContainer.appendChild(row);
    });

    geoGroup.parentCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      geoChildControllers.forEach((child) => {
        child.checkbox.checked = checked;
        child.setVisible(checked);
      });
    });

    tree.appendChild(geoGroup.root);
  }

  // --- Parent: RisalaCoordinates (toggles the whole group) ---
  const childControllers = [];
  const risalaGroup = makeCollapsibleLayerGroup({
    label: 'RisalaCoordinates',
    checked: subLayerGroup.getVisible(),
    onToggle: (checked) => {
      subLayerGroup.setVisible(checked);
      childControllers.forEach((child) => {
        child.checkbox.checked = checked;
        child.setVisible(checked);
      });
    },
    collapseKey: 'risalaCoordinates'
  });
  tree.appendChild(risalaGroup.root);

  // --- Children: one row per SubLayer ---
  subLayerGroup.getLayers().forEach(layer => {
    if (layer.get('isBoundaryLayer')) return;

    const swatchColor = firstPinColor(layer) || '#8B7FD1';
    const row = makeLayerRow({
      label: layer.get('title'),
      checked: layer.getVisible(),
      onToggle: (checked) => {
        layer.setVisible(checked);
        if (checked){
          ensureParentVisible(risalaGroup.parentCheckbox, (visible) => subLayerGroup.setVisible(visible));
        }
      },
      rowClass: 'child',
      swatchColor
    });
    const checkbox = row.querySelector('input');
    childControllers.push({
      checkbox,
      setVisible: (visible) => layer.setVisible(visible)
    });
    risalaGroup.childrenContainer.appendChild(row);
  });

  // --- Basemap row (last in panel list) ---
  if (graticuleController && graticuleController.layer){
    tree.appendChild(makeLayerRow({
      label: 'خطوط الطول والعرض',
      checked: graticuleController.getVisible(),
      onToggle: (checked) => graticuleController.setVisible(checked),
      rowClass: 'parent',
      swatchColor: graticuleController.getSwatchColor()
    }));
  }

  if (arabicLinesController && arabicLinesController.layer){
    tree.appendChild(makeLayerRow({
      label: 'الخطوط',
      checked: arabicLinesController.getVisible(),
      onToggle: (checked) => arabicLinesController.setVisible(checked),
      rowClass: 'parent',
      swatchColor: arabicLinesController.getSwatchColor()
    }));
  }

  tree.appendChild(makeLayerRow({
    label: 'Google Satellite',
    checked: satelliteLayer.getVisible(),
    onToggle: (checked) => setSatelliteVisibility(checked),
    rowClass: 'parent'
  }));
}

// Pull one representative Pincolor from a sublayer, for the panel swatch.
function firstPinColor(layer){
  if (!layer || !layer.getSource) return null;
  const feats = layer.getSource().getFeatures();
  return feats.length ? normalizeColor(feats[0].get('Pincolor'), feats[0].get('color')) : null;
}

function makeCollapsibleLayerGroup({ label, checked, onToggle, swatchColor, collapseKey }){
  const root = document.createElement('div');
  root.className = 'layer-group';

  const parentRow = makeLayerRow({
    label,
    checked,
    onToggle,
    rowClass: 'parent',
    swatchColor
  });
  parentRow.classList.add('has-children');

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'group-collapse-btn';
  collapseBtn.setAttribute('aria-label', `Toggle ${label} sublayers`);

  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'layer-group-children';

  const isCollapsed = Boolean(panelCollapseState[collapseKey]);
  root.classList.toggle('collapsed', isCollapsed);

  function syncCollapseVisual(){
    const collapsed = root.classList.contains('collapsed');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.textContent = collapsed ? '▸' : '▾';
  }

  collapseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    root.classList.toggle('collapsed');
    panelCollapseState[collapseKey] = root.classList.contains('collapsed');
    syncCollapseVisual();
  });

  syncCollapseVisual();

  parentRow.appendChild(collapseBtn);
  root.appendChild(parentRow);
  root.appendChild(childrenContainer);

  return {
    root,
    parentRow,
    parentCheckbox: parentRow.querySelector('input'),
    childrenContainer
  };
}

// Builds a single checkbox row element for the layer panel.
function makeLayerRow({ label, checked, onToggle, rowClass, swatchColor }){
  const row = document.createElement('div');
  row.className = `layer-row ${rowClass}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  const safeLabel = String(label)
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '');
  checkbox.id = `layer-cb-${safeLabel}`;
  checkbox.addEventListener('change', (e) => onToggle(e.target.checked));

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', checkbox.id);
  labelEl.textContent = label;

  row.appendChild(checkbox);
  if (swatchColor){
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = swatchColor;
    row.appendChild(swatch);
  }
  row.appendChild(labelEl);
  return row;
}

/* ================================================================
   HOVER INTERACTION
   Cursor -> pointer, and the hovered pin/label scales up smoothly
   via the animation engine defined above.
   ================================================================ */
let hoveredFeature = null;
const mapTargetEl = map.getTargetElement();

map.on('pointermove', (evt) => {
  if (evt.dragging) return;

  const hit = map.forEachFeatureAtPixel(
    evt.pixel,
    (feature, layer) => {
      if (!feature) return null;
      if (feature.get('isBoundaryZone')) return null;
      if (feature.get('isGeoPlacesNowFeature')) return null;
      if (feature.get('isGuideLine')) return null;
      if (layer && layer.get && layer.get('isGraticuleLayer')) return null;
      return feature;
    },
    { hitTolerance: 4 }
  );

  if (hit !== hoveredFeature){
    if (hoveredFeature) setAnimTarget(hoveredFeature, 1);      // reset old
    if (hit) setAnimTarget(hit, HOVER_SCALE);                  // grow new
    hoveredFeature = hit || null;
  }

  mapTargetEl.classList.toggle('feature-hover', !!hit);
});

/* ================================================================
   CLICK INTERACTION -> BOTTOM DIALOGUE BOX
   ================================================================ */
const popupEl = document.getElementById('feature-popup');

map.on('singleclick', (evt) => {
  if (measureController && measureController.isActive && measureController.isActive()){
    closePopup();
    return;
  }

  const feature = map.forEachFeatureAtPixel(
    evt.pixel,
    (feature, layer) => {
      if (!feature) return null;
      if (feature.get('isBoundaryZone')) return null;
      if (feature.get('isGeoPlacesNowFeature')) return null;
      if (feature.get('isGuideLine')) return null;
      if (layer && layer.get && layer.get('isGraticuleLayer')) return null;
      return feature;
    },
    { hitTolerance: 4 }
  );
  if (feature){
    openPopup(feature);
  } else {
    closePopup();
  }
});

function openPopup(feature){
  const layerColor = normalizeColor(feature.get('Pincolor'), feature.get('color'));
  const sublayerCard = document.getElementById('popup-sublayer-card');

  document.getElementById('popup-name').textContent = feature.get('Name') || '—';
  document.getElementById('popup-sublayer').textContent = feature.get('SubLayer') || '—';
  sublayerCard.style.backgroundColor = layerColor;
  sublayerCard.style.color = getReadableTextColor(layerColor);

  document.getElementById('popup-lat-label').textContent = LABELS.mini.Latitude;
  document.getElementById('popup-longorg-label').textContent = LABELS.mini.LongORG;
  document.getElementById('popup-lat').textContent = feature.get('Latitude') ?? '—';
  document.getElementById('popup-longorg').textContent = feature.get('LongORG') ?? '—';

  document.getElementById('popup-info-label').textContent = LABELS.info;
  document.getElementById('popup-info').textContent = feature.get('Information') || 'No further information available.';

  // Tie the header's accent stripe to this feature's own pin colour.
  const header = document.querySelector('.popup-header');
  header.style.borderLeftColor = layerColor;

  popupEl.classList.add('open');
}

function closePopup(){
  popupEl.classList.remove('open');
}

document.getElementById('popup-close-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  closePopup();
});

// Prevent clicks inside the popup card from bubbling to the map
// (so interacting with the card never pans/zooms the map underneath).
popupEl.addEventListener('click', (e) => e.stopPropagation());
popupEl.addEventListener('pointerdown', (e) => e.stopPropagation());

document.addEventListener('pointerdown', (e) => {
  if (!popupEl.classList.contains('open')) return;
  if (popupEl.contains(e.target)) return;
  closePopup();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopup();
});

/* ================================================================
   LAYERS PANEL TOGGLE
   Desktop: text button toggles show/hide.
   Mobile: 3-line button opens/closes layers panel.
   ================================================================ */
const MOBILE_BREAKPOINT = 768;
const layersToggleBtn = document.getElementById('layers-toggle-btn');
const layersToggleText = layersToggleBtn.querySelector('.toggle-text');
const layerPanelEl = document.getElementById('layer-panel');

function isMobileViewport(){
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function isLayersPanelOpen(){
  return isMobileViewport()
    ? document.body.classList.contains('layers-mobile-open')
    : !document.body.classList.contains('layers-hidden');
}

function setLayersPanelOpen(open){
  if (isMobileViewport()){
    document.body.classList.toggle('layers-mobile-open', open);
  } else {
    document.body.classList.toggle('layers-hidden', !open);
  }
}

function syncLayersPanelState(){
  const isOpen = isLayersPanelOpen();

  layersToggleBtn.setAttribute('aria-expanded', String(isOpen));
  layersToggleBtn.title = isOpen ? 'إخفاء الطبقات' : 'إظهار الطبقات';
  layersToggleText.textContent = isOpen ? 'إخفاء الطبقات' : 'إظهار الطبقات';
}

layersToggleBtn.addEventListener('click', () => {
  setLayersPanelOpen(!isLayersPanelOpen());
  syncLayersPanelState();
});

document.addEventListener('pointerdown', (e) => {
  if (!isLayersPanelOpen()) return;
  if (layerPanelEl.contains(e.target) || layersToggleBtn.contains(e.target)) return;

  setLayersPanelOpen(false);
  syncLayersPanelState();
});

window.addEventListener('resize', () => {
  if (isMobileViewport()){
    document.body.classList.remove('layers-hidden');
  } else {
    document.body.classList.remove('layers-mobile-open');
  }
  syncLayersPanelState();
});

// Start with layers panel hidden; user opens it with the toggle button.
if (isMobileViewport()){
  document.body.classList.remove('layers-mobile-open');
} else {
  document.body.classList.add('layers-hidden');
}

syncLayersPanelState();
