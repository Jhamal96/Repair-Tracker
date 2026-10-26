(function AJDStoreCart(){
'use strict';
const $=id=>document.getElementById(id);
const STORAGE_KEY='ajd_store_cart_v1';
const MAX_DIFFERENT=12;
const MAX_ITEMS=99;
const endpoint='https://vxpufrahrnwmtgltjstd.supabase.co/functions/v1/store-request';
const apikey='sb_publishable_tRjMtsoo9aT-6n7dzj9p-w_HsUqJ520';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
let cart=new Map(),pending=false,sent=false,focusFrom=null;
const getProducts=()=>typeof window.AJDStoreCatalog==='function'?window.AJDStoreCatalog():[];
const byId=id=>getProducts().find(p=>p.id===id);
const available=p=>p&&p.status==='available'?Math.max(0,Number(p.stock_quantity)-Number(p.reserved_quantity||0)):0;
function restore(){
 try{
  const parsed=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
  if(!Array.isArray(parsed))return;
  for(const row of parsed.slice(0,MAX_DIFFERENT)){
   if(typeof row?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(row.id))continue;
   const n=Number(row.quantity);
   if(Number.isInteger(n)&&n>0&&n<=99)cart.set(row.id,n);
  }
 }catch(error){console.warn('AJD cart memory could not be restored:',error)}
}
function save(){
 try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify([...cart].map(([id,quantity])=>({id,quantity}))))}
 catch(error){console.warn('AJD cart storage unavailable:',error)}
}
function count(){let n=0;for(const qty of cart.values())n+=qty;return n}
function sum(){let total=0;for(const [id,n] of cart)total+=(Number(byId(id)?.price)||0)*n;return total}
function node(tag,txt,cls){
 const e=document.createElement(tag);
 if(txt!==undefined&&txt!==null)e.textContent=String(txt);
 if(cls)e.className=cls;
 return e;
}
function button(text,label,action,cls){
 const b=node('button',text,cls);b.type='button';
 b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;
}
function setMessage(message,error=false){
 const box=$('cartStatus');
 box.textContent=String(message||'');
 box.className='cart-status'+(error?' is-error':' is-success');
 box.hidden=!message;
}
function adjust(id,next){
 if(pending||sent)return;
 if(!cart.has(id))return;
 const amount=Number(next);
 if(!Number.isInteger(amount)||amount<0)return;
 if(amount===0){cart.delete(id);save();render();return}
 const limit=Math.min(99,available(byId(id)));
 const other=count()-cart.get(id);
 if(amount>limit){setMessage('There are only '+limit+' unit(s) currently available for that item.',true);return}
 if(amount+other>MAX_ITEMS){setMessage('You can request a maximum of '+MAX_ITEMS+' units in one cart.',true);return}
 cart.set(id,amount);save();setMessage('');render();
}
function add(id){
 const item=byId(id);
 if(!item){window.alert('This product is unavailable. Refresh the store and try again.');return false}
 const cap=available(item);
 const current=cart.get(id)||0;
 if(sent)resetCheckout();
 if(cap<=current){window.alert('You have already selected all available units of this product.');return false}
 if(!current&&cart.size>=MAX_DIFFERENT){window.alert('You can choose up to '+MAX_DIFFERENT+' different products in one request.');return false}
 if(count()>=MAX_ITEMS){window.alert('You can choose up to '+MAX_ITEMS+' items in one request.');return false}
 cart.set(id,current+1);save();render();show();
 setMessage(item.title+' added to your cart.');
 return true;
}
function remove(id){if(pending||sent)return;cart.delete(id);save();render()}
function render(){
 const n=count();
 $('cartBadge').textContent=String(n);
 $('cartHeaderButton').setAttribute('aria-label','Open shopping cart with '+n+' selected item(s)');
 $('cartHeaderButton').title=n+' item(s) selected';
 $('cartSubtotal').textContent=money(sum());
 $('cartItemsTotal').textContent=n+' unit'+(n===1?'':'s')+' · '+cart.size+' product'+(cart.size===1?'':'s');
 const box=$('cartItems');box.replaceChildren();
 if(!cart.size){
  const empty=node('div',null,'cart-empty');
  empty.append(node('span','🛒','cart-empty-emoji'),node('strong','Your cart is empty'),node('p','Add products from the storefront to request them together.'));
  box.append(empty);
 }else{
  for(const [id,qty] of cart){
   const product=byId(id);
   const row=node('div',null,'cart-line');
   const left=node('div',null,'cart-line-info');
   const title=node('strong',product?.title||'Item no longer available');
   left.append(title,node('small',(product?money(product.price)+' each':'Unavailable')+' · '+money((Number(product?.price)||0)*qty)));
   const max=available(product);
   if(!product||max<qty||max===0)left.append(node('small',product?'Only '+max+' in stock — adjust quantity':'This product has been removed from the store','cart-stock-warning'));
   const controls=node('div',null,'cart-qty');
   controls.append(
    button('−','Decrease '+(product?.title||'item')+' quantity',()=>adjust(id,qty-1)),
    node('span',String(qty),'cart-qty-number'),
    button('+','Increase '+(product?.title||'item')+' quantity',()=>adjust(id,qty+1)),
    button('✕','Remove '+(product?.title||'item'),()=>remove(id),'cart-remove')
   );
   row.append(left,controls);box.append(row);
  }
 }
 const stockValid=[...cart].every(([id,qty])=>byId(id)&&available(byId(id))>=qty&&qty>0);
 const submit=$('cartSendBtn');
 submit.disabled=pending||sent||!cart.size||!stockValid;
 if(!sent)submit.textContent=pending?'Sending your request…':'Send Request for '+cart.size+' Product'+(cart.size===1?'':'s');
 $('cartCheckoutFields').hidden=!cart.size||sent;
 $('cartCheckoutForm').hidden=!cart.size||sent;
 $('cartCheckoutSummary').hidden=!cart.size;
 if(!stockValid&&cart.size&&!pending&&!sent)setMessage('Some items are out of stock or exceed available quantities. Update your selections before submitting.',true);
}
function resetCheckout(){
 sent=false;pending=false;$('cartCheckoutForm').reset();
 setMessage('');render();
}
function show(){
 const overlay=$('cartOverlay');
 if(!overlay.classList.contains('open'))focusFrom=document.activeElement;
 overlay.classList.add('open');document.body.classList.add('ajd-cart-open');
 render();
 $('cartCloseButton').focus({preventScroll:true});
}
function hide(){
 if(pending)return;
 $('cartOverlay').classList.remove('open');document.body.classList.remove('ajd-cart-open');
 if(focusFrom&&document.contains(focusFrom))focusFrom.focus({preventScroll:true});
}
function contactValid(){
 const phone=$('cartCustomerPhone');phone.setCustomValidity('');
 const digits=phone.value.replace(/\D/g,'');
 if(!/^\+?[\d\s().-]+$/.test(phone.value.trim())||digits.length<7||digits.length>15){
  phone.setCustomValidity('Enter a valid phone number with 7–15 digits.');
  phone.reportValidity();return false;
 }
 const email=$('cartCustomerEmail');
 if(email.value.trim()&&!email.checkValidity()){email.reportValidity();return false}
 return true;
}
async function submit(event){
 event.preventDefault();
 if(pending||sent||!cart.size||!contactValid())return;
 const list=[...cart].map(([item_id,quantity])=>({item_id,quantity}));
 if(list.some(item=>!byId(item.item_id)||available(byId(item.item_id))<item.quantity)){
  setMessage('Stock has changed. Adjust the highlighted item quantities before submitting.',true);render();return;
 }
 const body={
  items:list,
  customer_name:$('cartCustomerName').value.trim(),
  customer_phone:$('cartCustomerPhone').value.trim(),
  customer_email:$('cartCustomerEmail').value.trim(),
  notes:$('cartCustomerNotes').value.trim(),
  website:$('cartWebsite').value
 };
 pending=true;setMessage('Sending your selections securely…');render();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(endpoint,{method:'POST',mode:'cors',
    headers:{'content-type':'application/json','apikey':apikey},
    signal:controller.signal,body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true||!data.request_id)throw Error(data.error||'Could not confirm purchase request.');
  sent=true;
  const distinct=cart.size;
  const code=String(data.request_id).slice(0,8).toUpperCase();
  setMessage('✓ Your request for '+distinct+' product'+(distinct===1?'':'s')+' was received! Reference: '+code+'. We will confirm availability and contact you. This is not a completed purchase.');
  cart.clear();save();
  $('cartCheckoutForm').reset();
 }catch(error){
  const msg=error.name==='AbortError'
   ?'Connection timed out. Your request may have been received. Check with the shop before resubmitting.'
   :error instanceof TypeError
    ?'Unable to connect to the shop. Check your internet connection and try again.'
    :error.message;
  setMessage('Unable to submit: '+msg,true);
 }finally{clearTimeout(timeout);pending=false;render();}
}
function refresh(){render()}
function init(){
 restore();
 $('cartHeaderButton').addEventListener('click',show);
 $('cartCloseButton').addEventListener('click',hide);
 $('cartContinueButton').addEventListener('click',hide);
 $('cartCheckoutForm').addEventListener('submit',submit);
 $('cartCustomerPhone').addEventListener('input',()=>{$('cartCustomerPhone').setCustomValidity('')});
 $('cartOverlay').addEventListener('click',event=>{if(event.target===$('cartOverlay'))hide()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('cartOverlay').classList.contains('open'))hide()});
 render();
}
window.AJDStoreCart={add,show,refresh,count};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();