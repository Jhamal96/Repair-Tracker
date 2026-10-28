// AJD's Wireless Repairs — read-only notification capabilities.
// Does not send any SMS, email, or push. Only approved AJD admins can inspect configuration.
const origins=new Set(['https://repair.ajdapp.org','https://repair.ajdapp.com','https://repair.jhamal16.workers.dev','https://www.ajdapp.org']);
const cors=(origin)=>({'content-type':'application/json','cache-control':'no-store','vary':'Origin','access-control-allow-origin':origins.has(origin||'')?origin:'null','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info'});
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 const response=(body,status)=>new Response(JSON.stringify(body),{status,headers:cors(origin)});
 if(origin&&!origins.has(origin))return response({error:'Forbidden origin'},403);
 if(req.method==='OPTIONS')return response({ok:true},200);
 if(req.method!=='GET')return response({error:'Method not allowed'},405);
 const token=req.headers.get('authorization')||'';
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
 if(!token.startsWith('Bearer ')||!url||!key)return response({error:'Unauthorized'},401);
 try{
  const headers={'authorization':token,'apikey':key};
  const user=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(6500)});
  if(!user.ok)return response({error:'Unauthorized'},401);
  const admin=await fetch(url+'/rest/v1/rpc/ajd_is_admin',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(6500)});
  if(!admin.ok||(await admin.json())!==true)return response({error:'Admin access required'},403);
  const vapidPublic=(Deno.env.get('AJD_WEB_PUSH_PUBLIC_KEY')||'').trim();
  const vapidPrivate=Boolean(Deno.env.get('AJD_WEB_PUSH_PRIVATE_KEY'));
  return response({
    service:'ajd-notification-config',
    version:1,
    email_configured:Boolean(Deno.env.get('AJD_RESEND_API_KEY')&&Deno.env.get('AJD_NOTIFICATION_FROM_EMAIL')),
    sms_configured:false, // Explicitly off. SMS requires separate paid-service activation.
    push_configured:Boolean(vapidPublic&&vapidPrivate),
    vapid_public_key:vapidPublic&&vapidPrivate?vapidPublic:null,
    sending_active:false // Delivery dispatcher intentionally not enabled in this phase.
  },200);
 }catch{return response({error:'Configuration check unavailable'},503)}
});
