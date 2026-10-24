
(function(){
'use strict';
const URL_SUPABASE='https://vxpufrahrnwmtgltjstd.supabase.co';
const KEY_SUPABASE='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const page=document.body.dataset.page;
const expensePage=page==='expenses';
const tableName=expensePage?'business_expenses':'planned_purchases';
const $=id=>document.getElementById(id);
const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
let client=null,items=[],authorized=false,busy=false,checkingAuth=null;
const pdfs=expensePage?window.AJDExpensePDFs:null;
const overall=expensePage?window.AJDExpenseOverview:null;
function setAccessView(title,message,offerLogin=false){
 const box=$('accessBlock');if(!box)return;
 $('accessTitle').textContent=title;
 $('accessMessage').textContent=message;
 const link=$('accessSignInLink');if(link)link.hidden=!offerLogin;
 const retry=$('accessRetryButton');if(retry)retry.hidden=!title.startsWith('⚠️');
 box.hidden=false;$('appContent').hidden=true;
}
function checkingSession(){
 setAccessView('🔄 Restoring your session…','Checking your saved administrator session. You should not need to sign in again when changing pages.',false);
}
function deniedSession(message,login=true){
 authorized=false;
 setAccessView(login?'🔒 Administrator Sign-In Required':'⚠️ Session verification unavailable',message,login);
}

const categories=expensePage?['Parts','Tools','Inventory','Supplies','Equipment','Shipping','Software','Marketing','Rent','Utilities','Travel','Vehicle','Meals','Other']:['Parts','Tools','Inventory','Equipment','Supplies','Software','Office','Marketing','Other'];
function el(tag,text,className){
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=String(text);
 if(className)node.className=className;
 return node;
}
function optionList(id,choices){
 const node=$(id);if(!node)return;
 for(const name of choices){const opt=document.createElement('option');opt.value=name;opt.textContent=name;node.appendChild(opt)}
}
function showMessage(msg,error=false){
 const status=$('message');status.textContent=msg;status.className='message '+(error?'error':'ok');status.hidden=false;
}
function clearMessage(){$('message').hidden=true}
function setLoading(text){$('loading').textContent=text||''}
function makeActions(row){
 const group=el('div',null,'table-actions');
 const edit=el('button','Edit','secondary');edit.type='button';edit.addEventListener('click',()=>openEditor(row));group.appendChild(edit);
 const del=el('button','Delete','danger');del.type='button';del.addEventListener('click',()=>removeItem(row));group.appendChild(del);
 if(!expensePage&&row.status!=='purchased'&&row.status!=='canceled'){
  const record=el('button','Record Expense');record.type='button';record.addEventListener('click',()=>convertToExpense(row));group.prepend(record);
 }
 return group;
}
function showEmpty(message){$('rows').replaceChildren();const tr=el('tr');const cell=el('td',message,'empty');cell.colSpan=expensePage?8:7;tr.appendChild(cell);$('rows').appendChild(tr)}
function makeCell(tr,content){const td=el('td');if(content instanceof Node)td.appendChild(content);else td.textContent=String(content??'');tr.appendChild(td);return td}
function filtered(){
 const q=$('search').value.trim().toLowerCase();
 const status=$('statusFilter').value;
 const month=$('monthFilter')?.value||'';
 return items.filter(item=>{
  if(month&&expensePage&&String(item.expense_date||'').slice(0,7)!==month)return false;
  if(status&&String(expensePage?item.category:item.status)!==status)return false;
  const searchable=expensePage?[item.description,item.vendor,item.category,item.notes]:[item.item_name,item.vendor,item.category,item.notes,item.product_url];
  return searchable.some(v=>String(v||'').toLowerCase().includes(q));
 });
}
function render(){
 const list=filtered();$('rows').replaceChildren();
 if(!list.length){showEmpty('Nothing matches these filters. Choose “Add” to create your first entry.')}
 for(const row of list){
  const tr=el('tr');
  if(expensePage){
   makeCell(tr,row.expense_date||'');
   const summary=el('div',row.description);if(row.vendor)summary.appendChild(el('small',row.vendor));makeCell(tr,summary);
   makeCell(tr,row.category);makeCell(tr,el('span',currency(row.amount),'amount'));
   makeCell(tr,row.payment_method||'—');makeCell(tr,row.tax_deductible?'Yes':'No');makeCell(tr,pdfs?.renderRow(row)||'—');makeCell(tr,makeActions(row));
  }else{
   const item=el('div',row.item_name);if(row.vendor)item.appendChild(el('small',row.vendor));makeCell(tr,item);
   makeCell(tr,row.category);makeCell(tr,el('span',currency(row.estimated_price),'amount'));
   makeCell(tr,row.quantity);makeCell(tr,el('span',row.priority,'pill '+row.priority));makeCell(tr,el('span',row.status,'pill '+row.status));
   const actions=makeActions(row);
   if(row.product_url){
    try{const url=new URL(row.product_url);if(url.protocol==='https:'||url.protocol==='http:'){const a=el('a','Link ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';actions.appendChild(a)}}catch(_){}
   }
   const td=makeCell(tr,actions);if(row.target_date)td.appendChild(el('small','Target '+row.target_date));
  }
  $('rows').appendChild(tr);
 }
 if(expensePage){
  const shown=list.reduce((s,x)=>s+Number(x.amount||0),0);
  const month=$('monthFilter').value;
  const monthTotal=items.filter(x=>String(x.expense_date).slice(0,7)===(month||new Date().toISOString().slice(0,7))).reduce((s,x)=>s+Number(x.amount||0),0);
  $('statOne').textContent=currency(monthTotal);
  $('statTwo').textContent=currency(shown);
  $('statThree').textContent=String(list.length);
 }else{
  const pending=items.filter(x=>x.status==='planned'||x.status==='ordered');
  const purchased=items.filter(x=>x.status==='purchased');
  $('statOne').textContent=currency(pending.reduce((s,x)=>s+Number(x.estimated_price||0)*Number(x.quantity||1),0));
  $('statTwo').textContent=currency(purchased.reduce((s,x)=>s+Number(x.estimated_price||0)*Number(x.quantity||1),0));
  $('statThree').textContent=String(pending.length);
 }
 $('entryCount').textContent=list.length+' of '+items.length+' records';
}
function openEditor(record){
 clearMessage();const form=$('editorForm');form.reset();
 const isEdit=Boolean(record);
 $('editId').value=record?.id||'';
 $('formHeading').textContent=(isEdit?'Edit ':'Add ')+(expensePage?'Expense':'Planned Purchase');
 if(expensePage){
  $('expenseDate').value=record?.expense_date||new Date().toLocaleDateString('en-CA');
  $('description').value=record?.description||'';
  $('category').value=record?.category||'Other';
  $('vendor').value=record?.vendor||'';
  $('amount').value=record?.amount??'';
  $('paymentMethod').value=record?.payment_method||'Other';
  $('taxDeductible').checked=Boolean(record?.tax_deductible);
  $('notes').value=record?.notes||'';
  pdfs?.editorRecord(record?.id||'');
 }else{
  $('itemName').value=record?.item_name||'';
  $('category').value=record?.category||'Equipment';
  $('vendor').value=record?.vendor||'';
  $('estimatedPrice').value=record?.estimated_price??'';
  $('quantity').value=record?.quantity||1;
  $('priority').value=record?.priority||'medium';
  $('targetDate').value=record?.target_date||'';
  $('purchaseStatus').value=record?.status||'planned';
  $('productUrl').value=record?.product_url||'';
  $('notes').value=record?.notes||'';
 }
 $('editorPanel').hidden=false;
 $('editorPanel').scrollIntoView({behavior:'smooth',block:'start'});
 (expensePage?$('description'):$('itemName')).focus();
}
function closeEditor(){$('editorPanel').hidden=true;$('editorForm').reset();$('editId').value='';pdfs?.closeEditor()}
function readPayload(){
 if(expensePage){
  const amount=Number($('amount').value);
  if(!Number.isFinite(amount)||amount<0)throw Error('Enter a valid nonnegative amount.');
  return{expense_date:$('expenseDate').value,description:$('description').value.trim(),category:$('category').value,vendor:$('vendor').value.trim(),amount,payment_method:$('paymentMethod').value,tax_deductible:$('taxDeductible').checked,notes:$('notes').value.trim(),updated_at:new Date().toISOString()};
 }
 const price=Number($('estimatedPrice').value),qty=Number($('quantity').value);
 if(!Number.isFinite(price)||price<0)throw Error('Enter a valid estimated price.');
 if(!Number.isInteger(qty)||qty<1||qty>10000)throw Error('Enter a quantity from 1 to 10,000.');
 const url=$('productUrl').value.trim();
 if(url){const parsed=new URL(url);if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')throw Error('Purchase link must begin with https:// or http://.')}
 return{item_name:$('itemName').value.trim(),category:$('category').value,vendor:$('vendor').value.trim(),estimated_price:price,quantity:qty,priority:$('priority').value,target_date:$('targetDate').value||null,status:$('purchaseStatus').value,product_url:url,notes:$('notes').value.trim(),updated_at:new Date().toISOString()};
}
async function save(event){
 event.preventDefault();if(!authorized||busy)return;
 let savedId='';
 try{
  const payload=readPayload();busy=true;$('saveButton').disabled=true;setLoading('Saving to Supabase…');
  const id=$('editId').value;
  const query=id?client.from(tableName).update(payload).eq('id',id):client.from(tableName).insert(payload);
  const {data,error}=await query.select('id').single();
  if(error)throw error;
  savedId=data?.id||id;
  if(!savedId)throw Error('No saved expense ID was returned.');
  if(expensePage&&pdfs){
    // The expense record must exist before private storage policies allow uploading.
    $('editId').value=savedId;
    pdfs.editorRecord(savedId);
    setLoading('Uploading and linking selected PDF receipts…');
    const result=await pdfs.uploadPending(savedId);
    if(result.failed.length){
      await load();
      showMessage('Expense saved, but '+result.failed.length+' PDF(s) could not upload: '+result.failed.join(' ')+'. Retry the remaining files.',true);
      return;
    }
    closeEditor();await load();
    showMessage(result.uploaded
      ?'Expense saved with '+result.uploaded+' private PDF attachment(s). You can view them in the Receipts column.'
      :'Expense saved successfully to the secure business database.');
  }else{
    closeEditor();await load();
    showMessage('Saved successfully to the secure business database.');
  }
 }catch(err){
  if(savedId){$('editId').value=savedId;pdfs?.editorRecord(savedId)}
  showMessage((savedId?'Expense saved, but attachment handling failed: ':'Could not save: ')+err.message,true)
 }
 finally{busy=false;$('saveButton').disabled=false;setLoading('')}
}
async function removeItem(record){
 if(!authorized||busy)return;
 if(!confirm('Delete this '+(expensePage?'expense':'planned purchase')+'? This cannot be undone.'))return;
 try{
  busy=true;setLoading('Deleting…');
  const {error}=await client.from(tableName).delete().eq('id',record.id);
  if(error)throw error;
  let cleanupError='';
  if(expensePage&&pdfs){
   try{await pdfs.cleanDeletedExpense(record.id)}catch(e){cleanupError=e.message}
  }
  await load();
  showMessage(cleanupError?'Expense deleted; some private PDF files could not be cleaned up automatically: '+cleanupError:'Entry deleted.',Boolean(cleanupError));
 }catch(err){showMessage('Could not delete: '+err.message,true)}
 finally{busy=false;setLoading('')}
}
async function convertToExpense(record){
 if(!authorized||busy||expensePage)return;
 const total=Number(record.estimated_price||0)*Number(record.quantity||1);
 if(!confirm('Record '+record.item_name+' as an actual business expense of '+currency(total)+' and mark the plan as purchased?'))return;
 busy=true;setLoading('Recording expense…');clearMessage();
 try{
  const today=new Date().toLocaleDateString('en-CA');
  const payload={expense_date:today,description:record.item_name,category:record.category,vendor:record.vendor||'',amount:total,payment_method:'Other',tax_deductible:false,notes:'From Planned Purchases',source_plan_id:record.id};
  const {error}=await client.from('business_expenses').insert(payload);
  if(error&&String(error.code)!=='23505')throw error;
  const {error:updateError}=await client.from('planned_purchases').update({status:'purchased',updated_at:new Date().toISOString()}).eq('id',record.id);
  if(updateError)throw updateError;
  await load();showMessage('Recorded in Business Expenses and marked as purchased.');
 }catch(err){showMessage('Could not record expense: '+err.message,true)}
 finally{busy=false;setLoading('')}
}
function downloadCSV(){
 const rows=filtered();
 const cols=expensePage?['expense_date','description','category','vendor','amount','payment_method','tax_deductible','notes']:['item_name','category','vendor','estimated_price','quantity','priority','target_date','status','product_url','notes'];
 const csv=[cols.join(',')].concat(rows.map(item=>cols.map(key=>'"'+String(item[key]??'').replaceAll('"','""')+'"').join(','))).join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=el('a');a.href=url;a.download=tableName+'-'+new Date().toLocaleDateString('en-CA')+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function load(){
 if(!authorized)return;
 setLoading('Loading secure cloud records…');
 try{
  const {data,error}=await client.from(tableName).select('*').order(expensePage?'expense_date':'created_at',{ascending:false}).limit(2000);
  if(error)throw error;
  items=data||[];
  if(expensePage&&pdfs){
    try{await pdfs.refresh()}catch(error){showMessage('Expenses loaded, but the PDF attachment list is unavailable: '+error.message,true)}
  }
  render();
  if(expensePage&&overall)await overall.refresh();
 }
 catch(err){showMessage('Cloud read failed: '+err.message,true);showEmpty('Unable to load data from Supabase.')}
 finally{setLoading('')}
}
async function start(){
 const theme=localStorage.getItem('ajd_theme_preference')||'dark';
 const dark=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.classList.toggle('dark',dark);
 $('year').textContent=new Date().getFullYear();
 $('accessRetryButton')?.addEventListener('click',()=>{void verifyAdminSession()});
 optionList('category',categories);
 optionList('statusFilter',expensePage?categories:['planned','ordered','purchased','canceled']);
 if(expensePage)$('monthFilter').value=new Date().toLocaleDateString('en-CA').slice(0,7);
 $('search').addEventListener('input',render);
 $('statusFilter').addEventListener('change',render);
 if(expensePage)$('monthFilter').addEventListener('change',render);
 $('newButton').addEventListener('click',()=>openEditor(null));
 $('cancelButton').addEventListener('click',closeEditor);
 $('editorForm').addEventListener('submit',save);
 $('exportButton').addEventListener('click',downloadCSV);
 $('clearFilters').addEventListener('click',()=>{$('search').value='';$('statusFilter').value='';if(expensePage)$('monthFilter').value='';render()});
 try{
  checkingSession();
  if(!window.supabase?.createClient)throw Error('Supabase library could not load. Check your connection and reload.');
  client=window.supabase.createClient(URL_SUPABASE,KEY_SUPABASE);
  if(expensePage){
    if(!pdfs)throw Error('PDF attachment tools did not load. Refresh the page.');
    pdfs.init(client);
    pdfs.requestEdit=openEditor;
    pdfs.notifyChange=render;
    if(!overall)throw Error('Overall spending dashboard did not load. Refresh the page.');
    overall.init(client);
  }
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      deniedSession('Your account has signed out. Please sign in again on the dashboard.');
      items=[];if(expensePage)pdfs?.closeEditor();
    }else if(event==='SIGNED_IN'&&!authorized){
      setTimeout(()=>{void verifyAdminSession()},0);
    }
  });
  await verifyAdminSession();
 }catch(err){deniedSession(err.message,false)}
}
async function verifyAdminSession(){
 if(checkingAuth)return checkingAuth;
 checkingAuth=(async()=>{
  if(!authorized)checkingSession();
  try{
   const {data:{session},error:authError}=await client.auth.getSession();
   if(authError)throw authError;
   if(!session){deniedSession('Your Supabase session is not active on this website. Sign in once to access all admin pages.');return}
   const {data:isAdmin,error}=await client.rpc('ajd_is_admin');
   if(error)throw error;
   if(isAdmin!==true){deniedSession('This account is signed in, but it is not authorized to access AJD admin records.');return}
   authorized=true;
   $('accessBlock').hidden=true;$('appContent').hidden=false;
   await load();
  }catch(err){
    if(!authorized)deniedSession('We could not verify your saved session: '+err.message+'. Try refreshing once; your records are safe.',false);
    else showMessage('Unable to refresh secure data: '+err.message,true);
  }
 })().finally(()=>{checkingAuth=null});
 return checkingAuth;
}
document.addEventListener('DOMContentLoaded',start);
})();
