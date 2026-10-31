(function AJDAdminEntryPopups(){
'use strict';
const $=id=>document.getElementById(id);
const openDialogs=[];
let partContext='intake',returnFocus=null;
const isLocked=()=>document.body.classList.contains('admin-locked');
const button=(text,kind='bg-slate-200 dark:bg-slate-800')=>{
  const b=document.createElement('button');b.type='button';b.className='btn '+kind;b.textContent=text;return b;
};
function activeDialog(){return ['ajdPartEntryOverlay','ajdLaborEntryOverlay','ajdProductEntryOverlay','intakePanel'].map($).find(e=>e && !(e.hidden||e.classList.contains('hidden')));}
function lock(){document.body.classList.toggle('ajd-entry-lock',!!activeDialog());}
function restore(fallback){lock();if(!activeDialog()){const f=returnFocus&&returnFocus.isConnected?returnFocus:fallback; if(f&&typeof f.focus==='function')f.focus({preventScroll:true});returnFocus=null;}}
function remember(){if(!activeDialog())returnFocus=document.activeElement;}
function setDialogVisible(id,show){
 const el=$(id);if(!el)return;
 el.hidden=!show;
 if(show){lock();setTimeout(()=>{const first=el.querySelector('input:not([type=hidden]),textarea,select,button');first?.focus({preventScroll:true})},0)}
 else restore($(id==='ajdProductEntryOverlay'?'addStoreProductButton':'addNewRepairButton'));
}
function createOverlay(id,title,small=false){
 const layer=document.createElement('div');layer.id=id;layer.className='ajd-entry-overlay'+(small?' ajd-entry-small':'');layer.hidden=true;
 layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label',title);
 const shell=document.createElement('div');shell.className='ajd-entry-shell';
 const head=document.createElement('div');head.className='ajd-entry-header';
 const heading=document.createElement('h2');heading.textContent=title;heading.id=id+'Title';layer.setAttribute('aria-labelledby',heading.id);layer.removeAttribute('aria-label');
 const close=button('✕ Close');close.setAttribute('aria-label','Close '+title);close.addEventListener('click',()=>closeDialog(id));
 head.append(heading,close);shell.append(head);layer.append(shell);document.body.append(layer);
 layer.addEventListener('click',e=>{if(e.target===layer)closeDialog(id)});
 return {layer,shell,heading};
}
function closeDialog(id){
 if(id==='intakePanel'){window.closeNewRepairForm?.();lock();return}
 if(id==='ajdProductEntryOverlay')closeProduct();
 if(id==='ajdPartEntryOverlay')setDialogVisible(id,false);
 if(id==='ajdLaborEntryOverlay')setDialogVisible(id,false);
}
function initRepair(){
 const panel=$('intakePanel');if(!panel)return;
 panel.classList.add('ajd-entry-repair');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 panel.setAttribute('aria-label','New customer repair check-in');
 const card=document.createElement('div');card.className='ajd-entry-repair-card';
 while(panel.firstChild)card.appendChild(panel.firstChild);
 panel.append(card);
 panel.addEventListener('click',e=>{if(e.target===panel)window.closeNewRepairForm?.()});
 new MutationObserver(()=>lock()).observe(panel,{attributes:true,attributeFilter:['class']});
}
function openProduct(mode='add'){
 if(isLocked())return;
 const overlay=$('ajdProductEntryOverlay');if(!overlay)return;
 remember();
 if(mode==='add')window.resetProductForm?.();
 $('ajdProductEntryOverlayTitle').textContent=mode==='edit'?'✏️ Edit Store Item':'＋ Add Store Item';
 setDialogVisible('ajdProductEntryOverlay',true);
 $('productTitle')?.focus({preventScroll:true});
}
function closeProduct(){setDialogVisible('ajdProductEntryOverlay',false)}
function initProduct(){
 const form=$('productForm'),layout=form?.parentElement;
 if(!form||!layout)return;
 const invList=[...layout.children].find(el=>el!==form);
 layout.classList.add('ajd-inventory-layout');
 if(invList)invList.classList.add('ajd-inventory-list-area');
 const {shell}=createOverlay('ajdProductEntryOverlay','Add Store Item');
 form.classList.add('ajd-entry-product-form');
 shell.append(form); // Keep the existing form and submit handlers intact.
 const toolbar=$('viewInventory')?.querySelector('h2')?.parentElement;
 const trigger=button('＋ Add Store Item','bg-blue-600 text-white ajd-entry-trigger');
 trigger.id='addStoreProductButton';trigger.addEventListener('click',()=>openProduct('add'));
 toolbar?.append(trigger);
 const cancel=button('Cancel');cancel.addEventListener('click',closeProduct);
 form.querySelector('button[type=submit]')?.parentElement?.append(cancel);
}
function initPart(){
 const {shell}=createOverlay('ajdPartEntryOverlay','Add a Repair Part',true);
 const form=document.createElement('form');form.className='ajd-entry-panel';form.id='ajdPartEntryForm';
 const label1=document.createElement('label');label1.className='lbl';label1.textContent='Part name / notes';
 const name=document.createElement('input');name.id='ajdPartEntryName';name.className='field';name.required=true;name.maxLength=160;name.placeholder='e.g. OLED Display';label1.append(name);
 const label2=document.createElement('label');label2.className='lbl';label2.textContent='Part cost ($)';
 const cost=document.createElement('input');cost.id='ajdPartEntryCost';cost.className='field';cost.type='number';cost.min='0';cost.max='1000000';cost.step='.01';cost.required=true;cost.value='0';label2.append(cost);
 const actions=document.createElement('div');actions.className='ajd-entry-actions';
 const cancel=button('Cancel');cancel.onclick=()=>setDialogVisible('ajdPartEntryOverlay',false);
 const add=button('＋ Add Part','bg-blue-600 text-white');add.type='submit';actions.append(cancel,add);
 form.append(label1,label2,actions);shell.append(form);
 form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  if(!['intake','edit'].includes(partContext))return;
  window.addPartRow?.(partContext,{name:name.value.trim(),cost:Number(cost.value)});
  setDialogVisible('ajdPartEntryOverlay',false);
 });
}
function openPart(prefix){
 if(isLocked()||!['intake','edit'].includes(prefix))return;
 if(!$(prefix+'PartsList'))return;
 remember();partContext=prefix;
 const form=$('ajdPartEntryForm');form.reset();$('ajdPartEntryCost').value='0';
 setDialogVisible('ajdPartEntryOverlay',true);$('ajdPartEntryName').focus({preventScroll:true});
}
function initLabor(){
 const input=$('newLaborName'),price=$('newLaborPrice');
 const old= input?.parentElement;
 const oldButton=old?.nextElementSibling;
 if(!old||!oldButton||!oldButton.textContent.includes('Add / Update Labor'))return;
 const {shell}=createOverlay('ajdLaborEntryOverlay','Add / Update Labor Rate',true);
 const form=document.createElement('form');form.className='ajd-entry-panel';form.id='ajdLaborEntryForm';
 form.append(old,oldButton);oldButton.removeAttribute('onclick');oldButton.type='submit';
 const cancel=button('Cancel');cancel.onclick=()=>setDialogVisible('ajdLaborEntryOverlay',false);
 form.append(cancel);shell.append(form);
 const trigger=button('＋ Add Labor Rate','bg-blue-600 text-white w-full mt-2');
 $('laborPresetList')?.after(trigger);
 trigger.addEventListener('click',()=>openLabor(false));
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!input.value.trim())return input.focus();
  if(!price.checkValidity()){price.reportValidity();return}
  window.addLaborPreset?.();setDialogVisible('ajdLaborEntryOverlay',false);
 });
}
function openLabor(edit=false){
 if(isLocked())return;remember();
 if(!edit){$('newLaborName').value='';$('newLaborPrice').value=''}
 setDialogVisible('ajdLaborEntryOverlay',true);$('newLaborName')?.focus({preventScroll:true});
}
function trapTabs(event,dialog){
 const elements=[...dialog.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(el=>!el.disabled&&el.getClientRects().length&&el.getAttribute('tabindex')!=='-1');
 if(!elements.length)return;
 const first=elements[0],last=elements[elements.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function init(){
 if(!$('intakePanel')||!$('productForm'))return;
 initRepair();initProduct();initPart();initLabor();
 document.addEventListener('keydown',e=>{
  const dialog=['ajdPartEntryOverlay','ajdLaborEntryOverlay','ajdProductEntryOverlay','intakePanel'].map($).find(el=>el&&!el.hidden&&!el.classList.contains('hidden'));
  if(!dialog)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDialog(dialog.id)}
  else if(e.key==='Tab')trapTabs(e,dialog);
 },true);
}
window.AJDAdminPopups={openProduct,closeProduct,openPart,openLabor,closeLabor:()=>setDialogVisible('ajdLaborEntryOverlay',false)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
