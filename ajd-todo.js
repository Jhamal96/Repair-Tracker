/* AJD's Wireless Repairs: shared admin task list. No customer data or session tokens are cached here. */
(function AJDTodo(){
 'use strict';
 const $=id=>document.getElementById(id);
 const isMain=Boolean($('tabBtnRepairs'));
 const isEditor=document.body.dataset.page==='todo';
 if(!isMain&&!isEditor)return;
 const TABLE='ajd_todos';
 const COLUMNS='id,title,notes,priority,due_date,completed,created_at,updated_at';
 const priorities={high:0,normal:1,low:2};
 let tasks=[],active=false,loaded=false,loading=false,busy=false,errorText='';
 let generation=0,readVersion=0,previousTab=document.body.dataset.activeTab||'repairs';
 let popupRequested=isMain,dialog=null,returnFocus=null,refreshTimer=null;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el};
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const overdue=task=>!task.completed&&task.due_date&&task.due_date<today();
 const client=()=>isMain?(typeof window.initSupabase==='function'?window.initSupabase():null):window.AJDTools?.client;
 const authorized=()=>isMain?(typeof isCloudAdmin!=='undefined'&&isCloudAdmin===true&&!document.body.classList.contains('admin-locked')):(window.AJDTools?.admin===true&&document.body.classList.contains('ajd-tools-verified'));
 const sorted=rows=>[...rows].sort((a,b)=>Number(a.completed)-Number(b.completed)||(priorities[a.priority]??1)-(priorities[b.priority]??1)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||b.created_at.localeCompare(a.created_at));
 const setText=(id,value)=>{if($(id))$(id).textContent=value};
 function notify(text,error=false){
  errorText=error?text:'';
  if(isEditor){setText('pageFeedback',text);$('pageFeedback').classList.toggle('error',error)}
  if(isMain)setText('todoPopupFeedback',error?text:'');
 }
 function dateLabel(date){
  if(!date)return '';
  // Parse as a local calendar date, so a due date never shifts a day in Miami.
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(date+'T12:00:00'));
 }
 function taskRow(task,compact=false){
  const row=node('article',undefined,'todo-task'+(task.completed?' is-complete':''));row.dataset.todoId=task.id;
  const check=node('input',undefined,'todo-check');check.type='checkbox';check.checked=task.completed;check.disabled=busy;
  check.setAttribute('aria-label',(task.completed?'Reopen task: ':'Complete task: ')+task.title);
  check.addEventListener('change',()=>{const next=check.checked;check.checked=task.completed;void mutate(task.id,{completed:next})});
  const copy=node('div',undefined,'todo-task-copy');copy.append(node('h3',task.title,'todo-task-title'));
  if(task.notes)copy.append(node('p',task.notes,'todo-task-notes'));
  const meta=node('div',undefined,'todo-task-meta');
  meta.append(node('span',task.priority==='high'?'High priority':task.priority==='low'?'Low priority':'Normal priority','todo-badge '+task.priority));
  if(task.due_date)meta.append(node('span',(overdue(task)?'Overdue · ':'Due ')+dateLabel(task.due_date),'todo-badge'+(overdue(task)?' overdue':'')));
  if(task.completed)meta.append(node('span','Completed','todo-badge done'));
  copy.append(meta);row.append(check,copy);
  if(!compact){
   const actions=node('div',undefined,'todo-task-actions');
   const edit=node('button','Edit','tools-button');edit.type='button';edit.disabled=busy;edit.setAttribute('aria-label','Edit task: '+task.title);edit.addEventListener('click',()=>editTask(task.id));
   const remove=node('button','Remove','tools-button danger');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove task: '+task.title);remove.addEventListener('click',()=>{void removeTask(task.id)});
   actions.append(edit,remove);row.append(actions);
  }
  return row;
 }
 function renderList(root,rows,compact=false){
  if(!root)return;root.replaceChildren();root.setAttribute('aria-busy',String(loading));
  if(!loaded){root.append(node('p',errorText?'Your list could not load. Please retry.':'Loading your private to-do list…','todo-empty'));return}
  if(!rows.length){root.append(node('p',compact?'All caught up! Add your next task on the To-do List page.':tasks.length?'No tasks match this view.':'Your list is ready. Add your first task to get started.','todo-empty'));return}
  for(const task of sorted(rows))root.append(taskRow(task,compact));
 }
 function render(){
  if(!active)return;
  const open=tasks.filter(t=>!t.completed);
  if(isEditor){
   setText('todoOpenCount',loaded?open.length:'—');setText('todoHighCount',loaded?open.filter(t=>t.priority==='high').length:'—');setText('todoOverdueCount',loaded?open.filter(overdue).length:'—');setText('todoDoneCount',loaded?tasks.length-open.length:'—');
   const q=$('todoSearch').value.trim().toLocaleLowerCase(),filter=$('todoFilter').value;
   const rows=tasks.filter(t=>{
    if(filter==='open'&&t.completed)return false;
    if(filter==='completed'&&!t.completed)return false;
    if(filter==='high'&&(t.completed||t.priority!=='high'))return false;
    if(filter==='overdue'&&!overdue(t))return false;
    return (t.title+' '+t.notes).toLocaleLowerCase().includes(q);
   });
   renderList($('todoList'),rows);
   $('todoSave').disabled=busy||!loaded;$('todoRefresh').disabled=loading||busy;
   setText('todoSyncStatus',busy?'Saving your change…':loading?'Refreshing your list…':errorText?'Could not sync. Your last loaded list is shown.':loaded?'Saved securely · '+tasks.length+' task'+(tasks.length===1?'':'s'):'Loading your tasks…');
  }
  if(isMain&&dialog){
   const menuCount=document.querySelector('[data-ajd-id="todo"] .ajd-menu-chevron');
   if(menuCount)menuCount.textContent=loaded?String(open.length):'›';
   setText('todoPopupSummary',loaded?(open.length?open.length+' open task'+(open.length===1?'':'s')+' for your shop'+(open.filter(overdue).length?' · '+open.filter(overdue).length+' overdue':'')+'. Check off anything you finish.':'You’re all caught up. Keep your next shop reminder here.'):'Let’s check what’s on your list.');
   setText('todoPopupLoading',busy?'Saving…':loading?'Refreshing securely…':'');
   renderList($('todoPopupList'),open,true);
   $('todoPopupRetry').hidden=!errorText;$('todoPopupRetry').disabled=loading||busy;
  }
 }
 async function refresh(){
  if(!active||!authorized()||busy)return;
  const epoch=generation,version=++readVersion;loading=true;render();
  try{
   const sb=client();if(!sb)throw Error('The connection is unavailable.');
   // Page through the API limit instead of silently hiding older tasks.
   const rows=[];let start=0;
   while(true){
    const {data,error}=await sb.from(TABLE).select(COLUMNS).order('created_at',{ascending:false}).order('id',{ascending:true}).range(start,start+499);
    if(error)throw error;
    rows.push(...(data||[]));if(!data||data.length<500)break;start+=500;
   }
   if(epoch!==generation||version!==readVersion||!authorized())return;
   tasks=rows;loaded=true;
   if(errorText)notify('');
  }catch(error){
   if(epoch!==generation||version!==readVersion||!authorized())return;
   notify('Your to-do list could not refresh. Check your connection and retry. '+(error.message||''),true);
  }finally{
   if(epoch===generation&&version===readVersion&&authorized()){loading=false;render();maybeShowPopup()}
  }
 }
 async function mutate(id,changes,kind='update'){
  if(busy||!active||!authorized())return false;
  const epoch=generation;busy=true;++readVersion;loading=false;notify('');render();
  try{
   let query=client().from(TABLE);
   if(kind==='delete')query=query.delete().eq('id',id);
   else if(kind==='insert')query=query.insert(changes);
   else query=query.update(changes).eq('id',id);
   const {data,error}=await query.select(COLUMNS).single();
   if(error)throw error;
   if(!data)throw Error('The task was not saved. Refresh the list and retry.');
   if(epoch!==generation||!authorized())return false;
   if(kind==='delete')tasks=tasks.filter(t=>t.id!==id);
   else{const existing=tasks.findIndex(t=>t.id===data.id);if(existing<0)tasks.push(data);else tasks[existing]=data}
   notify(kind==='delete'?'Task removed.':kind==='insert'?'Task added.':changes.completed===true?'Task completed.':changes.completed===false?'Task reopened.':'Task updated.');
   // Notify other tabs without storing any private task text on this device.
   try{localStorage.setItem('ajd_todos_changed',String(Date.now())+Math.random())}catch(_){}
   return true;
  }catch(error){
   if(epoch===generation&&authorized())notify('Your change was not saved. '+(error.message||'Check your connection and retry.'),true);
   return false;
  }finally{if(epoch===generation){busy=false;render()}}
 }
 function resetForm(){
  if(!isEditor)return;
  $('todoForm').reset();$('todoEditId').value='';$('todoCancel').hidden=true;
  setText('todoFormTitle','Add a task');setText('todoSave','＋ Add Task');
 }
 function editTask(id){
  if(busy)return;const task=tasks.find(t=>t.id===id);if(!task)return;
  $('todoEditId').value=id;$('todoTitle').value=task.title;$('todoNotes').value=task.notes;$('todoPriority').value=task.priority;$('todoDueDate').value=task.due_date||'';
  setText('todoFormTitle','Edit task');setText('todoSave','✓ Save Changes');$('todoCancel').hidden=false;
  $('todoForm').scrollIntoView({behavior:'smooth',block:'center'});$('todoTitle').focus({preventScroll:true});
 }
 async function removeTask(id){
  const task=tasks.find(t=>t.id===id);if(!task||busy||!confirm('Remove “'+task.title+'” from your to-do list?'))return;
  if(await mutate(id,{},'delete')){if($('todoEditId').value===id)resetForm()}
 }
 function buildPopup(){
  dialog=node('dialog');dialog.id='ajdTodoReminder';dialog.setAttribute('aria-labelledby','todoPopupTitle');dialog.setAttribute('aria-describedby','todoPopupSummary');
  const head=node('div',undefined,'todo-popup-top');const icon=node('span','☑','todo-popup-icon');icon.setAttribute('aria-hidden','true');
  const copy=node('div',undefined,'todo-popup-heading');copy.append(node('p',"AJD'S WIRELESS REPAIRS"));const title=node('h2','Your to-do list');title.id='todoPopupTitle';copy.append(title);
  const close=node('button','×','todo-popup-close');close.type='button';close.setAttribute('aria-label','Close to-do reminder');close.addEventListener('click',closePopup);head.append(icon,copy,close);
  const summary=node('p','Let’s check what’s on your list.','todo-popup-summary');summary.id='todoPopupSummary';
  const body=node('div',undefined,'todo-popup-body');
  const feedback=node('p',undefined,'todo-popup-feedback');feedback.id='todoPopupFeedback';feedback.setAttribute('role','alert');
  const retry=node('button','↻ Retry','todo-popup-retry');retry.id='todoPopupRetry';retry.type='button';retry.hidden=true;retry.addEventListener('click',()=>{void refresh()});
  const progress=node('p',undefined,'todo-popup-loading');progress.id='todoPopupLoading';progress.setAttribute('role','status');
  const list=node('div',undefined,'todo-list');list.id='todoPopupList';
  const note=node('p','This reminder returns whenever you open the dashboard or come back to Repairs.','todo-popup-note');body.append(feedback,retry,progress,list,note);
  const foot=node('div',undefined,'todo-popup-footer');const manage=node('a','＋ Add / Edit Tasks');manage.href='/todo';const done=node('button','Continue to Dashboard');done.id='todoPopupContinue';done.type='button';done.addEventListener('click',closePopup);foot.append(manage,done);dialog.append(head,summary,body,foot);document.body.append(dialog);
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected&&!document.body.classList.contains('admin-locked'))returnFocus.focus({preventScroll:true})});
 }
 function closePopup(){if(dialog?.open)dialog.close()}
 function maybeShowPopup(){
  if(!isMain||!popupRequested||!active||!authorized()||document.visibilityState==='hidden')return;
  popupRequested=false;
  if(!dialog.open){returnFocus=document.activeElement;dialog.showModal()}
 }
 function requestPopup(){
  popupRequested=true;if(!active||!authorized())return;maybeShowPopup();void refresh();
 }
 function checkAccess(){
  const allowed=authorized();
  if(allowed&&!active){active=true;generation++;loaded=false;errorText='';render();maybeShowPopup();void refresh()}
  else if(!allowed&&active){
   active=false;generation++;readVersion++;tasks=[];loaded=false;loading=false;busy=false;popupRequested=isMain;closePopup();resetForm();
   for(const id of ['todoList','todoPopupList'])$(id)?.replaceChildren();
   if(isMain){setText('ajdTodoQuickCount','…');setText('todoPopupSummary','');setText('todoPopupFeedback','')}
  }
  if(isMain){const tab=document.body.dataset.activeTab||'repairs';if(tab==='repairs'&&previousTab!==tab)requestPopup();previousTab=tab}
 }
 function init(){
  if(isMain)buildPopup();
  if(isEditor){
   $('todoSearch').addEventListener('input',render);$('todoFilter').addEventListener('change',render);$('todoRefresh').addEventListener('click',()=>{void refresh()});$('todoCancel').addEventListener('click',resetForm);
   $('todoForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!loaded||!authorized())return;
    const title=$('todoTitle').value.trim();if(!title){$('todoTitle').setCustomValidity('Enter a task.');$('todoTitle').reportValidity();return}
    const id=$('todoEditId').value;const data={title,notes:$('todoNotes').value.trim(),priority:$('todoPriority').value,due_date:$('todoDueDate').value||null};
    if(await mutate(id,data,id?'update':'insert')){resetForm();$('todoTitle').focus()}
   });
   $('todoTitle').addEventListener('input',()=>$('todoTitle').setCustomValidity(''));
   document.addEventListener('ajd-admin-ready',checkAccess);
  }
  new MutationObserver(checkAccess).observe(document.body,{attributes:true,attributeFilter:['class','data-active-tab']});
  window.addEventListener('pageshow',event=>{checkAccess();if(event.persisted&&isMain)requestPopup()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){checkAccess();if(isMain)requestPopup();else void refresh()}});
  window.addEventListener('online',()=>{if(active)void refresh()});
  window.addEventListener('storage',event=>{if(event.key==='ajd_todos_changed'&&active)void refresh()});
  refreshTimer=setInterval(()=>{if(active&&document.visibilityState==='visible'&&(isEditor||dialog?.open))void refresh()},30000);
  window.addEventListener('pagehide',()=>{if(dialog?.open)dialog.close()});
  checkAccess();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
