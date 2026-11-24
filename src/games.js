/* Three local games; only mistakes join the common review queue. */
let selectedGame='match',selectedTile=null,gamePairs=[],gameEpoch=0,gameLocked=false,gameMatched=0;
let spelling=null,contextRound=null;
function selectGame(key){
 if(!['match','spell','context'].includes(key))return;
 VocaSpeech.stop();selectedGame=key;gameEpoch++;spelling=null;contextRound=null;
 for(const name of ['match','spell','context']){
  D(name+'Game').hidden=name!==key;
  const tab=D(name+'Tab');tab.setAttribute('aria-selected',String(name===key));tab.tabIndex=name===key?0:-1;
 }
 D('gameContext').textContent=activeLevel+' · '+themeName();
 if(key==='match')newGame();else if(key==='spell')startSpelling();else startContext();
}
function startSelectedGame(){selectGame(selectedGame);}
function changeGameSelection(){
 const level=D('gameLevel').value,topic=D('gameTheme').value;
 if(!VocaData.levels.includes(level)||(topic!=='All'&&!Object.hasOwn(VocaData.themes,topic)))return;
 activeLevel=level;activeCat=topic;state.profile.level=level;wi=0;session=null;persist(true);syncSelection();renderWord();startSelectedGame();
}
function gameFeedback(word,hit){
 const [ex,tr]=VocaDomain.context(word,state.profile.ageGroup);
 return (hit?'Верно! ':'Правильный ответ: ')+word.en+' — '+word.ru+'. '+ex+' — '+tr+(hit?'':' Слово добавлено в повторение.');
}
function gameMistake(word){VocaDomain.mistake(state,word.id);persist();}
function roundSummary(round,target,actions,restart){
 VocaStorage.flush();target.replaceChildren(mk('h3','Раунд завершён'),mk('p','Правильных ответов с первой попытки: '+round.correct+' из '+round.items.length+'.'));
 const wrong=round.items.filter(w=>round.errors.includes(w.id));
 if(wrong.length){target.append(mk('p','На повторение: '+wrong.map(w=>w.en+' — '+w.ru).join('; ')+'.'));}
 else target.append(mk('p','Все ответы верны. Продолжи практику или выбери другую игру.'));
 actions.replaceChildren(btn('Новый раунд',restart,'primary'));
 if(wrong.length)actions.append(btn('Повторить ошибки',startReview));
}
function startSpelling(){
 const items=shuffled(filteredWords().filter(w=>/^[a-z]+(?:[ '-][a-z]+)*$/i.test(w.en))).slice(0,5);
 spelling={items,index:0,correct:0,errors:[],checked:false,done:false};renderSpelling();
}
function renderSpelling(){
 const round=spelling,target=D('spellBody'),actions=D('spellActions');target.replaceChildren();actions.replaceChildren();
 if(!round.items.length){target.append(mk('p','Для этого набора пока нет слов. Выбери другую тему.'));return;}
 if(round.done){roundSummary(round,target,actions,startSpelling);return;}
 const word=round.items[round.index];round.word=word;round.checked=false;round.picks=[];
 round.letters=shuffled(Array.from(word.en.toLowerCase()).filter(c=>/[a-z]/.test(c)).map((letter,id)=>({letter,id})));
 target.append(mk('small','Слово '+(round.index+1)+' из '+round.items.length),mk('h3',word.ru));
 const answer=mk('div');answer.id='spellAnswer';answer.className='spell-answer';answer.setAttribute('aria-label','Собранное слово');
 const bank=mk('div');bank.id='letterBank';bank.className='letter-bank';
 for(const tile of round.letters){const b=btn(tile.letter,()=>pickLetter(tile.id,round),'letter');b.dataset.letterId=String(tile.id);b.setAttribute('aria-label','Буква '+tile.letter);bank.append(b);}
 const feedback=mk('p');feedback.id='spellFeedback';feedback.className='game-feedback';
 target.append(answer,bank,feedback);
 const undo=btn('Убрать букву',()=>{if(spelling!==round||round.checked)return;round.picks.pop();updateSpelling();});undo.id='spellUndo';
 const check=btn('Проверить',()=>checkSpelling(round),'primary');check.id='spellCheck';
 actions.append(undo,check);updateSpelling();
}
function updateSpelling(){
 const round=spelling;if(!round||round.done)return;
 let at=0;
 const result=Array.from(round.word.en.toLowerCase()).map(c=>{
  if(!/[a-z]/.test(c))return c;
  const pickedId=round.picks[at++];
  return round.letters.find(tile=>tile.id===pickedId)?.letter||'＿';
 }).join('');
 D('spellAnswer').textContent=result;
 for(const b of D('letterBank').children){b.disabled=round.checked||round.picks.includes(Number(b.dataset.letterId));}
 D('spellCheck').disabled=round.checked||round.picks.length!==round.letters.length;
 D('spellUndo').disabled=round.checked||!round.picks.length;
}
function pickLetter(id,expected=spelling){
 const round=spelling;if(!round||round!==expected||selectedGame!=='spell'||round.checked||round.done||round.picks.includes(id)||!round.letters.some(x=>x.id===id))return;
 round.picks.push(id);updateSpelling();
}
function checkSpelling(expected=spelling){
 const round=spelling;if(!round||round!==expected||selectedGame!=='spell'||round.checked||round.done||round.picks.length!==round.letters.length)return;
 round.checked=true;
 const result=round.picks.map(id=>round.letters.find(x=>x.id===id).letter).join('');
 const hit=result===round.word.en.toLowerCase().replace(/[^a-z]/g,'');
 if(hit)round.correct++;else{round.errors.push(round.word.id);gameMistake(round.word);}
 updateSpelling();D('spellFeedback').textContent=gameFeedback(round.word,hit);D('spellFeedback').classList.toggle('error',!hit);
 D('spellActions').append(btn(round.index+1<round.items.length?'Следующее слово':'Результат',()=>{
  if(spelling!==round||round.done||!round.checked)return;
  round.index++;round.done=round.index>=round.items.length;renderSpelling();
 },'primary'));
}
function startContext(){
 const pool=filteredWords();const items=shuffled(pool.filter(w=>VocaDomain.context(w,state.profile.ageGroup)[0].toLowerCase().includes(w.en.toLowerCase()))).slice(0,5);
 contextRound={items,index:0,correct:0,errors:[],checked:false,done:false,pool};renderContext();
}
function renderContext(){
 const round=contextRound,target=D('contextBody'),actions=D('contextActions');target.replaceChildren();actions.replaceChildren();
 if(!round.items.length){target.append(mk('p','Для этого набора пока нет предложений. Выбери другую тему.'));return;}
 if(round.done){roundSummary(round,target,actions,startContext);return;}
 round.word=round.items[round.index];round.checked=false;
 const question=VocaDomain.question(round.word,round.pool,state.profile.ageGroup,'gap');round.question=question;
 const prompt=mk('h3',question.prompt);prompt.id='contextPrompt';
 target.append(mk('small','Задание '+(round.index+1)+' из '+round.items.length),prompt);
 const choices=mk('div');choices.id='contextOptions';choices.className='answers';
 question.options.forEach(option=>choices.append(btn(option.text,()=>answerContext(option.id,round),'answer')));
 const feedback=mk('p');feedback.id='contextFeedback';feedback.className='game-feedback';target.append(choices,feedback);
}
function answerContext(id,expected=contextRound){
 const round=contextRound;if(!round||round!==expected||selectedGame!=='context'||round.checked||round.done||!round.question.options.some(o=>o.id===id))return;
 round.checked=true;const hit=id===round.word.id;
 if(hit)round.correct++;else{round.errors.push(round.word.id);gameMistake(round.word);}
 [...D('contextOptions').children].forEach((b,i)=>{b.disabled=true;const option=round.question.options[i];if(option.id===round.word.id)b.classList.add('correct');else if(option.id===id)b.classList.add('wrong');});
 D('contextFeedback').textContent=gameFeedback(round.word,hit);D('contextFeedback').classList.toggle('error',!hit);
 D('contextActions').append(btn(round.index+1<round.items.length?'Следующее предложение':'Результат',()=>{
  if(contextRound!==round||round.done||!round.checked)return;
  round.index++;round.done=round.index>=round.items.length;renderContext();
 },'primary'));
}
function newGame(){
 gameEpoch++;gameLocked=false;selectedTile=null;gameMatched=0;gamePairs=shuffled(filteredWords()).slice(0,4);D('gameContext').textContent=activeLevel+' · '+themeName();
 D('gameStatus').textContent='Найдено пар: 0 из '+gamePairs.length;
 const russian=shuffled(gamePairs),english=shuffled(gamePairs);
 if(english.length>1&&english.every((w,i)=>w.id===russian[i].id))english.push(english.shift());
 const column=(side,words,title)=>{
  const group=mk('div');group.id=side==='ru'?'matchRuColumn':'matchEnColumn';group.className='match-column';group.setAttribute('role','group');group.setAttribute('aria-label',title);
  group.append(mk('h3',title));
  for(const word of words){const b=btn(side==='ru'?word.ru:word.en,()=>pickTile(b),'match');b.dataset.id=word.id;b.dataset.side=side;b.lang=side;group.append(b);}
  return group;
 };
 D('matchGrid').replaceChildren(column('ru',russian,'Русский'),column('en',english,'English'));
}
function pickTile(b){
 if(selectedGame!=='match'||gameLocked||b.disabled||!b.isConnected)return;if(selectedTile===b){b.classList.remove('selected');selectedTile=null;return;}
 if(!selectedTile){selectedTile=b;b.classList.add('selected');return;}
 if(selectedTile.dataset.side===b.dataset.side){selectedTile.classList.remove('selected');selectedTile=b;b.classList.add('selected');return;}
 const first=selectedTile;selectedTile=null;first.classList.remove('selected');
 if(first.dataset.id===b.dataset.id&&first.dataset.side!==b.dataset.side){first.disabled=true;b.disabled=true;first.classList.add('done');b.classList.add('done');gameMatched++;D('gameStatus').textContent='Найдено пар: '+gameMatched+' из '+gamePairs.length;if(gameMatched===gamePairs.length)toast('Все пары найдены. Проверь запоминание в практике.');}
 else{
  const w=VocaData.words.find(w=>w.id===first.dataset.id);VocaDomain.mistake(state,w.id);persist();D('gameStatus').textContent='Верная пара: '+w.en+' — '+w.ru+'. Слово добавлено в повторение.';
  first.classList.add('game-bad');b.classList.add('game-bad');gameLocked=true;const epoch=gameEpoch;
  setTimeout(()=>{if(epoch!==gameEpoch)return;first.classList.remove('game-bad');b.classList.remove('game-bad');gameLocked=false;},700);
 }
}
