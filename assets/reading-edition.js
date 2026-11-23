'use strict';
(() => {
  const root=document.documentElement, chapter=document.querySelector('article');
  const scenes=Array.from(chapter.querySelectorAll('section[id]'));
  const get=id=>document.getElementById(id);
  const load=key=>{try{return localStorage.getItem(key)}catch{return null}};
  const save=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const themeKey='divan_read_theme_v1', sizeKey='divan_read_size_v1';
  const positionKey='divan_read_position_v1_'+chapter.dataset.edition;
  const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
  let size=limit(Number(load(sizeKey))||18,16,32);
  const smaller=get('reader-smaller'),larger=get('reader-larger'),theme=get('reader-theme');
  const position=get('reader-resume'),progress=get('reader-progress');
  const showSize=()=>{
    root.style.setProperty('--size',(size/16)+'rem');
    smaller.disabled=size<=16;larger.disabled=size>=32;
  };
  const showTheme=()=>{
    const dark=root.dataset.theme==='dark';
    theme.setAttribute('aria-pressed',String(dark));
    theme.textContent=dark?'نمای روشن':'نمای شب';
  };
  const applySize=step=>{size=limit(size+step,16,32);save(sizeKey,size);showSize()};
  smaller.addEventListener('click',()=>applySize(-2));larger.addEventListener('click',()=>applySize(2));
  if(load(themeKey)==='dark')root.dataset.theme='dark';
  theme.addEventListener('click',()=>{
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    save(themeKey,root.dataset.theme);showTheme();
  });
  showSize();showTheme();
  get('reader-tools').hidden=false;
  const select=id=>scenes.find(scene=>scene.id===id);
  let remembered=null;
  try {const v=JSON.parse(load(positionKey));if(v&&select(v.id)&&Number.isFinite(v.part))remembered=v;} catch{}
  if(remembered&&!location.hash){
    const target=select(remembered.id);
    position.href='#'+target.id;
    position.textContent='ادامهٔ مطالعه: '+target.querySelector('h2').textContent;
    position.hidden=false;
    position.addEventListener('click',e=>{
      if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      e.preventDefault();
      history.replaceState(null,'','#'+target.id);
      const heading=target.querySelector('h2');
      heading.tabIndex=-1;heading.focus({preventScroll:true});
      window.scrollTo({top:window.scrollY+target.getBoundingClientRect().top+target.offsetHeight*limit(remembered.part,0,.99)-36,behavior:'instant'});
    });
  }
  const read=()=>{
    const first=chapter.getBoundingClientRect(), vh=window.innerHeight;
    progress.value=limit(100*(-first.top)/(Math.max(1,first.height-vh*.62)),0,100);
    return scenes.reduce((active,scene)=>scene.getBoundingClientRect().top<=80?scene:active,null);
  };
  let deferred=0;
  const update=()=>{
    const target=read();
    if(target){
      const rect=target.getBoundingClientRect();
      save(positionKey,JSON.stringify({id:target.id,part:limit((40-rect.top)/Math.max(rect.height,1),0,.99)}));
    }
  };
  addEventListener('scroll',()=>{
    read();clearTimeout(deferred);deferred=setTimeout(update,240);
  },{passive:true});
  addEventListener('pagehide',update);addEventListener('resize',read,{passive:true});
  read();
})();
