import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
const identity={'x-authentik-username':'viewer','x-authentik-uid':'user-a','x-authentik-name':'Viewer "One"'};
async function fixture(t,options={}) {
 const app=createApp(options);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(()=>app.close());return 'http://127.0.0.1:'+app.address().port;
}
test('identity fails closed and JSON safely escapes display names',async t=>{
 const base=await fixture(t);
 assert.equal((await fetch(base+'/api/me')).status,401);
 assert.equal((await fetch(base+'/',{headers:{'x-authentik-username':'viewer'}})).status,401);
 const r=await fetch(base+'/api/me',{headers:identity});const u=await r.json();
 assert.equal(u.name,'Viewer "One"');assert.equal(u.id.length,64);
 const other=await (await fetch(base+'/api/me',{headers:{...identity,'x-authentik-uid':'user-b'}})).json();
 assert.notEqual(u.id,other.id);
});
test('registry keeps configured URLs and tokens off the client',async t=>{
 const base=await fixture(t,{addons:[{name:'Source',url:'https://addon.example/secret/manifest.json'}],fetcher:async()=>Response.json({name:'Source',catalogs:[],resources:['stream'],types:['movie']})});
 const data=await(await fetch(base+'/api/addons',{headers:identity})).text();
 assert.ok(!data.includes('secret'));assert.ok(!data.includes('addon.example'));
 assert.equal(JSON.parse(data)[0].ok,true);
});
test('catalog search encoding and fixed upstream selection',async t=>{
 let visited='';
 const base=await fixture(t,{addons:[{url:'https://addon.example/config/manifest.json'}],fetcher:async url=>{visited=url;return Response.json({metas:[]});}});
 const res=await fetch(base+'/api/addon/0/catalog/movie/top?search=A%2FB%20%26%20C',{headers:identity});
 assert.equal(res.status,200);assert.equal(visited,'https://addon.example/config/catalog/movie/top/search=A%2FB%20%26%20C.json');
 assert.equal((await fetch(base+'/api/addon/0/stream/movie/a/b',{headers:identity})).status,400);
 assert.equal((await fetch(base+'/api/addon/900/stream/movie/title',{headers:identity})).status,502);
 assert.equal((await fetch(base+'/api/arbitrary?url=https://other.example',{headers:identity})).status,404);
});
test('one failed addon does not prevent other catalogs loading',async t=>{
 const base=await fixture(t,{addons:[{name:'Bad',url:'https://bad.example/manifest.json'},{name:'Good',url:'https://good.example/manifest.json'}],fetcher:async url=>{if(url.includes('bad'))throw Error('private upstream details');return Response.json({name:'Good',catalogs:[]});}});
 const rows=await(await fetch(base+'/api/addons',{headers:identity})).json();assert.equal(rows[0].ok,false);assert.equal(rows[1].ok,true);
 const error=await(await fetch(base+'/api/addon/0/meta/movie/tt123',{headers:identity})).text();assert.ok(!error.includes('private'));
});
test('stream calls are never cached',async t=>{
 let calls=0;const base=await fixture(t,{addons:[{url:'https://a.example/manifest.json'}],fetcher:async()=>{calls++;return Response.json({streams:[]});}});
 for(let i=0;i<2;i++)await fetch(base+'/api/addon/0/stream/movie/tt123',{headers:identity});
 assert.equal(calls,2);
});
test('addon discovery streams fast results before slow manifests finish',async t=>{
 let release;const gate=new Promise(r=>release=r);t.after(()=>release());
 const base=await fixture(t,{addons:[{url:'https://slow.example/manifest.json'},{url:'https://fast.example/manifest.json'}],fetcher:async url=>{if(url.includes('slow'))await gate;return Response.json({name:url.includes('slow')?'Slow':'Fast',catalogs:[]});}});
 const response=await fetch(base+'/api/addons?live=1',{headers:identity});
 assert.match(response.headers.get('content-type'),/ndjson/);
 const reader=response.body.getReader();const first=await reader.read();
 const row=JSON.parse(new TextDecoder().decode(first.value).trim());
 assert.equal(row.name,'Fast');assert.equal(row.index,1);
 release();while(!(await reader.read()).done){}
});
test('read-only API rejects writes; static bytes served correctly',async t=>{
 const base=await fixture(t,{devIdentity:true,root:process.cwd()+'/web'});
 assert.equal((await fetch(base+'/api/me',{method:'POST'})).status,405);
 const r=await fetch(base+'/');assert.match(await r.text(),/^<!doctype html>/);
});
test('playback gateway masks upstream stream URLs and proxies media bytes with range support',async t=>{
 const mockVideo=Buffer.alloc(2048, 0x42);
 const base=await fixture(t,{
  addons:[{url:'https://streams.example/manifest.json'}],
  fetcher:async (url, opts)=>{
   if(url.endsWith('/stream/movie/tt123.json')) {
    return Response.json({
     streams:[{
      name:'4K',
      url:'https://upstream-cdn.example/secret-token/video.mp4',
      behaviorHints:{filename:'video.mp4'}
     }]
    });
   }
   if(url==='https://upstream-cdn.example/secret-token/video.mp4') {
    const range=opts.headers['Range']||'';
    if(range.startsWith('bytes=')) {
     const [start,end]=range.replace('bytes=','').split('-').map(Number);
     const chunk=mockVideo.subarray(start, (end||mockVideo.length-1)+1);
     return new Response(chunk,{
      status:206,
      headers:{
       'content-type':'application/octet-stream',
       'content-disposition':'attachment; filename="video.mp4"',
       'content-range':`bytes ${start}-${(end||mockVideo.length-1)}/${mockVideo.length}`,
       'content-length':String(chunk.length),
       'accept-ranges':'bytes'
      }
     });
    }
    return new Response(mockVideo,{headers:{'content-type':'video/mp4','content-length':'2048'}});
   }
   return new Response('Not found',{status:404});
  }
 });
 const streamRes=await (await fetch(base+'/api/addon/0/stream/movie/tt123',{headers:identity})).json();
 assert.ok(streamRes.streams[0].url.startsWith('/api/playback/'));
 assert.ok(!streamRes.streams[0].url.includes('secret-token'));
 
 const handleUrl=base+streamRes.streams[0].url;
 const rangeRes=await fetch(handleUrl,{headers:{...identity,'Range':'bytes=0-99'}});
 assert.equal(rangeRes.status,206);
 assert.equal(rangeRes.headers.get('content-disposition'),'inline');
 assert.equal(rangeRes.headers.get('content-type'),'video/mp4');
 assert.equal(rangeRes.headers.get('content-range'),'bytes 0-99/2048');
 assert.equal((await rangeRes.arrayBuffer()).byteLength,100);

 const badRes=await fetch(base+'/api/playback/00000000000000000000000000000000',{headers:identity});
 assert.equal(badRes.status,404);
});
test('playback gateway rejects upstream login HTML challenge with clean error',async t=>{
 const base=await fixture(t,{
  addons:[{url:'https://streams.example/manifest.json'}],
  fetcher:async (url)=>{
   if(url.endsWith('/stream/movie/tt123.json')) {
    return Response.json({
     streams:[{name:'4K',url:'https://bad-cdn.example/auth-challenge'}]
    });
   }
   if(url==='https://bad-cdn.example/auth-challenge') {
    return new Response('<html><head><title>Sign In - Authentik</title></head><body>Login required</body></html>',{
     status:200,
     headers:{'content-type':'text/html; charset=utf-8'}
    });
   }
   return new Response('Not found',{status:404});
  }
 });
 const streamRes=await (await fetch(base+'/api/addon/0/stream/movie/tt123',{headers:identity})).json();
 const playRes=await fetch(base+streamRes.streams[0].url,{headers:identity});
 assert.equal(playRes.status,502);
 const err=await playRes.json();
 assert.match(err.error,/authentication/);
});
test('playback gateway rewrites HLS playlist segment URLs to proxy path',async t=>{
 const base=await fixture(t,{
  addons:[{url:'https://streams.example/manifest.json'}],
  fetcher:async (url)=>{
   if(url.endsWith('/stream/movie/tt123.json')) {
    return Response.json({
     streams:[{name:'HLS',url:'https://cdn.example/live/master.m3u8'}]
    });
   }
   if(url==='https://cdn.example/live/master.m3u8') {
    return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000\nchunklist.m3u8\n',{
     headers:{'content-type':'application/vnd.apple.mpegurl'}
    });
   }
   return new Response('Not found',{status:404});
  }
 });
 const streamRes=await (await fetch(base+'/api/addon/0/stream/movie/tt123',{headers:identity})).json();
 const playRes=await fetch(base+streamRes.streams[0].url,{headers:identity});
 assert.equal(playRes.status,200);
 const text=await playRes.text();
 assert.ok(text.includes('/sub?url=https%3A%2F%2Fcdn.example%2Flive%2Fchunklist.m3u8'));
});

