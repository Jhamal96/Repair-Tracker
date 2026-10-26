const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const context={window:{},URL};
runInNewContext(readFileSync(join(__dirname,'../ajd-product-images.js'),'utf8'),context);
const urls=row=>Array.from(context.window.AJDProductImages.urls(row));

test('existing single-photo inventory and store records still display their photo',()=>{
 assert.deepEqual(urls({image_url:'https://example.test/cover.png'}),['https://example.test/cover.png']);
 assert.deepEqual(urls({image_url:'https://example.test/cover.png',image_urls:[]}),['https://example.test/cover.png']);
 assert.deepEqual(urls(null),[]);
});

test('saved gallery order controls the cover and rejects unsafe protocols',()=>{
 assert.deepEqual(urls({image_url:'https://example.test/old.png',image_urls:['https://example.test/new.png','javascript:alert(1)','https://example.test/side.png','https://example.test/new.png','data:image/svg+xml,unsafe']}),['https://example.test/new.png','https://example.test/side.png']);
});

test('gallery rendering respects the ten-photo cloud contract',()=>{
 assert.equal(context.window.AJDProductImages.MAX,10);
 const list=Array.from({length:12},(_,i)=>'https://example.test/'+i+'.png');
 assert.deepEqual(urls({image_urls:list}),list.slice(0,10));
});
