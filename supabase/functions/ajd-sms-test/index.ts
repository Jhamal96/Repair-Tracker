// AJD's Wireless Repairs — administrator-only Twilio SMS test.
// No sending until the owner rotates the exposed token, configures an approved
// Twilio Messaging Service or owned SMS-capable From number, and explicitly enables AJD_SMS_LIVE_ENABLED=true.
// Never accept destinations, message text or Twilio credentials from the browser.
const origins=new Set(['https://repair.ajdapp.org','https://repair.ajdapp.com','https://repair.jhamal16.workers.dev','https://www.ajdapp.org']);
const cors=(origin:string|null)=>({
 'content-type':'application/json','cache-control':'no-store','vary':'Origin',
 'access-control-allow-origin':origins.has(origin||'')?String(origin):'null',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'authorization,apikey,content-type,x-client-info'
});
const smsReady=()=>{
 const sid=Deno.env.get('AJD_TWILIO_ACCOUNT_SID')||'';
 const token=Deno.env.get('AJD_TWILIO_AUTH_TOKEN')||'';
 const service=(Deno.env.get('AJD_TWILIO_MESSAGING_SERVICE_SID')||'').trim();
 const from=(Deno.env.get('AJD_TWILIO_FROM_NUMBER')||'').trim();
 const approvedSender=/^MG[0-9a-f]{32}$/i.test(service)||/^\+[1-9][0-9]{7,14}$/.test(from);
 return /^AC[0-9a-f]{32}$/i.test(sid)&&token.length>=20&&approvedSender&&
   Deno.env.get('AJD_SMS_LIVE_ENABLED')==='true';
};
Deno.serve(async (req:Request)=>{
 const origin=req.headers.get('origin');
 const respond=(data:Record<string,unknown>,status:number)=>new Response(JSON.stringify(data),{status,headers:cors(origin)});
 if(origin&&!origins.has(origin))return respond({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return respond({ok:true},200);
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 const jwt=req.headers.get('authorization')||'';
 const supabaseUrl=Deno.env.get('SUPABASE_URL');
 const publishable=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
 if(!supabaseUrl||!publishable||!jwt.startsWith('Bearer '))return respond({error:'Unauthorized'},401);
 const headers={'authorization':jwt,'apikey':publishable,'content-type':'application/json'};
 try{
  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return respond({error:'Invalid request'},400)}
  if(body?.action!=='test_sms')return respond({error:'Unknown action'},400);
  const who=await fetch(supabaseUrl+'/auth/v1/user',{headers,signal:AbortSignal.timeout(7000)});
  if(!who.ok)return respond({error:'Unauthorized'},401);
  const user=await who.json();
  if(typeof user?.id!=='string')return respond({error:'Unauthorized'},401);
  const admin=await fetch(supabaseUrl+'/rest/v1/rpc/ajd_is_admin',{
   method:'POST',headers,body:'{}',signal:AbortSignal.timeout(7000)
  });
  if(!admin.ok||(await admin.json())!==true)return respond({error:'Administrator access required'},403);
  if(!smsReady())return respond({error:'SMS remains disabled until the rotated Twilio token, approved sender, and live activation are configured.'},409);
  const query=new URL(supabaseUrl+'/rest/v1/ajd_notification_preferences');
  query.searchParams.set('select','recipient_phone,sms_enabled');
  query.searchParams.set('user_id','eq.'+user.id);
  query.searchParams.set('limit','1');
  const prefsResponse=await fetch(query.toString(),{headers,signal:AbortSignal.timeout(7000)});
  if(!prefsResponse.ok)return respond({error:'Could not read SMS preferences'},502);
  const prefs=(await prefsResponse.json())?.[0];
  if(!prefs?.sms_enabled||!/^\+[1-9][0-9]{7,14}$/.test(prefs.recipient_phone||''))
   return respond({error:'Enable SMS and save a valid destination number in Admin Notification Settings first.'},409);
  // Atomically enforce max three test attempts per UTC day and five minutes between tests.
  // A reservation counts even if Twilio rejects the message, preventing repeated chargeable retries.
  const reservation=await fetch(supabaseUrl+'/rest/v1/rpc/ajd_reserve_sms_test',{
   method:'POST',headers,body:'{}',signal:AbortSignal.timeout(7000)
  });
  if(!reservation.ok)return respond({error:'SMS test cooldown or daily limit. Wait five minutes between tests; maximum three daily.'},429);
  const sid=Deno.env.get('AJD_TWILIO_ACCOUNT_SID')!;
  const token=Deno.env.get('AJD_TWILIO_AUTH_TOKEN')!;
  const service=(Deno.env.get('AJD_TWILIO_MESSAGING_SERVICE_SID')||'').trim();
  const from=(Deno.env.get('AJD_TWILIO_FROM_NUMBER')||'').trim();
  const form=new URLSearchParams({
   To:prefs.recipient_phone,
   Body:"AJD's Wireless Repairs: Your administrator SMS test is working. Sign in to your admin dashboard to manage alerts."
  });
  // Prefer the Messaging Service when provided. Otherwise Twilio accepts a
  // Twilio-owned, SMS-capable sender in the From parameter.
  if(/^MG[0-9a-f]{32}$/i.test(service))form.set('MessagingServiceSid',service);
  else form.set('From',from);
  const result=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{
   method:'POST',headers:{
     authorization:'Basic '+btoa(sid+':'+token),
     'content-type':'application/x-www-form-urlencoded'
   },
   body:form.toString(),signal:AbortSignal.timeout(13000)
  });
  // Read only the provider's message ID/status; never return the recipient or provider error details.
  const data=await result.json().catch(()=>({}));
  if(!result.ok||!/^SM[0-9a-f]{32}$/i.test(String(data.sid||'')))return respond({
   error:'Twilio did not accept the test SMS. Check Twilio sender ownership, SMS capability, registration and account status.',
   provider_status:result.status
  },502);
  return respond({ok:true,message_sid:data.sid,status:data.status||'queued',
   note:'Twilio accepted the request. Carrier delivery is not yet confirmed.'},200);
 }catch{
  return respond({error:'SMS test could not complete. No automatic retry was made.'},503);
 }
});
