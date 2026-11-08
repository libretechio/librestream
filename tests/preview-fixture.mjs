// Explicit integration fixture, never used in the live addon registry.
import {createApp} from '../server.mjs';
const movie={id:'bbb',type:'movie',name:'Big Buck Bunny',year:'2008',description:'Blender Foundation open movie. Integration test fixture; not a live addon result.'};
const series={id:'fixture-series',type:'series',name:'Episode selection test fixture',videos:[{id:'fixture-series:1:1',season:1,episode:1,title:'Playback test'},{id:'fixture-series:2:1',season:2,episode:1,title:'Second season test'}]};
createApp({devIdentity:true,addons:[{name:'Integration fixture',url:'https://fixture.invalid/manifest.json'}],fetcher:async url=>{
  if(url.endsWith('manifest.json'))return Response.json({name:'Integration fixture (test data)',resources:['catalog','meta','stream','subtitles'],catalogs:[{id:'movies',type:'movie',name:'Integration test titles',extra:[{name:'search'}]},{id:'series',type:'series',name:'Integration test episodes'}]});
  if(url.includes('/catalog/'))return Response.json({metas:url.includes('/series/')?[series]:[movie]});
  if(url.includes('/meta/'))return Response.json({meta:url.includes('/series/')?series:movie});
  if(url.includes('/stream/'))return Response.json({streams:[{name:'Open movie MP4',title:'Big Buck Bunny · Blender Foundation · CC BY 3.0',url:'http://127.0.0.1:4174/test-video.mp4'},{name:'Open movie HLS',title:'Big Buck Bunny trailer · local HLS fixture',url:'http://127.0.0.1:4174/fixture.m3u8'},{name:'Torrent test',infoHash:'test'},{name:'Header-dependent test',url:'https://fixture.invalid/video',behaviorHints:{proxyHeaders:{request:{Referer:'https://fixture.invalid'}}}}]});
  return Response.json({subtitles:[]});
}}).listen(4174,'127.0.0.1',()=>console.log('Fixture preview ready'));
