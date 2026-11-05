(function(){
'use strict';

/* ===== Config ===== */
var REDIRECT_TO = 'index.html';
var MIN_MS = 1200;

var NS = 'http://www.w3.org/2000/svg';
function el(name, attrs, parent){
 var n = document.createElementNS(NS, name);
 for (var k in attrs) n.setAttribute(k, attrs[k]);
 if (parent) parent.appendChild(n);
 return n;
}
var $ = function(id){ return document.getElementById(id); };
var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function arNum(n){ return String(n).replace(/\d/g, function(d){ return AR_DIGITS[d]; }); }

/* ===== Decorative scene ===== */
function buildGraticule(){
 var g = $('graticule'), R = 520, i;
 // parallels
 for (i = -80; i <= 80; i += 20) {
  var y = -i * 5.2;
  var w = Math.sqrt(Math.max(0, R * R - y * y));
  var p = el('path', { d: 'M' + (-w) + ' ' + y + ' Q0 ' + (y + i * 0.9) + ' ' + w + ' ' + y }, g);
  if (i === 0) p.setAttribute('class', 'eq');
 }
 // meridians
 for (i = -180; i <= 180; i += 20) {
  var x = i * 2.8, bow = i * 0.55;
  var m = el('path', { d: 'M' + (x * 0.35) + ' -' + R + ' Q' + (x + bow) + ' 0 ' + (x * 0.35) + ' ' + R }, g);
  if (i === 0) m.setAttribute('class', 'mer0');
 }
}

function buildRings(){
 var letters = 'ابجدهوزحطيكلمنسعفصقرشتثخذضظغ'.split('');
 var outer = $('ringOuter'), n = letters.length;
 letters.forEach(function(ch, i){
  var a = i / n * 360;
  var t = el('text', { x: 0, y: -275, transform: 'rotate(' + a + ')' }, outer);
  t.textContent = ch;
 });
 var mid = $('ringMid');
 for (var d = 0; d < 360; d += 5) {
  var big = d % 30 === 0;
  el('line', { class: 'tick', x1: 0, y1: -226, x2: 0, y2: big ? -210 : -218, transform: 'rotate(' + d + ')',
   stroke: '#5b4125', 'stroke-width': big ? 1.6 : .8 }, mid);
 }
}

function buildRose(){
 var rose = $('rose'), i, pts;
 el('circle', { r: 200, fill: 'none', stroke: 'none' }, rose);
 for (i = 0; i < 8; i++) {
  var long = i % 2 === 0, len = long ? 200 : 140, w = long ? 22 : 15;
  var cls = long ? (i % 4 === 0 ? 'pt a' : 'pt b') : 'pt';
  el('path', { class: cls, d: 'M0 ' + (-len) + ' L' + w + ' 0 L0 ' + (len * .22) + ' L' + (-w) + ' 0 Z',
   transform: 'rotate(' + (i * 45) + ')' }, rose);
 }
 // khatam (eight-pointed star) at the heart
 el('rect', { x: -46, y: -46, width: 92, height: 92, fill: 'none', stroke: '#b8862b', 'stroke-width': 1.6 }, rose);
 el('rect', { x: -46, y: -46, width: 92, height: 92, fill: 'none', stroke: '#b8862b', 'stroke-width': 1.6, transform: 'rotate(45)' }, rose);
}

function buildPins(){
 var places = [
  ['مكة', -150, 40], ['القاهرة', -260, -110], ['بغداد', 110, -90],
  ['صنعاء', 70, 150], ['افريقية', -380, -20], ['سمرقند', 300, -170]
 ];
 var g = $('pins');
 places.forEach(function(p, i){
  var pin = el('g', { class: 'pin', transform: 'translate(' + p[1] + ' ' + p[2] + ')' }, g);
  var h = el('circle', { class: 'halo', r: 6 }, pin);
  h.style.animationDelay = (i * .55) + 's';
  el('circle', { r: 3.2 }, pin);
  var t = el('text', { y: -10 }, pin);
  t.textContent = p[0];
 });
}

/* ===== Coordinates ===== */
function dms(v, pos, neg){
 var h = v >= 0 ? pos : neg;
 v = Math.abs(v);
 var d = Math.floor(v), m = Math.floor((v - d) * 60);
 return arNum(d) + '°' + arNum(m) + '′ ' + h;
}
function dmsLatin(v, pos, neg){
 var h = v >= 0 ? pos : neg; v = Math.abs(v);
 var d = Math.floor(v), m = Math.floor((v - d) * 60);
 return d + '°' + (m < 10 ? '0' : '') + m + '′' + h;
}
function setCorners(lat, lon){
 $('cTL').innerHTML = '<span>LAT</span> ' + dmsLatin(lat, 'N', 'S');
 $('cTR').innerHTML = '<span>LON</span> ' + dmsLatin(lon, 'E', 'W');
 $('cBL').innerHTML = '<span>CLIMATE</span> ' + (1 + Math.floor(Math.abs(lat) / 12) % 7);
 $('cBR').innerHTML = '<span>سنة</span> ١٤٤٨ هـ';
}
var lat = 21.4225, lon = 39.8262, tLat = lat, tLon = lon;
setInterval(function(){
 tLat = (Math.random() * 120 - 50);
 tLon = (Math.random() * 360 - 180);
}, 4500);
(function tick(){
 lat += (tLat - lat) * .02;
 lon += (tLon - lon) * .02;
 setCorners(lat, lon);
 requestAnimationFrame(tick);
})();

// crosshair following the pointer
var cross = $('cross');
if (window.matchMedia('(pointer:fine)').matches) {
 window.addEventListener('pointermove', function(e){
  cross.hidden = false;
  cross.style.setProperty('--x', e.clientX + 'px');
  cross.style.setProperty('--y', e.clientY + 'px');
  var la = 90 - e.clientY / innerHeight * 180;
  var lo = e.clientX / innerWidth * 360 - 180;
  $('crossTxt').textContent = dmsLatin(la, 'N', 'S') + '  ' + dmsLatin(lo, 'E', 'W');
 });
 document.addEventListener('pointerleave', function(){ cross.hidden = true; });
}

/* ===== Loading bar ===== */
var barFill = $('barFill'), bar = $('bar'), pct = $('pct');
function setProgress(v){
 v = Math.min(100, Math.max(0, Math.round(v)));
 barFill.style.width = v + '%';
 bar.setAttribute('aria-valuenow', v);
 pct.textContent = arNum(v) + '٪';
}

buildGraticule(); buildRings(); buildRose(); buildPins();

var start = Date.now(), pageReady = document.readyState === 'complete', done = false, shown = 0;
window.addEventListener('load', function(){ pageReady = true; });

(function step(){
 if (done) return;
 var elapsed = Date.now() - start;
 // ease toward 90% over MIN_MS; the last 10% waits for the page to finish loading
 var target = Math.min(90, elapsed / MIN_MS * 90);
 if (pageReady && elapsed >= MIN_MS) target = 100;
 shown += (target - shown) * .12;
 if (target === 100 && shown > 99.5) shown = 100;
 setProgress(shown);
 if (shown >= 100) {
  done = true;
  document.body.classList.add('leaving');
  setTimeout(function(){ location.href = REDIRECT_TO; }, 900);
  return;
 }
 requestAnimationFrame(step);
})();

})();
