/* Non-destructive on-device product image enhancement. Uploaded original stays available until Save. */
(function(){
'use strict';
const load=file=>new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
 img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Cannot decode this image.'))};
 img.src=url;
});
const blobFrom=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
async function enhance(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Unsupported photo type');
 const img=await load(file);
 const width=img.naturalWidth,height=img.naturalHeight;
 if(!width||!height)throw new Error('Empty image dimensions');
 // Limit image processing and uploads; retain aspect ratio without cropping.
 const scale=Math.min(1,1800/Math.max(width,height));
 const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable');
 const sampler=document.createElement('canvas');sampler.width=64;sampler.height=64;
 const sc=sampler.getContext('2d',{willReadFrequently:true});sc.drawImage(img,0,0,64,64);
 const pixels=sc.getImageData(0,0,64,64).data;let lum=0,count=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<64)continue;lum+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];count++}
 const average=count?lum/count:125;
 const brightness=Math.max(.94,Math.min(1.15,130/Math.max(90,average)));
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.filter='brightness('+brightness.toFixed(3)+') contrast(1.065) saturate(1.055)';
 ctx.drawImage(img,0,0,w,h);ctx.filter='none';
 // Mild local sharpening preserves original product geometry and coloring.
 if(w>2&&h>2){
  const current=ctx.getImageData(0,0,w,h),source=current.data;
  const result=new Uint8ClampedArray(source),strength=.18;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=(y*w+x)*4;if(source[i+3]<240)continue;
   for(let c=0;c<3;c++){const val=source[i+c];const neighbors=(source[i-4+c]+source[i+4+c]+source[i-w*4+c]+source[i+w*4+c])*.25;result[i+c]=Math.max(0,Math.min(255,val+(val-neighbors)*strength))}
  }
  current.data.set(result);ctx.putImageData(current,0,0);
 }
 const type=file.type==='image/png'?'image/png':'image/jpeg';
 let blob=await blobFrom(canvas,type,.9);
 if(!blob)throw new Error('Unable to export enhanced image');
 if(blob.size>5*1024*1024){blob=await blobFrom(canvas,'image/jpeg',.77);if(!blob||blob.size>5*1024*1024)throw new Error('Enhanced photo is too large')}
 const name=file.name.replace(/\.[^.]+$/,'')+'-enhanced.'+(blob.type==='image/png'?'png':'jpg');
 return new File([blob],name,{type:blob.type,lastModified:Date.now()});
}
window.AJDInventoryImageEnhancer={enhance};
})();