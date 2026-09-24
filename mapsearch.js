/* ---- Data: read from 3MapsJson.json in the same folder ---- */
const JSON_URL='3MapsJson.json', IMG_DIR='oldmaps/';
const $=id=>document.getElementById(id);
const fmt=n=>n.toLocaleString('ar');
const norm=s=>(s||'').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const src=f=>IMG_DIR+encodeURI(f);
const drawer=matchMedia('(max-width:900px),(max-height:520px)');
let MAPS=[],NAMES=[],cur=null,act=-1;

function fromVia(o){return Object.values(o).map(e=>({f:e.filename,r:(e.regions||[]).map(g=>{const a=g.shape_attributes;return [a.x,a.y,a.width,a.height,(g.region_attributes.name||'')]}).filter(r=>norm(r[4]))}))}
function build(list){
 MAPS=list.map(m=>({f:m.f,r:m.r.map(a=>({x:a[0],y:a[1],w:a[2],h:a[3],n:a[4].trim()}))}));
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
  im.onload=()=>{hits.forEach(r=>{const d=document.createElement('div');d.className='hl';d.style.cssText=`left:${r.x/im.naturalWidth*100}%;top:${r.y/im.naturalHeight*100}%;width:${r.w/im.naturalWidth*100}%;height:${r.h/im.naturalHeight*100}%`;z.appendChild(d)});c.querySelector('.pic').style.minHeight='0'};
  im.src=src(m.f);z.appendChild(im);
  c.onclick=()=>openViewer(m,hits);
  grid.appendChild(c);
 });
 box.scrollIntoView();$('main').scrollTop=0;
}

/* ---- Viewer: zoom to region + highlight ---- */
const vp=$('vp'),stage=$('stage');
let V={s:1,tx:0,ty:0,fit:1,nw:0,nh:0,hits:[],i:0};
function apply(anim){stage.style.transition=anim?'transform .95s cubic-bezier(.2,.7,.2,1)':'none';stage.style.transform=`translate(${V.tx}px,${V.ty}px) scale(${V.s})`;stage.style.setProperty('--inv',1/V.s)}
function fit(anim){const w=vp.clientWidth,h=vp.clientHeight;V.fit=V.s=Math.min(w/V.nw,h/V.nh);V.tx=(w-V.nw*V.s)/2;V.ty=(h-V.nh*V.s)/2;apply(anim)}
function focusOn(r,anim){const w=vp.clientWidth,h=vp.clientHeight;let s=Math.min(w/(r.w*3.5),h/(r.h*3.5));s=Math.min(Math.max(s,V.fit),8);V.s=s;V.tx=w/2-(r.x+r.w/2)*s;V.ty=h/2-(r.y+r.h/2)*s;apply(anim)}
function zoomAt(cx,cy,f){const ns=Math.min(Math.max(V.s*f,V.fit*.7),16);V.tx=cx-(cx-V.tx)*ns/V.s;V.ty=cy-(cy-V.ty)*ns/V.s;V.s=ns;apply(false)}
function mark(){[...stage.querySelectorAll('.hl')].forEach((d,i)=>d.classList.toggle('cur',i===V.i));$('ct').textContent=fmt(V.i+1)+' / '+fmt(V.hits.length)}

function openViewer(m,hits){
 $('viewer').hidden=false;document.body.classList.add('lock');
 history.pushState({v:1},'');
 $('vname').textContent=m.f;$('load').hidden=false;$('load').textContent='جارٍ تحميل الخريطة…';stage.innerHTML='';
 V.hits=hits;V.i=0;$('nav').hidden=hits.length<2;
 const im=new Image();
 im.onload=()=>{
  V.nw=im.naturalWidth;V.nh=im.naturalHeight;
  stage.style.width=V.nw+'px';stage.style.height=V.nh+'px';
  stage.appendChild(im);
  hits.forEach(r=>{const d=document.createElement('div');d.className='hl';d.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;stage.appendChild(d)});
    $('load').hidden=true;fit(false);
    if(hits.length){
     mark();
     setTimeout(()=>{if(!$('viewer').hidden)focusOn(hits[0],true)},450);
    }
 };
 im.onerror=()=>{$('load').textContent='تعذّر تحميل الصورة. تأكد أن الملف موجود داخل المجلد oldmaps.'};
 im.src=src(m.f);
}
function closeViewer(){$('viewer').hidden=true;document.body.classList.remove('lock');stage.innerHTML=''}
$('back').onclick=()=>{history.state&&history.state.v?history.back():closeViewer()};
addEventListener('popstate',closeViewer);
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('viewer').hidden)$('back').click()});
addEventListener('resize',()=>{if(!$('viewer').hidden&&V.nw)fit(false)});
const c=()=>[vp.clientWidth/2,vp.clientHeight/2];
$('zi').onclick=()=>zoomAt(...c(),1.5);$('zo').onclick=()=>zoomAt(...c(),1/1.5);$('zf').onclick=()=>fit(true);
const step=d=>{V.i=(V.i+d+V.hits.length)%V.hits.length;mark();focusOn(V.hits[V.i],true)};
$('nx').onclick=()=>step(1);$('pv').onclick=()=>step(-1);

/* pan, wheel, pinch */
const P=new Map();let last=0;
vp.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015))},{passive:false});
vp.addEventListener('pointerdown',e=>{vp.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);last=0});
vp.addEventListener('pointermove',e=>{
 if(!P.has(e.pointerId))return;const o=P.get(e.pointerId);
 if(P.size===1){V.tx+=e.clientX-o[0];V.ty+=e.clientY-o[1];P.set(e.pointerId,[e.clientX,e.clientY]);apply(false)}
 else{P.set(e.pointerId,[e.clientX,e.clientY]);const [a,b]=[...P.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(last)zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,d/last);last=d}
});
['pointerup','pointercancel'].forEach(t=>vp.addEventListener(t,e=>{P.delete(e.pointerId);last=0}));

setSide(!drawer.matches);
init();
