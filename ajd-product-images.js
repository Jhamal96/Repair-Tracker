/* Shared customer-safe product photo gallery. */
(function AJDProductImages(){
'use strict';
const MAX=10;
function safeUrl(value){try{const url=new URL(String(value||'').trim());return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}}
function urls(record){
 const source=Array.isArray(record?.image_urls)&&record.image_urls.length?record.image_urls:[record?.image_url];
 return [...new Set(source.map(safeUrl).filter(Boolean))].slice(0,MAX);
}
function gallery(record){
 const list=urls(record),root=document.createElement('div');root.className='ajd-product-gallery';
 const stage=document.createElement('div');stage.className='ajd-gallery-stage';
 const image=document.createElement('img');image.className='photo';image.loading='lazy';
 const fallback=document.createElement('div');fallback.className='placeholder';fallback.textContent='📷';fallback.setAttribute('role','img');
 let selected=0;const buttons=[];
 const count=document.createElement('span');count.className='ajd-gallery-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 function show(index){
  selected=(index+list.length)%list.length;
  image.hidden=false;fallback.hidden=true;image.alt=String(record.title||record.item_name||'Product')+' - photo '+(selected+1)+' of '+list.length;image.src=list[selected];
  count.textContent=(selected+1)+' / '+list.length;
  buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));
 }
 image.onerror=()=>{image.hidden=true;fallback.hidden=false;fallback.setAttribute('aria-label','Photo unavailable for '+String(record.title||record.item_name||'product'))};
 fallback.hidden=Boolean(list.length);stage.append(image,fallback);root.append(stage);
 if(!list.length){image.hidden=true;fallback.setAttribute('aria-label','No product photo');return root}
 if(list.length>1){
  const controls=document.createElement('div');controls.className='ajd-gallery-controls';
  for(const [label,icon,step] of [['Previous photo','‹',-1],['Next photo','›',1]]){
   const button=document.createElement('button');button.type='button';button.textContent=icon;button.setAttribute('aria-label',label);button.addEventListener('click',()=>show(selected+step));controls.append(button);
  }
  controls.insertBefore(count,controls.lastChild);stage.append(controls);
  const thumbs=document.createElement('div');thumbs.className='ajd-gallery-thumbs';thumbs.setAttribute('aria-label','Product photos');
  list.forEach((url,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','View photo '+(i+1));button.addEventListener('click',()=>show(i));const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';button.append(img);buttons.push(button);thumbs.append(button)});
  root.append(thumbs);
 }
 show(0);return root;
}
window.AJDProductImages={MAX,safeUrl,urls,gallery};
})();
