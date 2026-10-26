/* Public product inspection uses only the storefront's existing public catalog. */
(function AJDStoreDetails(){
'use strict';
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
let dialog,photoDialog,current=null,returnFocus=null,photoFocus=null,photoIndex=0,photoUrls=[],zoomed=false;
const stock=product=>product?.status==='available'?Math.max(0,Number(product.stock_quantity||0)-Number(product.reserved_quantity||0)):0;
function node(tag,text,cls){const result=document.createElement(tag);if(text!==undefined)result.textContent=String(text);if(cls)result.className=cls;return result}
function closePhoto(){
 if(!photoDialog?.open)return;
 photoDialog.close();$('ajdPhotoImage').removeAttribute('src');photoUrls=[];
 if(photoFocus&&document.contains(photoFocus))photoFocus.focus({preventScroll:true});photoFocus=null;
}
function close(){
 closePhoto();if(!dialog?.open)return;
 dialog.close();current=null;document.body.classList.remove('ajd-product-open');
 if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});returnFocus=null;
}
function showPhoto(index){
 photoIndex=(index+photoUrls.length)%photoUrls.length;zoomed=false;
 $('ajdPhotoStage').classList.remove('is-zoomed');$('ajdPhotoStage').scrollTo(0,0);
 $('ajdPhotoZoom').textContent='Zoom In';$('ajdPhotoZoom').setAttribute('aria-pressed','false');
 const image=$('ajdPhotoImage');image.hidden=false;$('ajdPhotoError').hidden=true;
 image.alt=String(current?.title||'Product')+' - photo '+(photoIndex+1)+' of '+photoUrls.length;image.src=photoUrls[photoIndex];
 $('ajdPhotoCount').textContent=(photoIndex+1)+' / '+photoUrls.length;
 $('ajdPhotoPrevious').disabled=photoUrls.length<2;$('ajdPhotoNext').disabled=photoUrls.length<2;
}
function openPhoto(index){
 if(!current)return;photoUrls=window.AJDProductImages.urls(current);if(!photoUrls.length)return;
 photoFocus=document.activeElement;$('ajdPhotoTitle').textContent=current.title||'Product photos';showPhoto(index);
 photoDialog.showModal();$('ajdPhotoClose').focus({preventScroll:true});
}
function ensureDialogs(){
 if(dialog)return;
 dialog=document.createElement('dialog');dialog.id='ajdProductDialog';dialog.setAttribute('aria-labelledby','ajdProductTitle');
 dialog.innerHTML='<div class="ajd-detail-head"><div><p class="ajd-detail-kicker">PRODUCT DETAILS</p><h2 id="ajdProductTitle"></h2></div><button type="button" id="ajdProductClose" aria-label="Close product details">✕</button></div><div class="ajd-detail-layout"><section class="ajd-detail-photos" aria-label="Product photos"><div id="ajdProductGallery"></div><p class="ajd-detail-photo-hint">Tap a photo to enlarge it.</p></section><section class="ajd-detail-info"><span id="ajdProductAvailability" class="ajd-detail-availability"></span><p id="ajdProductPrice" class="ajd-detail-price"></p><dl id="ajdProductFacts" class="ajd-detail-facts"></dl><h3>About this item</h3><p id="ajdProductDescription" class="ajd-detail-description"></p><div class="ajd-detail-actions"><button type="button" id="ajdProductAdd">Add to Cart</button><button type="button" id="ajdProductRequest">Request to Purchase</button></div><p class="ajd-detail-note">Purchase requests are reviewed before availability or purchase is confirmed.</p></section></div>';
 photoDialog=document.createElement('dialog');photoDialog.id='ajdPhotoDialog';photoDialog.setAttribute('aria-labelledby','ajdPhotoTitle');
 photoDialog.innerHTML='<div class="ajd-photo-head"><h2 id="ajdPhotoTitle"></h2><div><button type="button" id="ajdPhotoZoom" aria-pressed="false">Zoom In</button><button type="button" id="ajdPhotoClose" aria-label="Close enlarged photo">✕</button></div></div><div id="ajdPhotoStage" class="ajd-photo-stage" tabindex="0" aria-label="Enlarged product photo"><img id="ajdPhotoImage" alt=""><p id="ajdPhotoError" hidden>This photo is unavailable. Try another photo.</p></div><div class="ajd-photo-navigation"><button type="button" id="ajdPhotoPrevious" aria-label="Previous enlarged photo">‹ Previous</button><span id="ajdPhotoCount" role="status" aria-live="polite"></span><button type="button" id="ajdPhotoNext" aria-label="Next enlarged photo">Next ›</button></div>';
 document.body.append(dialog,photoDialog);
 $('ajdProductClose').addEventListener('click',close);$('ajdPhotoClose').addEventListener('click',closePhoto);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});photoDialog.addEventListener('cancel',event=>{event.preventDefault();closePhoto()});
 for(const [element,action] of [[dialog,close],[photoDialog,closePhoto]])element.addEventListener('click',event=>{if(event.target===element)action()});
 $('ajdPhotoImage').addEventListener('error',()=>{$('ajdPhotoImage').hidden=true;$('ajdPhotoError').hidden=false});
 $('ajdPhotoPrevious').addEventListener('click',()=>showPhoto(photoIndex-1));$('ajdPhotoNext').addEventListener('click',()=>showPhoto(photoIndex+1));
 photoDialog.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();showPhoto(photoIndex+(event.key==='ArrowLeft'?-1:1))}});
 $('ajdPhotoZoom').addEventListener('click',()=>{zoomed=!zoomed;$('ajdPhotoStage').classList.toggle('is-zoomed',zoomed);$('ajdPhotoZoom').textContent=zoomed?'Fit to Screen':'Zoom In';$('ajdPhotoZoom').setAttribute('aria-pressed',String(zoomed))});
 $('ajdProductAdd').addEventListener('click',()=>{if(!current||!stock(current))return;const id=current.id;close();window.AJDStoreCart?.add(id)});
 $('ajdProductRequest').addEventListener('click',()=>{if(!current||!stock(current))return;const id=current.id;close();window.AJDStoreRequest?.(id)});
}
function open(product,initialIndex=0,trigger=document.activeElement){
 if(!product||product.status==='hidden')return;
 ensureDialogs();
 const latest=typeof window.AJDStoreCatalog==='function'?window.AJDStoreCatalog().find(item=>item.id===product.id):null;
 current=latest||product;if(current.status==='hidden')return;
 if(!dialog.open)returnFocus=trigger;
 $('ajdProductTitle').textContent=current.title||'Product details';
 $('ajdProductPrice').textContent=money(current.price);
 const quantity=stock(current),available=quantity>0;
 $('ajdProductAvailability').textContent=available?'Available · '+quantity+' in stock':'Currently out of stock';
 $('ajdProductAvailability').classList.toggle('is-unavailable',!available);
 const facts=$('ajdProductFacts');facts.replaceChildren();
 for(const [label,value] of [['Category',current.category],['Brand',current.brand],['Model',current.model],['Series',current.device_family],['Capacity',current.capacity],['Color',current.color],['Condition',current.condition]]){
  if(String(value||'').trim())facts.append(node('dt',label),node('dd',value));
 }
 $('ajdProductDescription').textContent=current.description||'Contact the shop for more information about this item.';
 $('ajdProductAdd').disabled=!available;$('ajdProductRequest').disabled=!available;
 const gallery=window.AJDProductImages.gallery(current,{initialIndex,onPhotoClick:openPhoto});
 $('ajdProductGallery').replaceChildren(gallery);
 dialog.querySelector('.ajd-detail-photo-hint').hidden=!window.AJDProductImages.urls(current).length;
 document.body.classList.add('ajd-product-open');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('ajdProductClose').focus({preventScroll:true});
}
window.AJDStoreDetails={open,close};
})();
