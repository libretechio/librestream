import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streamInfo,filterStreams} from '../web/streams.js';
const addon={index:16};
test('AIOStreams TorBox ready markers are cached; negative states win',()=>{
 assert.deepEqual(streamInfo(addon,{name:'4K UHD',description:'⚡Ready (TB) · Comet'}),{resolution:'2160p',cache:'cached',addon:'16'});
 assert.equal(streamInfo(addon,{name:'1080p',description:'TorBox uncached ⚡'}).cache,'uncached');
 assert.equal(streamInfo(addon,{description:'TorBox downloading'}).cache,'uncached');
 assert.equal(streamInfo(addon,{name:'FHD'}).resolution,'1080p');
 assert.equal(streamInfo(addon,{name:'HD'}).resolution,'720p');
 assert.equal(streamInfo(addon,{description:'RD+ cached'}).cache,'unknown');
 assert.equal(streamInfo(addon,{description:'TorBox'}).cache,'unknown');
 assert.equal(streamInfo(addon,{url:'https://video.example/file.mp4'}).cache,'unknown');
});
test('resolution, addon and cache filters compose without hiding unknowns by default',()=>{
 const rows=[{info:streamInfo(addon,{name:'4K UHD',description:'⚡Ready (TB)'})},{info:streamInfo({index:3},{name:'1080p'})}];
 assert.equal(filterStreams(rows,{resolution:'all',addon:'all',cache:'all'}).length,2);
 assert.equal(filterStreams(rows,{resolution:'2160p',addon:'16',cache:'cached'}).length,1);
 assert.equal(filterStreams(rows,{resolution:'1080p',addon:'16',cache:'all'}).length,0);
 assert.equal(filterStreams(rows,{resolution:'all',addon:'3',cache:'unknown'}).length,1);
});
