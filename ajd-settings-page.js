(function AJDSettingsPage(){
'use strict';
const T=window.AJDTools,{read,save,node,money,message,$}=T;
const PHONE_KEY='ajd_shop_phone',PHONE_PENDING='ajd_shop_phone_pending_v1';
const EMAIL_KEY='ajd_shop_email',EMAIL_PENDING='ajd_shop_email_pending_v1';
const LABOR='ajd_labor_presets_v2';
const DEFAULT=[
 {id:'screen',name:'Screen Replacement',price:60},
 {id:'battery',name:'Battery Replacement',price:40},
 {id:'charging',name:'Charging Port Repair',price:55},
 {id:'backglass',name:'Back Glass Replacement',price:75},
 {id:'diagnostic',name:'Diagnostic Service',price:25},
 {id:'custom',name:'Custom Repair',price:0}
];
let busy=false;
function showPresets(){
 const list=$('laborList'),raw=read(LABOR,DEFAULT),presets=Array.isArray(raw)?raw:DEFAULT;
 list.replaceChildren();
 if(!presets.length)list.append(node('p','No labor presets saved yet.','list-empty'));
 for(const item of presets){
  const row=node('div',null,'preset-entry');
  const info=node('div');info.append(node('strong',item.name),node('small',money(item.price)));
  const controls=node('div',null,'tools-actions');
  const edit=node('button','✎ Edit','tools-button');edit.type='button';edit.addEventListener('click',()=>{$('laborName').value=item.name;$('laborPrice').value=item.price;$('laborName').focus()});
  const del=node('button','✕ Remove','tools-button danger');del.type='button';del.addEventListener('click',()=>removePreset(item.id));
  controls.append(edit,del);row.append(info,controls);list.append(row);
 }
}
function addPreset(event){
 event.preventDefault();
 const name=$('laborName').value.trim(),price=Number($('laborPrice').value);
 if(!name||name.length>90||!Number.isFinite(price)||price<0||price>100000){message('Enter a valid repair type and labor price.',true);return}
 const raw=read(LABOR,DEFAULT),items=Array.isArray(raw)?raw:DEFAULT;
 const existing=items.find(item=>item.name.toLowerCase()===name.toLowerCase());
 if(existing)existing.price=Math.round(price*100)/100;
 else items.push({id:'labor_'+crypto.randomUUID(),name,price:Math.round(price*100)/100});
 save(LABOR,items);$('laborForm').reset();showPresets();message('Labor preset saved. It will be available when you return to repair check-in.');
}
function removePreset(id){
 if(!confirm('Remove this labor preset?'))return;
 const records=read(LABOR,DEFAULT);
 save(LABOR,records.filter(x=>x.id!==id));showPresets();message('Labor preset removed.');
}
async function loadContacts(){
 const {data,error}=await T.client.from('shop_settings').select('phone,email').eq('id','business').maybeSingle();
 if(error)message('Showing saved settings from this device; cloud read failed: '+error.message,true);
 const pendingPhone=localStorage.getItem(PHONE_PENDING),pendingEmail=localStorage.getItem(EMAIL_PENDING);
 const phone=pendingPhone??data?.phone??localStorage.getItem(PHONE_KEY)??'(786) 970-7779';
 const email=pendingEmail??data?.email??localStorage.getItem(EMAIL_KEY)??'';
 $('settingPhone').value=phone;$('settingEmail').value=email;
 if(data&&pendingPhone===null)localStorage.setItem(PHONE_KEY,data.phone||'');
 if(data&&pendingEmail===null){
  if(data.email)localStorage.setItem(EMAIL_KEY,data.email);
  else localStorage.removeItem(EMAIL_KEY);
 }
 $('accountEmailDisplay').textContent=T.user?.email||'Signed-in administrator';
 showPresets();
}
async function saveContacts(event){
 event.preventDefault();if(busy)return;
 const phone=$('settingPhone').value.trim(),email=$('settingEmail').value.trim().toLowerCase();
 const digits=phone.replace(/\D/g,'');
 if(!/^[+()\d.\s-]{7,40}$/.test(phone)||digits.length<7||digits.length>15){message('Phone must contain 7–15 digits.',true);return}
 if(email&&(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254)){message('Enter a valid email address or clear the field.',true);return}
 busy=true;$('saveContacts').disabled=true;
 try{
  if(phone!==localStorage.getItem(PHONE_KEY)){
   localStorage.setItem(PHONE_KEY,phone);
   localStorage.setItem(PHONE_PENDING,phone);
  }
  if(email!==(localStorage.getItem(EMAIL_KEY)||'')){
   if(email)localStorage.setItem(EMAIL_KEY,email);else localStorage.removeItem(EMAIL_KEY);
   localStorage.setItem(EMAIL_PENDING,email);
  }
  const errors=[];let saved=0;
  const pendingPhone=localStorage.getItem(PHONE_PENDING);
  if(pendingPhone!==null){
   const {data,error}=await T.client.from('shop_settings').update({phone:pendingPhone,updated_at:new Date().toISOString()}).eq('id','business').select('id').maybeSingle();
   if(error||!data)errors.push('Phone: '+(error?.message||'Shop settings record not found'));
   else{if(localStorage.getItem(PHONE_PENDING)===pendingPhone)localStorage.removeItem(PHONE_PENDING);saved++}
  }
  const pendingEmail=localStorage.getItem(EMAIL_PENDING);
  if(pendingEmail!==null){
   const {data,error}=await T.client.from('shop_settings').update({email:pendingEmail||null,updated_at:new Date().toISOString()}).eq('id','business').select('id').maybeSingle();
   if(error||!data)errors.push('Email: '+(error?.message||'Shop settings record not found'));
   else{if(localStorage.getItem(EMAIL_PENDING)===pendingEmail)localStorage.removeItem(EMAIL_PENDING);saved++}
  }
  message(errors.length?'Saved locally; cloud publication needs attention: '+errors.join('; '):'Shop contact details saved and published. '+saved+' change(s) synchronized.',Boolean(errors.length));
 }catch(error){message('Unable to save shop contacts: '+error.message,true)}
 finally{busy=false;$('saveContacts').disabled=false}
}
async function changeEmail(event){
 event.preventDefault();
 const email=$('newAccountEmail').value.trim();
 const {error}=await T.client.auth.updateUser({email});
 if(error)message('Could not change login email: '+error.message,true);
 else{message('Login email change requested. Supabase may require email verification.');$('newAccountEmail').value=''}
}
async function changePassword(event){
 event.preventDefault();const user=T.user;
 const current=$('currentAccountPassword').value,next=$('newAccountPassword').value,confirmation=$('confirmAccountPassword').value;
 if(!user?.email||next.length<8||next!==confirmation||next===current){message('Enter your current password and matching new password (8+ characters).',true);return}
 try{
  const {data,error}=await T.client.auth.signInWithPassword({email:user.email,password:current});
  if(error||data?.user?.id!==user.id)throw Error('Current password could not be verified.');
  const {error:updateError}=await T.client.auth.updateUser({password:next});
  if(updateError)throw updateError;
  $('accountPasswordForm').reset();message('Cloud login password changed.');
 }catch(err){message('Password was not changed: '+err.message,true)}
}
function exportBackup(){
 const record={version:2,exported_at:new Date().toISOString(),repairs:read('ajd_repairs_backup',[]),purchaseRequests:read('ajd_purchase_requests',[]),
  presets:read(LABOR,DEFAULT),shopPhone:localStorage.getItem(PHONE_KEY)||'',shopEmail:localStorage.getItem(EMAIL_KEY)||''};
 const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='AJD_Backup_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 message('Your local backup has been exported. Store it securely.');
}
async function importBackup(event){
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>12*1024*1024)throw Error('File is larger than the 12 MB limit.');
  const record=JSON.parse(await file.text());
  if(!Array.isArray(record.repairs))throw Error('This is not a recognized AJD backup.');
  if(!confirm('Merge '+record.repairs.length+' repair tickets into this device? Existing local tickets with the same ID may be replaced. Cloud records will NOT be overwritten.'))return;
  const existing=read('ajd_repairs_backup',[]);
  const merged=new Map((Array.isArray(existing)?existing:[]).map(x=>[x.id,x]));
  for(const job of record.repairs)if(job&&typeof job.id==='string'&&job.id.length<=100)merged.set(job.id,job);
  save('ajd_repairs_backup',[...merged.values()]);
  if(Array.isArray(record.presets))save(LABOR,record.presets);
  if(Array.isArray(record.purchaseRequests)){
   const before=read('ajd_purchase_requests',[]),map=new Map((Array.isArray(before)?before:[]).map(x=>[x.id,x]));
   for(const q of record.purchaseRequests)if(q&&typeof q.id==='string')map.set(q.id,q);
   save('ajd_purchase_requests',[...map.values()]);
  }
  showPresets();message('Backup imported locally. Existing cloud data was not overwritten.');
 }catch(e){message('Import failed: '+e.message,true)}
 finally{event.target.value=''}
}
async function signOut(){await T.client.auth.signOut();location.href='/'}
function start(){
 $('settingsContactForm').addEventListener('submit',saveContacts);
 $('laborForm').addEventListener('submit',addPreset);
 $('themeMode').addEventListener('change',event=>{
  const mode=event.target.value;if(!['system','light','dark','ultra-dark'].includes(mode))return;
  localStorage.setItem('ajd_theme_preference',mode);T.theme();message('Appearance updated on this device.');
 });
 $('backupExport').addEventListener('click',exportBackup);
 $('backupImport').addEventListener('change',importBackup);
 $('accountEmailForm').addEventListener('submit',changeEmail);
 $('accountPasswordForm').addEventListener('submit',changePassword);
 $('toolsSignOut').addEventListener('click',signOut);
 void loadContacts();
}
document.addEventListener('ajd-admin-ready',start);
})();