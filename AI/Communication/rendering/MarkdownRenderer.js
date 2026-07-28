// AI/Communication/rendering/MarkdownRenderer.js
// Markdown Renderer — converts ResponseObject into well-formatted markdown.
// Authority: Part 7 — Rendering System

export function renderMarkdown(r){const p=[];if(r.overview&&r.overview.text){p.push('**'+r.overview.text+'**');p.push('');}for(const s of r.sections){p.push(rs(s));p.push('');}if(r.summary&&r.summary.text){p.push('---');p.push('**Summary:** '+r.summary.text);p.push('');}if(r.conclusion&&r.conclusion.text){p.push('**Conclusion:** '+r.conclusion.text);if(r.conclusion.verdict)p.push('> '+r.conclusion.verdict);p.push('');}if(r.citations&&r.citations.length>0){p.push('**References:**');for(const c of r.citations)p.push('- '+c);}return p.join('\n').trim();}
function rs(s){const ic={source:'📄',analysis:'🔍',comparison:'⚖️',recommendation:'✅',warning:'⚠️'};const l=['### '+(ic[s.type]||'📌')+' '+s.title];if(s.summary&&s.facts.length>0)l.push('*'+s.summary+'*');for(const f of s.facts){let ln='- '+f.text;if(f.citation)ln+=' '+f.citation;l.push(ln);}if(!s.facts.length)l.push('*No information available from this source.*');return l.join('\n');}
export function renderTable(s){if(!s.facts.length)return'';const l=['### ⚖️ '+s.title,'','| Source | Confidence | Fact |','|--------|-----------|------|'];for(const f of s.facts){const t=f.text.length>80?f.text.slice(0,77)+'...':f.text;l.push('| '+f.source+' | '+Math.round(f.confidence*100)+'% | '+t+' |');}return l.join('\n');}
export function renderCodeBlock(c,lang){const l=lang||dl(c);return'```'+l+'\n'+c+'\n```';}
function dl(c){if(c.includes('function')||c.includes('=>'))return'javascript';if(c.includes('def '))return'python';if(c.includes('{')&&c.includes('"'))return'json';return'';}
