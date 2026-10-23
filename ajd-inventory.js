(function AJDInventoryApp(){
'use strict';
const URL_SUPABASE='https://vxpufrahrnwmtgltjstd.supabase.co';
const KEY_SUPABASE='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const $=id=>document.getElementById(id);
const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(x)||0);
const digits=x=>new Intl.NumberFormat('en-US').format(Number(x)||0);
const table='ajd_parts_inventory';
let sb=null,records=[],store=new Map(),admin=false,busy=false,photoFile=null,previewBlob='',returnFocus=null;
function dom(tag,label,cls){const e=document.createElement(tag);if(label!==undefined&&label!==null)e.textContent=String(label);if(cls)e.className=cls;return e}
function message(msg,error=false){
 const e=$('message');e.hidden=false;e.textContent=String(msg);e.className='inv-message'+(error?' error':'');
 if(error)e.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function clearMessage(){$('message').hidden=true}
function status(msg){$('loading').textContent=msg||''}
function lock(reason){
 admin=false;records=[];store=new Map();$('appContent').hidden=true;$('accessBlock').hidden=false;
 $('accessMessage').textContent=reason||'Sign in to the admin dashboard first.';
}
function safeUrl(s){
 if(!String(s||'').trim())return '';
 try{const u=new URL(String(s).trim());return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}
}
function allowedPhoto(file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP photo.');
 if(file.size>5*1024*1024)throw Error('Photos must be 5 MB or smaller.');
}
function releasePhoto(){
 if(previewBlob){URL.revokeObjectURL(previewBlob);previewBlob=''}
 $('imagePreviewWrap').hidden=true;$('imagePreview').removeAttribute('src');
}
function previewPhoto(){
 releasePhoto();
 const url=photoFile?(previewBlob=URL.createObjectURL(photoFile)):safeUrl($('imageUrl').value);
 if(url){$('imagePreview').src=url;$('imagePreviewWrap').hidden=false}
}
function integer(id){
 const n=Number($(id).value);
 if(!Number.isSafeInteger(n)||n<0||n>1000000)throw Error('Stock numbers must be whole numbers between 0 and 1,000,000.');
 return n
}
function nonnegative(id){
 const n=Number($(id).value);
 if(!Number.isFinite(n)||n<0||n>999999999.99)throw Error('Enter a valid nonnegative cost or price.');
 return n
}
function payloadFor(editing){
 const name=$('itemName').value.trim();
 if(!name||name.length>240)throw Error('Enter an item name.');
 const supplierUrl=$('supplierUrl').value.trim();
 const photoUrl=$('imageUrl').value.trim();
 if(supplierUrl&&!safeUrl(supplierUrl))throw Error('Supplier URL must start with http:// or https://.');
 if(photoUrl&&!safeUrl(photoUrl)&&!photoFile)throw Error('Use a public http(s) photo URL or choose an image file.');
 const p={
   item_name:name,item_type:$('itemType').value,sku:$('sku').value.trim(),
   brand:$('brand').value.trim(),compatible_device:$('compatibleDevice').value.trim(),
   reorder_point:integer('reorderPoint'),
   unit_cost:nonnegative('unitCost'),sale_price:nonnegative('salePrice'),
   condition:$('condition').value,supplier:$('supplier').value.trim(),
   supplier_url:supplierUrl,storage_location:$('storageLocation').value.trim(),
   public_description:$('publicDescription').value.trim(),notes:$('notes').value.trim(),
   image_url:photoUrl
 };
 if(!editing)p.quantity=integer('quantity');
 return p
}
function linked(item){return item.store_item_id?store.get(item.store_item_id):null}
function live(item){return Boolean(!item.archived&&linked(item)&&linked(item).status!=='hidden')}
function low(item){return item.quantity<=item.reorder_point}
function setStats(){
 const active=records.filter(r=>!r.archived);
 $('invSkuTotal').textContent=digits(active.length);
 $('invUnitTotal').textContent=digits(active.reduce((sum,r)=>sum+Number(r.quantity),0));
 $('invLowStock').textContent=digits(active.filter(low).length);
 $('invStockValue').textContent=money(active.reduce((sum,r)=>sum+Number(r.unit_cost)*r.quantity,0));
 $('invLiveCount').textContent=digits(active.filter(live).length);
}
function filtered(){
 const type=$('typeFilter').value,state=$('statusFilter').value,q=$('search').value.trim().toLowerCase();
 const sort=$('sortFilter').value;
 const rows=records.filter(r=>{
  if(type!=='all'&&r.item_type!==type)return false;
  if(state==='active'&&r.archived)return false;
  if(state==='archived'&&!r.archived)return false;
  if(state==='low'&&(r.archived||!low(r)))return false;
  if(state==='out'&&(r.archived||r.quantity!==0))return false;
  if(state==='live'&&!live(r))return false;
  if(state==='hidden'&&(!linked(r)||linked(r).status!=='hidden'))return false;
  if(state==='unpublished'&&(r.archived||r.store_item_id))return false;
  return [r.item_name,r.item_type,r.brand,r.sku,r.compatible_device,r.supplier,r.storage_location].join(' ').toLowerCase().includes(q);
 });
 return rows.sort((a,b)=>{
  if(sort==='name')return a.item_name.localeCompare(b.item_name);
  if(sort==='quantity-low')return a.quantity-b.quantity;
  if(sort==='quantity-high')return b.quantity-a.quantity;
  if(sort==='value')return b.quantity*b.unit_cost-a.quantity*a.unit_cost;
  return new Date(b.updated_at)-new Date(a.updated_at);
 })
}
function button(label,cls,action){const b=dom('button',label,cls);b.type='button';b.addEventListener('click',action);return b}
function pill(label,cls){return dom('span',label,'inv-tag'+(cls?' '+cls:''))}
function renderCard(r){
 const card=dom('article',null,'inv-item'),header=dom('div',null,'inv-item-header');
 const photo=dom('div',null,'inv-item-img'),imgUrl=safeUrl(r.image_url);
 if(imgUrl){
  const img=dom('img');img.src=imgUrl;img.alt=r.item_name;img.loading='lazy';
  img.onerror=()=>{photo.textContent=r.item_type==='Accessory'?'🔌':'🧰'};
  photo.appendChild(img);
 }else photo.textContent=r.item_type==='Accessory'?'🔌':r.item_type==='Part'?'🧰':'📦';
 const name=dom('div',null,'inv-item-name');
 name.append(dom('h3',r.item_name),dom('small',[r.brand,r.compatible_device?'Fits '+r.compatible_device:''].filter(Boolean).join(' · ')));
 const tags=dom('div',null,'inv-item-tags');
 tags.append(pill({Part:'🧰 Part',Accessory:'🔌 Accessory',Tool:'🔧 Tool',Supply:'📦 Supply',Other:'Other'}[r.item_type]||r.item_type));
 if(r.archived)tags.append(pill('Archived','is-hidden'));
 else if(r.quantity===0)tags.append(pill('Out of stock','is-out'));
 else if(low(r))tags.append(pill('Low stock','is-low'));
 else tags.append(pill('In stock','is-live'));
 const shop=linked(r);
 if(shop)tags.append(pill(shop.status==='hidden'?'Store: Hidden':shop.status==='out_of_stock'?'Store: Out of stock':'Store: Live',shop.status==='hidden'?'is-hidden':'is-live'));
 else tags.append(pill('Private inventory'));
 name.appendChild(tags);header.append(photo,name);
 const stats=dom('div',null,'inv-item-stats');
 for(const [label,value] of [['On Hand',digits(r.quantity)],['Cost / Unit',money(r.unit_cost)],['Store Price',money(r.sale_price)]]){
  const item=dom('div',null,'inv-mini-stat');item.append(dom('small',label),dom('strong',value));stats.appendChild(item)
 }
 const details=dom('div',null,'inv-item-details');
 for(const value of [r.sku?'SKU '+r.sku:'',r.storage_location?'Bin '+r.storage_location:'',r.supplier?'Supplier '+r.supplier:'','Reorder at '+r.reorder_point,shop?.reserved_quantity?shop.reserved_quantity+' reserved':''].filter(Boolean))details.appendChild(dom('span',value));
 const actions=dom('div',null,'inv-item-buttons');
 actions.appendChild(button('✎ Edit','',()=>openEditor(r)));
 if(!r.archived)actions.appendChild(button('± Adjust Stock','',()=>openAdjust(r)));
 actions.appendChild(button('↺ History','',()=>showHistory(r)));
 if(r.archived)actions.appendChild(button('↩ Restore','',()=>restore(r)));
 else{
  actions.appendChild(button(shop?.status==='hidden'?'↗ Republish':shop?'↻ Publish / Sync':'↗ Publish to Store','inv-publish',()=>publish(r)));
  if(shop&&shop.status!=='hidden')actions.appendChild(button('Hide from Store','inv-unpublish',()=>unpublish(r)));
  if(shop&&shop.status!=='hidden'){const a=dom('a','Store ↗');a.href='/store';a.target='_blank';a.rel='noopener noreferrer';actions.appendChild(a)}
  actions.appendChild(button('Archive','inv-archive',()=>archive(r)));
 }
 card.append(header,stats,details,actions);
 return card;
}
function render(){
 setStats();const rows=filtered(),root=$('inventoryGrid');root.replaceChildren();
 $('entryCount').textContent=rows.length+' / '+records.length;
 $('filterSummary').textContent=$('statusFilter').selectedOptions?.[0]?.textContent||'Inventory records';
 if(!rows.length){const box=dom('div',null,'inv-empty');box.append(dom('strong',records.length?'Nothing matches these filters':'Your stockroom is ready'),dom('p',records.length?'Change your search or filters.':'Add repair parts and accessories to start tracking your inventory.'));root.appendChild(box)}
 else for(const item of rows)root.appendChild(renderCard(item));
}
function openEditor(row){
 if(!admin||busy)return;
 clearMessage();$('editorForm').reset();
 const editing=Boolean(row);
 $('editId').value=row?.id||'';
 $('formHeading').textContent=editing?'Edit Inventory Item':'Add an Inventory Item';
 $('quantityLabel').firstChild.textContent=editing?'Current Quantity (change with Adjust Stock)':'Opening Quantity *';
 $('quantity').readOnly=editing;
 $('quantity').value=row?.quantity??0;
 $('editorHint').textContent=editing?'Use Adjust Stock to record deliveries, repairs, sales or losses. Stock history and linked storefront quantity are updated automatically.':'Choose Publish to Customer Storefront if you also want the item listed for customers.';
 const fields={itemName:'item_name',itemType:'item_type',sku:'sku',brand:'brand',compatibleDevice:'compatible_device',reorderPoint:'reorder_point',unitCost:'unit_cost',salePrice:'sale_price',condition:'condition',supplier:'supplier',supplierUrl:'supplier_url',storageLocation:'storage_location',publicDescription:'public_description',imageUrl:'image_url',notes:'notes'};
 if(editing){
  for(const [id,key] of Object.entries(fields))$(id).value=row[key]??'';
  if(![...$('condition').options].some(o=>o.value===row.condition)){
   const opt=dom('option',row.condition);opt.value=row.condition;$('condition').appendChild(opt);$('condition').value=row.condition;
  }
 }
 $('publishAfterSave').checked=false;
 $('publishAfterSave').closest('label').hidden=Boolean(row?.archived);
 photoFile=null;$('imageFile').value='';previewPhoto();
 $('editorPanel').hidden=false;$('editorPanel').scrollIntoView({behavior:'smooth',block:'start'});$('itemName').focus();
}
function closeEditor(){$('editorPanel').hidden=true;releasePhoto();photoFile=null;$('imageFile').value=''}
async function uploadPhoto(file,id){
 allowedPhoto(file);
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
 const key='inventory/'+id+'/'+crypto.randomUUID()+'.'+ext;
 const {error}=await sb.storage.from('product-images').upload(key,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
 if(error)throw Error('Photo upload failed: '+error.message);
 const {data}=sb.storage.from('product-images').getPublicUrl(key);
 if(!data?.publicUrl)throw Error('Unable to retrieve uploaded photo URL.');
 return data.publicUrl;
}
async function save(event){
 event.preventDefault();if(!admin||busy)return;
 let id=$('editId').value,editing=Boolean(id),saved=false;
 const alsoPublish=$('publishAfterSave').checked;
 try{
  const data=payloadFor(editing);
  if(alsoPublish&&data.sale_price===0&&!confirm('This will publish to the storefront at $0.00. Continue?'))return;
  if(data.sku&&records.some(r=>r.id!==id&&!r.archived&&r.sku.toLowerCase()===data.sku.toLowerCase())&&!confirm('This SKU already exists. Save another item with the same SKU?'))return;
  busy=true;$('saveButton').disabled=true;status('Saving inventory to Supabase…');
  if(!id)id=crypto.randomUUID();
  if(photoFile)data.image_url=await uploadPhoto(photoFile,id);
  const request=editing?sb.from(table).update(data).eq('id',id):sb.from(table).insert({...data,id});
  const {data:reply,error}=await request.select('id').single();
  if(error)throw error;
  if(!reply?.id)throw Error('Could not confirm the inventory was saved.');
  saved=true;let published=false,publishError='';
  if(alsoPublish){
   status('Publishing to your customer storefront…');
   const {error:err}=await sb.rpc('ajd_inventory_publish',{p_inventory_id:id});
   if(err)publishError=err.message;
   else published=true;
  }
  closeEditor();await load();
  message(publishError?'Inventory saved privately, but publishing failed: '+publishError:published?'Inventory saved and published to the customer storefront.':'Inventory saved. Linked listings update automatically when you edit stock or price.',Boolean(publishError));
 }catch(err){message('Could not save inventory: '+err.message,true);if(!saved)$('editorPanel').hidden=false}
 finally{busy=false;$('saveButton').disabled=false;status('')}
}
function openAdjust(row){
 if(!admin||busy||row.archived)return;
 returnFocus=document.activeElement;$('adjustForm').reset();$('adjustItemId').value=row.id;
 $('adjustItemName').textContent=row.item_name+' · On hand: '+digits(row.quantity);
 $('adjustOverlay').hidden=false;$('adjustQuantity').focus();
}
function closeAdjust(){$('adjustOverlay').hidden=true;returnFocus?.focus?.({preventScroll:true})}
async function adjust(event){
 event.preventDefault();if(!admin||busy)return;
 const id=$('adjustItemId').value,qty=Number($('adjustQuantity').value);
 const dir=document.querySelector('input[name="adjustDirection"]:checked')?.value;
 const reason=$('adjustReason').value,details=$('adjustDetails').value.trim();
 if(!Number.isSafeInteger(qty)||qty<1||qty>1000000)return message('Enter a whole quantity of at least 1.',true);
 if(!reason)return message('Select a reason for this stock adjustment.',true);
 const change=dir==='remove'?-qty:qty,current=records.find(r=>r.id===id);
 if(current&&current.quantity+change<0)return message('You cannot remove more units than you have on hand.',true);
 try{
  busy=true;$('adjustSaveButton').disabled=true;status('Recording stock movement…');
  const {error}=await sb.rpc('ajd_inventory_adjust_stock',{p_inventory_id:id,p_change:change,p_reason:(reason+(details?' — '+details:'')).slice(0,180)});
  if(error)throw error;
  closeAdjust();await load();
  message((change<0?'Removed ':'Added ')+qty+' units. Change recorded in stock history; any linked storefront listing has been updated.');
 }catch(err){message('Stock adjustment failed: '+err.message,true)}
 finally{busy=false;$('adjustSaveButton').disabled=false;status('')}
}
function closeHistory(){$('historyOverlay').hidden=true;returnFocus?.focus?.({preventScroll:true})}
async function showHistory(row){
 if(!admin)return;
 returnFocus=document.activeElement;$('historyItemName').textContent=row.item_name;
 $('historyList').textContent='Loading stock history…';$('historyOverlay').hidden=false;$('closeHistory').focus();
 try{
  const {data,error}=await sb.from('ajd_parts_inventory_movements')
    .select('id,quantity_before,quantity_after,quantity_delta,reason,created_at')
    .eq('inventory_item_id',row.id).order('created_at',{ascending:false}).limit(60);
  if(error)throw error;
  const box=$('historyList');box.replaceChildren();
  if(!data?.length){box.appendChild(dom('p','No stock movements yet.','sub'));return}
  for(const r of data){
   const elItem=dom('div',null,'inv-history-item'),left=dom('div');
   left.append(dom('strong',r.reason),dom('small',new Date(r.created_at).toLocaleString()+' · '+r.quantity_before+' → '+r.quantity_after+' units'));
   elItem.append(left,dom('span',(r.quantity_delta>0?'+':'')+r.quantity_delta,'inv-history-qty '+(r.quantity_delta>=0?'add':'remove')));
   box.appendChild(elItem);
  }
 }catch(err){$('historyList').textContent='Could not load movement history: '+err.message}
}
async function publish(row){
 if(!admin||busy||row.archived)return;
 if(row.sale_price===0&&!confirm('This item will be published with a $0.00 selling price. Continue?'))return;
 try{
  busy=true;status('Publishing your inventory item…');
  const {error}=await sb.rpc('ajd_inventory_publish',{p_inventory_id:row.id});
  if(error)throw error;
  await load();message(row.store_item_id?'Storefront listing synchronized and made visible.':'Item published to your customer storefront.');
 }catch(err){message('Publishing failed: '+err.message,true)}
 finally{busy=false;status('')}
}
async function unpublish(row){
 if(!admin||busy||!confirm('Hide '+row.item_name+' from the storefront? It will remain in your private inventory.'))return;
 try{
  busy=true;status('Hiding storefront listing…');
  const {error}=await sb.rpc('ajd_inventory_unpublish',{p_inventory_id:row.id});
  if(error)throw error;await load();message('Listing hidden from customers; private inventory is retained.');
 }catch(err){message('Could not hide listing: '+err.message,true)}
 finally{busy=false;status('')}
}
async function archive(row){
 if(!admin||busy||!confirm('Archive '+row.item_name+'? This hides its storefront listing and preserves your private stock history.'))return;
 try{
  busy=true;status('Archiving inventory…');
  const {error}=await sb.rpc('ajd_inventory_archive',{p_inventory_id:row.id});
  if(error)throw error;await load();message('Item archived. Use the Archived filter to restore it.');
 }catch(err){message('Archiving failed: '+err.message,true)}
 finally{busy=false;status('')}
}
async function restore(row){
 if(!admin||busy)return;
 try{
  busy=true;status('Restoring item…');
  const {error}=await sb.from(table).update({archived:false}).eq('id',row.id);
  if(error)throw error;await load();message('Item restored privately. Publish separately if you want it visible to customers.');
 }catch(err){message('Restore failed: '+err.message,true)}
 finally{busy=false;status('')}
}
function exportCSV(){
 if(!admin)return;
 const cols=[['item_name','Item'],['item_type','Type'],['sku','SKU'],['brand','Brand'],['compatible_device','Compatible Device'],['quantity','Quantity'],['reorder_point','Reorder Level'],['unit_cost','Purchase Cost'],['sale_price','Selling Price'],['condition','Condition'],['supplier','Supplier'],['supplier_url','Supplier URL'],['storage_location','Location'],['public_description','Store Description'],['notes','Private Notes'],['store_item_id','Storefront ID'],['archived','Archived']];
 const quote=value=>{
  let s=String(value??'');if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
 };
 const text=[cols.map(x=>quote(x[1])).join(',')];
 for(const row of filtered())text.push(cols.map(x=>quote(row[x[0]])).join(','));
 const blob=new Blob(['\ufeff'+text.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=dom('a');a.href=url;a.download='AJD-inventory-'+new Date().toLocaleDateString('en-CA')+'.csv';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1600);
 message('Inventory CSV exported. It contains private purchase costs and suppliers—store it securely.');
}
async function load(){
 if(!admin)return;status('Loading inventory from Supabase…');
 try{
  const {data,error}=await sb.from(table).select('*').order('updated_at',{ascending:false}).limit(3000);
  if(error)throw error;
  const next=data||[],map=new Map(),ids=[...new Set(next.map(r=>r.store_item_id).filter(Boolean))];
  for(let i=0;i<ids.length;i+=100){
   const {data:list,error:err}=await sb.from('store_items').select('id,status,reserved_quantity,stock_quantity').in('id',ids.slice(i,i+100));
   if(err)throw err;for(const row of list||[])map.set(row.id,row);
  }
  records=next;store=map;render();
 }catch(err){$('inventoryGrid').replaceChildren(dom('div','Could not load inventory: '+err.message,'inv-empty'));message('Inventory connection error: '+err.message,true)}
 finally{status('')}
}
async function init(){
 $('year').textContent=new Date().getFullYear();
 $('newButton').addEventListener('click',()=>openEditor(null));$('heroNewButton').addEventListener('click',()=>openEditor(null));
 $('cancelButton').addEventListener('click',closeEditor);$('cancelBottom').addEventListener('click',closeEditor);
 $('refreshButton').addEventListener('click',load);$('exportButton').addEventListener('click',exportCSV);
 $('editorForm').addEventListener('submit',save);
 $('imageFile').addEventListener('change',event=>{
  const next=event.target.files?.[0]||null;
  try{allowedPhoto(next);photoFile=next;previewPhoto()}catch(err){photoFile=null;event.target.value='';message(err.message,true)}
 });
 $('imageUrl').addEventListener('change',()=>{if(!photoFile)previewPhoto()});
 for(const id of ['search','typeFilter','statusFilter','sortFilter'])$(id).addEventListener(id==='search'?'input':'change',render);
 $('adjustForm').addEventListener('submit',adjust);
 $('closeAdjust').addEventListener('click',closeAdjust);$('closeHistory').addEventListener('click',closeHistory);
 $('adjustOverlay').addEventListener('click',e=>{if(e.target===$('adjustOverlay'))closeAdjust()});
 $('historyOverlay').addEventListener('click',e=>{if(e.target===$('historyOverlay'))closeHistory()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('adjustOverlay').hidden)closeAdjust();if(!$('historyOverlay').hidden)closeHistory()}});
 try{
  if(!window.supabase?.createClient)throw Error('Supabase could not load. Check your connection.');
  sb=window.supabase.createClient(URL_SUPABASE,KEY_SUPABASE);
  const {data,error}=await sb.auth.getUser();if(error)throw error;
  if(!data?.user)throw Error('Sign in to the main admin dashboard first.');
  const {data:approved,error:authError}=await sb.rpc('ajd_is_admin');
  if(authError)throw authError;
  if(approved!==true)throw Error('This account is not approved as an administrator.');
  admin=true;$('accessBlock').hidden=true;$('appContent').hidden=false;
  sb.auth.onAuthStateChange((_event,session)=>{if(!session)lock('Signed out. Sign in again on the main admin page.')});
  await load();
 }catch(err){lock(err.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();