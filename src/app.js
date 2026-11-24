/* UI controller. Domain rules and persistence live in their own files. */
const D=id=>document.getElementById(id);
const mk=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const btn=(label,fn,style='secondary')=>{const b=mk('button',label);b.type='button';b.className=style;b.onclick=fn;return b;};
const shuffled=VocaDomain.shuffle;
let state=VocaStorage.getProgress();
let activeLevel=state.profile.level,activeCat='Travel',wi=0;
let session=null,cardIndex=0,lessonDeck=[];
let draftAssessment=state.profile.assessment;
const pageNames={home:'Главная',lesson:'Моё занятие',words:'Словарь',quiz:'Практика',game:'Игры',review:'Повторение',teacher:'Для учителя',assignment:'От учителя',tutor:'Помощь',progress:'Мой прогресс'};
function persist(immediate=false){VocaStorage.saveProgress(state,immediate);updateStats();}
function toast(text){D('toast').textContent=text;D('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>D('toast').classList.remove('show'),4500);}
function themeName(topic=activeCat){return VocaData.themes[topic]||'Все темы';}
function filteredWords(){return VocaDomain.select(activeLevel,activeCat);}
function showPage(id,cat){
 if(!Object.hasOwn(pageNames,id))return;VocaSpeech.stop();
 if(cat&&Object.hasOwn(VocaData.themes,cat)){activeCat=cat;syncSelection();}
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
 document.querySelectorAll('.nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===id);if(b.dataset.page===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 D('crumb').textContent=pageNames[id];
 if(id==='lesson')beginLesson();
 if(id==='words')renderWord();
 if(id==='quiz')startQuiz();
 if(id==='game')startSelectedGame();
 if(id==='review')renderReview();
 if(id==='assignment'&&typeof drawRun==='function')drawRun();
 updateStats();
 const title=D(id).querySelector('h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
 window.scrollTo({top:0,behavior:'auto'});
}
function initializeTopics(){
 for(const id of ['lessonTheme','taskTheme','gameTheme']){
  D(id).replaceChildren(...Object.entries(VocaData.themes).map(([key,name])=>{const o=mk('option',name);o.value=key;return o;}));
  if(id==='gameTheme'){const all=mk('option','Все темы');all.value='All';D(id).prepend(all);}
  D(id).value='Travel';
 }
 const icons={Food:'🍓',Travel:'🚆',Nature:'🌿',Study:'📘',Everyday:'🏡'};
 document.querySelector('#home .topic-grid').replaceChildren(...Object.entries(VocaData.themes).map(([key,name])=>{
  const b=btn('',()=>showPage('words',key),'topic');b.dataset.topic=key;
  const icon=mk('span',icons[key]||'📘');icon.className='topic-emoji';const label=mk('span');
  label.append(mk('strong',name));const count=mk('small');count.className='topicCount';label.append(count);b.append(icon,label);return b;
 }));
 document.querySelector('#words .tabs').replaceChildren(...[['All','Все темы'],...Object.entries(VocaData.themes)].map(([key,name])=>{
  const b=btn(name,()=>filterWords(key),'tab');b.dataset.topic=key;return b;
 }));
}
function syncSelection(){
 D('gameLevel').value=activeLevel;D('gameTheme').value=activeCat;
 D('lessonLevel').value=activeLevel;D('lessonTheme').value=activeCat==='All'?'Travel':activeCat;
 D('homeLevel').textContent=activeLevel+' · '+themeName();D('homeRole').textContent=state.profile.role==='teacher'?'Для учителя':'Ученик';
 document.querySelector('.profileName').textContent=state.profile.role==='teacher'?'Режим учителя':'Мой профиль';
 document.querySelectorAll('#words .tab').forEach(b=>b.classList.toggle('active',activeCat===b.dataset.topic));
 document.querySelectorAll('#home .topic[data-topic]').forEach(b=>b.querySelector('.topicCount').textContent=VocaDomain.select(activeLevel,b.dataset.topic).length+' слов · '+activeLevel);
}
function filterWords(cat){if(cat!=='All'&&!Object.hasOwn(VocaData.themes,cat))return;activeCat=cat;wi=0;syncSelection();renderWord();}
function renderWord(){
 const list=filteredWords();wi=wi%Math.max(1,list.length);const w=list[wi];
 D('dictionaryContext').textContent=activeLevel+' · '+themeName()+' · '+list.length+' слов';
 if(!w){D('wEn').textContent='В этой теме пока нет слов';D('wRu').textContent='Выбери другую тему';D('wEx').textContent='';D('wPron').textContent='';D('wordCount').textContent='0 слов';return;}
 const [ex,tr]=VocaDomain.context(w,state.profile.ageGroup);
 D('wEn').textContent=w.en;D('wEmoji').textContent=w.emoji;D('wRu').textContent=w.ru;D('wPron').textContent=w.pron+' · '+w.pos+' · '+w.level;D('wEx').replaceChildren(mk('p',ex),mk('p',tr));
 D('wordCount').textContent=`Карточка ${wi+1} из ${list.length} · ${state.seen.includes(w.id)?'Просмотрена':'Ещё не просмотрена'}`;
}
function nextWord(){VocaSpeech.stop();wi++;renderWord();}
function markSeen(id){if(!state.seen.includes(id)){state.seen.push(id);persist();}}
function markKnown(){const w=filteredWords()[wi];if(w)markSeen(w.id);toast('Просмотр отмечен. Запоминание проверим в практике.');nextWord();}
function sayLocally(text){return VocaSpeech.say(text);}
function speakWord(){const w=filteredWords()[wi];if(w)sayLocally(w.en);}
function openProfile(){
 draftAssessment=state.profile.assessment;D('profileLevel').value=activeLevel;D('ageGroup').value=state.profile.ageGroup;D('userRole').value=state.profile.role;
 document.querySelectorAll('.choice').forEach((b,i)=>{b.classList.toggle('active',i===draftAssessment);b.setAttribute('aria-pressed',String(i===draftAssessment));});
 D('cancelProfile').hidden=!state.profile.configured;D('onboard').hidden=false;document.querySelector('.shell').inert=true;document.querySelector('.choice').focus();
}
function closeProfile(){if(!state.profile.configured)return;D('onboard').hidden=true;document.querySelector('.shell').inert=false;document.querySelector('.profile').focus();}
function chooseAssessment(button){
 const choices=[...document.querySelectorAll('.choice')];draftAssessment=choices.indexOf(button);
 choices.forEach((b,i)=>{b.classList.toggle('active',i===draftAssessment);b.setAttribute('aria-pressed',String(i===draftAssessment));});
 D('profileLevel').value=VocaData.levels[draftAssessment];
}
function saveOnboarding(){
 const level=D('profileLevel').value;if(!VocaData.levels.includes(level))return;
 state.profile={level,role:D('userRole').value==='teacher'?'teacher':'student',ageGroup:D('ageGroup').value,assessment:draftAssessment,configured:true};
 activeLevel=level;wi=0;session=null;persist(true);syncSelection();closeProfile();renderWord();beginLesson();
 showPage(state.profile.role==='teacher'?'teacher':'home');toast('Настройки сохранены. Уровень можно изменить в любой момент.');
}
function changeLessonSelection(){
 activeLevel=D('lessonLevel').value;activeCat=D('lessonTheme').value;state.profile.level=activeLevel;wi=0;session=null;persist();syncSelection();renderWord();beginLesson();
}
function beginLesson(){
 activeCat=D('lessonTheme').value;syncSelection();
 lessonDeck=VocaDomain.select(activeLevel,D('lessonTheme').value);cardIndex=0;
 if(!lessonDeck.length){D('lessonBody').textContent='Здесь пока нет слов. Выбери другую тему.';D('lessonActions').replaceChildren();return;}
 showLessonCard();
}
function showLessonCard(){
 VocaSpeech.stop();const w=lessonDeck[cardIndex];const [ex,tr]=VocaDomain.context(w,state.profile.ageGroup);
 D('lessonBody').replaceChildren(mk('small',`Карточка ${cardIndex+1} из ${lessonDeck.length} · ${activeLevel} · ${themeName(w.cat)}`),mk('h2',w.en+' — '+w.ru),mk('p',w.pron+' · '+w.pos),mk('p',ex),mk('p',tr));
 D('lessonActions').replaceChildren(btn('Прослушать слово',()=>sayLocally(w.en)),btn('Прослушать пример',()=>sayLocally(ex)),btn(cardIndex+1===lessonDeck.length?'Начать практику →':'Следующая карточка →',()=>{markSeen(w.id);cardIndex++;if(cardIndex<lessonDeck.length)showLessonCard();else{showQuizPage();startQuiz(lessonDeck,false,lessonDeck.length);}},'primary'));
}
function showQuizPage(){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='quiz'));document.querySelectorAll('.nav button').forEach(b=>{b.classList.toggle('active',b.dataset.page==='quiz');b.removeAttribute('aria-current');if(b.dataset.page==='quiz')b.setAttribute('aria-current','page');});D('crumb').textContent='Практика';}
function startQuiz(pool=filteredWords(),review=false,limit=10){
 if(!Array.isArray(pool)||!pool.length){session=null;D('qText').textContent=review?'Трудных слов пока нет':'В выбранном наборе пока нет слов';D('answers').replaceChildren(btn('К словарю',()=>showPage('words')));D('feedback').textContent='';D('nextQ').style.display='none';D('qLabel').textContent='ПРАКТИКА';D('qScore').textContent='';D('qProgress').style.width='0%';return;}
 const items=shuffled(pool).slice(0,Math.max(1,Math.min(20,limit)));
 const optionsPool=review?VocaData.words:pool;
 session={id:VocaDomain.uuid(),items,questions:items.map((w,i)=>VocaDomain.question(w,review?VocaDomain.select(w.level,w.cat):optionsPool,state.profile.ageGroup,i%2?'gap':'translation')),index:0,answers:[],review,saved:false};
 D('quizContext').textContent=review?('Повторение · '+items.length+' из '+pool.length+' трудных слов'):activeLevel+' · '+themeName()+' · '+items.length+' вопросов';renderQuestion();
}
function renderQuestion(){
 if(!session||session.saved)return;
 const q=session.questions[session.index];D('qLabel').textContent=`ВОПРОС ${session.index+1} ИЗ ${session.items.length}`;D('qScore').textContent=session.answers.filter(a=>a.correct).length+' правильных';D('qProgress').style.width=(session.index/session.items.length*100)+'%';
 D('qText').replaceChildren(mk('span',q.prompt));if(q.hint)D('qText').append(mk('p',q.hint));
 D('feedback').textContent='';D('feedback').classList.remove('error');D('nextQ').style.display='none';
 const current=session;D('answers').replaceChildren(...q.options.map(o=>btn(o.text,()=>chooseAnswer(o.id,current),'answer')));
}
function chooseAnswer(id,expected=session){
 if(!session||session!==expected||session.saved||session.answers.length>session.index)return;
 const q=session.questions[session.index];if(!q.options.some(o=>o.id===id))return;
 const hit=id===q.answer,w=session.items[session.index];session.answers.push({id:w.id,correct:hit});
 if(hit){if(session.review)state.review=state.review.filter(x=>x!==w.id);}
 else VocaDomain.mistake(state,w.id);
 if(!hit||session.review)persist();
 [...D('answers').children].forEach((b,i)=>{b.disabled=true;if(q.options[i].id===q.answer)b.classList.add('correct');else if(q.options[i].id===id)b.classList.add('wrong');});
 const [ex,tr]=VocaDomain.context(w,state.profile.ageGroup);
 D('feedback').classList.toggle('error',!hit);D('feedback').textContent=(hit?'Верно. ':'Верный ответ: '+w.en+' — '+w.ru+'. ')+ex+' — '+tr+(hit?'':' Слово добавлено в повторение.');
 D('qScore').textContent=session.answers.filter(a=>a.correct).length+' правильных';D('nextQ').textContent=session.index+1===session.items.length?'Показать результат':'Далее →';D('nextQ').style.display='inline-block';D('nextQ').focus({preventScroll:true});
}
function nextQuestion(){
 if(!session||session.saved||session.answers.length!==session.index+1)return;
 if(++session.index<session.items.length){renderQuestion();return;}
 VocaDomain.finish(state,session);persist(true);
 const hits=session.answers.filter(a=>a.correct).length;
 D('qLabel').textContent='ЗАНЯТИЕ ЗАВЕРШЕНО';D('qProgress').style.width='100%';D('qText').textContent=`Результат: ${hits} из ${session.items.length}`;D('feedback').textContent=VocaStorage.isVolatile()?'Результат доступен в текущей вкладке. Скачай прогресс.':'Результат сохранён в этом браузере.';
 const nodes=[btn('Новое занятие',()=>showPage('lesson'),'primary'),btn('К словарю',()=>showPage('words'))];if(state.review.length)nodes.push(btn('Повторить ошибки ('+state.review.length+')',startReview));
 D('answers').replaceChildren(...nodes);D('nextQ').style.display='none';
}
function renderReview(){
 const list=D('reviewList');const pool=VocaData.words.filter(w=>state.review.includes(w.id));
 list.replaceChildren(...(pool.length?pool.map(w=>mk('p',w.level+' · '+themeName(w.cat)+' · '+w.en+' — '+w.ru)):[mk('p','Трудных слов пока нет. Они появятся после ошибок в практике или игре.')]));
}
function startReview(){const pool=VocaData.words.filter(w=>state.review.includes(w.id));showQuizPage();startQuiz(pool,true);}
function updateStats(){
 const mastered=Object.values(state.successes).filter(n=>n>=2).length,s=state.stats,acc=s.total?Math.round(s.correct/s.total*100)+'%':'—';
 for(const [id,value]of Object.entries({statWords:mastered,pWords:mastered,statTests:s.attempts,pTests:s.attempts,statAccuracy:acc,pAcc:acc,reviewQty:state.review.length,pBadges:(state.seen.length>0?1:0)+(s.attempts>0?1:0)+(mastered>=4?1:0),vPercent:Math.round(mastered/VocaData.words.length*100)+'%',tPercent:s.attempts?'100%':'0%',seenCount:'Просмотрено карточек: '+state.seen.length+' из '+VocaData.words.length})){const e=D(id),v=String(value);if(e.textContent!==v)e.textContent=v;}
 D('vBar').style.width=(mastered/VocaData.words.length*100)+'%';D('tBar').style.width=s.attempts?'100%':'0%';
}
function exportProgress(){VocaStorage.flush();downloadJson({type:'voca-progress',exportedAt:new Date().toISOString(),...state},'VOCA-progress.json');}
function resetProgress(){if(!confirm('Сбросить учебный прогресс? Настройки и задания учителя сохранятся. Сначала скачай прогресс, если он нужен.'))return;const profile=state.profile;state=VocaDomain.empty();state.profile=profile;session=null;persist(true);renderReview();renderWord();toast('Учебный прогресс сброшен.');}
window.Voca={getState:()=>structuredClone(state),getSession:()=>session?structuredClone(session):null};
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.addEventListener('keydown',e=>{
 if(D('onboard').hidden)return;
 if(e.key==='Escape'&&state.profile.configured){closeProfile();return;}
 if(e.key==='Tab'){
  const f=[...D('onboard').querySelectorAll('button,select,input')].filter(x=>!x.hidden&&!x.disabled),first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
initializeTopics();syncSelection();renderWord();updateStats();D('onboard').hidden=true;
