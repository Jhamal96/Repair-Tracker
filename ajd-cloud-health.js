/* AJD's Wireless Repairs: cloud status from real Supabase requests and local queues. */
(function AJDCloudHealth(){
 'use strict';
 const labels={healthy:'Healthy',syncing:'Syncing',attention:'Attention',critical:'Critical',offline:'Offline',disconnected:'Not syncing',checking:'Checking'};
 const resources={repairs:'Repairs',admin_links:'Quick links',shop_settings:'Shop contacts',store_items:'Store products',purchase_requests:'Customer requests',repair_requests:'Repair requests',store_purchase_requests:'Store requests',store_purchase_request_items:'Order details',ajd_todos:'To-do list',ajd_parts_inventory:'Parts inventory',ajd_parts_inventory_movements:'Stock history',business_expenses:'Expenses',planned_purchases:'Planned purchases',ajd_is_admin:'Administrator connection'};
 const queueKeys=['ajd_pending_repairs_v3','ajd_links_pending_v1','ajd_shop_phone_pending_v1','ajd_shop_email_pending_v1'];
 let access=null,client=null,lastSuccess=0,epoch=0,sequence=0,checking=false,mountPoint=null,button=null,panel=null;
 const active=new Map(),failures=new Map();
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 function pending(){
  let count=0;
  for(const key of queueKeys){try{const raw=localStorage.getItem(key);if(raw===null)continue;if(key.includes('pending_v1')&&!key.includes('links'))count++;else{const list=JSON.parse(raw);count+=Array.isArray(list)?list.length:1}}catch(_){count++}}
  return count;
 }
 function snapshot(){
  const queued=pending(),now=Date.now();let state,detail;
  if(navigator.onLine===false){state='offline';detail='This device is offline. Cloud changes cannot upload until the connection returns.'}
  else if(access===false){state='disconnected';detail='Sign in with your approved administrator account to connect to cloud sync.'}
  else if(failures.size){state='critical';detail=[...failures.values()].map(f=>f.label+' could not '+(f.write?'save':'load')+'.').join(' ')+' Open Cloud Sync to review and retry.'}
  else if([...active.values()].some(job=>now-job.started>20000)){state='attention';detail='The cloud is taking longer than usual to respond. Keep this page open while it finishes.'}
  else if(active.size||checking){state='syncing';detail='Checking the cloud or transferring changes. Keep this page open until syncing finishes.'}
  else if(access===null||!lastSuccess){state='checking';detail='Waiting for a successful administrator connection check.'}
  else if(queued){state='attention';detail=queued+' change'+(queued===1?' is':'s are')+' waiting to upload from this device. Open Cloud Sync and choose Sync Now.'}
  else if(now-lastSuccess>120000){state='attention';detail='The last successful cloud check is over two minutes old. Check the connection to confirm its status.'}
  else{state='healthy';detail='Cloud requests are succeeding, and no repair, link, or contact changes are waiting to upload on this device.'}
  return {state,label:labels[state],detail,pending:queued,active:active.size,lastSuccess,failures:failures.size};
 }
 function render(){
  const state=snapshot();
  if(button){
   button.dataset.state=state.state;
   button.querySelector('.ajd-health-label').textContent=state.label;
   button.title='Cloud sync: '+state.label+'. '+state.detail;
   button.setAttribute('aria-label','Cloud sync: '+state.label+'. Show connection details');
  }
  if(panel){
   panel.dataset.state=state.state;
   panel.querySelector('.ajd-health-state').textContent=state.label;
   panel.querySelector('.ajd-health-detail').textContent=state.detail;
   panel.querySelector('.ajd-health-queue').textContent=state.pending+' pending upload'+(state.pending===1?'':'s');
   panel.querySelector('.ajd-health-time').textContent=state.lastSuccess?'Last success: '+new Date(state.lastSuccess).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'No successful cloud check yet';
   const checkButton=panel.querySelector('button[data-health-check]');checkButton.disabled=checking||access!==true||navigator.onLine===false;
   checkButton.textContent=checking?'Checking…':'Check Connection';
  }
  document.querySelectorAll('[data-cloud-health-heading]').forEach(n=>{n.textContent='Cloud Sync · '+state.label;n.dataset.state=state.state});
  document.querySelectorAll('[data-cloud-health-detail]').forEach(n=>n.textContent=state.detail);
 }
 function setAccess(value){
  if(value===false&&access!==false){epoch++;active.clear();failures.clear();lastSuccess=0;checking=false}
  access=value;render();
 }
 function requestInfo(input,init,origin){
  try{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   if(url.origin!==origin||!/^\/(rest|storage)\/v1\//.test(url.pathname))return null;
   const pieces=url.pathname.split('/').filter(Boolean),name=pieces[2]==='rpc'?pieces[3]:pieces[2];
   const method=String(init?.method||input?.method||'GET').toUpperCase();
   return {key:url.pathname,label:resources[name]||(pieces[0]==='storage'?'Attachments':'Cloud data'),write:name!=='ajd_is_admin'&&!['GET','HEAD','OPTIONS'].includes(method)};
  }catch(_){return null}
 }
 async function monitoredFetch(input,init,base,origin){
  const info=requestInfo(input,init,origin);
  if(!info)return base(input,init);
  const id=++sequence,stamp=epoch;active.set(id,{...info,started:Date.now()});render();
  const success=()=>{
   if(stamp!==epoch)return;
   lastSuccess=Date.now();
   const failure=failures.get(info.key);
   // A successful read cannot hide a failed write to the same table.
   if(failure&&(!failure.write||info.write))failures.delete(info.key);
  };
  try{
   const response=await base(input,init);
   if(stamp===epoch){
    if(response.ok)success();
    // These responses are also used by existing duplicate/empty-row recovery.
    // If recovery does not finish, its local queue still shows Attention.
    else if(![406,409].includes(response.status))failures.set(info.key,{...info,write:info.write||failures.get(info.key)?.write||false});
   }
   return response;
  }catch(error){
   if(stamp===epoch&&error?.name!=='AbortError')failures.set(info.key,{...info,write:info.write||failures.get(info.key)?.write||false});
   throw error;
  }finally{active.delete(id);render()}
 }
 function createClient(url,key,options={}){
  const base=options.global?.fetch||window.fetch.bind(window),origin=new URL(url).origin;
  const result=window.supabase.createClient(url,key,{...options,global:{...options.global,fetch:(input,init)=>monitoredFetch(input,init,base,origin)}});
  client=result;
  result.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')setAccess(false)});
  return result;
 }
 async function check(){
  if(checking||access!==true||!client||navigator.onLine===false)return;
  const stamp=epoch;checking=true;render();
  try{
   const {data,error}=await client.rpc('ajd_is_admin');
   if(stamp!==epoch)return;
   if(error||data!==true)failures.set('connection-check',{label:'Administrator connection',write:false});
   else{lastSuccess=Date.now();failures.delete('connection-check')}
  }catch(_){if(stamp===epoch)failures.set('connection-check',{label:'Administrator connection',write:false})}
  finally{if(stamp===epoch){checking=false;render()}}
 }
 function closePanel(){if(panel){panel.hidden=true;button.setAttribute('aria-expanded','false')}}
 function mount(host){
  if(mountPoint)return;mountPoint=node('div','ajd-health-wrap');mountPoint.id='ajdCloudHealth';
  button=node('button','ajd-health-button');button.id='ajdCloudHealthButton';button.type='button';button.setAttribute('aria-controls','ajdCloudHealthPanel');button.setAttribute('aria-expanded','false');
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('aria-hidden','true');
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M6 18h12a4 4 0 0 0 .8-7.92A7 7 0 0 0 5.2 8.8 4.6 4.6 0 0 0 6 18Z');icon.append(p);
  button.append(icon,node('span','ajd-health-dot'),node('span','ajd-health-label','Checking'));
  panel=node('section','ajd-health-panel');panel.id='ajdCloudHealthPanel';panel.hidden=true;panel.setAttribute('aria-label','Cloud synchronization status');
  const top=node('div','ajd-health-panel-top');top.append(node('strong','','Cloud Sync'),node('span','ajd-health-state','Checking'));
  const detail=node('p','ajd-health-detail');detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
  const stats=node('div','ajd-health-stats');stats.append(node('span','ajd-health-queue'),node('span','ajd-health-time'));
  const actions=node('div','ajd-health-actions'),probe=node('button','','Check Connection'),open=node('a','','Open Cloud Sync →');probe.type='button';probe.dataset.healthCheck='';probe.addEventListener('click',()=>{void check()});open.href='/cloud-sync';actions.append(probe,open);
  panel.append(top,detail,stats,actions);mountPoint.append(button,panel);host.append(mountPoint);
  button.addEventListener('click',event=>{event.stopPropagation();const show=panel.hidden;closePanel();if(show){panel.hidden=false;button.setAttribute('aria-expanded','true');render()}});
  document.addEventListener('click',event=>{if(!mountPoint.contains(event.target))closePanel()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){closePanel();button.focus()}});
  render();
 }
 window.AJDCloudHealth={createClient,setAccess,changed:render,check,mount,closePanel,get snapshot(){return snapshot()}};
 window.addEventListener('storage',event=>{if(!event.key||queueKeys.includes(event.key))render()});
 window.addEventListener('offline',render);
 window.addEventListener('online',()=>{render();void check()});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){render();if(Date.now()-lastSuccess>60000)void check()}});
 setInterval(()=>{render();if(document.visibilityState==='visible'&&access===true&&!active.size&&Date.now()-lastSuccess>60000)void check()},15000);
})();
