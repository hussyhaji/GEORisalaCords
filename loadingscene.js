(function(){
'use strict';

var overlay = document.getElementById('loading-overlay');
if (!overlay) return;

var NS = 'http://www.w3.org/2000/svg';
function el(name, attrs, parent){
  var n = document.createElementNS(NS, name);
  for (var k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
var $ = function(id){ return document.getElementById(id); };

function buildGraticule(){
  var g = $('ld-grat'), R = 520, i;
  for (i = -80; i <= 80; i += 20) {
    var y = -i * 5.2;
    var w = Math.sqrt(Math.max(0, R * R - y * y));
    var p = el('path', { d: 'M' + (-w) + ' ' + y + ' Q0 ' + (y + i * 0.9) + ' ' + w + ' ' + y }, g);
    if (i === 0) p.setAttribute('class', 'eq');
  }
  for (i = -180; i <= 180; i += 20) {
    var x = i * 2.8, bow = i * 0.55;
    var m = el('path', { d: 'M' + (x * 0.35) + ' -' + R + ' Q' + (x + bow) + ' 0 ' + (x * 0.35) + ' ' + R }, g);
    if (i === 0) m.setAttribute('class', 'mer0');
  }
}

function buildRings(){
  var letters = 'ابجدهوزحطيكلمنسعفصقرشتثخذضظغ'.split('');
  var outer = $('ld-ringOuter'), n = letters.length;
  letters.forEach(function(ch, i){
    var t = el('text', { x: 0, y: -275, transform: 'rotate(' + (i / n * 360) + ')' }, outer);
    t.textContent = ch;
  });
  var mid = $('ld-ringMid');
  for (var d = 0; d < 360; d += 5) {
    var big = d % 30 === 0;
    el('line', { x1: 0, y1: -226, x2: 0, y2: big ? -210 : -218, transform: 'rotate(' + d + ')',
      stroke: '#5b4125', 'stroke-width': big ? 1.6 : .8 }, mid);
  }
}

function buildRose(){
  var rose = $('ld-rose'), i;
  for (i = 0; i < 8; i++) {
    var long = i % 2 === 0, len = long ? 200 : 140, w = long ? 22 : 15;
    var cls = long ? (i % 4 === 0 ? 'pt a' : 'pt b') : 'pt';
    el('path', { class: cls, d: 'M0 ' + (-len) + ' L' + w + ' 0 L0 ' + (len * .22) + ' L' + (-w) + ' 0 Z',
      transform: 'rotate(' + (i * 45) + ')' }, rose);
  }
  el('rect', { x: -46, y: -46, width: 92, height: 92, fill: 'none', stroke: '#b8862b', 'stroke-width': 1.6 }, rose);
  el('rect', { x: -46, y: -46, width: 92, height: 92, fill: 'none', stroke: '#b8862b', 'stroke-width': 1.6, transform: 'rotate(45)' }, rose);
}

function buildPins(){
  var places = [
    ['مكة', -150, 40], ['القاهرة', -260, -110], ['بغداد', 110, -90],
    ['صنعاء', 70, 150], ['افريقية', -380, -20], ['سمرقند', 300, -170]
  ];
  var g = $('ld-pins');
  places.forEach(function(p, i){
    var pin = el('g', { class: 'ld-pin', transform: 'translate(' + p[1] + ' ' + p[2] + ')' }, g);
    var h = el('circle', { class: 'halo', r: 6 }, pin);
    h.style.animationDelay = (i * .55) + 's';
    el('circle', { r: 3.2 }, pin);
    var t = el('text', { y: -10 }, pin);
    t.textContent = p[0];
  });
}

function dmsLatin(v, pos, neg){
  var h = v >= 0 ? pos : neg; v = Math.abs(v);
  var d = Math.floor(v), m = Math.floor((v - d) * 60);
  return d + '°' + (m < 10 ? '0' : '') + m + '′' + h;
}
function setCorners(lat, lon){
  $('ld-cTL').innerHTML = '<span>LAT</span> ' + dmsLatin(lat, 'N', 'S');
  $('ld-cTR').innerHTML = '<span>LON</span> ' + dmsLatin(lon, 'E', 'W');
  $('ld-cBL').innerHTML = '<span>CLIMATE</span> ' + (1 + Math.floor(Math.abs(lat) / 12) % 7);
  $('ld-cBR').innerHTML = '<span>سنة</span> ١٤٤٨ هـ';
}

buildGraticule(); buildRings(); buildRose(); buildPins();

var lat = 21.4225, lon = 39.8262, tLat = lat, tLon = lon;
var retarget = setInterval(function(){
  tLat = Math.random() * 120 - 50;
  tLon = Math.random() * 360 - 180;
}, 1500);
(function tick(){
  if (overlay.classList.contains('hidden') || !$('ld-cTL')) { clearInterval(retarget); return; }
  lat += (tLat - lat) * .03;
  lon += (tLon - lon) * .03;
  setCorners(lat, lon);
  requestAnimationFrame(tick);
})();

})();
