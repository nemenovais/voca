/* Single persistence adapter. Short UI writes are grouped; explicit completion flushes. */
window.VocaStorage=(()=>{
 const memory=new Map(),pending=new Map();let timer=null,failed=false;
 function warn(message){const n=document.getElementById('storageNotice');if(n){n.hidden=false;n.textContent=message||'Браузер не смог сохранить данные на устройстве. Они доступны до закрытия страницы. Скачай прогресс и файлы заданий.';}}
 function read(key,fallback){
  if(memory.has(key))return memory.get(key);
  let raw;try{raw=localStorage.getItem(key);}catch{failed=true;warn();return fallback;}
  if(!raw)return fallback;
  try{const value=JSON.parse(raw);memory.set(key,value);return value;}
  catch{warn('Часть сохранённых данных повреждена. Для неё использованы начальные значения; остальные данные не удалены.');return fallback;}
 }
 function store(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{failed=true;warn();return false;}
 }
 function write(key,value){memory.set(key,value);pending.delete(key);return store(key,value);}
 function flush(){
  clearTimeout(timer);timer=null;let ok=true;
  for(const [key,value] of pending){if(!store(key,value))ok=false;}pending.clear();return ok;
 }
 function stage(key,value){memory.set(key,value);pending.set(key,value);if(timer===null)timer=setTimeout(flush,120);return !failed;}
 function getProgress(){return VocaDomain.normalize(read('voca3.progress',null));}
 function saveProgress(state,immediate=false){if(immediate){flush();return write('voca3.progress',state);}return stage('voca3.progress',state);}
 window.addEventListener('pagehide',flush);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
 return {read,write,stage,flush,getProgress,saveProgress,isVolatile:()=>failed};
})();
