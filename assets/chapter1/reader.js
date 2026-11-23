'use strict';

const el = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const voices = { narrator: 'راوی', man: 'مرد کلبه', 'fire-lady': 'بانوی آتش' };
const imageSizes = new Map(chapters.map(c => [c.photo, [c.photoWidth, c.photoHeight]]));
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* restricted storage */ } },
};
const legacy = [{type:'cover'}, {type:'toc'}];
chapters.forEach((c,i) => {
  legacy.push({type:'chapter',i});
  c.p.forEach((_,j) => legacy.push({type:'text',i,j}));
});
let pages = legacy, index = 0, busy = false, master = null;
const make = (tag, value, className) => {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
};
const control = (label, onClick) => {
  const button = make('button',label);
  button.type = 'button'; button.addEventListener('click',onClick);
  return button;
};
function pageKey(p) {
  if (p.type === 'passage') return 'passage:' + p.passage.id;
  if (p.type === 'scene') return 'scene:' + p.scene.id;
  return [p.type,p.i,p.j].filter(x => x !== undefined).join(':');
}
function imageFigure(src, alt, fallback, caption, sizes) {
  const fig = make('figure',undefined,'story-illustration');
  const image = make('img'); image.alt = alt;
  if (sizes) [image.width,image.height] = sizes;
  image.decoding = 'async';
  if (fallback && fallback !== src)
    image.addEventListener('error',() => { image.src = fallback; },{once:true});
  image.src = src; fig.append(image);
  if (caption) fig.append(make('figcaption',caption));
  return fig;
}
function render(focus = false) {
  const sheet = el('sheet'), p = pages[index], c = chapters[p.i];
  sheet.className = 'sheet' + (p.type === 'cover' ? ' cover' : '');
  sheet.replaceChildren();
  const heading = (text, target=sheet) => {
    const h = make('h2',text); h.tabIndex = -1; target.append(h); return h;
  };
  let h;
  if (p.type === 'cover') {
    const frame = make('div');
    h = heading('دیوان دیوانه‌وار',frame);
    frame.append(make('h3','دریا شو، رود خودش می‌آید'),make('p','در زمستانی، بهارم آرزوست'),control('گشودن کتاب',() => go(1)));
    frame.querySelector('p').style.textAlign = 'center'; sheet.append(frame);
  } else if (p.type === 'toc') {
    h = heading('فهرست داستان');
    const list = make('div',undefined,'toc');
    chapters.forEach((c,i) => list.append(control((i+1)+'. '+(i===0 && master ? master.title : c.t),
      () => go(pages.findIndex(p => p.type==='chapter' && p.i===i)))));
    sheet.append(list,make('p','برای خواندن هر بخش روی نام آن بزنید.','note'));
  } else if (p.type === 'chapter') {
    h = heading(p.i===0 && master ? master.title : c.t);
    const opening = p.i===0 ? master?.scenes[0] : null;
    if (opening) sheet.append(make('h3',opening.title,'chapter-kicker'));
    const src = opening?.image || c.photo;
    sheet.append(imageFigure(src,opening?.imageAlt || c.cinematicCaption,c.img,
      opening?.title || 'تصویر فصل '+(p.i+1)+' · '+c.t,imageSizes.get(src)),
      make('p','بخش '+(p.i+1)+' از '+chapters.length+' · برای ادامه ورق بزنید.','note'));
  } else if (p.type === 'scene') {
    const scene = make('section',undefined,'chapter-scene');
    scene.append(make('div',master.title,'chapter-kicker')); h=heading(p.scene.title,scene);
    if (p.scene.image) scene.append(imageFigure(p.scene.image,p.scene.imageAlt || p.scene.title,chapters[0].img,undefined,imageSizes.get(p.scene.image)));
    sheet.append(scene);
  } else if (p.type === 'passage') {
    const page = make('section',undefined,'chapter-passage');
    h = heading(p.scene.title,page);
    const para = make('p'); para.id=p.passage.id;
    p.passage.segments.forEach((segment,i) => {
      if (i) para.append(document.createTextNode(' '));
      const span = make('span',segment.text); span.dataset.voice = segment.voice;
      span.dataset.segmentId = segment.id || p.passage.id+'-s'+(i+1);
      para.append(span);
    });
    page.append(para,make('p',String(p.scene.passages.indexOf(p.passage)+1)+' / '+p.scene.passages.length,'note'));
    sheet.append(page);
  } else {
    h = heading(c.t);
    sheet.append(make('p',c.p[p.j]),make('p',(p.j+1)+' / '+c.p.length,'note'));
  }
  el('status').textContent = 'صفحه '+(index+1)+' از '+pages.length;
  // Old versions retain a usable position; revisions use stable logical keys.
  const old = legacy.findIndex(x => pageKey(x) === pageKey(p));
  storage.set('divan_page', old >= 0 ? old : legacy.findIndex(x => x.type === 'chapter' && x.i === 0));
  storage.set('divan_page_key_v3',pageKey(p));
  audioView();
  if (focus && h) { h.focus({preventScroll:true}); h.scrollIntoView({block:'nearest',behavior:'instant'}); }
}
function go(n, { animate=true, focus=true, fromAudio=false } = {}) {
  if (busy || n < 0 || n >= pages.length || n === index) return;
  // A manual page turn takes precedence over pending clip auto-advance.
  // The audio controls themselves can still follow the spoken passage.
  if (playing && !fromAudio) pauseAudio();
  const swap = () => { index=n; busy=false; render(focus); };
  if (!animate || reduced.matches) { swap(); return; }
  busy=true; el('sheet').classList.add('turn'); setTimeout(swap,240);
}
function move(n){go(index+n);}
function font(n){
  const d=document.documentElement;
  d.style.setProperty('--sz',Math.max(15,Math.min(27,parseInt(getComputedStyle(d).getPropertyValue('--sz'),10)+n))+'px');
}
let origin = null;
document.querySelector('.book').addEventListener('touchstart',e=>{
  const t=e.touches[0]; origin=e.touches.length===1 ? [t.clientX,t.clientY] : null;
},{passive:true});
document.querySelector('.book').addEventListener('touchend',e=>{
  if(!origin || String(getSelection()).trim()) {origin=null;return;}
  if(!e.changedTouches.length){origin=null;return;}
  const t=e.changedTouches[0], dx=t.clientX-origin[0], dy=t.clientY-origin[1]; origin=null;
  if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.3) move(dx>0?1:-1);
},{passive:true});
document.querySelector('.book').addEventListener('touchcancel',()=>{origin=null;},{passive:true});
document.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.defaultPrevented||e.target.closest?.('#chapter-audio,input,textarea,select,[contenteditable]'))return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?1:-1);}
});

const player = el('audio-media');
let queue = [], cursor=0, playing=false, loaded=-1, ticket=0, failure='', gap=null, audioMode='prepared';
function audioView() {
  const show=pages[index]?.i===0 && !!master;
  el('chapter-audio').hidden=!show;
  const clip=queue[cursor];
  const playable=queue.length>0;
  el('audio-description').textContent=playable
    ? audioMode==='full' ? 'روایت سه‌صدایی فصل اول' : 'نمونهٔ سه‌صدایی فصل اول · elevenlabs.io (نسخهٔ کامل نیست)'
    : 'متن و تفکیک نقش‌ها آماده است؛ فایل صوتی هنوز در دسترس نیست.';
  el('audio-play').disabled=!playable;
  el('audio-play').textContent=playing?'مکث':loaded===cursor && player.currentTime>0?'ادامه':'پخش';
  el('audio-play').setAttribute('aria-label',playing?'مکث صوت':loaded===cursor && player.currentTime>0?'ادامهٔ صوت':'پخش صوت');
  el('audio-prev').disabled=!playable || cursor===0;
  el('audio-next').disabled=!playable || cursor>=queue.length-1;
  el('audio-status').textContent=failure || (clip ? clip.scene.title+' · '+voices[clip.voice]+' · '+(cursor+1)+' از '+queue.length : '');
  document.querySelectorAll('[data-segment-id]').forEach(span=>{
    const active=playing && span.dataset.segmentId===clip?.segmentId;
    span.classList.toggle('is-speaking',active);
    if(active) span.setAttribute('aria-current','true');else span.removeAttribute('aria-current');
  });
}
function pauseAudio() {
  clearTimeout(gap);gap=null;ticket++;playing=false;player.pause();audioView();
}
function selectClip(next, play) {
  if(busy || !queue[next])return;
  pauseAudio();cursor=next;failure='';
  const clip=queue[cursor];
  const nextPage=pages.findIndex(p=>p.type==='passage' && p.passage.id===clip.passage.id);
  if(nextPage>=0 && pages[index]?.i===0)go(nextPage,{animate:false,focus:false,fromAudio:true});
  if(play)playAudio(); else audioView();
}
async function playAudio() {
  const clip=queue[cursor];
  if(busy || !clip || pages[index]?.i!==0)return;
  const nextPage=pages.findIndex(p=>p.type==='passage' && p.passage.id===clip.passage.id);
  if(nextPage>=0)go(nextPage,{animate:false,focus:false,fromAudio:true});
  failure='';
  const token=++ticket;
  if(loaded!==cursor || player.ended){player.src=clip.src;loaded=cursor;}
  playing=true;audioView();
  try {
    await player.play();
    if(token!==ticket && !playing) player.pause();
  } catch(e) {
    if(token===ticket){playing=false;failure='پخش این قطعه ممکن نشد. دوباره تلاش کنید.';audioView();}
  }
}
el('audio-play').addEventListener('click',()=>playing?pauseAudio():playAudio());
el('audio-prev').addEventListener('click',()=>selectClip(cursor-1,playing));
el('audio-next').addEventListener('click',()=>selectClip(cursor+1,playing));
player.addEventListener('ended',()=>{
  if(!playing)return;
  if(cursor+1>=queue.length){pauseAudio();failure='پخش به پایان رسید.';audioView();return;}
  const advance=()=>{
    gap=null;
    if(!playing)return;
    if(busy){gap=setTimeout(advance,60);return;}
    selectClip(cursor+1,true);
  };
  gap=setTimeout(advance,120);
});
player.addEventListener('error',()=>{if(playing){pauseAudio();failure='فایل صوتی این قطعه بارگذاری نشد.';audioView();}});
async function readJSON(url) {
  try { const r=await fetch(url); return r.ok?await r.json():null; } catch { return null; }
}
function validMaster(data) {
  return typeof data?.title==='string' && Array.isArray(data.scenes) && data.scenes.length>0 &&
    data.scenes.every(s=>s.id && s.title && (!s.image || /^assets\/images\/[\w-]+\.webp$/.test(s.image)) &&
      s.passages?.length && s.passages.every(p=>p.id && p.segments?.length && p.segments.every(a=>voices[a.voice] && a.text)));
}
async function boot() {
  const [edition,manifest]=await Promise.all([readJSON('assets/chapter1/chapter1.json'),readJSON('assets/audio/chapter1/manifest.json')]);
  if(validMaster(edition)){
    master=edition;
    const start=legacy.findIndex(p=>p.type==='chapter' && p.i===0);
    const next=legacy.findIndex(p=>p.type==='chapter' && p.i===1);
    const added=[];
    master.scenes.forEach((scene,sceneIndex)=>{
      if(sceneIndex>0)added.push({type:'scene',i:0,scene});
      scene.passages.forEach(passage=>{
        added.push({type:'passage',i:0,scene,passage});
        passage.segments.forEach((seg,i)=>{
          const segmentId=seg.id || passage.id+'-s'+(i+1);
          const clip=manifest?.segments?.[segmentId];
          if(clip && /^assets\/audio\/chapter1\/[\w-]+\.(mp3|ogg|wav)$/.test(clip))
            queue.push({src:clip,segmentId,scene,passage,voice:seg.voice});
        });
      });
    });
    audioMode=manifest?.mode==='full'?'full':'pilot';
    pages=[...legacy.slice(0,start+1),...added,...legacy.slice(next)];
    const items=master.pronunciation?.filter(p=>p.term&&p.reading)||[];
    el('pronunciation').hidden=!items.length;
    items.forEach(p=>el('pronunciation').querySelector('ul').append(make('li',p.term+' ← '+p.reading)));
  }
  const saved=pages.findIndex(p=>pageKey(p)===storage.get('divan_page_key_v3'));
  const legacyIndex=Number(storage.get('divan_page'));
  const previous=legacy[Number.isInteger(legacyIndex)?legacyIndex:0] || legacy[0];
  const migrated=pages.findIndex(p=>pageKey(p)===pageKey(previous));
  index=saved>=0 ? saved : migrated>=0 ? migrated : pages.findIndex(p=>p.type==='chapter' && p.i===0);
  render();
}
boot();
