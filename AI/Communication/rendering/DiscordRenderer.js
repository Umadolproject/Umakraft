// AI/Communication/rendering/DiscordRenderer.js
// Discord Renderer — converts ResponseObject into Discord-ready output.
// Authority: Part 7 — Rendering System

import { renderMarkdown, renderTable } from './MarkdownRenderer.js';
import { splitMessage, estimateChunks } from './MessageSplitter.js';
export function renderForDiscord(r,o){o=o||{};const md=renderMarkdown(r);const ms=splitMessage(md,o.charLimit||2000);const em=[];if(o.useEmbeds){const se=renderSummaryEmbed(r);if(se)em.push(se);for(const s of r.sections){if(s.type==='comparison'){const ce=renderComparisonEmbed(s);if(ce)em.push(ce);}}}const at=estimateChunks(md,o.charLimit||2000)>3?[{name:'response_'+(r.metadata&&r.metadata.topic||'general')+'.md',content:md,type:'text/markdown'}]:[];return{messages:ms,embeds:em,attachments:at,components:[],metadata:r.metadata||{}};}
export function renderSummaryEmbed(r){if(!r.summary||!r.summary.text)return null;return{title:'Summary',description:r.summary.text,color:0x2ecc71,fields:(r.summary.keyPoints||[]).slice(0,3).map((p,i)=>({name:'Key Point '+(i+1),value:p,inline:false})),footer:r.citations&&r.citations.length>0?{text:r.citations.length+' reference(s)'}:void 0};}
export function renderComparisonEmbed(s){const t=renderTable(s);if(!t)return null;return{title:s.title,description:t.split('\n').slice(3).join('\n'),color:0x3498db,fields:s.facts.map(f=>({name:f.source+' ('+Math.round(f.confidence*100)+'%)',value:f.text.length>256?f.text.slice(0,253)+'...':f.text,inline:false}))};}
