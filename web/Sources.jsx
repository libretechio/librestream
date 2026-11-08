import React,{useEffect,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Selector} from '@astryxdesign/core/Selector';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Play,RotateCw} from 'lucide-react';
import {resource,supports,safeURL,sourceLabel} from './api';
import {streamInfo,filterStreams} from './streams';
export function Sources({addons,meta,videoId,onPlay}) {
 const [rows,setRows]=useState([]);const [pending,setPending]=useState(0);const [failed,setFailed]=useState(0);const [retry,setRetry]=useState(0);
 const [filters,setFilters]=useState({resolution:'all',addon:'all',cache:'all'});
 useEffect(()=>{
  const controller=new AbortController();const providers=addons.filter(a=>supports(a,'stream',meta.type));
  setRows([]);setPending(providers.length);setFailed(0);
  for(const a of providers) resource(a,'stream',meta.type,videoId,'',controller.signal).then(data=>{
   if(controller.signal.aborted)return;
   setRows(old=>[...old,...(Array.isArray(data.streams)?data.streams:[]).map(stream=>({a,stream,info:streamInfo(a,stream)}))]);
  }).catch(()=>{if(!controller.signal.aborted)setFailed(n=>n+1);}).finally(()=>{if(!controller.signal.aborted)setPending(n=>n-1);});
  return()=>controller.abort();
 },[videoId,addons,meta.type,retry]);
 const playable=rows.filter(({stream})=>safeURL(stream.url)&&!stream.behaviorHints?.proxyHeaders);
 const visible=filterStreams(playable,filters);const unsupported=rows.length-playable.length;
 const choose=(key,value)=>setFilters(old=>({...old,[key]:value}));
 const qualities=[...new Set(playable.map(r=>r.info.resolution))].sort((a,b)=>(parseInt(b)||0)-(parseInt(a)||0));
 return <VStack gap={4} className="sources">
  <Heading level={3}>Choose a source</Heading>
  <HStack gap={3} wrap="wrap" className="source-filters">
   <Selector label="Resolution" presentation="popover" value={filters.resolution} onChange={v=>choose('resolution',v)} options={[{value:'all',label:'All resolutions'},...qualities.map(value=>({value,label:value==='unknown'?'Unknown resolution':value==='2160p'?'4K · 2160p':value}))]}/>
   <Selector label="Addon" presentation="popover" value={filters.addon} onChange={v=>choose('addon',v)} options={[{value:'all',label:'All addons'},...addons.filter(a=>supports(a,'stream',meta.type)).map(a=>({value:String(a.index),label:a.name}))]}/>
   <Selector label="TorBox cache" presentation="popover" value={filters.cache} onChange={v=>choose('cache',v)} options={[{value:'all',label:'All cache states'},{value:'cached',label:'Cached on TorBox'},{value:'uncached',label:'Uncached on TorBox'},{value:'unknown',label:'Unknown / other provider'}]}/>
  </HStack>
  <Text type="supporting">Cache labels come from the addon. Unknown results are never assumed cached.</Text>
  <Text role="status">{visible.length} of {playable.length} streams{pending>0?' · '+pending+' addons still loading…':''}</Text>
  <VStack gap={2} className="source-results" aria-label="Stream results">
   {visible.map(({a,stream,info},i)=><Button icon={<Icon icon={Play}/>} key={a.index+':'+i} className="source-button" label={sourceLabel(a,stream)||'Play stream'} onClick={()=>onPlay(stream)} width="100%"><VStack gap={2} width="100%"><Text className="source-label" textWrap="wrap">{sourceLabel(a,stream)||'Play stream'}</Text><Text type="supporting">{info.resolution==='unknown'?'Resolution unknown':info.resolution} · {info.cache==='cached'?'TorBox cached':info.cache==='uncached'?'TorBox uncached':'Cache unknown'}</Text></VStack></Button>)}
  </VStack>
  {!visible.length&&<Text role="status">{pending?'Waiting for matching streams…':playable.length?'No streams match these filters.':'No browser-playable streams found. Try another episode or source.'}</Text>}
  {Object.values(filters).some(v=>v!=='all')&&<Button label="Clear filters" onClick={()=>setFilters({resolution:'all',addon:'all',cache:'all'})}/>}
  {unsupported>0&&<Text type="supporting">{unsupported} additional results require an external app, torrents, or custom request headers.</Text>}
  {failed>0&&<Text type="supporting">{failed} addons did not respond.</Text>}
  <Button icon={<Icon icon={RotateCw}/>} label="Refresh sources" onClick={()=>setRetry(retry+1)} isDisabled={pending>0}/>
 </VStack>;
}
