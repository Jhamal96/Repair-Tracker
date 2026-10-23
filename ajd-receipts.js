(function AJDReceiptModule(){
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const invoiceNo=job=>String(job?.invoice_number||'').trim();
const when=raw=>{
 const date=new Date(raw);
 return Number.isFinite(date.getTime())?date.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Date unavailable';
};
let returnFocus=null;
let current=null;
let currentPayment=null;
let currentConfig={};
function summaryLine(label,value,cls){
 return '<div class="receipt-item '+(cls||'')+'"><span>'+escapeHTML(label)+'</span><span class="receipt-right">'+escapeHTML(value)+'</span></div>';
}
function detail(label,value){
 const text=String(value??'').trim();
 return text?'<dt>'+escapeHTML(label)+'</dt><dd>'+escapeHTML(text)+'</dd>':'';
}
function open(job,payment,config={}){
 if(!job)return;
 returnFocus=document.activeElement;
 current=job;
 currentPayment=payment;
 currentConfig=config;
 const num=invoiceNo(job),ready=Boolean(num);
 const r=payment||{total:0,required:0,paid:0,balance:0};
 const phone=String(config.phone||'').trim();
 const email=String(config.email||'').trim();
 const status=(Number(r.balance)<=0&&Number(r.total)>0)?'PAID IN FULL':Number(r.paid)>0?'PARTIAL PAYMENT':'PAYMENT DUE';
 const work=(Array.isArray(job.parts)?job.parts:[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
 if(!work.length&&job.part_note)work.push(String(job.part_note).trim());
 const parts=work.length?'<section class="receipt-section"><h3>SERVICE / PARTS DESCRIPTION</h3>'+work.slice(0,10).map(t=>'<div class="receipt-item"><span>'+escapeHTML(t)+'</span></div>').join('')+'</section>':'';
 const html=`
  <header class="receipt-brand">
    <div class="receipt-brand-icon" aria-hidden="true">AJD</div>
    <h2>AJD'S WIRELESS REPAIRS</h2>
    ${phone?`<p>Tel: ${escapeHTML(phone)}</p>`:''}
    ${email?`<p>${escapeHTML(email)}</p>`:''}
  </header>
  <div class="receipt-title">CUSTOMER INVOICE / RECEIPT</div>
  ${!ready?'<div class="receipt-draft-warning">DRAFT — A PERMANENT INVOICE NUMBER HAS NOT BEEN ASSIGNED.<br>SYNC TO CLOUD BEFORE PRINTING.</div>':''}
  <dl class="receipt-metadata">
    <dt>INVOICE #</dt><dd class="receipt-number">${escapeHTML(num||'PENDING CLOUD SYNC')}</dd>
    <dt>DATE</dt><dd>${escapeHTML(when(job.created_at))}</dd>
    ${detail('CUSTOMER',job.customer_name)}
    ${detail('PHONE',job.customer_phone)}
    ${detail('DEVICE',job.make_model)}
    ${detail('SERVICE',job.issue)}
  </dl>
  ${parts}
  <section class="receipt-section" aria-label="Payment summary">
    <h3>PAYMENT SUMMARY</h3>
    ${summaryLine('Total Repair Charge',usd(r.total),'receipt-grand-total')}
    ${Number(r.required)>0?summaryLine('Required Deposit',usd(r.required)):''}
    ${summaryLine('Paid to Date',usd(r.paid))}
    ${summaryLine('Balance Due',usd(r.balance),'receipt-balance')}
  </section>
  <div class="receipt-chip">${escapeHTML(status)}</div>
  <footer class="receipt-footer">
    <strong>THANK YOU FOR CHOOSING AJD!</strong>
    <p>Keep this receipt for your records.</p>
    ${ready?`<p>Track progress: repair.ajdapp.org/track<br>Use invoice ${escapeHTML(num)} and your phone/email.</p>`:''}
    <p>AJD's Wireless Repairs</p>
  </footer>`;
 $('invoicePrintSheet').innerHTML=html;
 $('invoicePrintSheet').setAttribute('aria-label',ready?'Receipt '+num:'Draft receipt awaiting invoice number');
 $('receiptPrintButton').disabled=false;
 $('receiptPrintButton').textContent=ready?'🖨 Print Receipt':'🖨 Print Draft';
 $('receiptPrintButton').title=ready?'Print official receipt':'Print an clearly marked draft until cloud sync completes';
 const saveButton=$('receiptPdfButton');
 if(saveButton){saveButton.disabled=false;saveButton.textContent=ready?'⬇ Download PDF':'⬇ Download Draft PDF'}
 $('receiptReadyMessage').textContent=ready?
   'Print on 80mm thermal paper, or choose Save as PDF in your browser’s print dialog.':
   'This is a clearly marked DRAFT without a permanent invoice number. You can print/download the draft, then sync with Supabase to issue the official receipt.';
 $('invoiceModal').classList.remove('hidden');
 $('receiptPrintButton').focus({preventScroll:true});
}
function close(){
 $('invoiceModal').classList.add('hidden');current=null;currentPayment=null;currentConfig={};
 if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});
 returnFocus=null;
}
function print(){
 if(!current)return;
 // Direct call from the click handler is important for iOS Safari and popup policies.
 try{
   if(window.AJDNativePrint?.printReceipt){
     window.AJDNativePrint.printReceipt();
   }else if(typeof window.print==='function'){
     window.print();
   }else{
     throw new Error('The print dialog is unavailable in this browser.');
   }
 }catch(err){
   console.warn('Receipt print dialog failed:',err);
   const text=$('receiptReadyMessage');
   if(text)text.textContent='Printing is unavailable in this browser. Use Download PDF and print the saved file instead.';
 }
}
function downloadPDF(){
 if(!current)return;
 try{
   if(!window.AJDPdfTools?.receipt)throw new Error('PDF generator did not load. Refresh the page and try again.');
   window.AJDPdfTools.receipt(current,currentPayment,currentConfig);
   const info=$('receiptReadyMessage');
   if(info)info.textContent='Your '+(invoiceNo(current)?'receipt':'draft receipt')+' PDF is being saved. Check Downloads or the Android file picker.';
 }catch(err){
   console.warn('Receipt PDF generation failed:',err);
   const info=$('receiptReadyMessage');if(info)info.textContent='Could not generate the PDF: '+err.message;
 }
}
function printView(){
 if(!current)return;
 // Opens an isolated printable page when an installed browser blocks its print dialog.
 const sheet=$('invoicePrintSheet');
 if(!sheet)return;
 const popup=window.open('','_blank');
 if(!popup){
   $('receiptReadyMessage').textContent='The new print window was blocked. Allow pop-ups or choose Download PDF.';
   return;
 }
 const printable='<html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<title>AJD Receipt</title>'+
 '<style>@page{size:80mm 200mm;margin:4mm}body{margin:0;padding:14px;background:white;color:black;font:11px/1.5 Courier New,monospace;}'+
 '.paper{width:72mm;max-width:100%;margin:0 auto}h2{text-align:center;font:900 15px system-ui}'+
 '.receipt-brand,.receipt-footer{text-align:center}.receipt-brand-icon{margin:0 auto;text-align:center;font-weight:900}'+
 '.receipt-title{text-align:center;font-weight:900;margin:12px 0;border-block:1px dashed;padding:8px 0}'+
 '.receipt-metadata{display:grid;grid-template-columns:auto 1fr;gap:5px 9px}.receipt-metadata dd{margin:0;overflow-wrap:anywhere}'+
 '.receipt-section{border-top:1px dashed;margin-top:12px;padding-top:10px}.receipt-item{display:flex;justify-content:space-between;gap:8px;margin:5px 0}'+
 '.receipt-item .receipt-right{white-space:nowrap;font-weight:900}.receipt-grand-total,.receipt-balance{font-weight:900}'+
 '.receipt-chip,.receipt-draft-warning{text-align:center;font-weight:900;border:1px solid;margin:12px 0;padding:8px}'+
 '.receipt-footer{border-top:1px dashed;padding-top:12px;margin-top:12px}'+
 '.controls{text-align:center;padding:15px}.controls button{padding:10px 22px;font:700 14px system-ui}'+
 '@media print{body{padding:0}.controls{display:none}.paper{width:72mm}}</style></head><body>'+
 '<div class="controls"><button onclick="window.print()">🖨 Print Receipt / Save as PDF</button></div>'+
 '<main class="paper">'+sheet.innerHTML+'</main></body></html>';
 popup.document.open();popup.document.write(printable);popup.document.close();
 popup.focus();
}

function copyNumber(){
 const value=invoiceNo(current);if(!value)return;
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).catch(()=>{});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('invoiceModal')?.classList.contains('hidden'))close()});
window.AJDReceipts={open,close,print,downloadPDF,printView,copyNumber,invoiceNo};
})();