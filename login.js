(function(){
'use strict';

/* ===== Configuration ===== */
// Paste your OAuth 2.0 Web Client ID (Google Cloud Console > APIs & Services > Credentials).
var GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
var ALLOWED_DOMAIN = 'jameasaifiyah.edu';
var REDIRECT_TO = 'index.html';
var SESSION_KEY = 'geo.auth';

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

/* ===== Already signed in? ===== */
(function(){
 try {
  var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  if (s && s.exp * 1000 > Date.now() && isAllowed(s)) location.replace(REDIRECT_TO);
 } catch (e) {}
})();

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
 $('lat').textContent = dms(lat, 'ش', 'ج');
 $('lon').textContent = dms(lon, 'ق', 'غ');
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

/* ===== Auth ===== */
function parseJwt(token){
 var b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
 var json = decodeURIComponent(atob(b).split('').map(function(c){
  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
 }).join(''));
 return JSON.parse(json);
}
function isAllowed(p){
 var email = String(p.email || '').toLowerCase();
 return email.endsWith('@' + ALLOWED_DOMAIN) && p.email_verified !== false &&
  (p.hd === undefined || String(p.hd).toLowerCase() === ALLOWED_DOMAIN);
}
function showMsg(text, ok){
 var m = $('msg');
 m.hidden = false; m.textContent = text;
 m.className = 'msg' + (ok ? ' ok' : '');
 // restart the shake animation
 m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
}

function onCredential(resp){
 var p;
 try { p = parseJwt(resp.credential); } catch (e) { return showMsg('تعذّر قراءة بيانات الدخول، حاول مرة أخرى.'); }
 if (!isAllowed(p)) {
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  return showMsg('عذرًا، الدخول مقصور على حسابات @' + ALLOWED_DOMAIN + ' فقط.');
 }
 sessionStorage.setItem(SESSION_KEY, JSON.stringify({
  email: p.email, name: p.name, picture: p.picture, exp: p.exp, credential: resp.credential
 }));
 showMsg('أهلًا بك يا ' + (p.given_name || p.name || '') + ' — جارٍ فتح الخزانة…', true);
 document.body.classList.add('leaving');
 setTimeout(function(){ location.href = REDIRECT_TO; }, 900);
}

function initGoogle(){
 if (!window.google || !google.accounts || !google.accounts.id) return false;
 if (/^YOUR_CLIENT_ID/.test(GOOGLE_CLIENT_ID)) {
  $('gwait').textContent = 'لم يُضبط معرّف عميل جوجل بعد (GOOGLE_CLIENT_ID في login.js).';
  return true;
 }
 google.accounts.id.initialize({
  client_id: GOOGLE_CLIENT_ID,
  callback: onCredential,
  hd: ALLOWED_DOMAIN,
  auto_select: false,
  ux_mode: 'popup'
 });
 google.accounts.id.renderButton($('gbtn'), {
  theme: 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', logo_alignment: 'left',
  width: 280, locale: 'ar'
 });
 document.querySelector('.gwrap').classList.add('ready');
 return true;
}

buildGraticule(); buildRings(); buildRose(); buildPins();

var tries = 0;
(function wait(){
 if (initGoogle()) return;
 if (++tries > 100) { $('gwait').textContent = 'تعذّر تحميل خدمة جوجل. تحقّق من الاتصال بالإنترنت.'; return; }
 setTimeout(wait, 100);
})();

})();
