const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const {test}=require('node:test');
const context={window:{},document:{createElement:()=>({}),head:{appendChild(){}}},Intl,Uint8Array,atob};
runInNewContext(readFileSync(join(__dirname,'../ajd-invoice-fonts.js'),'utf8'),context);
runInNewContext(readFileSync(join(__dirname,'../ajd-invoices.js'),'utf8'),context);
runInNewContext(readFileSync(join(__dirname,'../ajd-pdf-tools.js'),'utf8'),context);
const invoice=context.window.AJDInvoices;
const job={id:'AJTEST',invoice_number:'INV-101',customer_name:'Test Customer',customer_phone:'5550100000',make_model:'Test tablet',issue:'Screen replacement',parts:[{name:'Replacement screen',cost:876.54}],part_cost:876.54,labor_cost:987.65,amount:150,deposit_amount:50,payment_status:'unpaid',created_at:'2026-10-01T12:00:00Z',status:'pending'};

test('requested deposits are not counted as received payments',()=>{
 const data=invoice.model(job);
 assert.equal(data.total,150);assert.equal(data.required,50);assert.equal(data.paid,0);assert.equal(data.balance,150);
 assert.equal(data.state,'PAYMENT DUE');
 assert.match(invoice.html(data),/Deposit still due: \$50.00/);
 assert.throws(()=>context.window.AJDPdfTools.receipt(job,{paid:0}),/Use Invoice/);
});

test('deposit and full-payment invoices keep the original invoice and correct balance',()=>{
 const deposit=invoice.model({...job,payment_status:'deposit_paid'});
 assert.equal(deposit.number,job.invoice_number);assert.equal(deposit.paid,50);assert.equal(deposit.balance,100);
 const paid=invoice.model({...job,payment_status:'paid_in_full'});
 assert.equal(paid.paid,150);assert.equal(paid.balance,0);assert.equal(paid.state,'PAID IN FULL');
 assert.equal(job.payment_status,'unpaid');
});

test('draft and declined invoices are clearly labeled',()=>{
 const draft=invoice.model({...job,invoice_number:null});assert.ok(draft.draft);assert.match(invoice.html(draft),/DRAFT INVOICE/);
 const declined=invoice.model({...job,status:'declined'});assert.equal(declined.state,'REPAIR DECLINED');
 assert.match(declined.note,/does not request payment/);assert.match(invoice.html(declined),/Quoted balance/);
 assert.equal(invoice.model({...job,amount:0}).state,'NO PAYMENT DUE');
});

test('customer documents exclude internal costs and escape customer text',()=>{
 const data=invoice.model({...job,customer_name:'<img src=x onerror=alert(1)>',technician_notes:'PRIVATE_NOTE'});
 const html=invoice.html(data),pdf=Buffer.from(invoice.pdfBytes(data)).toString('latin1');
 assert.match(html,/&lt;img/);assert.ok(!html.includes('<img src=x'));
 for(const text of ['876.54','987.65','PRIVATE_NOTE','part_cost','labor_cost']){
  assert.ok(!html.includes(text));assert.ok(!pdf.includes(text));
 }
 assert.match(pdf,/\/MediaBox \[0 0 612 792\]/);assert.match(pdf,/INV-101/);
 assert.match(pdf,/\/FontFile2/,'invoice fonts are embedded for consistent printing');
});

test('long service descriptions and unbroken text flow onto additional pages',()=>{
 const parts=Array.from({length:110},(_,i)=>({name:'Customer service item '+i+' '+('W'.repeat(130))}));
 const pdf=Buffer.from(invoice.pdfBytes(invoice.model({...job,parts}))).toString('latin1');
 assert.ok((pdf.match(/\/Type \/Page\s/g)||[]).length>1);
 assert.match(pdf,/Customer service item 109/);assert.match(pdf,/Balance due/);
});
