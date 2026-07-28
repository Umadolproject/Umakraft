// AI/Communication/rendering/MessageSplitter.js
// Splits long responses to fit Discord's 2000-char limit.
// Authority: Part 7 — Rendering System

const MX=2000;export function splitMessage(t,l){l=l||MX;if(t.length<=l)return[t];const s=t.split(/(?=^### )/m).filter(p=>p.trim());const c=ps(s,l);const f=[];for(const x of c){if(x.length<=l)f.push(x);else f.push(...sp(x,l));}return am(f);}
export const split = splitMessage; // backward-compat alias
export function needsSplit(t,l){l=l||MX;return t.length>l;}export function estimateChunks(t,l){l=l||MX;return Math.ceil(t.length/l);}
function ps(s,l){const c=[];let cur='';for(const x of s){if(cur.length+x.length+1<=l)cur+=(cur?'\n':'')+x;else{if(cur)c.push(cur);cur=x;}}if(cur)c.push(cur);return c;}
function sp(t,l){const p=t.split(/\n\n+/);const c=[];let cur='';for(const x of p){if(cur.length+x.length+2<=l)cur+=(cur?'\n\n':'')+x;else{if(cur)c.push(cur);if(x.length>l)c.push(...sl(x,l));else cur=x;}}if(cur)c.push(cur);return c;}
function sl(t,l){const ln=t.split('\n');const c=[];let cur='';for(const x of ln){if(cur.length+x.length+1<=l)cur+=(cur?'\n':'')+x;else{if(cur)c.push(cur);if(x.length>l)c.push(...sw(x,l));else cur=x;}}if(cur)c.push(cur);return c;}
function sw(t,l){const w=t.split(' ');const c=[];let cur='';for(const x of w){if(cur.length+x.length+1<=l)cur+=(cur?' ':'')+x;else{if(cur)c.push(cur);cur=x;}}if(cur)c.push(cur);return c;}
function am(c){if(c.length<=1)return c;return c.map((x,i)=>i===0?'**('+(i+1)+'/'+c.length+')**\n'+x:'**('+(i+1)+'/'+c.length+')**\n*(continued)*\n'+x);}
