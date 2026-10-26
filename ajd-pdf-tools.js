(function AJDPDFModule(){
'use strict';
const W=226.77; // standard 80 mm thermal receipt paper in PDF points
const MONEY=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(x)||0);
function sanitize(v){
 return String(v??'')
  .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/[\u2013\u2014]/g,'-').replace(/[\u2022\u00b7]/g,'-')
  .replace(/[\u00a0]/g,' ').replace(/[\u20ac]/g,'EUR ')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\x20-\x7e]/g,'?');
}
function wrapText(value,max=37){
 const result=[];
 for(const raw of sanitize(value).split(/\r?\n/)){
  let rest=raw.trim();
  if(!rest){result.push('');continue}
  while(rest.length>max){
   const chunk=rest.slice(0,max+1);
   let end=chunk.lastIndexOf(' ');
   if(end<Math.floor(max*.45))end=max;
   result.push(rest.slice(0,end).trim());
   rest=rest.slice(end).trim();
  }
  result.push(rest);
 }
 return result;
}
function displayDate(value){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Date not available';
}
function pdfString(value){return sanitize(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function pdfBytes(rows){
 // Single continuous 80 mm page, scaled to actual receipt length.
 const flattened=[];
 for(const item of rows){
  const type=item.type||'line';
  if(type==='rule'){flattened.push({type:'rule'});continue}
  if(type==='gap'){flattened.push({type:'gap'});continue}
  const max=type==='title'?26:type==='heading'?33:37;
  const parts=wrapText(item.text,max);
  for(const line of parts)flattened.push({type,text:line});
 }
 const heights={title:17,heading:16,line:12,center:12,rule:10,gap:10,small:11};
 const height=Math.max(210,Math.ceil(28+flattened.reduce((sum,row)=>sum+(heights[row.type]||12),0)+29));
 let y=height-19;
 const commands=['0 G','0 g','0.55 w'];
 for(const line of flattened){
  const size=line.type==='title'?13:line.type==='heading'?10:line.type==='small'?8:9;
  const font=line.type==='title'||line.type==='heading'?'F2':'F1';
  const advance=heights[line.type]||12;
  if(line.type==='rule'){
   commands.push('12 '+y.toFixed(2)+' m '+(W-12).toFixed(2)+' '+y.toFixed(2)+' l S');
  }else if(line.type!=='gap'){
   const chars=sanitize(line.text);
   const width=chars.length*size*.6;
   const x=line.type==='center'||line.type==='title'?Math.max(12,(W-width)/2):12;
   commands.push('BT /'+font+' '+size+' Tf 1 0 0 1 '+x.toFixed(2)+' '+y.toFixed(2)+' Tm ('+pdfString(chars)+') Tj ET');
  }
  y-=advance;
 }
 const stream=commands.join('\n')+'\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+height+'] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'
 ];
 let file='%PDF-1.4\n%AJD\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(file.length);
  file+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const start=file.length;
 file+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<offsets.length;i++)file+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 file+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
 return Uint8Array.from(file,character=>character.charCodeAt(0));
}
function save(bytes,name){
 const filename=String(name||'AJD-Receipt.pdf').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,110);
 if(window.AJDNativePrint?.savePdf){
  try{
   let binary='';
   for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
   window.AJDNativePrint.savePdf(btoa(binary),filename);
   return {ok:true,kind:'android'};
  }catch(err){console.warn('Native Android PDF picker not available:',err)}
 }
 const blob=new Blob([bytes],{type:'application/pdf'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 return {ok:true,kind:'download'};
}
function appendKV(rows,key,value){rows.push({type:'line',text:key+': '+String(value??'')})}
function receipt(job,payment,config={}){
 const num=String(job?.invoice_number||'').trim();
 const draft=!num;
 const declined=job.status==='declined';
 const p=payment||{};
 const rows=[{type:'title',text:"AJD'S WIRELESS REPAIRS"},{type:'center',text:config.phone||''},{type:'center',text:config.email||''},{type:'rule'},{type:'heading',text:draft?'DRAFT RECEIPT - NOT OFFICIAL':'CUSTOMER INVOICE / RECEIPT'}];
 appendKV(rows,'INVOICE',num||'AWAITING CLOUD SYNC');
 if(declined)appendKV(rows,'REPAIR STATUS','Repair Declined');
 appendKV(rows,'DATE',displayDate(job.created_at));
 appendKV(rows,'CUSTOMER',job.customer_name||'Customer');
 if(job.customer_phone)appendKV(rows,'PHONE',job.customer_phone);
 appendKV(rows,'DEVICE',job.make_model||'Device');
 if(job.issue)appendKV(rows,'SERVICE',job.issue);
 const parts=(Array.isArray(job.parts)?job.parts:[]).map(part=>String(part.name||'').trim()).filter(Boolean);
 if(!parts.length&&job.part_note)parts.push(String(job.part_note));
 if(parts.length){
  rows.push({type:'rule'},{type:'heading',text:'SERVICE / PARTS'});
  for(const name of parts.slice(0,12))rows.push({type:'line',text:'- '+name});
 }
 rows.push({type:'rule'},{type:'heading',text:'PAYMENT SUMMARY'});
 appendKV(rows,declined?'Saved Repair Quote':'Total Repair Charge',MONEY(p.total));
 if(Number(p.required)>0)appendKV(rows,'Required Deposit',MONEY(p.required));
 appendKV(rows,'Paid to Date',MONEY(p.paid));
 appendKV(rows,declined?'Quoted Balance':'Balance Due',MONEY(p.balance));
 rows.push({type:'rule'},{type:'center',text:declined?'REPAIR DECLINED':Number(p.balance)<=0?'PAID IN FULL':Number(p.paid)>0?'PARTIAL PAYMENT':'PAYMENT DUE'},{type:'gap'},{type:'center',text:'THANK YOU FOR CHOOSING AJD!'});
 if(draft){rows.push({type:'heading',text:'DRAFT - NOT OFFICIAL'},{type:'small',text:'Sync this repair to Supabase for a permanent invoice number.'});}
 else rows.push({type:'center',text:'repair.ajdapp.org/track'},{type:'small',text:'Use invoice '+num+' and verified phone/email.'});
 return save(pdfBytes(rows),'AJD-'+(draft?'DRAFT-'+String(job.id||'Receipt').slice(0,32):'Receipt-'+num)+'.pdf');
}
function status(job){
 if(!job?.invoice_number&&!job?.id)throw Error('Verify your repair ticket before exporting.');
 const labels={pending:'Checked In','in-progress':'In Repair',completed:'Ready for Pickup',picked_up:'Picked Up',declined:'Repair Declined'};
 const amount=Number(job.amount)||0,deposit=Number(job.deposit_amount)||0;
 const paid=job.payment_status==='paid_in_full'?amount:job.payment_status==='deposit_paid'?Math.min(amount,deposit):0;
 const rows=[
  {type:'title',text:"AJD'S WIRELESS REPAIRS"},{type:'center',text:'REPAIR STATUS SUMMARY'},{type:'rule'}
 ];
 appendKV(rows,'Invoice / Ticket',job.invoice_number||job.id);
 appendKV(rows,'Device',job.make_model||'Device');
 appendKV(rows,'Current Stage',labels[job.status]||job.status||'Status unavailable');
 appendKV(rows,'Last Updated',displayDate(job.updated_at||job.created_at));
 rows.push({type:'rule'},{type:'heading',text:'PAYMENT OVERVIEW'});
 appendKV(rows,job.status==='declined'?'Saved Repair Quote':'Total Repair Charge',MONEY(amount));
 appendKV(rows,'Deposit Requested',MONEY(deposit));
 appendKV(rows,'Paid To Date',MONEY(paid));
 appendKV(rows,job.status==='declined'?'Quoted Balance':'Balance Due',MONEY(Math.max(0,amount-paid)));
 rows.push({type:'rule'},{type:'center',text:'Status snapshot - not an official receipt'},{type:'center',text:'repair.ajdapp.org/track'});
 return save(pdfBytes(rows),'AJD-Repair-Status-'+sanitize(job.invoice_number||job.id)+'.pdf');
}
window.AJDPdfTools={pdfBytes,receipt,status};
})();
