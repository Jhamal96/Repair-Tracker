/* Shared public carousel speed settings. Admin writes are enforced with Supabase RLS. */
(function(){
'use strict';
const DEFAULT={product_seconds:3,featured_seconds:3};
const clamp=value=>Math.max(1,Math.min(15,Number.isFinite(Number(value))?Math.round(Number(value)):3));
const settings={...DEFAULT};
let client=null;
function set(row){
 if(!row)return;
 const product=clamp(row.product_seconds),featured=clamp(row.featured_seconds);
 if(settings.product_seconds===product&&settings.featured_seconds===featured)return;
 settings.product_seconds=product;settings.featured_seconds=featured;
 window.dispatchEvent(new CustomEvent('ajd-carousel-speed-change',{detail:{...settings}}));
}
function getMs(kind){return clamp(settings[kind==='featured'?'featured_seconds':'product_seconds'])*1000}
function getClient(){
 if(client)return client;
 if(!window.supabase?.createClient)return null;
 client=window.supabase.createClient('https://vxpufrahrnwmtgltjstd.supabase.co','sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520');
 return client;
}
async function refresh(){
 const sb=getClient();if(!sb)return {...settings};
 const {data,error}=await sb.from('ajd_carousel_settings').select('product_seconds,featured_seconds').eq('id','store').maybeSingle();
 if(error)throw error;set(data||DEFAULT);return {...settings};
}
async function save(productSeconds,featuredSeconds){
 const sb=getClient();if(!sb)throw Error('Supabase unavailable');
 const row={id:'store',product_seconds:clamp(productSeconds),featured_seconds:clamp(featuredSeconds),updated_at:new Date().toISOString()};
 const {data,error}=await sb.from('ajd_carousel_settings').upsert(row,{onConflict:'id'}).select('product_seconds,featured_seconds').single();
 if(error)throw error;set(data);return {...settings};
}
window.AJDCarouselSettings={getMs,refresh,save,values:()=>({...settings})};
void refresh().catch(error=>console.warn('Carousel speeds using defaults:',error));
window.addEventListener('focus',()=>{void refresh().catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh().catch(()=>{})});
})();
