/* AJD featured storefront promotions: live Supabase-backed, admin-controlled. */
(() => {
'use strict';
const URL='https://vxpufrahrnwmtgltjstd.supabase.co';
const KEY='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const client=window.supabase?.createClient(URL,KEY);
if(!client)return;
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const isAdminPage=location.pathname.startsWith('/inventory')||document.body?.dataset.page==='parts';
const productUrl=id=>'/store?product='+encodeURIComponent(String(id));
function photo(p){const pics=Array.isArray(p.image_urls)?p.image_urls:typeof p.image_urls==='string'?(()=>{try{return JSON.parse(p.image_urls)}catch{return []}})():[];const raw=p.image_url||(pics[0]?.url||pics[0]||'');try{const u=new URL(typeof raw==='string'?raw:raw.url,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
async function getPromos(){const {data,error}=await client.from('ajd_store_promotions').select('product_id,position,active,headline,subtitle').order('position');if(error)throw error;return data||[]}
function element(tag,cl,text){const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=text;return e}
function enableTilt(root){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;root.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=root.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;root.style.setProperty('--ajd-mx',x*16+'px');root.style.setProperty('--ajd-my',y*14+'px');root.style.setProperty('--ajd-rx',-y*5+'deg');root.style.setProperty('--ajd-ry',x*7+'deg')});root.addEventListener('pointerleave',()=>{root.style.setProperty('--ajd-mx','0px');root.style.setProperty('--ajd-my','0px');root.style.setProperty('--ajd-rx','0deg');root.style.setProperty('--ajd-ry','0deg')})}
async function startStore(){
 const main=document.querySelector('main.wrap');if(!main)return;
 const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const section=element('section','ajd-promos');section.id='ajdFeatured';section.hidden=true;section.setAttribute('aria-label','Featured products carousel');
 const head=element('div','ajd-promos-heading');head.append(element('span','ajd-promos-kicker','CURATED BY AJD'),element('h2','','Featured tech & deals'));section.append(head);
 const frame=element('div','ajd-promo-carousel');frame.setAttribute('aria-roledescription','carousel');frame.setAttribute('aria-label','Featured store products');
 const viewport=element('div','ajd-promo-viewport');viewport.setAttribute('aria-live','off');
 const track=element('div','ajd-promo-track');viewport.append(track);
 const controlBar=element('div','ajd-promo-carousel-controls');
 const prev=element('button','ajd-promo-nav','‹');prev.type='button';prev.setAttribute('aria-label','Previous featured product');
 const dots=element('div','ajd-promo-dots');dots.setAttribute('aria-label','Choose featured product');
 const next=element('button','ajd-promo-nav','›');next.type='button';next.setAttribute('aria-label','Next featured product');
 controlBar.append(prev,dots,next);frame.append(viewport,controlBar);section.append(frame);
 main.insertBefore(section,main.firstChild);enableTilt(frame);
 let current=0,lastSignature='',cards=[],timer=null,paused=false,loading=false,deepLinkOpened=false;
 function stop(){if(timer){clearInterval(timer);timer=null}}
 function start(){stop();if(cards.length<2||reduceMotion||paused||document.hidden)return;timer=setInterval(()=>setSlide(current+1,false),window.AJDCarouselSettings?.getMs('featured')||3000)}
 function setSlide(index,manual=true){
  if(!cards.length)return;
  current=(index+cards.length)%cards.length;
  track.style.transform='translate3d(-'+(current*100)+'%,0,0)';
  cards.forEach((card,i)=>{card.setAttribute('aria-hidden',String(i!==current));card.inert=i!==current});
  [...dots.children].forEach((button,i)=>{button.setAttribute('aria-current',String(i===current));button.setAttribute('aria-label','Show featured product '+(i+1)+(i===current?' (current)':''))});
  if(manual)start();
 }
 prev.onclick=()=>setSlide(current-1);
 next.onclick=()=>setSlide(current+1);
 dots.addEventListener('click',e=>{const button=e.target.closest('button[data-index]');if(button)setSlide(Number(button.dataset.index))});
 frame.addEventListener('mouseenter',()=>{paused=true;stop()});
 frame.addEventListener('mouseleave',()=>{paused=false;start()});
 frame.addEventListener('focusin',()=>{paused=true;stop()});
 frame.addEventListener('focusout',e=>{if(!frame.contains(e.relatedTarget)){paused=false;start()}});
 window.addEventListener('ajd-carousel-speed-change',start);
 let touchX=null,touchY=null;
 viewport.addEventListener('touchstart',e=>{if(e.touches.length===1){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY}},{passive:true});
 viewport.addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;const dy=e.changedTouches[0].clientY-touchY;touchX=null;touchY=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)setSlide(current+(dx<0?1:-1))},{passive:true});
 function photoUrls(product){
  if(window.AJDProductImages?.urls)return window.AJDProductImages.urls(product);
  const photos=Array.isArray(product.image_urls)?product.image_urls:[product.image_url];
  return [...new Set(photos.map(value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}}).filter(Boolean))];
 }
 function buildCard(p,c,idx){
  const card=element('article','ajd-promo-card');
  card.setAttribute('aria-roledescription','slide');card.setAttribute('aria-label','Featured product '+(idx+1)+': '+p.title);
  const art=element('div','ajd-promo-art');
  const urls=photoUrls(p);const src=urls[0];
  if(src){
   const picture=element('img');picture.src=src;picture.alt=p.title;picture.loading=idx===0?'eager':'lazy';picture.decoding='async';
   picture.onerror=()=>{picture.hidden=true;if(!art.querySelector('.ajd-promo-placeholder'))art.append(element('div','ajd-promo-placeholder','📷'))};
   art.append(picture);
   if(urls.length>1){
    let imageIndex=0;
    const nav=element('div','ajd-promo-photo-controls');
    const counter=element('span','', '1 / '+urls.length);
    const showImage=n=>{imageIndex=(n+urls.length)%urls.length;picture.hidden=false;picture.src=urls[imageIndex];picture.alt=p.title+' - photo '+(imageIndex+1)+' of '+urls.length;counter.textContent=(imageIndex+1)+' / '+urls.length};
    const back=element('button','','‹');back.type='button';back.setAttribute('aria-label','Previous photo of '+p.title);back.onclick=()=>showImage(imageIndex-1);
    const forward=element('button','','›');forward.type='button';forward.setAttribute('aria-label','Next photo of '+p.title);forward.onclick=()=>showImage(imageIndex+1);
    nav.append(back,counter,forward);art.append(nav);
   }
  }else{const missing=element('div','ajd-promo-placeholder','📷');missing.setAttribute('aria-label','No photo available for '+p.title);art.append(missing)}
  const body=element('div','ajd-promo-copy');
  body.append(element('span','ajd-promo-label',idx===0?'★ FEATURED PICK':'✦ SPOTLIGHT'),element('h3','',c.headline||p.title),element('p','',c.subtitle||p.description||'Explore this featured product at AJD’s Wireless Repairs.'),element('strong','ajd-promo-price',money(p.price)));
  const actions=element('div','ajd-promo-actions');
  const info=element('button','ajd-promo-cta','View Product ↗');info.type='button';info.onclick=()=>window.AJDStoreDetails?.open(p);actions.append(info);
  const available=p.status==='available'&&Number(p.stock_quantity)>Number(p.reserved_quantity||0);
  if(available){const request=element('button','ajd-promo-secondary','Request Item');request.type='button';request.onclick=()=>window.AJDStoreRequest?.(p.id);actions.append(request)}
  body.append(actions);card.append(art,body);
  return card;
 }
 async function render(){
  if(loading)return;loading=true;
  try{
   const items=window.AJDStoreCatalog?.()||[];
   if(!items.length)return;
   if(!deepLinkOpened){const id=new URLSearchParams(location.search).get('product');if(id){const target=items.find(item=>String(item.id)===id&&item.status!=='hidden');if(target&&window.AJDStoreDetails?.open){deepLinkOpened=true;window.AJDStoreDetails.open(target)}}}
   const promos=(await getPromos()).filter(p=>p.active);
   const matches=promos.map(p=>({config:p,item:items.find(i=>String(i.id)===p.product_id&&i.status!=='hidden')})).filter(x=>x.item);
   const signature=JSON.stringify(matches.map(x=>[x.item.id,x.config.position,x.config.headline,x.config.subtitle,x.item.price,x.item.status,x.item.image_url,x.item.image_urls,x.item.stock_quantity,x.item.reserved_quantity]));
   if(signature===lastSignature)return;
   lastSignature=signature;section.hidden=!matches.length;
   stop();const selectedId=cards[current]?.dataset.productId;
   cards=matches.slice(0,12).map(({item,config},idx)=>{const card=buildCard(item,config,idx);card.dataset.productId=String(item.id);return card});
   track.replaceChildren(...cards);
   dots.replaceChildren(...cards.map((_,i)=>{const button=element('button','ajd-promo-dot');button.type='button';button.dataset.index=i;button.textContent=String(i+1);return button}));
   current=Math.max(0,cards.findIndex(c=>c.dataset.productId===selectedId));
   controlBar.hidden=cards.length<2;
   setSlide(current,false);start();
  }catch(e){console.warn('Unable to load featured promotions:',e)}
  finally{loading=false}
 }
 await render();
 let startupTries=0;const startup=setInterval(()=>{if(section.hidden&&startupTries++<20)void render();else clearInterval(startup)},900);
 setInterval(()=>{if(!document.hidden)void render()},15000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{void render();start()}});
}

async function startAdmin(){
const content=$('appContent');if(!content)return;
const section=element('section','ajd-promo-manager panel');section.id='ajdPromoManager';
section.innerHTML='<div class="ajd-promo-manager-head"><div><span class="ajd-promos-kicker">STORE CAMPAIGNS</span><h2>Featured products & advertising</h2><p>Choose published products for the animated top section of your customer store. Arrange your featured items, preview their actual images, and open or copy a direct storefront product link.</p></div><a href="/store#ajdFeatured" target="_blank" rel="noopener">↗ Preview Store</a></div><div class="ajd-promo-manager-controls"><label>Published product<select id="promoProduct"><option value="">Select a store item…</option></select></label><label>Headline (optional)<input id="promoHeadline" maxlength="100" placeholder="Featured this week"></label><label>Caption (optional)<input id="promoSubtitle" maxlength="240" placeholder="Short message for shoppers"></label><button id="promoAdd" type="button">＋ Feature Product</button></div><p id="promoStatus" role="status" aria-live="polite"></p><div id="promoSelected" class="ajd-promo-selected"></div>';
content.insertBefore(section,content.children[1]||null);

const speedPanel=element('div','ajd-carousel-speed-settings');
speedPanel.innerHTML='<div class="ajd-carousel-speed-heading"><strong>⏱ Carousel timing</strong><span>Choose how quickly slides change. Settings apply to the customer storefront.</span></div><div class="ajd-carousel-speed-fields"><label>Product photo carousel <select id="ajdProductSpeed" aria-label="Product photo carousel seconds"></select></label><label>Featured ad carousel <select id="ajdFeaturedSpeed" aria-label="Featured ad carousel seconds"></select></label><button type="button" id="ajdSaveSpeed">Save Timing</button></div><p id="ajdSpeedStatus" role="status" aria-live="polite"></p>';
section.insertBefore(speedPanel,section.querySelector('.ajd-promo-manager-controls'));
const intervals=[1,2,3,4,5,6,7,8,10,12,15];
for(const id of ['ajdProductSpeed','ajdFeaturedSpeed']){
 const select=$(id);
 for(const n of intervals){const option=element('option','',n+' second'+(n===1?'':'s'));option.value=String(n);select.append(option)}
}
const speedValues=window.AJDCarouselSettings?.values?.()||{product_seconds:3,featured_seconds:3};
$('ajdProductSpeed').value=String(speedValues.product_seconds);
$('ajdFeaturedSpeed').value=String(speedValues.featured_seconds);
$('ajdSaveSpeed').addEventListener('click',async()=>{
 const button=$('ajdSaveSpeed'),feedback=$('ajdSpeedStatus');
 try{
  button.disabled=true;feedback.textContent='Saving timing…';
  const result=await window.AJDCarouselSettings.save(Number($('ajdProductSpeed').value),Number($('ajdFeaturedSpeed').value));
  feedback.textContent='Saved! Product photos: '+result.product_seconds+'s · Featured ads: '+result.featured_seconds+'s.';
 }catch(error){feedback.textContent='Unable to save carousel timing: '+error.message}
 finally{button.disabled=false}
});
void window.AJDCarouselSettings?.refresh().then(values=>{
 if(!values)return;
 $('ajdProductSpeed').value=String(values.product_seconds);
 $('ajdFeaturedSpeed').value=String(values.featured_seconds);
}).catch(error=>{$('ajdSpeedStatus').textContent='Current timing could not be loaded: '+error.message});

const status=$('promoStatus'),selected=$('promoSelected'),picker=$('promoProduct');let promos=[],items=[];
function say(t){status.textContent=t}
async function refresh(){
const [p,i]=await Promise.all([getPromos(),client.from('store_items').select('id,title,status,price,image_url,image_urls').neq('status','hidden').order('title')]);if(i.error)throw i.error;promos=p;items=i.data||[];
const previous=picker.value;picker.replaceChildren();const first=element('option','','Select a store item…');first.value='';picker.append(first);items.forEach(item=>{const o=element('option','',item.title);o.value=item.id;picker.append(o)});picker.value=previous;
selected.replaceChildren();
promos.forEach((p,index)=>{
 const item=items.find(i=>String(i.id)===p.product_id);
 const wrap=element('article','ajd-promo-selected-item');
 const imgLink=element('a','ajd-promo-admin-image');imgLink.href=productUrl(p.product_id);imgLink.target='_blank';imgLink.rel='noopener';imgLink.setAttribute('aria-label','Open '+(item?.title||'product')+' in customer store');
 const pictureUrl=item&&window.AJDProductImages?.urls?.(item)?.[0]|| (item?photo(item):'');
 if(pictureUrl){const image=element('img');image.src=pictureUrl;image.alt=item.title;image.loading='lazy';image.onerror=()=>{image.remove();imgLink.textContent='📷'};imgLink.append(image)}else imgLink.textContent='📷';
 const details=element('div','ajd-promo-admin-info');
 const link=element('a','ajd-promo-admin-title',item?.title||'Unavailable item');link.href=productUrl(p.product_id);link.target='_blank';link.rel='noopener';
 const description=element('span','ajd-promo-admin-meta',(item?money(item.price)+' · ':'')+(p.active?'Live on storefront':'Inactive'));
 details.append(link,description);
 if(p.headline)details.append(element('small','',p.headline));
 const actions=element('div','ajd-promo-admin-actions');
 const directLink=element('a','ajd-promo-admin-visit','↗ Open Product');directLink.href=productUrl(p.product_id);directLink.target='_blank';directLink.rel='noopener';
 const copy=element('button','','Copy Link');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(new URL(productUrl(p.product_id),location.origin).href);say('Product link copied.')}catch(e){say('Could not copy link: '+e.message)}});
 const left=element('button','','↑');left.type='button';left.disabled=index===0;left.setAttribute('aria-label','Move '+(item?.title||'feature')+' up');left.onclick=()=>move(index,-1);
 const right=element('button','','↓');right.type='button';right.disabled=index===promos.length-1;right.setAttribute('aria-label','Move '+(item?.title||'feature')+' down');right.onclick=()=>move(index,1);
 const remove=element('button','ajd-promo-remove','Remove');remove.type='button';remove.onclick=async()=>{try{remove.disabled=true;const {error}=await client.from('ajd_store_promotions').delete().eq('product_id',p.product_id);if(error)throw error;await refresh();say('Promotion removed from the storefront.')}catch(e){say('Could not remove promotion: '+e.message);remove.disabled=false}};
 actions.append(directLink,copy,left,right,remove);
 wrap.append(imgLink,details,actions);selected.append(wrap);
});
if(!promos.length)selected.append(element('p','','No featured products selected yet.'));

}
window.addEventListener('ajd-featured-changed',()=>{void refresh().catch(error=>say('Could not update featured list: '+error.message))});
async function move(index,direction){try{const reordered=[...promos];const target=index+direction;[reordered[index],reordered[target]]=[reordered[target],reordered[index]];const results=await Promise.all(reordered.map((p,i)=>client.from('ajd_store_promotions').update({position:i}).eq('product_id',p.product_id)));const failed=results.find(x=>x.error);if(failed)throw failed.error;await refresh();say('Featured order updated.')}catch(e){say('Unable to reorder: '+e.message)}}
$('promoAdd').onclick=async()=>{const id=picker.value;if(!id){say('Select a published product first.');return}try{$('promoAdd').disabled=true;const row={product_id:String(id),position:promos.find(p=>p.product_id===id)?.position??promos.length,active:true,headline:$('promoHeadline').value.trim()||null,subtitle:$('promoSubtitle').value.trim()||null,updated_at:new Date().toISOString()};const {error}=await client.from('ajd_store_promotions').upsert(row,{onConflict:'product_id'});if(error)throw error;await refresh();say('Featured product saved and visible to customers.');$('promoHeadline').value='';$('promoSubtitle').value=''}catch(e){say('Unable to save promotion: '+e.message)}finally{$('promoAdd').disabled=false}};
while(content.hidden)await new Promise(resolve=>setTimeout(resolve,350));
try{const {data:approved,error}=await client.rpc('ajd_is_admin');if(error||approved!==true){section.remove();return}await refresh()}catch(e){say('Could not load featured products: '+e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void(isAdminPage?startAdmin():startStore())});else void(isAdminPage?startAdmin():startStore());
})();