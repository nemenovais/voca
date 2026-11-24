/* Browser speech only. Never selects a remote voice or starts network requests. */
window.VocaSpeech=(()=>{
 let voices=[],active=null,token=0,timer=null;
 const supported='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
 function status(message){const e=document.getElementById('voiceStatus');if(e&&e.textContent!==message)e.textContent=message;}
 function refresh(){
  if(!supported){status('Озвучивание недоступно в этой среде. Открой скачанный файл в Chrome или Edge.');return;}
  try{voices=speechSynthesis.getVoices().filter(v=>v.localService&&/^en(?:[-_]|$)/i.test(v.lang));}
  catch{voices=[];}
  voices.sort((a,b)=>(/^en[-_]GB$/i.test(b.lang)?1:0)-(/^en[-_]GB$/i.test(a.lang)?1:0));
  if(!active)status(voices.length?'Озвучивание готово: '+voices[0].name+'.':'Английский голос пока недоступен. В предпросмотре ChatGPT звук может быть ограничен; попробуй скачанный файл в отдельном браузере.');
 }
 function stop(){const hadActive=!!active;token++;clearTimeout(timer);timer=null;active=null;if(supported&&hadActive){try{speechSynthesis.cancel();}catch{}}if(voices.length)status('Озвучивание готово: '+voices[0].name+'.');}
 function say(text){
  if(!supported){refresh();return false;}
  if(typeof text!=='string'||!text.trim()||text.length>500)return false;
  if(active?.text===text){status('Это произношение уже запускается или звучит.');return false;}
  refresh();if(!voices.length)return false;
  if(active)stop();
  const request=++token;const u=new SpeechSynthesisUtterance(text);u.voice=voices[0];u.lang=voices[0].lang;u.rate=.9;
  active=u;status('Запускаю произношение…');
  u.onstart=()=>{if(request!==token)return;clearTimeout(timer);status('Воспроизводится произношение.');};
  u.onend=()=>{if(request!==token)return;active=null;clearTimeout(timer);refresh();};
  u.onerror=e=>{if(request!==token)return;active=null;clearTimeout(timer);status(['canceled','interrupted'].includes(e.error)?'Воспроизведение остановлено.':'Браузер не смог воспроизвести звук. Проверь английский голос и попробуй открыть файл отдельно.');};
  try{speechSynthesis.speak(u);}catch{active=null;status('Не удалось запустить голос в этой среде.');return false;}
  timer=setTimeout(()=>{if(request===token&&active===u)status('Голос ещё не начал воспроизведение. Нажми «Остановить звук» и попробуй снова в отдельном браузере.');},5000);
  return true;
 }
 if(supported)speechSynthesis.addEventListener?.('voiceschanged',refresh);
 window.addEventListener('pagehide',stop);
 refresh();return {say,stop,refresh,available:()=>voices.length>0};
})();
