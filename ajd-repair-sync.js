/* Shared repair payload rules for the dashboard and Cloud Sync upload queues. */
(function AJDRepairSync(){
 'use strict';
 const fields=['id','customer_name','customer_phone','make_model','issue','part_note','part_cost','labor_cost','amount','discount','deposit_amount','payment_status','payment_info','status','supplier_links','created_at','picked_up_at','repair_type','parts'];
 function payload(job,{insert=false}={}){
  if(!job||typeof job!=='object')throw Error('The queued repair details are unavailable.');
  const result=Object.fromEntries(fields.filter(key=>job[key]!==undefined).map(key=>[key,job[key]]));
  const deviceType=[job.device_type,job.deviceType].find(value=>typeof value==='string'&&value.trim());
  // Older check-ins only collected make/model. Supply the required cloud field
  // for inserts, but never replace an existing cloud category with a fallback.
  if(deviceType)result.device_type=deviceType;
  else if(insert)result.device_type='Device';
  return result;
 }
 window.AJDRepairSync={payload};
})();
