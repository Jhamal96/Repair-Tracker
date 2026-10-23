(function AJDLiveTrackerApp(){
'use strict';
const SUPABASE_URL='https://vxpufrahrnwmtgltjstd.supabase.co';
const SUPABASE_KEY='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const CHECK_EVERY_MS=15000;
const MAX_RETRY_MS=60000;
const $=id=>document.getElementById(id);
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY)||null;

let activeCredentials=null;
let currentJob=null;
let lastSignature='';
let version=0;
let busy=false;
let automatic=true;
let nextCheckTimer=null;
let errorsInARow=0;
let lastCheckedTime=0;
let lastFocusTarget=null;

const STAGES=[
 {key:'pending',label:'Checked In',icon:'✓',hint:'Your repair is registered.',next:'Your device is checked in. We will update this tracker when your repair moves forward.'},
 {key:'in-progress',label:'In Repair',icon:'⚙',hint:'Repair work in progress.',next:'Your repair is currently in progress. Timing depends on the work and parts availability.'},
 {key:'completed',label:'Ready for Pickup',icon:'📦',hint:'Repair marked ready.',next:'Your device is marked ready for pickup! Please contact us to confirm pickup arrangements.'},
 {key:'picked_up',label:'Picked Up',icon:'★',hint:'Pickup recorded.',next:'Your device has been marked picked up. Thank you for choosing AJD’s Wireless Repairs!'}
];
const stageIndex=status=>STAGES.findIndex(s=>s.key===status);
const dollar=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
function escapeHtml(input){
 return String(input??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function dateText(iso){
 if(!iso)return 'Not available';
 const d=new Date(iso);
 return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Not available';
}
function showInitial(title,description,emoji='🔍'){
 $('trackerContent').innerHTML='<div class="ajd-track-empty">'+
 '<div class="ajd-track-empty-icon" aria-hidden="true">'+escapeHtml(emoji)+'</div>'+
 '<h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(description)+'</p></div>';
 $('printReceiptButton').disabled=true;
}
function showUpdateNotice(oldStatus,newStatus,amountOnly=false){
 const box=$('statusChangeNotice');
 if(amountOnly){
  $('changeNoticeTitle').textContent='Payment or repair details updated';
  $('changeNoticeText').textContent='Your repair information has changed. The latest figures are displayed below.';
 }else{
  $('changeNoticeTitle').textContent='Your repair status has changed!';
  $('changeNoticeText').textContent='Your repair moved from '+(STAGES[stageIndex(oldStatus)]?.label||'an earlier stage')+' to '+(STAGES[stageIndex(newStatus)]?.label||'a new stage')+'.';
 }
 box.hidden=false;
}
function hideUpdateNotice(){$('statusChangeNotice').hidden=true}
function setConnection(kind,title,detail){
 const bar=$('liveTrackerBar');
 bar.hidden=false;
 bar.dataset.state=kind;
 $('liveConnectionTitle').textContent=title;
 $('liveConnectionDetail').textContent=detail;
 $('refreshStatusButton').disabled=busy;
 $('toggleLiveButton').dataset.paused=String(!automatic);
 $('toggleLiveButton').textContent=automatic?'⏸ Pause checks':'▶ Resume checks';
 $('toggleLiveButton').setAttribute('aria-pressed',String(automatic));
}
function timeSinceCheck(){
 if(!lastCheckedTime)return '';
 const age=Math.max(0,Math.floor((Date.now()-lastCheckedTime)/1000));
 return age<60?'Last checked '+age+'s ago':'Last checked '+Math.floor(age/60)+'m ago';
}
function updateConnectionAfterSuccess(){
 if(!currentJob)return;
 const final=currentJob.status==='picked_up';
 if(!navigator.onLine){
  setConnection('offline','Connection offline','Last verified result shown · waiting for your connection');
 }else if(!automatic){
  setConnection('paused','Auto-checks paused',timeSinceCheck()+' · use Refresh now');
 }else if(document.hidden){
  setConnection('paused','Updates paused in background','Will refresh when you return');
 }else if(final){
  setConnection('paused','Pickup confirmed',timeSinceCheck()+' · tracking complete');
 }else{
  setConnection('live','Live tracking active',timeSinceCheck()+' · secure check every 15 seconds');
 }
}
function stopTimer(){if(nextCheckTimer!==null){clearTimeout(nextCheckTimer);nextCheckTimer=null}}
function scheduleNext(){
 stopTimer();
 if(!activeCredentials||!automatic||document.hidden||!navigator.onLine||currentJob?.status==='picked_up')return;
 const interval=Math.min(CHECK_EVERY_MS*(2**Math.min(errorsInARow,2)),MAX_RETRY_MS);
 nextCheckTimer=setTimeout(()=>{void loadTrackedJob('automatic')},interval);
}
function resetSession(showPrompt=true){
 version++;
 stopTimer();
 busy=false;
 $('trackLookupButton').disabled=false;
 $('refreshStatusButton').disabled=false;
 activeCredentials=null;currentJob=null;lastSignature='';errorsInARow=0;lastCheckedTime=0;
 $('liveTrackerBar').hidden=true;
 hideUpdateNotice();
 $('printReceiptButton').disabled=true;
 if(showPrompt)showInitial('Search for your repair','Enter your invoice or repair ticket and verify your phone number or email above.','🔎');
}
function signature(job){
 return [job.status,job.amount,job.deposit_amount,job.payment_status,job.updated_at,job.picked_up_at,job.make_model,job.invoice_number].map(v=>String(v??'')).join('|');
}
function render(job){
 const s=String(job.status||'pending');
 const index=stageIndex(s);
 const current=index>=0?STAGES[index]:null;
 const amount=Number(job.amount)||0;
 const deposit=Number(job.deposit_amount)||0;
 const paid=job.payment_status==='paid_in_full'?amount:job.payment_status==='deposit_paid'?Math.min(amount,deposit):0;
 const due=Math.max(0,amount-paid);
 const progress=index<0?0:(index+1)*25;
 const completed=s==='picked_up';
 const markup=STAGES.map((step,i)=>{
  const cls=index>i?'completed':index===i?'current':'upcoming';
  const desc=index>i?'Completed':index===i?'Current stage':step.hint;
  const marker=index>i?'✓':step.icon;
  return '<div class="ajd-stage-step '+cls+'"><span class="ajd-stage-circle" aria-hidden="true">'+marker+'</span>'+
    '<b>'+escapeHtml(step.label)+'</b><p>'+escapeHtml(desc)+'</p></div>';
 }).join('');
 $('trackerContent').innerHTML=`
  <div class="ajd-track-card">
   <div class="ajd-track-card-top">
    <div><span class="ajd-track-card-kicker">YOUR REPAIR STATUS</span>
      <h2>${escapeHtml(current?.label||'Repair Status Available')}</h2>
      <p>Status reported by AJD’s Wireless Repairs.</p></div>
    <span class="ajd-stage-pill ${completed?'final':''}">${completed?'✓':'●'} ${escapeHtml(current?.label||'Contact the shop')}</span>
   </div>
   <div class="ajd-ticket-details">
    <div class="ajd-ticket-info"><small>Invoice / Ticket</small><strong>${escapeHtml(job.invoice_number||job.id||'Not available')}</strong></div>
    <div class="ajd-ticket-info"><small>Device</small><strong>${escapeHtml(job.make_model||'Your device')}</strong></div>
   </div>
   <section class="ajd-track-progress" aria-label="Repair progress">
    <div class="ajd-track-progress-head"><strong>Repair journey</strong><span>${progress}% · ${escapeHtml(current?.label||'Status unavailable')}</span></div>
    <div class="ajd-track-progress-bar" role="progressbar" aria-label="Repair progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
     <div class="ajd-track-progress-fill" style="width:${progress}%"></div>
    </div>
    <div class="ajd-stage-timeline">${markup}</div>
   </section>
   <p class="ajd-track-update-time">◷ Latest team update: <strong>${escapeHtml(dateText(job.updated_at||job.created_at))}</strong>${completed&&job.picked_up_at?' · Pickup: '+escapeHtml(dateText(job.picked_up_at)):''}</p>
   <section class="ajd-track-payment" aria-label="Payment information">
    <h3>PAYMENT OVERVIEW</h3>
    <div class="ajd-payment-line"><span>Total repair charge</span><strong>${dollar(amount)}</strong></div>
    <div class="ajd-payment-line"><span>Deposit requested</span><strong>${dollar(deposit)}</strong></div>
    <div class="ajd-payment-line paid"><span>Paid to date</span><strong>${dollar(paid)}</strong></div>
    <div class="ajd-payment-line due ${due===0?'settled':''}"><span>Balance due</span><strong>${dollar(due)}</strong></div>
   </section>
   <div class="ajd-track-next">
     <span class="ajd-track-next-icon" aria-hidden="true">${completed?'🎉':s==='completed'?'📦':'🔧'}</span>
     <div><h3>${completed?'Pickup complete':s==='completed'?'Your device is ready':s==='in-progress'?'Your repair is underway':'What happens next?'}</h3>
     <p>${escapeHtml(current?.next||'Please contact AJD’s Wireless Repairs for information about your repair.')}</p></div>
   </div>
  </div>`;
 $('printReceiptButton').disabled=false;
}
function handleValidResponse(data,kind){
 const old=currentJob;
 const newSig=signature(data);
 const changed=Boolean(old&&lastSignature!==newSig);
 const stageChanged=Boolean(old&&old.status!==data.status);
 currentJob=data;
 lastSignature=newSig;
 lastCheckedTime=Date.now();errorsInARow=0;
 if(!old||changed){
  render(data);
  if(changed)showUpdateNotice(old.status,data.status,!stageChanged);
  else hideUpdateNotice();
 }
 updateConnectionAfterSuccess();
 if(kind==='verify')$('trackerContent').scrollIntoView({behavior:'smooth',block:'start'});
}
async function loadTrackedJob(kind='automatic'){
 if(!activeCredentials||busy)return;
 if(kind==='automatic'&&(document.hidden||!automatic||!navigator.onLine)){scheduleNext();return}
 const credentials=activeCredentials,startedVersion=version;
 busy=true;stopTimer();
 if(currentJob){
  if(kind!=='automatic')setConnection('checking','Checking for updates…',timeSinceCheck()||'Requesting secure repair status');
  else setConnection('checking','Checking repair status…',timeSinceCheck()||'Contacting the shop');
 }else{
  setConnection('checking','Verifying your repair…','Checking your invoice or ticket and contact information');
 }
 try{
  if(!supabaseClient)throw Error('Unable to contact the secure tracking service.');
  const {data,error}=await supabaseClient.rpc('ajd_public_track_repair',{
   p_ticket:credentials.ticket,p_contact:credentials.contact
  });
  if(startedVersion!==version)return;
  if(error)throw error;
  if(!data){
   resetSession(false);
   showInitial('Repair not found','We could not verify that invoice or ticket with your phone number or email. Check the details or contact the shop.','🔒');
   return;
  }
  handleValidResponse(data,kind);
 }catch(error){
  if(startedVersion!==version)return;
  errorsInARow++;
  if(!currentJob){
   showInitial('Secure tracking is unavailable','Please check your connection and try Refresh now. No repair details will appear until verified.','📡');
  }
  const offline=!navigator.onLine;
  setConnection(offline?'offline':'offline',offline?'You are offline':'Connection interrupted',
   currentJob?(offline?'Last verified status shown. Waiting for your connection.':'Last verified status shown. Retrying automatically.'):'Unable to check right now. Use Refresh now to retry.');
  console.warn('AJD secure tracking temporarily unavailable:',error.message);
 }finally{
  if(startedVersion===version){busy=false;$('trackLookupButton').disabled=false;$('refreshStatusButton').disabled=false;updateLiveToggle();scheduleNext();}
 }
}
function updateLiveToggle(){
 $('toggleLiveButton').dataset.paused=String(!automatic);
 $('toggleLiveButton').textContent=automatic?'⏸ Pause checks':'▶ Resume checks';
 $('toggleLiveButton').setAttribute('aria-pressed',String(automatic));
}
function performCustomerSearch(){
 const ticket=$('trackerSearchInput').value.trim();
 const contact=$('trackerContactInput').value.trim();
 if(!ticket||contact.length<5){
  resetSession(false);
  showInitial('Verification needed','Enter your full invoice or ticket number and the phone number or email used at check-in.','🔒');
  return;
 }
 resetSession(false);
 activeCredentials={ticket,contact};automatic=true;updateLiveToggle();
 $('trackLookupButton').disabled=true;
 hideUpdateNotice();
 void loadTrackedJob('verify');
}
function refreshNow(){
 if(!activeCredentials){performCustomerSearch();return}
 if(busy)return;
 void loadTrackedJob('manual');
}
function toggleAutomatic(){
 if(!activeCredentials||busy)return;
 automatic=!automatic;
 updateLiveToggle();
 if(automatic&&navigator.onLine){
  void loadTrackedJob('manual');
 }else{
  stopTimer();updateConnectionAfterSuccess();
 }
}
function handlePrint(){if(currentJob)window.print()}
function setShopContact(phone,email){
 const p=String(phone||'').trim(),e=String(email||'').trim();
 if(p){
  document.querySelectorAll('[data-shop-phone]').forEach(node=>node.textContent=p);
  document.querySelectorAll('[data-shop-tel]').forEach(node=>node.href='tel:'+p.replace(/[^\d+]/g,''));
 }
 if(e){
  document.querySelectorAll('[data-shop-email]').forEach(node=>node.textContent=e);
  document.querySelectorAll('[data-shop-mailto]').forEach(node=>node.href='mailto:'+e);
  document.querySelectorAll('[data-shop-email-container]').forEach(node=>node.hidden=false);
 }else document.querySelectorAll('[data-shop-email-container]').forEach(node=>node.hidden=true);
}
async function refreshContact(){
 try{
  const p=localStorage.getItem('ajd_shop_phone'),e=localStorage.getItem('ajd_shop_email');
  setShopContact(p,e);
 }catch(_){}
 if(!supabaseClient)return;
 try{
  const {data,error}=await supabaseClient.from('shop_settings').select('phone,email').eq('id','business').maybeSingle();
  if(!error&&data)setShopContact(data.phone,data.email);
 }catch(e){console.warn('AJD shop contact lookup:',e)}
}
function init(){
 $('footerYear').textContent=String(new Date().getFullYear());
 const params=new URLSearchParams(location.search);
 $('trackerSearchInput').value=params.get('id')||params.get('track')||'';
 $('printReceiptButton').addEventListener('click',handlePrint);
 $('trackLookupForm').addEventListener('submit',e=>{e.preventDefault();performCustomerSearch()});
 $('refreshStatusButton').addEventListener('click',refreshNow);
 $('toggleLiveButton').addEventListener('click',toggleAutomatic);
 const onEdit=()=>{if(activeCredentials)resetSession(true)};
 $('trackerSearchInput').addEventListener('input',onEdit);
 $('trackerContactInput').addEventListener('input',onEdit);
 window.addEventListener('online',()=>{if(activeCredentials){void loadTrackedJob('manual')}});
 window.addEventListener('offline',()=>{stopTimer();if(activeCredentials)setConnection('offline','Device offline','Waiting for an internet connection before refreshing')});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopTimer();if(currentJob)updateConnectionAfterSuccess()}
  else{void refreshContact();if(activeCredentials&&automatic)void loadTrackedJob('manual');else if(currentJob)updateConnectionAfterSuccess()}
 });
 window.addEventListener('focus',()=>{
  void refreshContact();
  if(activeCredentials&&automatic&&!document.hidden&&lastCheckedTime&&(Date.now()-lastCheckedTime>CHECK_EVERY_MS))void loadTrackedJob('manual');
 });
 window.addEventListener('storage',e=>{if(e.key==='ajd_shop_phone'||e.key==='ajd_shop_email')void refreshContact()});
 showInitial('Track your device repair','Enter your invoice or ticket number and verified contact details to see your live progress.','🔎');
 void refreshContact();
}
window.performCustomerSearch=performCustomerSearch;
window.AJDLiveTracker={refreshNow,toggleAutomatic};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();