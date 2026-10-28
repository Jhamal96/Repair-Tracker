(function AJDAdminNotifications(){
'use strict';
const T=window.AJDTools;
if(!T)return;
const $=id=>document.getElementById(id);
const flags=['repair_requests','store_orders','payment_activity','customer_messages','repair_status'];
const fieldIds={repair_requests:'noticeRepair',store_orders:'noticeStore',payment_activity:'noticePayments',customer_messages:'noticeMessages',repair_status:'noticeStatuses'};
let initialized=false,backendConfig=null,subscribed=false;
function report(text,failed=false){
 const n=$('noticeFeedback');if(!n)return;
 n.textContent=text;n.classList.toggle('is-error',failed);
}
function shortDate(v){try{return new Date(v).toLocaleString()}catch{return String(v||'')}}
function checkClient(){if(!T.admin||!T.user?.id||!T.client)throw Error('Administrator sign-in is required.')}
function defaults(){return {email_enabled:false,sms_enabled:false,push_enabled:false,recipient_email:T.user?.email||'',recipient_phone:'',repair_requests:true,store_orders:true,payment_activity:true,customer_messages:true,repair_status:true}}
function toUI(row){
 const p={...defaults(),...(row||{})};
 $('noticeEmail').checked=!!p.email_enabled;
 $('noticeSms').checked=!!p.sms_enabled;
 $('noticePush').checked=!!p.push_enabled;
 $('noticeEmailAddress').value=p.recipient_email||'';
 $('noticePhoneAddress').value=p.recipient_phone||'';
 for(const k of flags)$(fieldIds[k]).checked=!!p[k];
}
function collect(){
 const email=$('noticeEmailAddress').value.trim().toLowerCase();
 const phone=$('noticePhoneAddress').value.trim();
 if(email && (email.length>254||!/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(email)))throw Error('Enter a valid notification email.');
 if(phone && !/^\\+[1-9][0-9]{7,14}$/.test(phone))throw Error('SMS numbers must use international format, such as +13055550100.');
 if($('noticeEmail').checked&&!email)throw Error('Enter an email address before enabling email alerts.');
 if($('noticeSms').checked&&!phone)throw Error('Enter a phone number before enabling SMS preferences.');
 const data={user_id:T.user.id,email_enabled:$('noticeEmail').checked,sms_enabled:$('noticeSms').checked,push_enabled:$('noticePush').checked,recipient_email:email,recipient_phone:phone,updated_at:new Date().toISOString()};
 for(const key of flags)data[key]=$(fieldIds[key]).checked;
 return data;
}
async function loadPreferences(){
 checkClient();
 const {data,error}=await T.client.from('ajd_notification_preferences').select('*').eq('user_id',T.user.id).maybeSingle();
 if(error)throw error;
 toUI(data);
}
async function savePreferences(e){
 e.preventDefault();
 try{
  checkClient();
  const row=collect();
  $('noticeSave').disabled=true;
  const {error}=await T.client.from('ajd_notification_preferences').upsert(row,{onConflict:'user_id'});
  if(error)throw error;
  report('Preferences saved securely. External delivery stays off until a provider and server-side dispatcher are configured.');
 }catch(e){report('Preferences not saved: '+e.message,true)}
 finally{$('noticeSave').disabled=false}
}
function itemText(tag,value,cls){
 const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(value||'');return n;
}
async function refreshHistory(){
 const list=$('noticeHistory');if(!list)return;
 try{
  checkClient();
  const {data,error}=await T.client.from('ajd_notification_deliveries').select('id,read_at,created_at,ajd_notification_events(event_type,title,body,created_at)').eq('user_id',T.user.id).order('created_at',{ascending:false}).limit(30);
  if(error)throw error;
  list.replaceChildren();
  const unread=(data||[]).filter(x=>!x.read_at).length;
  $('noticeUnread').textContent=unread+' unread';
  if(!(data||[]).length){list.append(itemText('p','No notification events yet. New customer and repair activity will appear here.','ajd-notice-help'));return}
  for(const entry of data){
   const ev=entry.ajd_notification_events;
   if(!ev)continue;
   const row=itemText('div','','ajd-notice-item'+(!entry.read_at?' is-unread':''));
   const left=document.createElement('div');
   left.append(itemText('strong',ev.title),itemText('p',ev.body),itemText('small',shortDate(ev.created_at)));
   row.append(left);
   if(!entry.read_at){
    const mark=itemText('button','✓ Mark read','tools-button');
    mark.type='button';
    mark.addEventListener('click',async()=>{
      mark.disabled=true;
      const {error:updateError}=await T.client.from('ajd_notification_deliveries').update({read_at:new Date().toISOString()}).eq('id',entry.id).eq('user_id',T.user.id);
      if(updateError){mark.disabled=false;report('Could not mark as read: '+updateError.message,true);return}
      await refreshHistory();
    });
    row.append(mark);
   }
   list.append(row);
  }
 }catch(error){list.replaceChildren(itemText('p','Unable to load notification history. '+error.message,'ajd-notice-help'));report('Notification history unavailable.',true)}
}
async function loadProviderStatus(){
 const n=$('noticeProviderStatus');
 try{
  const {data,error}=await T.client.functions.invoke('ajd-notification-config',{method:'GET'});
  if(error)throw error;
  backendConfig=data;
  n.textContent='Email: '+(data.email_configured?'provider detected':'setup required')+' · SMS: not activated · Push: '+(data.push_configured?'keys available, dispatcher pending':'setup required');
  $('noticeEnrollPush').disabled=!data.vapid_public_key;
 }catch(error){
  backendConfig=null;
  n.textContent='External delivery is not configured. Email, SMS and push preferences can be saved without sending messages.';
  $('noticeEnrollPush').disabled=true;
 }
}
function decodeVapid(base64){
 const pad='='.repeat((4-base64.length%4)%4);
 const raw=atob((base64+pad).replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function enrollPush(){
 try{
  checkClient();
  if(!backendConfig?.vapid_public_key)throw Error('Push provider keys have not been configured on the server.');
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('This device/browser does not support web push.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Notification permission was not granted.');
  $('noticeEnrollPush').disabled=true;
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  const existing=await registration.pushManager.getSubscription();
  const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(backendConfig.vapid_public_key)});
  const json=subscription.toJSON();
  const {error}=await T.client.from('ajd_notification_push_subscriptions').upsert({
   user_id:T.user.id,endpoint:subscription.endpoint,p256dh:json.keys?.p256dh||'',auth_secret:json.keys?.auth||'',
   device_label:(navigator.userAgentData?.platform||navigator.platform||'Browser').slice(0,90)
  },{onConflict:'endpoint'});
  if(error)throw error;
  subscribed=true;
  $('noticeRemovePush').disabled=false;
  report('This device is subscribed. Push delivery requires the server-side dispatcher before alerts will be sent.');
 }catch(error){report('Push setup failed: '+error.message,true)}
 finally{$('noticeEnrollPush').disabled=!backendConfig?.vapid_public_key}
}
async function removePush(){
 try{
  checkClient();
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=await registration?.pushManager.getSubscription();
  if(subscription){
   const {error}=await T.client.from('ajd_notification_push_subscriptions').delete().eq('user_id',T.user.id).eq('endpoint',subscription.endpoint);
   if(error)throw error;
   await subscription.unsubscribe();
  }
  subscribed=false;$('noticeRemovePush').disabled=true;
  report('Push subscription removed from this device.');
 }catch(error){report('Could not remove push subscription: '+error.message,true)}
}
async function checkSubscription(){
 try{
  const reg=await navigator.serviceWorker?.getRegistration('/');
  subscribed=!!(await reg?.pushManager?.getSubscription());
  $('noticeRemovePush').disabled=!subscribed;
 }catch{}
}
async function init(){
 if(initialized)return;
 initialized=true;
 $('noticeForm').addEventListener('submit',savePreferences);
 $('noticeRefresh').addEventListener('click',()=>void refreshHistory());
 $('noticeEnrollPush').addEventListener('click',()=>void enrollPush());
 $('noticeRemovePush').addEventListener('click',()=>void removePush());
 try{await loadPreferences();await Promise.all([refreshHistory(),loadProviderStatus(),checkSubscription()]);}
 catch(error){report('Notification settings unavailable: '+error.message,true)}
 // Only poll while this admin-only page is visible; no delivery occurs from the browser.
 setInterval(()=>{if(!document.hidden&&T.admin)void refreshHistory()},45000);
}
document.addEventListener('ajd-admin-ready',()=>void init());
})();
