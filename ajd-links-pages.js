(function AJDLinksPages(){
'use strict';
const T=window.AJDTools,{read,save,node,safeUrl,message,$}=T;
const LINK_KEY='ajd_managed_links_v1',QUEUE_KEY='ajd_links_pending_v1';
const defaults=[
 {id:'request',label:'Customer Request Form',url:'/request',icon:'📝'},
 {id:'store',label:'Customer Storefront',url:'/store',icon:'🛍️'},
 {id:'track',label:'Track My Repair',url:'/track',icon:'🔎'},
 {id:'call',label:'Call Shop',url:'tel:7869707779',icon:'📞'}
];
const page=document.body.dataset.page;
let links=[],busy=false,loadedEditor=false;
const queue=()=>{const q=read(QUEUE_KEY,[]);return Array.isArray(q)?q:[]};
function localLinks(){
 const old=read(LINK_KEY,null);
 const list=Array.isArray(old)?old.filter(x=>x&&typeof x.id==='string'&&typeof x.label==='string'&&safeUrl(x.url)).map(x=>({...x})):defaults.map(x=>({...x}));
 if(!Array.isArray(old))save(LINK_KEY,list);
 return list;
}
function persist(){
 save(LINK_KEY,links);
 document.dispatchEvent(new CustomEvent('ajd-links-updated'));
 render();
}
function mark(op){
 const pending=queue().filter(x=>x.id!==op.id);
 pending.push(op);save(QUEUE_KEY,pending);
}
async function sync(){
 if(!T.admin)return {saved:0,error:'Administrator session required'};
 const pending=queue();let saved=0;
 try{
  if(!pending.length)return {saved};
  const {error:marker}=await T.client.from('admin_links').upsert({id:'__initialized__',label:'Links initialized',url:'about:blank',icon:'',position:-9999},{onConflict:'id'});
  if(marker)throw marker;
  for(const op of pending){
   let error;
   if(op.kind==='delete'){
    ({error}=await T.client.from('admin_links').delete().eq('id',op.id));
   }else if(op.kind==='upsert'&&op.item&&safeUrl(op.item.url)){
    const item=op.item;
    ({error}=await T.client.from('admin_links').upsert({id:item.id,label:item.label,url:item.url,icon:item.icon||'',position:links.findIndex(l=>l.id===item.id)},{onConflict:'id'}));
   }else throw Error('Invalid pending link change');
   if(error)throw error;
   const latest=queue(),record=latest.find(x=>x.id===op.id);
   if(record&&JSON.stringify(record)===JSON.stringify(op))save(QUEUE_KEY,latest.filter(x=>x.id!==op.id));
   saved++;
  }
  return {saved};
 }catch(error){return {saved,error:error.message||String(error)}}
}
async function load(){
 if(!T.admin)return;
 links=localLinks();
 const {data,error}=await T.client.from('admin_links').select('id,label,url,icon,position').order('position',{ascending:true});
 if(error){
  message('Showing links saved on this device; cloud retrieval failed: '+error.message,true);
  render();return;
 }
 const cloud=(data||[]).filter(x=>x.id!=='__initialized__'&&safeUrl(x.url)).map(x=>({id:x.id,label:x.label,url:x.url,icon:x.icon||''}));
 if(cloud.length){
  const map=new Map(cloud.map(x=>[x.id,x]));
  for(const op of queue()){if(op.kind==='delete')map.delete(op.id);else if(op.item)map.set(op.id,op.item)}
  links=[...map.values()];
  persist();
 }
 render();
}
function action(label,handler,cls=''){
 const button=node('button',label,'tools-button '+cls);button.type='button';button.addEventListener('click',handler);return button;
}
function render(){
 if(page!=='links')return;
 const area=$('allLinks');if(!area)return;area.replaceChildren();
 const term=($('linkSearch').value||'').trim().toLowerCase();
 const shown=links.filter(x=>[x.label,x.url,x.icon].join(' ').toLowerCase().includes(term));
 $('linkCount').textContent=links.length+' saved shortcuts · '+queue().length+' queued changes';
 if(!shown.length){area.append(node('div',links.length?'No links match your search.':'No saved links yet. Add one to get started.','list-empty'));return}
 for(const l of shown){
  const row=node('article',null,'link-record');
  const icon=node('span',l.icon||'🔗','link-icon');
  const info=node('div',null,'link-info');info.append(node('h3',l.label),node('p',l.url));
  const buttons=node('div',null,'tools-actions');
  const dest=safeUrl(l.url);
  if(dest){
   const open=node('a','↗ Open','tools-button');open.href=dest;
   open.target=dest.startsWith('tel:')||dest.startsWith('mailto:')?'_self':'_blank';
   if(open.target==='_blank')open.rel='noopener noreferrer';
   buttons.append(open);
  }
  const edit=node('a','✎ Edit','tools-button primary');edit.href='/link-editor?edit='+encodeURIComponent(l.id);buttons.append(edit);
  const index=links.findIndex(x=>x.id===l.id);
  const up=action('↑',()=>move(l.id,-1));up.title='Move up';up.disabled=index===0;
  const down=action('↓',()=>move(l.id,1));down.title='Move down';down.disabled=index===links.length-1;
  buttons.append(up,down,action('✕ Remove',()=>remove(l.id),'danger'));
  row.append(icon,info,buttons);area.append(row);
 }
}
function move(id,offset){
 const index=links.findIndex(x=>x.id===id),next=index+offset;
 if(index<0||next<0||next>=links.length)return;
 [links[index],links[next]]=[links[next],links[index]];
 for(const item of links)mark({id:item.id,kind:'upsert',item});
 persist();void sync().then(result=>{if(result.error)message('Order saved locally; sync pending: '+result.error,true);else message('Shortcut order updated.')});
}
async function remove(id){
 const item=links.find(x=>x.id===id);
 if(!item||!confirm('Remove '+item.label+' from your Links menu?'))return;
 links=links.filter(x=>x.id!==id);
 mark({id,kind:'delete'});persist();
 const result=await sync();
 if(result.error)message('Link removed on this device; cloud deletion pending: '+result.error,true);
 else message('Link removed from your shared quick links.');
 render();
}
function loadEditor(){
 if(loadedEditor)return;loadedEditor=true;
 const id=new URLSearchParams(location.search).get('edit');
 const item=id?links.find(x=>x.id===id):null;
 if(id&&!item){message('The selected link was not found. Create a new link below.',true)}
 $('editorTitle').textContent=item?'Edit Link':'Add New Link';
 $('editLinkId').value=item?.id||'';
 $('editLinkName').value=item?.label||'';
 $('editLinkUrl').value=item?.url||'';
 $('editLinkIcon').value=item?.icon||'';
}
async function submit(event){
 event.preventDefault();
 if(!T.admin||busy)return;
 const name=$('editLinkName').value.trim(),url=safeUrl($('editLinkUrl').value),icon=$('editLinkIcon').value.trim();
 if(!name||name.length>100||!url||icon.length>8){message('Add a valid link name, URL or page path, and optional short icon.',true);return}
 const id=$('editLinkId').value||crypto.randomUUID();
 const item={id,label:name,url,icon};
 const position=links.findIndex(x=>x.id===id);
 if(position<0)links.push(item);else links[position]=item;
 mark({id,kind:'upsert',item});persist();
 busy=true;$('saveLinkButton').disabled=true;
 message('Link saved. Publishing to Supabase…');
 const result=await sync();
 busy=false;$('saveLinkButton').disabled=false;
 if(result.error){$('editLinkId').value=id;message('Saved on this device; cloud sync remains queued: '+result.error+'. Retry from Cloud Synchronization.',true)}
 else{message('Shortcut saved and synchronized.');location.href='/links'}
}
async function start(){
 await load();
 if(page==='links'){
  $('linkSearch').addEventListener('input',render);
  $('refreshLinksButton').addEventListener('click',()=>{void load()});
 }else{
  loadEditor();
  $('linkEditorForm').addEventListener('submit',submit);
 }
}
document.addEventListener('ajd-admin-ready',()=>{void start()});
})();