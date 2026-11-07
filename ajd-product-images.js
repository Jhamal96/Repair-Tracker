/* Shared customer-safe product photo gallery. */
(function AJDProductImages(){
'use strict';
const MAX=10;
function safeUrl(value){try{const url=new URL(String(value||'').trim());return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}}
function urls(record){
 const source=Array.isArray(record?.image_urls)&&record.image_urls.length?record.image_urls:[record?.image_url];
 return [...new Set(source.map(safeUrl).filter(Boolean))].slice(0,MAX);
}
function gallery(record,{onPhotoClick,initialIndex=0,autoRotate=false}={}){
 const list=urls(record),root=document.createElement('div');root.className='ajd-product-gallery';
 const stage=document.createElement('div');stage.className='ajd-gallery-stage';
 const image=document.createElement('img');image.className='photo';image.loading='lazy';
 const fallback=document.createElement('div');fallback.className='placeholder';fallback.textContent='📷';fallback.setAttribute('role','img');
 let selected=0;const buttons=[];let timer=null,isVisible=false,hovered=false,focused=false;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function stop(){if(timer){clearInterval(timer);timer=null}}
 function schedule(){stop();if(!autoRotate||reducedMotion||list.length<2||!isVisible||hovered||focused||document.hidden)return;timer=setInterval(()=>show(selected+1),5500)}
 const count=document.createElement('span');count.className='ajd-gallery-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 function show(index){
  selected=(index+list.length)%list.length;
  image.hidden=false;fallback.hidden=true;image.alt=String(record.title||record.item_name||'Product')+' - photo '+(selected+1)+' of '+list.length;image.src=list[selected];
  count.textContent=(selected+1)+' / '+list.length;
  buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));
  root.style.setProperty('--ajd-gallery-progress',((selected+1)/list.length*100)+'%');
 }
 image.onerror=()=>{image.hidden=true;fallback.hidden=false;fallback.setAttribute('aria-label','Photo unavailable for '+String(record.title||record.item_name||'product'))};
 fallback.hidden=Boolean(list.length);
 if(typeof onPhotoClick==='function'){
  const open=document.createElement('button');open.type='button';open.className='ajd-gallery-open';open.setAttribute('aria-label','View '+String(record.title||record.item_name||'product'));open.addEventListener('click',()=>onPhotoClick(selected));open.append(image,fallback);stage.append(open);
 }else stage.append(image,fallback);
 root.append(stage);
 if(!list.length){image.hidden=true;fallback.setAttribute('aria-label','No product photo');return root}
 if(list.length>1){
  root.classList.add('ajd-gallery-carousel');root.setAttribute('aria-roledescription','carousel');root.setAttribute('aria-label',(record.title||record.item_name||'Product')+' photos');
  const controls=document.createElement('div');controls.className='ajd-gallery-controls';
  for(const [label,icon,step] of [['Previous photo','‹',-1],['Next photo','›',1]]){
   const button=document.createElement('button');button.type='button';button.textContent=icon;button.setAttribute('aria-label',label);button.addEventListener('click',()=>{show(selected+step);schedule()});controls.append(button);
  }
  controls.insertBefore(count,controls.lastChild);stage.append(controls);
  const thumbs=document.createElement('div');thumbs.className='ajd-gallery-thumbs';thumbs.setAttribute('aria-label','Product photos');
  list.forEach((url,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','View photo '+(i+1));button.addEventListener('click',()=>{show(i);schedule()});const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';button.append(img);buttons.push(button);thumbs.append(button)});
  root.append(thumbs);
 }

 if(list.length>1){
  let startX=null,startY=null;
  stage.style.touchAction='pan-y';
  stage.addEventListener('touchstart',event=>{if(event.touches.length!==1)return;startX=event.touches[0].clientX;startY=event.touches[0].clientY},{passive:true});
  stage.addEventListener('touchend',event=>{
   if(startX===null)return;
   const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;startX=null;startY=null;
   if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.25){
    event.preventDefault();show(selected+(dx<0?1:-1));schedule();
    stage.dataset.justSwiped='1';setTimeout(()=>delete stage.dataset.justSwiped,380);
   }
  },{passive:false});
  stage.addEventListener('click',event=>{if(stage.dataset.justSwiped){event.preventDefault();event.stopPropagation();delete stage.dataset.justSwiped}},true);
  stage.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(selected+(event.key==='ArrowLeft'?-1:1));schedule()}});
  root.addEventListener('mouseenter',()=>{hovered=true;stop()});
  root.addEventListener('mouseleave',()=>{hovered=false;schedule()});
  root.addEventListener('focusin',()=>{focused=true;stop()});
  root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget)){focused=false;schedule()}});
  if(autoRotate&&typeof IntersectionObserver!=='undefined'){
   const observer=new IntersectionObserver(entries=>{isVisible=entries[0]?.isIntersecting||false;schedule()},{threshold:.3});
   observer.observe(root);
   const mutationObserver=new MutationObserver(()=>{if(!root.isConnected){stop();observer.disconnect();mutationObserver.disconnect()}});
   mutationObserver.observe(document.body,{childList:true,subtree:true});
  }else if(autoRotate){isVisible=true;schedule()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else schedule()});
 }
 show(Number.isInteger(initialIndex)?Math.max(0,Math.min(list.length-1,initialIndex)):0);return root;
}
window.AJDProductImages={MAX,safeUrl,urls,gallery};
})();
