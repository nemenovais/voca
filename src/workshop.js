
const el = id => document.getElementById(id);
const levels = VocaData.levels;
const prefix = "vocaWorkshop3.";
const maxRows = 16;
const uuid = () => VocaDomain.uuid();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(value) { return typeof value === 'string' && uuidPattern.test(value); }
function ensure(test, message) { if (!test) throw Error(message); }
function keys(obj, names) {
  return obj && typeof obj === "object" && !Array.isArray(obj) &&
    Object.keys(obj).length === names.length && names.every(k => Object.hasOwn(obj,k));
}
function labelOK(value, limit) {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
}
function loadLocal(name, fallback) { return VocaStorage.read(prefix+name,fallback); }
function saveLocal(name, value) { return VocaStorage.write(prefix+name,value); }
function node(tag, text) { const item=document.createElement(tag); if(text!==undefined)item.textContent=text; return item; }
function control(text, action, style="secondary") {
  const b=node("button",text); b.type="button"; b.className=style; b.onclick=action; return b;
}
function showMessage(id, text) { el(id).textContent=text; }
function assertCards(cards) {
  ensure(Array.isArray(cards) && cards.length>=2 && cards.length<=maxRows,"Добавь от 2 до 16 карточек.");
  const english=new Set(), russian=new Set();
  for (const c of cards) {
    ensure(keys(c,["en","ru"]) && labelOK(c.en,80) && labelOK(c.ru,120),"Заполни слово и перевод в каждой строке.");
    ensure(!english.has(c.en.toLowerCase()) && !russian.has(c.ru.toLowerCase()),"Слова и переводы должны быть разными.");
    english.add(c.en.toLowerCase()); russian.add(c.ru.toLowerCase());
  }
}
function checkAssignment(task) {
  ensure(keys(task,["type","version","id","title","level","direction","cards"]) && task.type==="voca-assignment" && task.version===1 && validId(task.id),"Выбери файл задания VOCA этой версии.");
  ensure(labelOK(task.title,80) && levels.includes(task.level) && ["en-ru","ru-en"].includes(task.direction),"Проверь название, уровень и направление.");
  assertCards(task.cards); return task;
}
let library=loadLocal("library",[]);
let reports=loadLocal("reports",[]);
let run=loadLocal("attempt",null);
let preview=false, previewRun=null;
function activeRun(){return preview?previewRun:run;}
function recordRun(next){if(preview)previewRun=next;else {const saved=saveLocal("attempt",next);run=next;if(!saved)showMessage("assignmentMsg","Попытка доступна только до закрытия вкладки. Закончи задание и скачай результат.");}}
function downloadJson(data, filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=node("a"); a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function readFile(input) {
  const file=input.files[0]; ensure(file && file.size>0 && file.size<=32768,"Выбери файл VOCA размером до 32 КБ.");
  try{return JSON.parse(await file.text());}catch{throw Error("Файл не удалось прочитать как JSON.");}
}
function currentDraft(){
  return {title:el("taskTitle").value.trim(),level:el("taskLevel").value,direction:el("direction").value,
    cards:[...el("editRows").children].map(row=>({en:row.children[0].value.trim(),ru:row.children[1].value.trim()}))};
}
function rememberDraft(){if(!VocaStorage.stage(prefix+"draft",currentDraft()))showMessage("teacherMsg","Черновик доступен только до закрытия вкладки. Сохрани версию и скачай файл.");}
function addRow(en="",ru=""){
  const row=node("div"); row.className="editRow";
  for(const [label,value,max] of [["Английское слово",en,80],["Перевод",ru,120]]){
    const field=node("input");field.placeholder=label;field.setAttribute("aria-label",label);field.maxLength=max;field.value=value;row.append(field);
  }
  row.append(control("Удалить",()=>{row.remove();rememberDraft();}));el("editRows").append(row);
}
function fillForm(draft){
  el("taskTitle").value=draft.title;el("taskLevel").value=draft.level;el("direction").value=draft.direction;
  el("editRows").replaceChildren();draft.cards.forEach(c=>addRow(c.en,c.ru));
}
function template(level){const topic=el("taskTheme").value;return {title:VocaData.themes[topic],level,direction:"en-ru",cards:VocaDomain.select(level,topic).map(({en,ru})=>({en,ru}))};}
function buildAssignment(){return checkAssignment({type:"voca-assignment",version:1,id:uuid(),...currentDraft()});}
function newRun(task,nick){
  return {task,nick,attempt:uuid(),choices:[],current:0,feedback:false,done:false,
    options:task.cards.map((c,i)=>shuffled([i,...shuffled(task.cards.map((_,k)=>k).filter(k=>k!==i)).slice(0,3)]))};
}
function startPreview(){try{
  const task=buildAssignment();preview=true;recordRun(newRun(task,"Предпросмотр"));showPage("assignment");drawRun();
}catch(e){showMessage("teacherMsg",e.message);}}
function releaseTask(){try{
  const task=buildAssignment();ensure(library.length<100,"В библиотеке уже 100 версий. Скачай резервную копию перед дальнейшей работой.");const next=[task,...library];const saved=saveLocal("library",next);library=next;
  renderLibrary();showMessage("teacherMsg",saved?"Версия сохранена. Скачай файл для ученика из списка ниже.":"Версия доступна только до закрытия вкладки. Обязательно скачай файл задания сейчас.");
}catch(e){showMessage("teacherMsg",e.message);}}
function renderLibrary(){
  const list=el("savedTasks");list.replaceChildren();
  if(!library.length){list.append(node("p","Здесь появятся сохранённые версии."));return;}
  library.forEach((task,index)=>{
    const group=node("div");group.className="itemRow";
    group.append(node("strong",task.title+" · "+task.level),node("small","Версия "+(library.length-index)+" · "+task.cards.length+" карточек"));
    group.append(control("Скачать задание",()=>downloadJson(task,"VOCA-task-"+task.id.slice(0,8)+".json")),
      control("Редактировать копию",()=>{fillForm(task);rememberDraft();showMessage("teacherMsg","Копия открыта. Сохранение создаст новую версию.");el("taskTitle").focus();}));
    list.append(group);
  });
}
function makeReport(r){return {type:"voca-result",version:1,assignmentId:r.task.id,attemptId:r.attempt,nick:r.nick,answers:r.choices.slice()};}
function inspectReport(data){
  ensure(keys(data,["type","version","assignmentId","attemptId","nick","answers"]) && data.type==="voca-result" && data.version===1 && validId(data.assignmentId) && validId(data.attemptId) && labelOK(data.nick,32),"Выбери корректный файл результата VOCA.");
  const task=library.find(t=>t.id===data.assignmentId);ensure(task,"В этом браузере учителя нет исходной версии задания.");
  ensure(Array.isArray(data.answers) && data.answers.length===task.cards.length && data.answers.every(i=>Number.isInteger(i)&&i>=0&&i<task.cards.length),"Файл содержит неполный или недопустимый ответ.");
  return {task,score:data.answers.filter((v,i)=>v===i).length};
}
function renderReports(){
  const out=el("reports");out.replaceChildren();
  if(!reports.length)out.append(node("p","Пока нет возвращённых результатов."));
  reports.forEach(data=>{const {task,score}=inspectReport(data);const row=node("details");
    row.append(node("summary",data.nick+" · "+task.title+" · "+score+" из "+task.cards.length));
    data.answers.forEach((v,i)=>{const from=task.direction==="en-ru"?"en":"ru",to=from==="en"?"ru":"en";
      row.append(node("p",task.cards[i][from]+" → "+task.cards[v][to]+(v===i?" ✓":" · верно: "+task.cards[i][to])));});
    out.append(row);
  });
}
el("resultFile").onchange=async function(){
  try{const data=await readFile(this);inspectReport(data);const old=reports.find(r=>r.assignmentId===data.assignmentId&&r.attemptId===data.attemptId);
    if(old){ensure(old.nick===data.nick && old.answers.every((v,i)=>v===data.answers[i]),"У этой попытки уже есть другой результат.");showMessage("resultMsg","Эта попытка уже учтена.");}
    else{ensure(reports.length<500,"Достигнут лимит 500 результатов.");const next=[data,...reports];const saved=saveLocal("reports",next);reports=next;renderReports();showMessage("resultMsg",saved?"Результат принят и пересчитан.":"Результат пересчитан, но доступен только до закрытия вкладки. Сохрани исходный файл результата.");}
  }catch(e){showMessage("resultMsg",e.message);}finally{this.value="";}
};
el("assignmentFile").onchange=async function(){
  try{const task=checkAssignment(await readFile(this));const nick=el("alias").value.trim()||"Ученик";ensure(labelOK(nick,32),"Псевдоним должен быть короче 33 символов.");
    if(run && !run.done && !confirm("Заменить текущую попытку новым заданием?"))return;
    preview=false;recordRun(newRun(task,nick));showMessage("assignmentMsg",VocaStorage.isVolatile()?"Задание открыто. Попытка доступна только до закрытия вкладки: закончи её и скачай результат.":"Задание открыто.");drawRun();
  }catch(e){showMessage("assignmentMsg",e.message);}finally{this.value="";}
};
function drawRun(){
 const out=el("runBody");out.replaceChildren();const r=activeRun();
 el("openTask").hidden=preview;
 if(!r)return;
 const task=r.task,from=task.direction==="en-ru"?"en":"ru",to=from==="en"?"ru":"en";
 if(preview)out.append(node("p","Предпросмотр учителя"),control("Вернуться в конструктор",()=>{preview=false;showPage("teacher");}));
 out.append(node("h2",task.title+" · "+task.level));
 if(r.done){
   const report=makeReport(r);const hits=r.choices.filter((v,i)=>v===i).length;
   out.append(node("h3","Результат: "+hits+" из "+task.cards.length));
   r.choices.forEach((v,i)=>{if(v!==i)out.append(node("p",task.cards[i][from]+" — "+task.cards[i][to]+" · твой ответ: "+task.cards[v][to]));});
   if(!preview){out.append(control("Скачать результат",()=>downloadJson(report,"VOCA-result-"+r.attempt.slice(0,8)+".json"),"primary"));out.append(node("p","Скачай файл результата и передай его учителю привычным способом. Сайт не отправляет ответы автоматически."));}
   return;
 }
 const i=r.current;out.append(node("small","Вопрос "+(i+1)+" из "+task.cards.length),node("h3",task.cards[i][from]));
 if(r.feedback){
   out.append(node("p",r.choices[i]===i?"Верно!":"Верный ответ: "+task.cards[i][to]));
   out.append(control(i===task.cards.length-1?"Показать результат":"Дальше",()=>{
     if(!r.feedback||r.done)return;
     const next={...r,current:i+1,feedback:false,done:i+1===task.cards.length};recordRun(next);drawRun();
   },"primary"));
 }else{
   const opts=node("div");opts.className="answers";r.options[i].forEach(k=>opts.append(control(task.cards[k][to],()=>{
     if(activeRun()!==r || r.feedback || r.done)return;recordRun({...r,choices:[...r.choices,k],feedback:true});drawRun();
   },"answer")));out.append(opts);
 }
}
el("taskForm").oninput=rememberDraft;
el("addCard").onclick=()=>{if(el("editRows").children.length>=maxRows){showMessage("teacherMsg","Максимум 16 карточек.");return;}addRow();rememberDraft();};
el("fromBank").onclick=()=>{if(el("editRows").children.length && !confirm("Заменить карточки черновика набором выбранного уровня?"))return;fillForm(template(el("taskLevel").value));rememberDraft();};
el("tryTask").onclick=startPreview;el("releaseTask").onclick=releaseTask;
hydrateWorkshop();
let restoredDraft=loadLocal("draft",template(activeLevel));
try{ensure(restoredDraft&&labelOK(restoredDraft.title,80)&&levels.includes(restoredDraft.level)&&["en-ru","ru-en"].includes(restoredDraft.direction),"draft");ensure(Array.isArray(restoredDraft.cards)&&restoredDraft.cards.length<=maxRows&&restoredDraft.cards.every(c=>keys(c,["en","ru"])&&typeof c.en==="string"&&c.en.length<=80&&typeof c.ru==="string"&&c.ru.length<=120),"draft rows");}catch{restoredDraft=template(activeLevel);}
fillForm(restoredDraft);renderLibrary();renderReports();drawRun();

function hydrateWorkshop(){
 if(!Array.isArray(library))library=[];
 library=library.slice(0,100).filter(t=>{try{checkAssignment(t);return true;}catch{return false;}});
 if(!Array.isArray(reports))reports=[];
 reports=reports.slice(0,500).filter(r=>{try{inspectReport(r);return true;}catch{return false;}});
 if(run){try{
  checkAssignment(run.task);ensure(validId(run.attempt)&&labelOK(run.nick,32),"attempt");
  const n=run.task.cards.length;
  ensure(Array.isArray(run.choices)&&run.choices.every(i=>Number.isInteger(i)&&i>=0&&i<n),"answers");
  ensure(Number.isInteger(run.current)&&run.current>=0&&run.current<=n&&typeof run.feedback==='boolean'&&typeof run.done==='boolean',"position");
  ensure(run.done ? run.current===n&&run.choices.length===n&&!run.feedback : run.current<n&&run.choices.length===run.current+(run.feedback?1:0),"state");
  ensure(Array.isArray(run.options)&&run.options.length===n&&run.options.every((a,i)=>Array.isArray(a)&&a.length===Math.min(4,n)&&new Set(a).size===a.length&&a.includes(i)&&a.every(k=>Number.isInteger(k)&&k>=0&&k<n)),"options");
 }catch{run=null;toast("Сохранённая попытка повреждена. Открой файл задания заново.");}}
}
