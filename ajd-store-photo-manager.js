/* Dashboard photo management for public storefront products. */
(()=>{
'use strict';
let dialog,current,photos=[],busy=false;
const safe=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
function message(t){dialog.querySelector('[data-message]').textContent=t}
function render(){
 const list=dialog.querySelector('[data-photos]');list.replaceChildren();
 photos.forEach((p,i)=>{const tile=el('div');tile.style='border:1px solid #64748b;border-radius:12px;padding:10px';const img=el('img');img.src=p.preview||p.url;img.alt='Product photo '+(i+1);img.style='width:100%;height:120px;object-fit:contain';tile.append(img,el('p',i===0?'Cover photo':'Photo '+(i+1)));
 for(const [label,fn] of [['Make Cover',()=>{photos.splice(i,1);photos.unshift(p);render()}],['Remove',()=>{if(p.preview)URL.revokeObjectURL(p.preview);photos.splice(i,1);render()}]]){const b=el('button',label);b.type='button';b.className='btn';b.disabled=busy;b.onclick=()=>{if(!busy)fn()};tile.append(b)}list.append(tile)});
 dialog.querySelector('[data-count]').textContent=photos.length+' / 10 photos';
}
function close(){if(busy)return;dialog.close();for(const p of photos)if(p.preview)URL.revokeObjectURL(p.preview);photos=[]}
function open(id){
 if(!isCloudAdmin){toast('Sign in as administrator first');return}
 current=storeProducts.find(p=>p.id===id);if(!current)return;
 if(!dialog){dialog=el('dialog');dialog.style='width:min(760px,94vw);max-height:90dvh;overflow:auto;padding:22px;border:1px solid #64748b;border-radius:20px;background:var(--surface,#0f172a);color:var(--text,#fff)';dialog.innerHTML='<h2 style="font-size:20px;font-weight:800">Storefront Photos</h2><p data-title></p><p data-count></p><p>Up to 10 photos. JPG, PNG or WebP, 5 MB each.</p><input data-files type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Add storefront photos"><div style="display:flex;gap:8px;margin:12px 0"><input data-url type="url" placeholder="https://… image URL" aria-label="Photo URL" style="color:#0f172a;flex:1;min-width:0"><button data-add type="button" class="btn">Add URL</button></div><div data-photos style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px"></div><p data-message role="status"></p><div style="display:flex;gap:12px;margin-top:18px"><button data-save type="button" class="btn bg-blue-600 text-white">Save Photos</button><button data-close type="button" class="btn">Close</button></div>';document.body.append(dialog);
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 dialog.querySelector('[data-files]').onchange=e=>{try{const files=Array.from(e.target.files);if(photos.length+files.length>10)throw Error('Maximum 10 photos. Remove a photo first.');for(const f of files)if(!['image/jpeg','image/png','image/webp'].includes(f.type)||!f.size||f.size>5*1024*1024)throw Error('Use JPG, PNG or WebP files up to 5 MB each.');for(const file of files)photos.push({file,preview:URL.createObjectURL(file)});message('Photos ready to save.');render()}catch(e){message(e.message)}finally{e.target.value=''}};
 dialog.querySelector('[data-add]').onclick=()=>{const input=dialog.querySelector('[data-url]'),url=safe(input.value.trim());if(!url||url.length>2000){message('Enter a complete http(s) image URL.');return}if(photos.length>=10){message('Maximum 10 photos.');return}if(!photos.some(p=>p.url===url))photos.push({url});input.value='';render()};
 dialog.querySelector('[data-save]').onclick=save;
 }
 photos=(current.image_urls?.length?current.image_urls:[current.image_url]).filter(Boolean).map(url=>({url}));dialog.querySelector('[data-title]').textContent=current.title;message('');dialog.querySelector('[data-files]').value='';render();dialog.showModal();
}
async function save(){
 if(busy||!isCloudAdmin)return;busy=true;for(const n of dialog.querySelectorAll('button,input'))n.disabled=true;
 try{for(const p of photos){if(p.url)continue;message('Uploading photos…');const ext=p.file.type==='image/png'?'png':p.file.type==='image/webp'?'webp':'jpg';p.path ||= current.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from('product-images').upload(p.path,p.file,{upsert:true,contentType:p.file.type});if(error)throw error;p.url=sb.storage.from('product-images').getPublicUrl(p.path).data.publicUrl}
 const urls=photos.map(p=>p.url);const {error}=await sb.from('store_items').update({image_urls:urls,image_url:urls[0]||''}).eq('id',current.id);if(error)throw error;current.image_urls=urls;current.image_url=urls[0]||'';message('Photos saved to the customer storefront.');await fetchInventory();
 }catch(e){message('Could not save: '+e.message+' You can retry without uploading saved photos again.')}finally{busy=false;for(const n of dialog.querySelectorAll('button,input'))n.disabled=false;render()}
}
window.AJDStorePhotoManager={open};
})();
