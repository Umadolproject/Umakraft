// AI/Communication/composition/SourceGrouper.js
// Source Grouper — groups facts by provider source.
// Authority: Part 6 — Composition System

const L={official_docs:'Official Documentation',github:'GitHub',repository:'Repository',knowledge:'Knowledge Base',memory:'Memory',conversation:'Conversation History',web:'Web Search',gemini:'AI Search',qdrant:'Vector Search',discord:'Discord'};
const P={official_docs:1,repository:2,knowledge:3,github:4,memory:5,web:6,gemini:7,conversation:8,qdrant:9};
export function groupBySource(f){const g={};for(const x of f){const k=x.source;if(!g[k])g[k]={title:L[k]||k,facts:[],priority:P[k]||99};g[k].facts.push(x);}return Object.values(g).sort((a,b)=>a.priority-b.priority);}
export function groupByProvider(f){const g={};for(const x of f){const k=x.source+':'+x.provider;if(!g[k])g[k]={title:(L[x.provider]||x.provider)+' ('+(L[x.source]||x.source)+')',facts:[],priority:(P[x.provider]||50)+(P[x.source]||99)};g[k].facts.push(x);}return Object.values(g).sort((a,b)=>a.priority-b.priority);}
export function emptySection(s){return{title:L[s]||s,facts:[],priority:P[s]||99};}
export function mergeSmallGroups(g){const m=[],s=[];for(const x of g){if(x.facts.length<=2)s.push(x);else m.push(x);}if(s.length>1)m.push({title:'Additional Sources',facts:s.flatMap(x=>x.facts),priority:99});else if(s.length===1)m.push(s[0]);return m.sort((a,b)=>a.priority-b.priority);}
