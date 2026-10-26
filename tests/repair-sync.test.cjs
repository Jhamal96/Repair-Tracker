const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const {test}=require('node:test');
const context={window:{}};
runInNewContext(readFileSync(join(__dirname,'../ajd-repair-sync.js'),'utf8'),context);
const payload=(job,insert=false)=>JSON.parse(JSON.stringify(context.window.AJDRepairSync.payload(job,{insert})));
const repair={id:'AJTEST',customer_name:'Test Customer',customer_phone:'5550100000',make_model:'Test laptop',amount:145,deposit_amount:45,payment_status:'deposit_paid',status:'declined',parts:[{name:'Screen',cost:65}],invoice_number:'INV-EXISTING'};

test('old queued check-ins meet required cloud insert fields without changing ticket or payment data',()=>{
 const result=payload(repair,true);
 for(const key of ['id','customer_name','customer_phone','make_model','device_type'])assert.equal(typeof result[key],'string');
 assert.equal(result.device_type,'Device');
 for(const key of ['id','amount','deposit_amount','payment_status','status','parts'])assert.deepEqual(result[key],repair[key]);
 assert.equal(repair.device_type,undefined);
 assert.ok(!Object.hasOwn(result,'invoice_number'),'cloud-issued invoices remain immutable');
});

test('known device types survive inserts and updates',()=>{
 for(const insert of [true,false]){
  assert.equal(payload({...repair,device_type:'Laptop'},insert).device_type,'Laptop');
  assert.equal(payload({...repair,deviceType:'Tablet'},insert).device_type,'Tablet');
  assert.equal(payload({...repair,device_type:'iPhone',deviceType:'Tablet'},insert).device_type,'iPhone');
 }
});

test('missing or empty legacy types cannot clear an existing cloud category',()=>{
 for(const device_type of [undefined,null,'','   ']){
  const job={...repair,device_type};
  assert.ok(!Object.hasOwn(payload(job),'device_type'));
  assert.equal(payload(job,true).device_type,'Device');
 }
});
