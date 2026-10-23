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
 $('receiptPrintButton').disabled=!ready;
 $('receiptPrintButton').title=ready?'Print on your receipt printer or save as PDF':'Sync this repair to the cloud first';
 $('receiptReadyMessage').textContent=ready?
   'Print on 80mm thermal paper, or choose Save as PDF in your browser’s print dialog.':
   'This repair has not yet received a permanent invoice number. Sync it to Supabase, then reopen the receipt.';
 $('invoiceModal').classList.remove('hidden');
 $('receiptPrintButton').focus({preventScroll:true});
}
function close(){
 $('invoiceModal').classList.add('hidden');current=null;
 if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});
 returnFocus=null;
}
function print(){
 if(!current||!invoiceNo(current))return;
 if(window.AJDNativePrint&&typeof window.AJDNativePrint.printReceipt==='function')window.AJDNativePrint.printReceipt();
 else window.print();
}
function copyNumber(){
 const value=invoiceNo(current);if(!value)return;
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).catch(()=>{});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('invoiceModal')?.classList.contains('hidden'))close()});
window.AJDReceipts={open,close,print,copyNumber,invoiceNo};
})();