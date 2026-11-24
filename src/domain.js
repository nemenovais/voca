/* Pure learning rules: no DOM and no storage. */
window.VocaDomain = (() => {
 const data=VocaData;
 const ids=new Set(data.words.map(w=>w.id));
 function uuid(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
 }
 function shuffle(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function select(level,topic='All'){return data.words.filter(w=>w.level===level&&(topic==='All'||w.cat===topic));}
 function context(word,age='neutral'){return word.contexts?.[age]||[word.ex,word.tr];}
 function question(word,pool,age='neutral',mode='translation'){
  const [example,translation]=context(word,age);
  const offset=example.toLowerCase().indexOf(word.en.toLowerCase());
  const gap=mode==='gap'&&offset>=0;
  const field=gap?'en':'ru';
  const seen=new Set([word[field].toLowerCase()]);
  const other=shuffle(pool.filter(w=>w.id!==word.id)).filter(w=>{const v=w[field].toLowerCase();if(seen.has(v))return false;seen.add(v);return true;}).slice(0,3);
  return {wordId:word.id,kind:gap?'gap':'translation',prompt:gap?example.slice(0,offset)+'____'+example.slice(offset+word.en.length):`Как переводится «${word.en}»?`,hint:gap?translation:'',options:shuffle([word,...other]).map(w=>({id:w.id,text:w[field]})),answer:word.id};
 }
 function empty(){return {version:1,profile:{level:'A1',ageGroup:'neutral',role:'student',assessment:0,configured:false},seen:[],review:[],successes:{},stats:{attempts:0,correct:0,total:0},sessions:[]};}
 function normalize(raw){
  const out=empty();if(!raw||raw.version!==1)return out;
  const p=raw.profile||{};out.profile={level:data.levels.includes(p.level)?p.level:'A1',ageGroup:['neutral','school','adult'].includes(p.ageGroup)?p.ageGroup:'neutral',role:p.role==='teacher'?'teacher':'student',assessment:Number.isInteger(p.assessment)&&p.assessment>=0&&p.assessment<4?p.assessment:0,configured:p.configured===true};
  for(const key of ['seen','review'])if(Array.isArray(raw[key]))out[key]=[...new Set(raw[key].filter(id=>ids.has(id)))];
  for(const word of data.words){const n=raw.successes?.[word.id];if(Number.isInteger(n)&&n>=0&&n<=2)out.successes[word.id]=n;}
  const st=raw.stats;
  if(st&&['attempts','correct','total'].every(k=>Number.isSafeInteger(st[k])&&st[k]>=0)&&st.correct<=st.total)out.stats={attempts:st.attempts,correct:st.correct,total:st.total};
  if(Array.isArray(raw.sessions))out.sessions=raw.sessions.filter(s=>s&&typeof s.id==='string'&&typeof s.date==='string'&&['practice','review'].includes(s.kind)&&Number.isInteger(s.total)&&s.total>0&&s.total<=48&&Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=s.total).slice(-30);
  return out;
 }
 function mistake(state,id){if(ids.has(id)){if(!state.review.includes(id))state.review.push(id);state.successes[id]=0;}}
 function finish(state,session){
  if(session.saved||!session.items.length||session.answers.length!==session.items.length)return false;
  session.saved=true;for(const answer of session.answers)if(answer.correct)state.successes[answer.id]=Math.min(2,(state.successes[answer.id]||0)+1);const count=session.answers.filter(a=>a.correct).length;
  state.stats.attempts++;state.stats.correct+=count;state.stats.total+=session.items.length;
  state.sessions.push({id:session.id,date:new Date().toISOString(),kind:session.review?'review':'practice',correct:count,total:session.items.length});state.sessions=state.sessions.slice(-30);
  return true;
 }
 return {uuid,shuffle,select,context,question,empty,normalize,mistake,finish};
})();
