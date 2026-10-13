/* ---- Data: read from 3MapsJson.json in the same folder ---- */
const JSON_URL='3MapsJson.json', IMG_DIR='oldmaps/';
const $=id=>document.getElementById(id);
const fmt=n=>n.toLocaleString('ar');
const norm=s=>(s||'').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const src=f=>IMG_DIR+encodeURI(f);
const drawer=matchMedia('(max-width:900px),(max-height:520px)');
let MAPS=[],NAMES=[],cur=null,act=-1;

function fromVia(o){return Object.values(o).map(e=>({f:e.filename,u:e.unit==='percent'?'percent':'pixel',r:(e.regions||[]).map(g=>{
 const a=g.shape_attributes,n=(g.region_attributes.name||'').trim();
 if(!n)return null;
 if(a.name==='rect')return{shape:'rect',x:a.x,y:a.y,w:a.width,h:a.height,n};
 if(a.name==='polygon'||a.name==='polyline'){
  const points=a.all_points_x.map((x,i)=>[x,a.all_points_y[i]]);
  if(points.length<(a.name==='polygon'?3:2)||points.length!==a.all_points_y.length)return null;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);
  return{shape:a.name,x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,points,n};
 }
 return null;
 }).filter(Boolean)}))}
function build(list){
 MAPS=list;
 const g=new Map();
 MAPS.forEach(m=>m.r.forEach(r=>{const k=norm(r.n);if(!g.has(k))g.set(k,{label:r.n,maps:new Set()});g.get(k).maps.add(m.f)}));
 NAMES=[...g].map(([k,v])=>({k,label:v.label,count:v.maps.size})).sort((a,b)=>a.label.localeCompare(b.label,'ar'));
 $('sideTitle').textContent='الأماكن ('+fmt(NAMES.length)+')';
 $('sideList').innerHTML=NAMES.map((n,i)=>`<li><button data-i="${i}"><span>${esc(n.label)}</span><span class="cnt">${fmt(n.count)}</span></button></li>`).join('');
 showEmpty();
}
async function init(){
 try{const r=await fetch(JSON_URL);if(!r.ok)throw 0;build(fromVia(await r.json()))}
 catch(e){loadFail()}
}
function loadFail(){
 $('results').innerHTML='<div class="empty"><p>تعذّر تحميل ملف <bdi dir="ltr">3MapsJson.json</bdi>. تأكد أنه في نفس مجلد الصفحة وافتح الصفحة عبر خادم محلي (مثل <bdi dir="ltr">python -m http.server</bdi>)، أو اختر الملف يدويًا.</p><p><button class="pill" id="pickJson" type="button">اختيار ملف JSON</button><input type="file" id="jsonFile" accept=".json,application/json" hidden></p></div>';
 $('pickJson').onclick=()=>$('jsonFile').click();
 $('jsonFile').onchange=async e=>{try{build(fromVia(JSON.parse(await e.target.files[0].text())))}catch(err){alert('الملف غير صالح')}};
}

/* ---- Sidebar ---- */
function setSide(open){$('side').classList.toggle('closed',!open);$('tog').setAttribute('aria-expanded',open);$('scrim').classList.toggle('off',!(open&&drawer.matches))}
$('tog').onclick=()=>setSide($('side').classList.contains('closed'));
$('scrim').onclick=()=>setSide(false);
$('sideList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const n=NAMES[b.dataset.i];$('q').value=n.label;runSearch(n.label,true);if(drawer.matches)setSide(false)};
drawer.onchange=()=>setSide(!drawer.matches);

/* ---- Search + dropdown ---- */
const q=$('q'),dd=$('dd');
function showSug(){
 const t=norm(q.value);const list=NAMES.filter(n=>n.k.includes(t));
 dd.innerHTML=list.length?list.map((n,i)=>`<li role="option" data-i="${NAMES.indexOf(n)}"><span>${esc(n.label)}</span><span class="cnt">${fmt(n.count)}</span></li>`).join(''):'<li class="none">لا توجد أسماء مطابقة</li>';
 dd.hidden=false;q.setAttribute('aria-expanded','true');act=-1;
}
function hideSug(){dd.hidden=true;q.setAttribute('aria-expanded','false')}
q.addEventListener('input',()=>{showSug();if(!q.value.trim())runSearch('',false)});
q.addEventListener('focus',showSug);
q.addEventListener('keydown',e=>{
 const items=[...dd.querySelectorAll('li[data-i]')];
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(dd.hidden)showSug();if(!items.length)return;act=(act+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items.forEach((li,i)=>li.classList.toggle('act',i===act));items[act].scrollIntoView({block:'nearest'})}
 else if(e.key==='Enter'){e.preventDefault();if(act>=0&&items[act]){pick(items[act].dataset.i)}else if(q.value.trim()){runSearch(q.value,false);hideSug();q.blur()}}
 else if(e.key==='Escape')hideSug();
});
dd.addEventListener('mousedown',e=>{const li=e.target.closest('li[data-i]');if(li){e.preventDefault();pick(li.dataset.i)}});
function pick(i){const n=NAMES[i];q.value=n.label;hideSug();q.blur();runSearch(n.label,true)}
document.addEventListener('click',e=>{if(!e.target.closest('.sb'))hideSug()});

function showEmpty(){runSearch('',false)}
function runSearch(label,exact){
 const t=norm(label);const test=n=>exact?norm(n)===t:norm(n).includes(t);
 cur={label,exact};
 const res=MAPS.map(m=>({m,hits:t?m.r.filter(r=>test(r.n)):[]})).filter(o=>!t||o.hits.length);
 document.querySelectorAll('#sideList button').forEach(b=>b.classList.toggle('on',exact&&NAMES[b.dataset.i].k===t));
 const box=$('results');
 if(!res.length){box.innerHTML='<p class="empty">لا توجد خرائط بهذا الاسم. جرّب جزءًا آخر من الاسم أو اختر من القائمة الجانبية.</p>';return}
 const heading=t?`«${esc(label.trim())}» في ${fmt(res.length)} ${res.length===1?'خريطة':'خرائط'}`:`كل الخرائط (${fmt(res.length)})`;
 box.innerHTML=`<h2 class="rh">${heading}</h2><div class="grid"></div>`;
 const grid=box.querySelector('.grid');
 res.forEach(({m,hits})=>{
  const c=document.createElement('button');c.className='card';c.type='button';
    const chip=hits.length?`<span class="chip">${fmt(hits.length)} ${hits.length===1?'موضع':'مواضع'}</span>`:'';
    c.innerHTML=`<div class="pic"><div class="zoom"></div></div><div class="cap"><span class="fn">${esc(m.f)}</span>${chip}</div>`;
  const z=c.querySelector('.zoom'),im=new Image();
  im.alt=m.f;im.loading='lazy';im.decoding='async';
  im.onload=()=>{
   const baseW=m.u==='percent'?100:im.naturalWidth,baseH=m.u==='percent'?100:im.naturalHeight;
   const vectors=hits.filter(r=>r.shape==='polygon'||r.shape==='polyline');
   hits.filter(r=>r.shape==='rect').forEach(r=>{const d=document.createElement('div');d.className='hl';d.style.cssText=`left:${r.x/baseW*100}%;top:${r.y/baseH*100}%;width:${r.w/baseW*100}%;height:${r.h/baseH*100}%`;z.appendChild(d)});
   if(vectors.length){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('hl-svg');vectors.forEach(r=>{const p=document.createElementNS(svg.namespaceURI,r.shape);p.classList.add(r.shape==='polygon'?'hl-poly':'hl-line');p.setAttribute('points',r.points.map(([x,y])=>`${x/baseW*100},${y/baseH*100}`).join(' '));svg.appendChild(p)});z.appendChild(svg)}
   c.querySelector('.pic').style.minHeight='0';
  };
  im.src=src(m.f);z.appendChild(im);
  c.onclick=()=>openViewer(m,hits);
  grid.appendChild(c);
 });
 box.scrollIntoView();$('main').scrollTop=0;
}

/* ---- Viewer: zoom to region + highlight + per-map sidebar + all-places overlay ---- */
const vp=$('vp'),stage=$('stage'),labels=$('labels'),vside=$('vside'),vq=$('vq'),NS='http://www.w3.org/2000/svg';
let V={s:1,tx:0,ty:0,fit:1,nw:0,nh:0,hits:[],all:[],shapes:[],names:[],i:0,showAll:false,mode:0};
function center(r){
 if(r.shape==='polyline'){const p=r.points,seg=[];let L=0;for(let i=1;i<p.length;i++){const d=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);seg.push(d);L+=d}
  let t=L/2;for(let i=1;i<p.length;i++){if(t<=seg[i-1]){const k=seg[i-1]?t/seg[i-1]:0;return[p[i-1][0]+(p[i][0]-p[i-1][0])*k,p[i-1][1]+(p[i][1]-p[i-1][1])*k]}t-=seg[i-1]}}
 return[r.x+r.w/2,r.y+r.h/2];
}
const isVec=r=>r.shape==='polygon'||r.shape==='polyline';
const toPx=(r,u,w,h)=>u==='percent'?{...r,x:r.x*w/100,y:r.y*h/100,w:r.w*w/100,h:r.h*h/100,points:r.points&&r.points.map(([x,y])=>[x*w/100,y*h/100])}:r;

function apply(anim){stage.style.transition=anim?'transform .95s cubic-bezier(.2,.7,.2,1)':'none';stage.style.transform=`translate(${V.tx}px,${V.ty}px) scale(${V.s})`;stage.style.setProperty('--inv',1/V.s);labels.classList.toggle('anim',!!anim);placeLabels()}
function placeLabels(){
 if(!V.showAll)return;
 const els=labels.children,w=vp.clientWidth,h=vp.clientHeight;
 for(let i=0;i<els.length;i++){const r=V.all[i],x=V.tx+r.cx*V.s,y=V.ty+r.cy*V.s,el=els[i];
  el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
  el.style.visibility=(x<-160||x>w+160||y<-60||y>h+60)?'hidden':'visible'}
}
function fit(anim){const w=vp.clientWidth,h=vp.clientHeight;V.fit=V.s=Math.min(w/V.nw,h/V.nh);V.tx=(w-V.nw*V.s)/2;V.ty=(h-V.nh*V.s)/2;apply(anim)}
function focusOn(r,anim){const w=vp.clientWidth,h=vp.clientHeight;let s=Math.min(w/(r.w*3.5),h/(r.h*3.5));s=Math.min(Math.max(s,V.fit),8);V.s=s;V.tx=w/2-(r.x+r.w/2)*s;V.ty=h/2-(r.y+r.h/2)*s;apply(anim)}
function zoomAt(cx,cy,f){const ns=Math.min(Math.max(V.s*f,V.fit*.7),16);V.tx=cx-(cx-V.tx)*ns/V.s;V.ty=cy-(cy-V.ty)*ns/V.s;V.s=ns;apply(false)}
function mark(){[...stage.querySelectorAll('.hl,.hl-poly,.hl-line')].forEach(d=>d.classList.toggle('cur',Number(d.dataset.hitIndex)===V.i));$('ct').textContent=fmt(V.i+1)+' / '+fmt(V.hits.length)}

/* search-result highlights (the current hits) */
function renderHits(){
 stage.querySelectorAll('.hl,.hit-svg').forEach(e=>e.remove());
 V.hits.forEach((r,i)=>{if(isVec(r))return;const d=document.createElement('div');d.className='hl';d.dataset.hitIndex=i;d.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;stage.appendChild(d)});
 if(V.hits.some(isVec)){
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${V.nw} ${V.nh}`);svg.classList.add('hl-svg','hit-svg');
  V.hits.forEach((r,i)=>{if(!isVec(r))return;const p=document.createElementNS(NS,r.shape);p.classList.add(r.shape==='polygon'?'hl-poly':'hl-line');p.dataset.hitIndex=i;p.setAttribute('points',r.points.map(([x,y])=>`${x},${y}`).join(' '));svg.appendChild(p)});
  stage.appendChild(svg);
 }
}

/* all places of the map: outlines + name boxes (hidden until the button is pressed) */
function buildAll(){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${V.nw} ${V.nh}`);svg.classList.add('all-svg');
 const mk=(r,i,cls)=>{
  const p=document.createElementNS(NS,r.shape);p.classList.add(...cls);p.dataset.i=i;
  if(r.shape==='rect'){p.setAttribute('x',r.x);p.setAttribute('y',r.y);p.setAttribute('width',r.w);p.setAttribute('height',r.h)}
  else p.setAttribute('points',r.points.map(([x,y])=>`${x},${y}`).join(' '));
  return p};
 V.shapes=[];
 /* bigger areas first, so smaller places stay on top and can be hovered */
 V.all.map((r,i)=>i).sort((a,b)=>V.all[b].w*V.all[b].h-V.all[a].w*V.all[a].h).forEach(i=>{const r=V.all[i];V.shapes[i]=mk(r,i,['sh',r.shape]);svg.appendChild(V.shapes[i])});
 /* wide invisible stroke so polylines are easy to hover */
 V.all.forEach((r,i)=>{if(r.shape==='polyline')svg.appendChild(mk(r,i,['hit']))});
 const idx=e=>{const t=e.target.closest&&e.target.closest('[data-i]');return t?+t.dataset.i:-1};
 svg.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const i=idx(e);if(i>=0)setHov(i,true)});
 svg.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const i=idx(e);if(i>=0)setHov(i,false)});
 stage.appendChild(svg);
 labels.innerHTML=V.all.map(r=>`<div class="lbl">${esc(r.n)}</div>`).join('');
}
function setHov(i,on){const el=labels.children[i],sh=V.shapes[i];if(el)el.classList.toggle('hov',on);if(sh)sh.classList.toggle('hov',on)}
function clearHov(){labels.querySelectorAll('.hov').forEach(e=>e.classList.remove('hov'));V.shapes.forEach(s=>s.classList.remove('hov'))}
function pin(i){const was=i>=0&&labels.children[i].classList.contains('hov');clearHov();if(i>=0&&!was)setHov(i,true)}
/* one button, 3 states: 0 = hidden, 1 = outlines (name on hover), 2 = outlines + all names */
const MODE_TXT=['اظهر كل المواضع','اظهر كل الاسماء','اخفِ كل المواضع'];
function setMode(m){
 V.mode=m;clearHov();
 $('viewer').classList.toggle('show-all',m>0);$('viewer').classList.toggle('show-names',m===2);
 V.showAll=m>0;
 [...labels.children].forEach(el=>{el.style.opacity=m===2?'1':''});
 const b=$('showAll');b.classList.toggle('on',m>0);b.setAttribute('aria-pressed',m>0);b.textContent=MODE_TXT[m];b.dataset.mode=m;
 if(m>0){labels.classList.remove('anim');placeLabels()}
}
$('showAll').onclick=()=>setMode((V.mode+1)%3);

/* per-map sidebar */
function setVS(open){
 vside.classList.toggle('closed',!open);$('viewer').classList.toggle('vs-open',open);$('vtog').setAttribute('aria-expanded',open);
 if(open&&!drawer.matches)vq.focus({preventScroll:true});
}
$('vtog').onclick=()=>setVS(vside.classList.contains('closed'));
$('vclose').onclick=()=>setVS(false);
function buildSide(){
 const g=new Map();V.all.forEach(r=>{const k=norm(r.n);if(!g.has(k))g.set(k,{k,label:r.n,count:0});g.get(k).count++});
 V.names=[...g.values()].sort((a,b)=>a.label.localeCompare(b.label,'ar'));
 $('vsTitle').textContent='أماكن الخريطة ('+fmt(V.names.length)+')';
 filterSide();
}
function filterSide(){
 const t=norm(vq.value),list=V.names.filter(n=>n.k.includes(t));
 $('vsList').innerHTML=list.length?list.map(n=>`<li><button data-i="${V.names.indexOf(n)}"><span>${esc(n.label)}</span><span class="cnt">${fmt(n.count)}</span></button></li>`).join(''):'<li class="none">لا توجد أسماء مطابقة</li>';
}
function goTo(t,exact){
 const hits=V.all.filter(r=>{const n=norm(r.n);return exact?n===t:n.includes(t)});
 if(!hits.length)return false;
 V.hits=hits;V.i=0;$('nav').hidden=hits.length<2;renderHits();mark();focusOn(hits[0],true);
 $('vsList').querySelectorAll('button').forEach(b=>b.classList.toggle('on',exact&&V.names[b.dataset.i].k===t));
 return true;
}
$('vsList').onclick=e=>{const b=e.target.closest('button');if(!b)return;goTo(V.names[b.dataset.i].k,true);if(drawer.matches)setVS(false)};
vq.addEventListener('input',filterSide);
vq.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const t=norm(vq.value);if(t&&goTo(t,false)){vq.blur();if(drawer.matches)setVS(false)}});

function resetUI(){
 setMode(0);setVS(false);labels.innerHTML='';vq.value='';
 V.all=[];V.shapes=[];V.names=[];V.hits=[];
}
function openViewer(m,hits){
 resetUI();
 $('viewer').hidden=false;document.body.classList.add('lock');
 history.pushState({v:1},'');
 $('vname').textContent=m.f;$('load').hidden=false;$('load').textContent='جارٍ تحميل الخريطة…';stage.innerHTML='';
 V.i=0;$('nav').hidden=hits.length<2;
 const im=new Image();
 im.onload=()=>{
  V.nw=im.naturalWidth;V.nh=im.naturalHeight;
  V.all=m.r.map(r=>{const p=toPx(r,m.u,V.nw,V.nh),[cx,cy]=center(p);return{...p,cx,cy}});
  V.hits=hits.map(h=>V.all[m.r.indexOf(h)]);
  stage.style.width=V.nw+'px';stage.style.height=V.nh+'px';
  stage.appendChild(im);
  buildAll();buildSide();renderHits();
  $('load').hidden=true;fit(false);
  if(V.hits.length){
   mark();
   setTimeout(()=>{if(!$('viewer').hidden)focusOn(V.hits[0],true)},450);
  }
 };
 im.onerror=()=>{$('load').textContent='تعذّر تحميل الصورة. تأكد أن الملف موجود داخل المجلد oldmaps.'};
 im.src=src(m.f);
}
function closeViewer(){$('viewer').hidden=true;document.body.classList.remove('lock');stage.innerHTML='';resetUI()}
const goBack=()=>{history.state&&history.state.v?history.back():closeViewer()};
addEventListener('popstate',closeViewer);
addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('viewer').hidden){if(!vside.classList.contains('closed'))setVS(false);else goBack()}
});
addEventListener('resize',()=>{if(!$('viewer').hidden&&V.nw)fit(false)});
const c=()=>[vp.clientWidth/2,vp.clientHeight/2];
$('zi').onclick=()=>zoomAt(...c(),1.5);$('zo').onclick=()=>zoomAt(...c(),1/1.5);$('zf').onclick=()=>fit(true);
const step=d=>{V.i=(V.i+d+V.hits.length)%V.hits.length;mark();focusOn(V.hits[V.i],true)};
$('nx').onclick=()=>step(1);$('pv').onclick=()=>step(-1);

/* pan, wheel, pinch (+ tap on a label pins its hover state on touch screens) */
const P=new Map();let last=0,down=null;
vp.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015))},{passive:false});
vp.addEventListener('pointerdown',e=>{vp.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);last=0;down=P.size===1?{t:e.target,x:e.clientX,y:e.clientY}:null});
vp.addEventListener('pointermove',e=>{
 if(!P.has(e.pointerId))return;const o=P.get(e.pointerId);
 if(P.size===1){V.tx+=e.clientX-o[0];V.ty+=e.clientY-o[1];P.set(e.pointerId,[e.clientX,e.clientY]);apply(false)}
 else{P.set(e.pointerId,[e.clientX,e.clientY]);const [a,b]=[...P.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(last)zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,d/last);last=d}
});
vp.addEventListener('pointerup',e=>{
 if(down&&e.pointerType!=='mouse'&&P.size===1&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<8&&V.showAll){const l=down.t.closest&&down.t.closest('[data-i]');pin(l?+l.dataset.i:-1)}
 down=null;
});
['pointerup','pointercancel'].forEach(t=>vp.addEventListener(t,e=>{P.delete(e.pointerId);last=0}));

setSide(!drawer.matches);
init();