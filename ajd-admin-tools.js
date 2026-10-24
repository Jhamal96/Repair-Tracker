(function AJDToolsCore(){
'use strict';
const URL='https://vxpufrahrnwmtgltjstd.supabase.co',KEY='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const $=id=>document.getElementById(id);
const read=(key,other)=>{try{const s=localStorage.getItem(key);return s===null?other:JSON.parse(s)??other}catch{return other}};
const save=(key,object)=>localStorage.setItem(key,JSON.stringify(object));
const node=(tag,content,className)=>{const x=document.createElement(tag);if(content!==undefined&&content!==null)x.textContent=String(content);if(className)x.className=className;return x};
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0);
const safeUrl=value=>{
 const s=String(value||'').trim();
 if(!s||s.length>2048||/[\u0000-\u001f\u007f]/.test(s)||s.startsWith('//'))return '';
 if(/^\/(?!\/)[a-z0-9_./?&=%+#-]*$/i.test(s))return s;
 try{const u=new window.URL(s);
  if(['https:','http:'].includes(u.protocol)&&u.hostname)return u.href;
  if(u.protocol==='mailto:'&&/^[^@\s]+@[^@\s]+/.test(u.pathname))return s;
  if(u.protocol==='tel:'&&/^[+\d().\s-]{7,40}$/.test(u.pathname))return s;
 }catch{
  if(/^[a-z0-9][a-z0-9_./?&=%+#-]*$/i.test(s)&&!s.includes('..'))return '/'+s;
 }
 return '';
};
const theme=()=>{
 const raw=localStorage.getItem('ajd_theme_preference')||'dark';
 const mode=['system','light','dark','ultra-dark'].includes(raw)?raw:'system';
 const dark=mode==='dark'||mode==='ultra-dark'||(mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.classList.toggle('dark',dark);
 document.documentElement.classList.toggle('ultra-dark',mode==='ultra-dark');
 document.documentElement.style.colorScheme=dark?'dark':'light';
 const picker=$('themeMode');if(picker)picker.value=mode;
};
const message=(value,error=false)=>{
 const item=$('pageFeedback');if(!item)return;
 item.textContent=String(value);item.className='tools-feedback'+(error?' error':'');
};
let client=null,admin=false,checking=null;
function access(title,details,signIn=false,retry=false){
 admin=false;$('accessBlock').hidden=false;$('appContent').hidden=true;
 $('accessTitle').textContent=title;$('accessDescription').textContent=details;
 $('accessLogin').hidden=!signIn;$('accessRetry').hidden=!retry;
 $('accessLoading').hidden=signIn||retry;
}
async function verify(){
 if(checking)return checking;
 checking=(async()=>{
  access('Restoring your secure session','Verifying your existing AJD administrator sign-in.',false,false);
  try{
   if(!window.supabase?.createClient)throw Error('Supabase is unavailable. Check your connection.');
   if(!client)client=window.supabase.createClient(URL,KEY);
   const {data,error}=await client.auth.getSession();
   if(error)throw error;
   if(!data?.session){access('Administrator Sign-In Required','Sign in to the main dashboard once, then return here.',true,false);return}
   const {data:approved,error:permission}=await client.rpc('ajd_is_admin');
   if(permission)throw permission;
   if(approved!==true){access('Administrator Access Required','This Supabase account does not have permission to manage AJD records.',true,false);return}
   admin=true;window.AJDTools.user=data.session.user;
   $('accessBlock').hidden=true;$('appContent').hidden=false;
   message('');
   document.dispatchEvent(new CustomEvent('ajd-admin-ready'));
  }catch(error){access('Session Verification Unavailable','Your data was not changed. '+error.message+'. Check your connection and retry.',false,true)}
 })().finally(()=>{checking=null});
 return checking;
}
function init(){
 theme();$('year').textContent=String(new Date().getFullYear());
 $('accessRetry').addEventListener('click',()=>{void verify()});
 window.addEventListener('storage',event=>{if(event.key==='ajd_theme_preference')theme()});
 if(window.supabase?.createClient){
  client=window.supabase.createClient(URL,KEY);
  client.auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_OUT'){admin=false;access('Signed Out','Sign in on the main dashboard to manage AJD records.',true,false)}
   if(event==='SIGNED_IN'&&!admin)setTimeout(()=>{void verify()},0);
  });
 }
 void verify();
}
window.AJDTools={
 $,read,save,node,money,safeUrl,theme,message,verify,
 get client(){return client},
 get admin(){return admin},
 user:null
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();