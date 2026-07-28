// AI/Communication/composition/ResponseBuilder.js
// Response Builder — top-level entry point for the Composition subsystem.
// Pipeline: facts → dedup → group → sections → summary → conclusion → ResponseObject
// Authority: Part 6 — Composition System

import { deduplicateFacts, selectPattern, createBlueprint, blueprintToResponse } from './MessageBlueprint.js';
import { groupBySource, mergeSmallGroups } from './SourceGrouper.js';
import { buildSections } from './SectionComposer.js';
import { buildSummary, buildConclusion } from './SummaryComposer.js';
const L={maxSections:8,maxFactsPerSection:12,maxCitations:20};
export function build(f,o){o=o||{};const u=deduplicateFacts(f);let g=groupBySource(u);g=mergeSmallGroups(g);const p=selectPattern(o.topic,o.complexity);let s=buildSections(g,p);s=s.slice(0,L.maxSections).map(x=>({...x,facts:x.facts.slice(0,L.maxFactsPerSection)}));const sum=buildSummary(s);const con=buildConclusion(s);const ov=u.length===0?'No information found for "'+(o.query||'')+'".':u.length+' fact(s) from '+g.length+' source(s) about '+(o.topic==='umamusume'?'Umamusume':o.topic||'web')+'.';const seen=new Set();const ci=[];for(const x of s)for(const f of x.facts){if(f.citation&&!seen.has(f.citation)){seen.add(f.citation);ci.push(f.citation);}}const bp=createBlueprint(s,{overview:ov,summary:sum,conclusion:con?con.text:null,citations:ci.slice(0,L.maxCitations),tone:o.tone||'friendly',audience:o.audience||'discord',pattern:p.name,query:o.query||'',topic:o.topic||'web',complexity:o.complexity||'simple'});return blueprintToResponse(bp);}
