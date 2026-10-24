(function ExpensePDFs(){
'use strict';
const BUCKET='ajd-expense-pdfs';
const TABLE='business_expense_attachments';
const MAX_BYTES=15*1024*1024;
const $=id=>document.getElementById(id);
let client=null,records=[],draftFiles=[],activeExpenseId='',previewUrl='',activeRow=null,busy=false;
const notify=(message,isError=false)=>{
 const m=$('message');
 if(m){m.textContent=message;m.className='message '+(isError?'error':'ok');m.hidden=false;}
};
function escapeText(v){return String(v||'').slice(0,220)}
function node(tag,txt,cls){const el=document.createElement(tag);if(txt!==undefined&&txt!==null)el.textContent=String(txt);if(cls)el.className=cls;return el}
function find(id){return records.filter(a=>a.expense_id===id)}
function count(id){return find(id).length}
function validate(file){
 if(!file)throw Error('Choose a PDF document.');
 if(!file.name.toLowerCase().endsWith('.pdf')||file.type&&file.type!=='application/pdf')throw Error(file.name+': only PDF files are supported.');
 if(file.size<5||file.size>MAX_BYTES)throw Error(file.name+': PDF must be 15 MB or smaller.');
}
async function validatePDFHeader(file){
 validate(file);
 const bytes=await file.slice(0,5).arrayBuffer();
 const header=Array.from(new Uint8Array(bytes)).map(x=>String.fromCharCode(x)).join('');
 if(header!=='%PDF-')throw Error(file.name+': file contents do not look like a valid PDF.');
}
function setDrafts(files){
 const errs=[],valid=[];
 for(const f of Array.from(files||[])){
  try{validate(f);valid.push(f)}catch(e){errs.push(e.message)}
 }
 draftFiles=valid;
 const e=$('expensePdfPending');
 if(e){
  e.replaceChildren();
  if(!valid.length)e.appendChild(node('p','No PDFs selected yet.','sub'));
  else for(const file of valid){
   const li=node('div',null,'expense-pdf-pending-row');
   li.append(node('span','📄 '+escapeText(file.name)),node('small',(file.size/1024/1024).toFixed(2)+' MB'));
   e.appendChild(li);
  }
 }
 if(errs.length)notify(errs.join(' '),true);
}
function button(text,action,cls='secondary'){
 const b=node('button',text,cls);b.type='button';b.addEventListener('click',action);return b;
}
function editorRecord(id){
 activeExpenseId=id||'';
 drawEditor();
}
function drawEditor(){
 const list=$('expensePdfSaved');if(!list)return;
 list.replaceChildren();
 const saved=find(activeExpenseId);
 if(!activeExpenseId){list.appendChild(node('p','Save this expense to attach your PDFs securely.','sub'));return}
 if(!saved.length){list.appendChild(node('p','No PDF attachments saved for this expense.','sub'));return}
 for(const att of saved){
  const row=node('div',null,'expense-pdf-saved-row');
  const info=node('span','📄 '+escapeText(att.file_name));
  const actions=node('span',null,'expense-pdf-inline-actions');
  actions.append(button('View',()=>viewFile(att),'secondary'),button('Download',()=>downloadFile(att),'secondary'),button('Remove',()=>removeFile(att),'danger'));
  row.append(info,actions);list.appendChild(row);
 }
}
function renderRow(expense){
 const n=count(expense.id);
 return button(n?'📄 View PDFs ('+n+')':'＋ Add PDF',()=>{
  if(n)openLibrary(expense);
  else{
   document.getElementById('editorPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
   document.getElementById('editorForm')&&window.AJDExpensePDFs?.requestEdit?.(expense);
  }
 },n?'expense-pdf-count':'expense-pdf-empty');
}
function stateBusy(on){busy=on;const e=$('expensePdfUpload');if(e)e.disabled=on}
async function refresh(){
 if(!client)return;
 const {data,error}=await client.from(TABLE).select('id,expense_id,storage_path,file_name,file_size,created_at').order('created_at',{ascending:false}).limit(4000);
 if(error)throw error;
 records=data||[];
 drawEditor();
 if(activeRow)drawLibrary();
}
function readFileInput(){
 const input=$('expensePdfUpload');setDrafts(input?.files||[]);
}
async function uploadPending(expenseId){
 if(!client)throw Error('Secure account connection required');
 if(!draftFiles.length)return {uploaded:0,failed:[]};
 const files=draftFiles.slice(),failures=[],uploadedIds=[];
 for(const file of files){
  let path='';
  try{
   await validatePDFHeader(file);
   path='expenses/'+expenseId+'/'+crypto.randomUUID()+'.pdf';
   const {error:uploadError}=await client.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:'application/pdf',cacheControl:'3600'});
   if(uploadError)throw uploadError;
   const {data,error:metaError}=await client.from(TABLE).insert({
    expense_id:expenseId,storage_path:path,file_name:escapeText(file.name),
    file_size:file.size,mime_type:'application/pdf'
   }).select('id').single();
   if(metaError||!data){
    await client.storage.from(BUCKET).remove([path]);
    throw metaError||Error('File metadata could not be saved.');
   }
   uploadedIds.push(data.id);
  }catch(err){
   failures.push(escapeText(file.name)+': '+err.message);
  }
 }
 draftFiles=[];
 if($('expensePdfUpload'))$('expensePdfUpload').value='';
 setDrafts([]);
 await refresh();
 return {uploaded:uploadedIds.length,failed:failures};
}
function showModal(){
 $('expensePdfModal').hidden=false;
 $('closeExpensePdfModal').focus();
}
function closeModal(){
 $('expensePdfModal').hidden=true;
 $('expensePdfFrame').src='about:blank';
 $('expensePdfFrame').hidden=true;
 $('expensePdfPreviewHelp').textContent='Select View to preview a private PDF.';
 $('expensePdfOpenTab').hidden=true;
 previewUrl='';activeRow=null;
}
function openLibrary(expense){
 activeRow=expense;
 $('expensePdfModalTitle').textContent='Receipts for '+escapeText(expense.description);
 showModal();drawLibrary();
}
function drawLibrary(){
 const e=$('expensePdfLibrary');if(!e)return;
 e.replaceChildren();
 const attachments=find(activeRow?.id);
 if(!attachments.length){e.appendChild(node('p','No PDF attachments yet. Open the expense to add one.','sub'));return}
 for(const att of attachments){
  const row=node('div',null,'expense-pdf-library-row');
  const left=node('div',null,'expense-pdf-library-name');
  left.append(node('strong','📄 '+escapeText(att.file_name)),node('small',(att.file_size/1024/1024).toFixed(2)+' MB · '+new Date(att.created_at).toLocaleDateString()));
  const actions=node('div',null,'expense-pdf-inline-actions');
  actions.append(button('👁 View',()=>viewFile(att),'secondary'),button('↓ Download',()=>downloadFile(att),'secondary'),button('✕ Delete',()=>removeFile(att),'danger'));
  row.append(left,actions);e.appendChild(row);
 }
}
async function viewFile(att){
 if(!client||busy)return;
 try{
  $('expensePdfPreviewHelp').textContent='Loading your private PDF…';
  if($('expensePdfModal').hidden)openLibrary({id:att.expense_id,description:'Expense document'});
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(att.storage_path,120);
  if(error||!data?.signedUrl)throw error||Error('Signed file access is unavailable.');
  previewUrl=data.signedUrl;
  const frame=$('expensePdfFrame');
  frame.src=previewUrl;frame.hidden=false;
  const open=$('expensePdfOpenTab');
  open.href=previewUrl;open.hidden=false;open.target='_blank';open.rel='noopener noreferrer';
  $('expensePdfPreviewHelp').textContent='PDF preview. If it does not appear on your device, use Open PDF or Download.';
 }catch(err){
  $('expensePdfPreviewHelp').textContent='Unable to open PDF: '+err.message;
  notify('Could not view PDF: '+err.message,true);
 }
}
async function downloadFile(att){
 if(!client||busy)return;
 try{
  $('expensePdfPreviewHelp').textContent='Preparing a secure download…';
  const {data:blob,error}=await client.storage.from(BUCKET).download(att.storage_path);
  if(error||!blob)throw error||Error('Download unavailable.');
  // Installed Android WebView cannot download blob: links reliably; use its
  // native Save PDF bridge for documents up to the supported native size.
  if(window.AJDNativePrint?.savePdf&&blob.size<=4000000){
   const buffer=new Uint8Array(await blob.arrayBuffer());
   let binary='';
   for(let i=0;i<buffer.length;i+=16384)binary+=String.fromCharCode(...buffer.subarray(i,i+16384));
   window.AJDNativePrint.savePdf(btoa(binary),escapeText(att.file_name));
  }else{
   const url=URL.createObjectURL(blob);
   const link=node('a');link.href=url;link.download=escapeText(att.file_name);document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),45000);
  }
  $('expensePdfPreviewHelp').textContent='Download requested. Check your Downloads folder or save-file picker.';
 }catch(err){notify('Could not download PDF: '+err.message,true);}
}
async function removeFile(att){
 if(!client||busy)return;
 if(!confirm('Permanently delete the PDF '+escapeText(att.file_name)+'?'))return;
 try{
  stateBusy(true);
  const {error}=await client.storage.from(BUCKET).remove([att.storage_path]);
  if(error)throw error;
  const {error:metaErr}=await client.from(TABLE).delete().eq('id',att.id);
  if(metaErr)throw metaErr;
  records=records.filter(x=>x.id!==att.id);
  drawEditor();drawLibrary();
  if(typeof window.AJDExpensePDFs?.notifyChange==='function')window.AJDExpensePDFs.notifyChange();
  notify('PDF attachment deleted.');
 }catch(err){notify('Could not delete PDF: '+err.message,true);}
 finally{stateBusy(false)}
}
async function cleanDeletedExpense(id){
 const paths=find(id).map(v=>v.storage_path);
 if(!paths.length)return;
 const {error}=await client.storage.from(BUCKET).remove(paths);
 if(error)throw error;
 records=records.filter(r=>r.expense_id!==id);
}
function init(sb){
 client=sb;
 const input=$('expensePdfUpload');
 if(input)input.addEventListener('change',readFileInput);
 const close=$('closeExpensePdfModal');
 if(close)close.addEventListener('click',closeModal);
 const modal=$('expensePdfModal');
 if(modal)modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)closeModal()});
 setDrafts([]);
}
function closeEditor(){
 activeExpenseId='';draftFiles=[];
 if($('expensePdfUpload'))$('expensePdfUpload').value='';
 setDrafts([]);drawEditor();
}
window.AJDExpensePDFs={init,refresh,editorRecord,uploadPending,renderRow,count,closeEditor,cleanDeletedExpense,
 openLibrary,downloadFile,viewFile,requestEdit:null,notifyChange:null};
})();