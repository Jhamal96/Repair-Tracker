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
function photo(p){const pics=Array.isArray(p.image_urls)?p.image_urls:typeof p.image_urls==='string'?(()=>{try{return JSON.parse(p.image_urls)}catch{return []}})():[];const raw=p.image_url||(pics[0]?.url||pics[0]||'');try{const u=new URL(typeof raw==='string'?raw:raw.url,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
async function getPromos(){const {data,error}=await client.from('ajd_store_promotions').select('product_id,position,active,headline,subtitle').order('position');if(error)throw error;return data||[]}
function element(tag,cl,text){const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=text;return e}
function enableTilt(root){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;root.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=root.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;root.style.setProperty('--ajd-mx',x*16+'px');root.style.setProperty('--ajd-my',y*14+'px');root.style.setProperty('--ajd-rx',-y*5+'deg');root.style.setProperty('--ajd-ry',x*7+'deg')});root.addEventListener('pointerleave',()=>{root.style.setProperty('--ajd-mx','0px');root.style.setProperty('--ajd-my','0px');root.style.setProperty('--ajd-rx','0deg');root.style.setProperty('--ajd-ry','0deg')})}
async function startStore(){
const main=document.querySelector('main.wrap');if(!main)return;
const section=element('section','ajd-promos');section.id='ajdFeatured';section.hidden=true;section.setAttribute('aria-label','Featured products');
const head=element('div','ajd-promos-heading');head.append(element('span','ajd-promos-kicker','CURATED BY AJD'),element('h2','','Featured tech & deals'));section.append(head);
const row=element('div','ajd-promos-grid');section.append(row);main.insertBefore(section,main.firstChild);enableTilt(section);
let lastSignature='';
async function render(){
try{
const items=window.AJDStoreCatalog?.()||[];if(!items.length)return;
const promos=(await getPromos()).filter(p=>p.active);const matches=promos.map(p=>({config:p,item:items.find(i=>String(i.id)===p.product_id&&i.status!=='hidden')})).filter(x=>x.item);
const signature=JSON.stringify(matches.map(x=>[x.item.id,x.config.position,x.config.headline,x.config.subtitle,x.item.price,x.item.image_url,x.item.image_urls]));if(signature===lastSignature)return;lastSignature=signature;
row.replaceChildren();section.hidden=!matches.length;
matches.slice(0,6).forEach(({item:p,config:c},idx)=>{
const card=element('article','ajd-promo-card');card.style.setProperty('--card-index',idx);
const art=element('div','ajd-promo-art');const src=photo(p);if(src){const img=element('img');img.src=src;img.alt=p.title;img.loading=idx===0?'eager':'lazy';art.append(img)}else art.append(element('div','ajd-promo-placeholder','✦'));
const body=element('div','ajd-promo-copy');body.append(element('span','ajd-promo-label',idx===0?'★ FEATURED PICK':'✦ SPOTLIGHT'),element('h3','',c.headline||p.title),element('p','',c.subtitle||p.description||'Explore this featured product at AJD’s Wireless Repairs.'),element('strong','ajd-promo-price',money(p.price)));
const actions=element('div','ajd-promo-actions');const info=element('button','ajd-promo-cta','View Product ↗');info.type='button';info.addEventListener('click',()=>window.AJDStoreDetails?.open(p));actions.append(info);
const available=p.status==='available'&&Number(p.stock_quantity)>Number(p.reserved_quantity||0);if(available){const request=element('button','ajd-promo-secondary','Request Item');request.type='button';request.addEventListener('click',()=>window.AJDStoreRequest?.(p.id));actions.append(request)}body.append(actions);card.append(art,body);row.append(card);
});
}catch(e){console.warn('Unable to load featured promotions:',e)}
}
await render();setInterval(()=>{if(!document.hidden)void render()},12000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void render()});
}
async function startAdmin(){
const content=$('appContent');if(!content)return;
const section=element('section','ajd-promo-manager panel');section.id='ajdPromoManager';
section.innerHTML='<div class="ajd-promo-manager-head"><div><span class="ajd-promos-kicker">STORE CAMPAIGNS</span><h2>Featured products & advertising</h2><p>Choose published products for the animated top section of your customer store. Drag-free ordering, optional headline and caption, and one-click removal.</p></div><a href="/store#ajdFeatured" target="_blank" rel="noopener">↗ Preview Store</a></div><div class="ajd-promo-manager-controls"><label>Published product<select id="promoProduct"><option value="">Select a store item…</option></select></label><label>Headline (optional)<input id="promoHeadline" maxlength="100" placeholder="Featured this week"></label><label>Caption (optional)<input id="promoSubtitle" maxlength="240" placeholder="Short message for shoppers"></label><button id="promoAdd" type="button">＋ Feature Product</button></div><p id="promoStatus" role="status" aria-live="polite"></p><div id="promoSelected" class="ajd-promo-selected"></div>';
content.insertBefore(section,content.children[1]||null);
const status=$('promoStatus'),selected=$('promoSelected'),picker=$('promoProduct');let promos=[],items=[];
function say(t){status.textContent=t}
async function refresh(){
const [p,i]=await Promise.all([getPromos(),client.from('store_items').select('id,title,status').neq('status','hidden').order('title')]);if(i.error)throw i.error;promos=p;items=i.data||[];
const previous=picker.value;picker.replaceChildren();const first=element('option','','Select a store item…');first.value='';picker.append(first);items.forEach(item=>{const o=element('option','',item.title);o.value=item.id;picker.append(o)});picker.value=previous;
selected.replaceChildren();
promos.forEach((p,index)=>{const item=items.find(i=>String(i.id)===p.product_id);const wrap=element('div','ajd-promo-selected-item');wrap.append(element('strong','',item?.title||'Unavailable item'),element('span','',p.active?'Shown on storefront':'Not active'));
const left=element('button','','↑');left.type='button';left.disabled=index===0;left.setAttribute('aria-label','Move feature up');left.onclick=()=>move(index,-1);const right=element('button','','↓');right.type='button';right.disabled=index===promos.length-1;right.setAttribute('aria-label','Move feature down');right.onclick=()=>move(index,1);
const remove=element('button','','Remove');remove.type='button';remove.onclick=async()=>{try{remove.disabled=true;const {error}=await client.from('ajd_store_promotions').delete().eq('product_id',p.product_id);if(error)throw error;await refresh();say('Promotion removed from the storefront.')}catch(e){say('Could not remove promotion: '+e.message);remove.disabled=false}};wrap.append(left,right,remove);selected.append(wrap)});
if(!promos.length)selected.append(element('p','','No featured products selected yet.'));
}
async function move(index,direction){try{const reordered=[...promos];const target=index+direction;[reordered[index],reordered[target]]=[reordered[target],reordered[index]];const results=await Promise.all(reordered.map((p,i)=>client.from('ajd_store_promotions').update({position:i}).eq('product_id',p.product_id)));const failed=results.find(x=>x.error);if(failed)throw failed.error;await refresh();say('Featured order updated.')}catch(e){say('Unable to reorder: '+e.message)}}
$('promoAdd').onclick=async()=>{const id=picker.value;if(!id){say('Select a published product first.');return}try{$('promoAdd').disabled=true;const row={product_id:String(id),position:promos.find(p=>p.product_id===id)?.position??promos.length,active:true,headline:$('promoHeadline').value.trim()||null,subtitle:$('promoSubtitle').value.trim()||null,updated_at:new Date().toISOString()};const {error}=await client.from('ajd_store_promotions').upsert(row,{onConflict:'product_id'});if(error)throw error;await refresh();say('Featured product saved and visible to customers.');$('promoHeadline').value='';$('promoSubtitle').value=''}catch(e){say('Unable to save promotion: '+e.message)}finally{$('promoAdd').disabled=false}};
while(content.hidden)await new Promise(resolve=>setTimeout(resolve,350));
try{const {data:approved,error}=await client.rpc('ajd_is_admin');if(error||approved!==true){section.remove();return}await refresh()}catch(e){say('Could not load featured products: '+e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void(isAdminPage?startAdmin():startStore())});else void(isAdminPage?startAdmin():startStore());
})();