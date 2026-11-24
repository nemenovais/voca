/* Explicit event registry: no inline JS, eval or dynamic code execution. */
const actions={checkVoice:()=>VocaSpeech.refresh(),stopVoice:()=>VocaSpeech.stop(),showPage,filterWords,speakWord,markKnown,nextWord,nextQuestion,newGame,changeGameSelection,openProfile,closeProfile,saveOnboarding,changeLessonSelection,startReview,exportProgress,resetProgress};
document.querySelectorAll('[data-action]').forEach(element=>element.addEventListener('click',()=>{
 const name=element.dataset.action;
 if(name==='chooseAssessment'){chooseAssessment(element);return;}
 if(Object.hasOwn(actions,name))actions[name](...JSON.parse(element.dataset.args||'[]'));
}));
document.querySelectorAll('[data-change]').forEach(element=>element.addEventListener('change',()=>{
 const name=element.dataset.change;if(Object.hasOwn(actions,name))actions[name]();
}));
if(!state.profile.configured)openProfile();
else {D('onboard').hidden=true;document.querySelector('.shell').inert=false;}

const gameTabs=[...document.querySelectorAll('[data-game]')];
gameTabs.forEach((tab,index)=>{
 tab.addEventListener('click',()=>selectGame(tab.dataset.game));
 tab.addEventListener('keydown',event=>{
  let next=index;
  if(event.key==='ArrowRight')next=(index+1)%gameTabs.length;
  else if(event.key==='ArrowLeft')next=(index+gameTabs.length-1)%gameTabs.length;
  else if(event.key==='Home')next=0;else if(event.key==='End')next=gameTabs.length-1;else return;
  event.preventDefault();gameTabs[next].focus();selectGame(gameTabs[next].dataset.game);
 });
});
