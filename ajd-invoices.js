/* Customer invoices: full-page preview and printable PDF, separate from payment receipts. */
(function AJDInvoiceModule(){
'use strict';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=value=>Math.max(0,Number.isFinite(Number(value))?Math.round(Number(value)*100)/100:0);
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount(value));
const ascii=value=>String(value??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[\u2022\u00b7]/g,'-').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e\n]/g,'?');
const literal=value=>ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function model(job,payment={},config={}){
 const total=amount(payment.total??job.amount),required=Math.min(total,amount(payment.required??job.deposit_amount));
 const paid=Math.min(total,amount(payment.paid??(job.payment_status==='paid_in_full'?total:job.payment_status==='deposit_paid'?required:0)));
 const number=String(job.invoice_number||'').trim(),declined=job.status==='declined';
 const date=new Date(job.created_at);
 const parts=(Array.isArray(job.parts)?job.parts:[]).map(part=>String(part?.name||'').trim()).filter(Boolean);
 if(!parts.length&&job.part_note)parts.push(String(job.part_note));
 return {
  number,ticket:String(job.id||''),draft:!number,declined,total,required,paid,balance:amount(total-paid),
  date:Number.isFinite(date.getTime())?date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date unavailable',
  customer:String(job.customer_name||'Customer'),customerPhone:String(job.customer_phone||''),customerEmail:String(job.customer_email||''),
  device:String(job.make_model||'Device'),service:String(job.issue||'Repair Service'),parts,
  phone:String(config.phone||''),email:String(config.email||''),
  state:declined?'REPAIR DECLINED':paid>=total?(total>0?'PAID IN FULL':'NO PAYMENT DUE'):paid>0?'DEPOSIT / PARTIAL PAYMENT':'PAYMENT DUE',
  paymentLabel:job.payment_status==='deposit_paid'?'Deposit received':'Payments received',
  note:declined?'This repair was declined. The saved quote is shown for reference; this invoice does not request payment for the declined repair.':
   paid>=total&&total>0?'This invoice is paid in full. Your payment receipt is available separately.':
   'This invoice shows the amount due. A payment receipt is issued separately after a deposit or full payment is recorded.'
 };
}
const styles=`
.customer-invoice{box-sizing:border-box;width:100%;max-width:820px;margin:0 auto;padding:38px;background:#fff;color:#17243a;font:13px/1.55 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}
.customer-invoice *{box-sizing:border-box;color:inherit!important}.customer-invoice h2,.customer-invoice h3,.customer-invoice p{margin:0}
.customer-invoice .ci-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:3px solid #2257a5}
.customer-invoice .ci-brand{display:flex;align-items:flex-start;gap:12px;min-width:0}.customer-invoice .ci-logo{width:46px;height:46px;flex:none;border-radius:9px}
.customer-invoice .ci-brand h2{font-size:17px;line-height:1.25;font-weight:800;letter-spacing:-.4px}.customer-invoice .ci-contact{font-size:11px;color:#526078!important;margin-top:7px}
.customer-invoice .ci-document{text-align:right;flex:none}.customer-invoice .ci-document h3{font-size:25px;line-height:1.1;letter-spacing:2px;color:#2257a5!important}.customer-invoice .ci-document span{display:block;font-size:10px;margin-top:9px;font-weight:700}
.customer-invoice .ci-draft{border:1px solid #a66c11;background:#fff9eb;padding:10px 13px;margin-top:20px;font-size:11px;font-weight:700;color:#74480c!important}
.customer-invoice .ci-details{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:25px 0 28px}.customer-invoice .ci-label{font-size:10px;font-weight:800;letter-spacing:1.3px;color:#526078!important;margin-bottom:7px}.customer-invoice .ci-customer{font-size:15px;font-weight:700}
.customer-invoice .ci-reference{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 18px;margin:0;font-size:11px}.customer-invoice .ci-reference dd{margin:0;text-align:right;font-weight:700}.customer-invoice .ci-reference dt{color:#526078!important}
.customer-invoice .ci-table{width:100%;border-collapse:collapse;table-layout:fixed}.customer-invoice .ci-table th{padding:11px 12px;background:#142c4d;color:#fff!important;text-align:left;font-size:10px;letter-spacing:1px}.customer-invoice .ci-table th:last-child{width:106px;text-align:right}.customer-invoice .ci-table td{padding:17px 12px;border-bottom:1px solid #d9e1eb;vertical-align:top}.customer-invoice .ci-table td:last-child{text-align:right;font-weight:700;white-space:nowrap}.customer-invoice .ci-service{font-size:14px;font-weight:700}.customer-invoice .ci-device{margin-top:6px;font-size:11px;color:#526078!important}.customer-invoice .ci-parts{margin:10px 0 0;padding-left:17px;font-size:11px}.customer-invoice .ci-parts li{margin-top:3px}
.customer-invoice .ci-summary{width:300px;max-width:100%;margin:22px 0 0 auto}.customer-invoice .ci-summary-row{display:flex;justify-content:space-between;gap:15px;padding:7px 10px;font-size:12px}.customer-invoice .ci-summary-row strong{white-space:nowrap}.customer-invoice .ci-balance{margin-top:8px;padding:13px 10px;background:#eef4fd;border-left:3px solid #2257a5;font-size:15px;font-weight:800}
.customer-invoice .ci-deposit{border:1px solid #d9e1eb;border-radius:6px;padding:11px 13px;margin-top:24px;font-size:11px}.customer-invoice .ci-note{padding-top:24px;font-size:11px;color:#526078!important}.customer-invoice .ci-track{padding-top:15px;font-size:10px;color:#526078!important}.customer-invoice .ci-footer{margin-top:30px;border-top:1px solid #d9e1eb;padding-top:13px;font-size:10px;color:#526078!important}
@media(max-width:550px){.customer-invoice{padding:20px 16px;font-size:12px}.customer-invoice .ci-header{gap:12px;flex-wrap:wrap}.customer-invoice .ci-document{text-align:left}.customer-invoice .ci-details{grid-template-columns:1fr;gap:20px}.customer-invoice .ci-brand h2{font-size:16px}.customer-invoice .ci-document h3{font-size:23px}.customer-invoice .ci-table th:last-child{width:90px}.customer-invoice .ci-table td{padding:12px 8px}.customer-invoice .ci-service{font-size:12px}}
@media print{@page{size:letter;margin:15mm}.customer-invoice{max-width:none;padding:0;font-size:11px}.customer-invoice .ci-header{flex-wrap:nowrap}.customer-invoice .ci-document{text-align:right}.customer-invoice .ci-details{grid-template-columns:1fr 1fr}.customer-invoice .ci-summary,.customer-invoice .ci-deposit,.customer-invoice .ci-note{break-inside:avoid}.customer-invoice .ci-table thead{display:table-header-group}.customer-invoice .ci-table td{border-bottom:1px solid #d9e1eb}.customer-invoice .ci-table th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;
function html(data){
 const e=escapeHTML;
 const line=(label,value,cls='')=>`<div class="ci-summary-row ${cls}"><span>${e(label)}</span><strong>${e(money(value))}</strong></div>`;
 return `<header class="ci-header"><div class="ci-brand"><img class="ci-logo" src="/admin-icon-192.png?v=20261024-logo2" alt="" width="46" height="46"><div><h2>AJD's Wireless Repairs</h2><p class="ci-contact">${e(data.phone)}${data.phone&&data.email?'<br>':''}${e(data.email)}</p></div></div><div class="ci-document"><h3>${data.draft?'DRAFT INVOICE':'INVOICE'}</h3><span>${e(data.state)}</span></div></header>
 ${data.draft?'<p class="ci-draft">DRAFT - Awaiting a permanent invoice number. Sync this ticket before issuing the official invoice.</p>':''}
 <section class="ci-details"><div><p class="ci-label">BILL TO</p><p class="ci-customer">${e(data.customer)}</p>${data.customerPhone?`<p>${e(data.customerPhone)}</p>`:''}${data.customerEmail?`<p>${e(data.customerEmail)}</p>`:''}</div><dl class="ci-reference"><dt>Invoice number</dt><dd>${e(data.number||'Pending cloud sync')}</dd><dt>Invoice date</dt><dd>${e(data.date)}</dd><dt>Repair ticket</dt><dd>${e(data.ticket)}</dd></dl></section>
 <table class="ci-table"><thead><tr><th scope="col">DESCRIPTION</th><th scope="col">AMOUNT</th></tr></thead><tbody><tr><td><p class="ci-service">${e(data.service)}</p><p class="ci-device">Device: ${e(data.device)}</p>${data.parts.length?'<ul class="ci-parts">'+data.parts.map(part=>`<li>${e(part)}</li>`).join('')+'</ul>':''}</td><td>${e(money(data.total))}</td></tr></tbody></table>
 <section class="ci-summary" aria-label="Invoice totals">${line(data.declined?'Saved repair quote':'Repair total',data.total)}${line(data.paymentLabel,data.paid)}${line(data.declined?'Quoted balance':'Balance due',data.balance,'ci-balance')}</section>
 ${data.required>0&&!data.declined?`<p class="ci-deposit"><strong>Deposit requested: ${e(money(data.required))}</strong>${data.paid<data.required?` · Deposit still due: ${e(money(data.required-data.paid))}`:''}<br>The deposit is included in the repair total.</p>`:''}
 <p class="ci-note">${e(data.note)}</p>${data.phone&&!data.declined&&data.balance>0?`<p class="ci-note">For payment arrangements, contact ${e(data.phone)}.</p>`:''}
 ${!data.draft?`<p class="ci-track">Track your repair at repair.ajdapp.org/track using invoice ${e(data.number)} and your phone or email.</p>`:''}
 <footer class="ci-footer">Thank you for choosing AJD's Wireless Repairs.</footer>`;
}
// Embedded typeface metrics keep long descriptions within the printed page.
const widths=window.AJDInvoiceFonts?.map(font=>font.widths)||[];
const textWidth=(value,size,bold=false)=>[...ascii(value)].reduce((sum,char)=>sum+(widths[bold?1:0][char.charCodeAt(0)-32]||556)*size/1000,0);
function wrap(value,width,size,bold=false){
 const lines=[];
 for(const raw of ascii(value).split('\n')){
  let rest=raw.trim();if(!rest){lines.push('');continue}
  while(textWidth(rest,size,bold)>width){
   let end=1;while(end<rest.length&&textWidth(rest.slice(0,end+1),size,bold)<=width)end++;
   const space=rest.lastIndexOf(' ',end);if(space>0)end=space;
   lines.push(rest.slice(0,end).trim());rest=rest.slice(end).trim();
  }
  lines.push(rest);
 }
 return lines;
}
function pdfBytes(data,logo=null){
 const fonts=window.AJDInvoiceFonts;
 if(!fonts?.length)throw Error('Invoice fonts did not load. Refresh the page and try again.');
 const pages=[],blue='0.13 0.34 0.65',ink='0.09 0.15 0.24',muted='0.32 0.38 0.47';
 let commands,y;
 const text=(value,x,top,size=10,bold=false,color=ink)=>commands.push(`${color} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(792-top-size).toFixed(2)} Tm (${literal(value)}) Tj ET`);
 const right=(value,edge,top,size=10,bold=false,color=ink)=>text(value,edge-textWidth(value,size,bold),top,size,bold,color);
 const rect=(x,top,w,h,color)=>commands.push(`${color} rg ${x} ${792-top-h} ${w} ${h} re f`);
 const rule=top=>rect(42,top,528,.7,'0.84 0.88 0.93');
 function page(){
  commands=[];pages.push(commands);
  if(logo)commands.push('q 42 0 0 42 42 706 cm /Logo Do Q');
  text("AJD's Wireless Repairs",logo?96:42,43,16,true);
  let contactY=66;
  for(const value of [data.phone,data.email])if(value)for(const line of wrap(value,280,9)){text(line,logo?96:42,contactY,9,false,muted);contactY+=12}
  right(data.draft?'DRAFT INVOICE':'INVOICE',570,42,data.draft?17:25,true,blue);
  right(data.state,570,79,8,true);
  right(data.number||'Draft - '+data.ticket,570,98,8,false,muted);
  const lineY=Math.max(116,contactY+12);rect(42,lineY,528,2,blue);y=lineY+23;
 }
 const ensure=height=>{if(y+height>711)page()};
 function paragraph(value,{x=42,width=528,size=10,bold=false,color=ink,gap=5}={}){
  for(const line of wrap(value,width,size,bold)){ensure(size+6);text(line,x,y,size,bold,color);y+=size+5}
  y+=gap;
 }
 function tableHeading(){rect(42,y,528,27,'0.08 0.17 0.30');text('DESCRIPTION',54,y+8,9,true,'1 1 1');right('AMOUNT',558,y+8,9,true,'1 1 1');y+=43}
 page();
 if(data.draft){paragraph('DRAFT - Awaiting a permanent invoice number. Sync this ticket before issuing the official invoice.',{bold:true,color:blue});y+=8}
 text('BILL TO',42,y,9,true,muted);y+=18;
 paragraph(data.customer,{width:310,size:12,bold:true});
 for(const value of [data.customerPhone,data.customerEmail])if(value)paragraph(value,{width:310,gap:1});
 y+=8;
 for(const [label,value] of [['Invoice number',data.number||'Pending cloud sync'],['Invoice date',data.date],['Repair ticket',data.ticket]])paragraph(label+': '+value,{size:10,gap:1});
 y+=18;ensure(100);tableHeading();
 const details=[...wrap(data.service,388,12,true).map(value=>({value,bold:true,size:12})),...wrap('Device: '+data.device,388,10).map(value=>({value,size:10})),...data.parts.flatMap(part=>wrap('- '+part,382,10).map(value=>({value,size:10})))];
 let first=true;
 for(const line of details){
  if(y+line.size+7>711){page();tableHeading();text('Repair service (continued)',54,y,9,true,muted);y+=22}
  text(line.value,54,y,line.size,line.bold||false);
  if(first){right(money(data.total),558,y,12,true);first=false}
  y+=line.size+7;
 }
 y+=8;rule(y);y+=24;
 const depositText='Deposit requested: '+money(data.required)+(data.paid<data.required?' - Deposit still due: '+money(data.required-data.paid):'');
 const contactText='For payment arrangements, contact '+data.phone+'.';
 const trackingText='Track your repair: repair.ajdapp.org/track - Use invoice '+data.number+' and your phone or email.';
 const paragraphHeight=(value,size,bold=false)=>wrap(value,528,size,bold).length*(size+5)+5;
 // Keep totals and payment notes together rather than leaving an orphan note page.
 ensure(92+(data.required>0&&!data.declined?8+paragraphHeight(depositText,10,true)+paragraphHeight('The deposit is included in the repair total.',9):0)+12+paragraphHeight(data.note,10)+(data.phone&&!data.declined&&data.balance>0?paragraphHeight(contactText,10):0)+(!data.draft?paragraphHeight(trackingText,9):0));
 const row=(label,value,big=false)=>{
  if(big){rect(310,y-4,260,36,'0.93 0.96 0.99');rect(310,y-4,3,36,blue)}
  text(label,322,y,big?13:10,big);right(money(value),558,y,big?15:10,true);y+=big?44:24;
 };
 row(data.declined?'Saved repair quote':'Repair total',data.total);
 row(data.paymentLabel,data.paid);
 row(data.declined?'Quoted balance':'Balance due',data.balance,true);
 if(data.required>0&&!data.declined){
  y+=8;paragraph(depositText,{bold:true,size:10});
  paragraph('The deposit is included in the repair total.',{size:9,color:muted});
 }
 y+=12;paragraph(data.note,{size:10,color:muted});
 if(data.phone&&!data.declined&&data.balance>0)paragraph(contactText,{size:10,color:muted});
 if(!data.draft)paragraph(trackingText,{size:9,color:muted});
 pages.forEach((p,i)=>{commands=p;rule(741);text("Thank you for choosing AJD's Wireless Repairs.",42,754,8,false,muted);right('Page '+(i+1)+' of '+pages.length,570,754,8,false,muted)});
 const objects=['','','',''];
 fonts.forEach((font,i)=>{
  const binary=atob(font.base64),fileRef=objects.length+1;
  objects.push(`<< /Length ${binary.length} /Length1 ${binary.length} >>\nstream\n${binary}\nendstream`);
  const descriptorRef=objects.length+1;
  objects.push(`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV ${i?120:80} /FontFile2 ${fileRef} 0 R >>`);
  objects[i+2]=`<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /FirstChar 32 /LastChar 126 /Widths [${font.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorRef} 0 R >>`;
 });
 const imageRef=logo?objects.length+1:null;
 if(logo)objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.binary.length} >>\nstream\n${logo.binary}\nendstream`);
 const refs=[];
 for(const ops of pages){
  const stream=ops.join('\n')+'\n',contentRef=objects.length+1;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  const pageRef=objects.length+1;refs.push(pageRef+' 0 R');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageRef?`/XObject << /Logo ${imageRef} 0 R >>`:''} >> /Contents ${contentRef} 0 R >>`);
 }
 objects[0]='<< /Type /Catalog /Pages 2 0 R >>';objects[1]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${pages.length} >>`;
 let file='%PDF-1.4\n%AJD\n';const offsets=[0];
 objects.forEach((object,i)=>{offsets.push(file.length);file+=(i+1)+' 0 obj\n'+object+'\nendobj\n'});
 const start=file.length;file+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<offsets.length;i++)file+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 file+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
 return Uint8Array.from(file,char=>char.charCodeAt(0));
}
let logoPromise;
function logo(){
 if(!logoPromise)logoPromise=new Promise(resolve=>{
  const image=new Image(),timer=setTimeout(()=>resolve(null),4000);image.onload=()=>{
   clearTimeout(timer);
   try{const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,192,192);ctx.drawImage(image,0,0,192,192);resolve({width:192,height:192,binary:atob(canvas.toDataURL('image/jpeg',.94).split(',')[1])})}catch{resolve(null)}
  };image.onerror=()=>{clearTimeout(timer);resolve(null)};image.src='/admin-icon-192.png?v=20261024-logo2';
 });
 return logoPromise;
}
async function downloadPDF(job,payment,config={}){
 const data=model(job,payment,config),bytes=pdfBytes(data,await logo());
 return window.AJDPdfTools.save(bytes,'AJD-'+(data.draft?'Draft-Invoice-'+data.ticket:'Invoice-'+data.number)+'.pdf');
}
const style=document.createElement('style');style.id='ajdInvoiceStyles';style.textContent=styles;document.head.appendChild(style);
window.AJDInvoices={model,html,styles,pdfBytes,downloadPDF};
})();
