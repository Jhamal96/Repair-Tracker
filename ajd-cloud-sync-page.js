(function AJDCloudSyncPage(){
'use strict';
const T=window.AJDTools,{read,save,node,message,$}=T;
const REPAIR_KEY='ajd_pending_repairs_v3',LOCAL_REPAIRS='ajd_repairs_backup';
const LINKS='ajd_managed_links_v1',LINK_QUEUE='ajd_links_pending_v1';
const PHONE_PENDING='ajd_shop_phone_pending_v1',EMAIL_PENDING='ajd_shop_email_pending_v1';
let running=false;
const queued=(key)=>{const data=read(key,[]);return Array.isArray(data)?data:[]};
function status(){
 const repair=queued(REPAIR_KEY).length,links=queued(LINK_QUEUE).length;
 const phone=localStorage.getItem(PHONE_PENDING)!==null?1:0;
 const email=localStorage.getItem(EMAIL_PENDING)!==null?1:0;
 $('repairsPendingCount').textContent=repair;
 $('linksPendingCount').textContent=links;
 $('contactsPendingCount').textContent=phone+email;
 const total=repair+links+phone+email;
 $('syncStatusHeading').textContent=total?total+' pending change'+(total===1?'':'s')+' on this device.':'Your local queues are clear.';
}
function payload(job){
 const props=['id','customer_name','customer_phone','make_model','issue','part_note','part_cost','labor_cost','amount','discount','deposit_amount','payment_status','payment_info','status','supplier_links','created_at','picked_up_at','repair_type','parts'];
 return Object.fromEntries(props.filter(x=>job[x]!==undefined).map(x=>[x,job[x]]));
}
function assignInvoice(id,number){
 if(!number)return;
 const local=read(LOCAL_REPAIRS,[]);if(!Array.isArray(local))return;
 let changed=false;
 for(const record of local)if(record?.id===id&&record.invoice_number!==number){record.invoice_number=number;changed=true}
 if(changed)save(LOCAL_REPAIRS,local);
}
async function pushRepairs(){
 let count=0;
 try{
  for(const operation of queued(REPAIR_KEY)){
   if(!operation||typeof operation.id!=='string')throw Error('A queued repair has an invalid ID.');
   const id=operation.id;let invoice='';
   if(operation.kind==='delete'){
    const {error}=await T.client.from('repairs').delete().eq('id',id);
    if(error)throw error;
   }else if(operation.job&&['insert','update'].includes(operation.kind)){
    const job=operation.job,details=payload(job);details.id=id;
    if(operation.kind==='insert'){
     const {data,error}=await T.client.from('repairs').insert(details).select('invoice_number').single();
     if(error?.code==='23505'){
      const {data:existing,error:lookupError}=await T.client.from('repairs').select('customer_name,customer_phone,make_model,invoice_number').eq('id',id).maybeSingle();
      if(lookupError)throw lookupError;
      if(!existing||existing.customer_name!==job.customer_name||existing.customer_phone!==job.customer_phone||existing.make_model!==job.make_model){
       throw Error('Repair ticket ID conflict. Keep this change queued and resolve it from the main dashboard.');
      }
      invoice=existing.invoice_number;
     }else if(error)throw error;
     else invoice=data?.invoice_number;
    }else{
     const {data,error}=await T.client.from('repairs').update(details).eq('id',id).select('invoice_number');
     if(error)throw error;
     if(data?.length)invoice=data[0].invoice_number;
     else{
      const {data:created,error:insertError}=await T.client.from('repairs').insert(details).select('invoice_number').single();
      if(insertError)throw insertError;invoice=created?.invoice_number;
     }
    }
   }else throw Error('Unrecognized repair operation: '+String(operation.kind));
   assignInvoice(id,invoice);
   const current=queued(REPAIR_KEY),matching=current.find(x=>x.id===id);
   if(matching&&JSON.stringify(matching)===JSON.stringify(operation))save(REPAIR_KEY,current.filter(x=>x.id!==id));
   count++;status();
  }
  return{count};
 }catch(error){return{count,error:error.message||String(error)}}
}
async function pushLinks(){
 let count=0;
 try{
  const pending=queued(LINK_QUEUE);
  if(!pending.length)return{count};
  const {error:marker}=await T.client.from('admin_links').upsert({id:'__initialized__',label:'Links initialized',url:'about:blank',icon:'',position:-9999},{onConflict:'id'});
  if(marker)throw marker;
  const local=read(LINKS,[]);
  for(const operation of pending){
   let error;
   if(operation.kind==='delete'){
    ({error}=await T.client.from('admin_links').delete().eq('id',operation.id));
   }else if(operation.kind==='upsert'&&operation.item&&T.safeUrl(operation.item.url)){
    const item=operation.item,position=Array.isArray(local)?local.findIndex(x=>x.id===item.id):0;
    ({error}=await T.client.from('admin_links').upsert({id:item.id,label:item.label,url:item.url,icon:item.icon||'',position},{onConflict:'id'}));
   }else throw Error('Invalid queued link change: '+String(operation.id));
   if(error)throw error;
   const latest=queued(LINK_QUEUE),current=latest.find(x=>x.id===operation.id);
   if(current&&JSON.stringify(current)===JSON.stringify(operation))save(LINK_QUEUE,latest.filter(x=>x.id!==operation.id));
   count++;status();
  }
  return{count};
 }catch(error){return{count,error:error.message||String(error)}}
}
async function pushContacts(){
 const errors=[];let count=0;
 const pendingPhone=localStorage.getItem(PHONE_PENDING);
 if(pendingPhone!==null){
  const digits=pendingPhone.replace(/\D/g,'');
  if(!/^[+()\d.\s-]{7,40}$/.test(pendingPhone)||digits.length<7||digits.length>15)errors.push('Shop phone has an invalid format.');
  else{
   const {data,error}=await T.client.from('shop_settings').update({phone:pendingPhone,updated_at:new Date().toISOString()}).eq('id','business').select('id').maybeSingle();
   if(error||!data)errors.push('Phone: '+(error?.message||'No shop settings row found'));
   else{if(localStorage.getItem(PHONE_PENDING)===pendingPhone)localStorage.removeItem(PHONE_PENDING);count++}
  }
 }
 const pendingEmail=localStorage.getItem(EMAIL_PENDING);
 if(pendingEmail!==null){
  if(pendingEmail&&(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(pendingEmail)||pendingEmail.length>254))errors.push('Business email format is invalid.');
  else{
   const {data,error}=await T.client.from('shop_settings').update({email:pendingEmail||null,updated_at:new Date().toISOString()}).eq('id','business').select('id').maybeSingle();
   if(error||!data)errors.push('Email: '+(error?.message||'No shop settings row found'));
   else{if(localStorage.getItem(EMAIL_PENDING)===pendingEmail)localStorage.removeItem(EMAIL_PENDING);count++}
  }
 }
 status();
 return{count,errors};
}
async function refresh(){
 if(!T.admin)return;
 status();
 const tables=[['cloudRepairCount','repairs'],['cloudLinkCount','admin_links'],['cloudRequestCount','store_purchase_requests']];
 await Promise.all(tables.map(async([id,table])=>{
  const {count,error}=await T.client.from(table).select('id',{head:true,count:'exact'});
  $(id).textContent=error?'Unavailable':String(count||0);
 }));
 const {data,error}=await T.client.from('shop_settings').select('phone,email').eq('id','business').maybeSingle();
 if(!error&&data){
  $('cloudPhoneValue').textContent=data.phone||'Not set';
  $('cloudEmailValue').textContent=data.email||'Not set';
 }
 status();
}
async function syncAll(){
 if(running||!T.admin)return;
 running=true;$('syncNowButton').disabled=true;$('syncNowButton').textContent='☁️ Synchronizing…';
 message('Publishing queued changes securely to Supabase…');
 try{
  const repairs=await pushRepairs(),links=await pushLinks(),contacts=await pushContacts();
  const errors=[repairs.error,links.error,...contacts.errors].filter(Boolean);
  const summary=[
   'Repair changes: '+repairs.count,
   'Links: '+links.count,
   'Contact updates: '+contacts.count
  ];
  message(summary.join(' · ')+(errors.length?' · Pending errors: '+errors.join('; '):' · Synchronization complete.'),Boolean(errors.length));
  await refresh();
 }catch(error){message('Cloud sync interrupted: '+error.message,true)}
 finally{running=false;$('syncNowButton').disabled=false;$('syncNowButton').textContent='☁️ Sync Now'}
}
function start(){
 $('syncNowButton').addEventListener('click',syncAll);
 $('refreshSyncButton').addEventListener('click',()=>{void refresh()});
 window.addEventListener('storage',event=>{
  if([REPAIR_KEY,LINK_QUEUE,PHONE_PENDING,EMAIL_PENDING].includes(event.key))status();
 });
 status();void refresh();
}
document.addEventListener('ajd-admin-ready',start);
})();