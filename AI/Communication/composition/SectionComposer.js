// AI/Communication/composition/SectionComposer.js
// Section Composer — builds response sections from grouped facts.
// Authority: Part 6 — Composition System

import { RESPONSE_PATTERNS } from './MessageBlueprint.js';
export function buildSections(g,p){const s=[];for(const x of g)s.push({title:x.title,type:'source',facts:x.facts,summary:sm(x.facts),priority:x.priority||99});if(g.length>=2){const c=bc(g);if(c)s.push(c);}if(p.sections.includes('recommendation')||p.sections.includes('verdict')){const r=br(g);if(r)s.push(r);}const w=bw(g);if(w)s.push(w);return s.sort((a,b)=>(a.priority||99)-(b.priority||99));}
function sm(f){if(!f.length)return null;if(f.length===1)return f[0].text;const h=f.filter(x=>x.confidence>=0.7);return h.length?h.length+' verified fact(s) with high confidence':f.length+' fact(s) available';}
function bc(g){const w=g.filter(x=>x.facts.length>0);if(w.length<2)return null;const a=[],m=new Map();for(const x of w)for(const f of x.facts){const k=f.text.toLowerCase().slice(0,40);if(m.has(k))a.push({fact:f,source:x.title,other:m.get(k).source});else m.set(k,{fact:f,source:x.title});}if(!a.length)return null;return{title:'Source Comparison',type:'comparison',facts:[{id:'cmp',text:a.length+' fact(s) confirmed by multiple sources.',source:'system',provider:'composition',confidence:1}],summary:'Cross-source verification results',priority:50};}
function br(g){const a=g.flatMap(x=>x.facts).filter(f=>f.confidence>=0.7);if(!a.length)return null;return{title:'Recommendations',type:'recommendation',facts:a.slice(0,3).map(f=>({...f,id:'rec-'+f.id})),summary:'Based on '+a.length+' high-confidence fact(s)',priority:80};}
function bw(g){const l=g.flatMap(x=>x.facts).filter(f=>f.confidence<0.4);if(!l.length)return null;return{title:'⚠️ Notes',type:'warning',facts:l.map(f=>({...f,text:'Low confidence ('+Math.round(f.confidence*100)+'%): '+f.text})),summary:l.length+' fact(s) have low confidence',priority:90};}
