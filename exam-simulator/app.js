(function aptisExamSimulator(){
'use strict';
const root=document.getElementById('simulation');
const COURSES=Array.isArray(window.COURSES)?window.COURSES:[];
const SKILLS={
 grammar:{name:'Grammar & Vocabulary',duration:25,icon:'Aa',detail:'25 grammar questions + 25 vocabulary items'},
 listening:{name:'Listening',duration:40,icon:'♫',detail:'17 tasks · 20 recordings in the official format'},
 reading:{name:'Reading',duration:35,icon:'▤',detail:'Four parts · reading and matching tasks'},
 writing:{name:'Writing',duration:50,icon:'✎',detail:'Four parts · 5 messages, text, chat and two emails'},
 speaking:{name:'Speaking',duration:12,icon:'◉',detail:'Four parts · short responses, photos and discussion'}
};
const ORDER=['grammar','listening','reading','writing','speaking'];
const KEY='dingdang-exam-practice-session-v1';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const raw=x=>String(x??'');
const str=x=>String(x??'').trim();
const wordCount=s=>(str(s).match(/\S+/g)||[]).length;
const clean=s=>{const el=document.createElement('div');el.innerHTML=raw(s);return (el.textContent||'').replace(/\s+/g,' ').trim()};
const sourceLabel=s=>raw(s).replace(/[ĂăĐđĨĩŨũƠơƯưẠ-ỹ].*$/,'').replace(/\s*[-–:]\s*$/,'').trim();
const displayName=q=>sourceLabel(q?.metadata?.topic||q?.title||q?.stem||'Question');
const parts=c=>c?.questions||[];
const modCourses=skill=>COURSES.filter(c=>c.skill===skill);
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify({screen:S.screen,skill:S.skill,set:S.set,full:S.full,queue:S.queue,at:S.at,index:S.index,answers:S.answers,flags:S.flags,seen:S.seen,plays:S.plays,deadline:S.deadline,results:S.results,speakIndex:S.speakIndex}))}catch{}};
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
const tpad=x=>String(Math.max(0,x)).padStart(2,'0');
const clock=seconds=>`${tpad(Math.floor(seconds/3600))}:${tpad(Math.floor(seconds%3600/60))}:${tpad(Math.floor(seconds%60))}`;
const timeleft=()=>Math.max(0,Math.ceil((S.deadline-Date.now())/1000));
const S={screen:'welcome',skill:'writing',set:1,full:false,queue:[],at:0,index:0,answers:{},flags:{},seen:{},plays:{},deadline:0,results:[],speakIndex:0,filter:'all',dialog:null};
let tasks=[],timer=null,audio=null,stream=null,recorder=null,recChunks=[],recorded={},speaktimer=null,speakRemaining=0,speakStatus='ready',objectUrls=[];
const sample=s=>{const arr=modCourses(s);return arr.length};
const totalSets={grammar:3,listening:15,reading:10,writing:30,speaking:15};
function seedPick(a,seed){return a.length?a[((seed%a.length)+a.length)%a.length]:null}
function buildTasks(skill,set){
 const groups=modCourses(skill);
 if(skill==='grammar'){const c=groups[Math.max(0,Math.min(set-1,groups.length-1))];return parts(c).map(q=>({q,part:q.part}))}
 if(skill==='listening'){
  const q=groups.flatMap(c=>parts(c));
  const p1=q.filter(a=>a.part===1&&a.type==='listening_mcq');
  const p2=q.filter(a=>a.part===2&&a.type==='listening_speaker_match');
  const p3=q.filter(a=>a.part===3&&a.type==='listening_conversation');
  const p4=q.filter(a=>a.part===4&&a.type==='listening_monologue');
  const result=[];for(let i=0;i<13;i++){const x=seedPick(p1,(set-1)*13+i);if(x)result.push(x)}
  result.push(seedPick(p2,set-1),seedPick(p3,set-1),seedPick(p4,(set-1)*2),seedPick(p4,(set-1)*2+1));
  return result.filter(Boolean).map(q=>({q,part:q.part}))
 }
 if(skill==='reading'){
  const all=groups.flatMap(c=>parts(c));
  const by=n=>all.filter(q=>q.part===n);
  return [seedPick(by(1),set-1),seedPick(by(2),(set-1)*2),seedPick(by(2),(set-1)*2+1),seedPick(by(3),set-1),seedPick(by(4),set-1)].filter(Boolean).map(q=>({q,part:q.part}));
 }
 if(skill==='writing'||skill==='speaking'){
  const sorted=[...groups].sort((a,b)=>Number.parseInt(a.title,10)-Number.parseInt(b.title,10));
  const group=seedPick(sorted,set-1);
  return parts(group).sort((a,b)=>a.part-b.part).map(q=>({q,part:q.part}));
 }
 return [];
}
function aid(q){return str(q.id)}
function ans(q){const k=aid(q);return S.answers[k]||(S.answers[k]={})}
function isAnswered(task){
 const q=task.q,m=q.metadata||{},a=S.answers[aid(q)]||{};
 if(S.skill==='speaking')return !!a.done;
 if(S.skill==='writing'){
  if(q.part===1)return (m.fields||[]).every((x,i)=>!!str(a[i]));
  if(q.part===2)return !!str(a.text);
  if(q.part===3)return (m.questions||[]).every((x,i)=>!!str(a[i]));
  if(q.part===4)return !!str(a.friend)&&!!str(a.formal);
 }
 if(q.type==='sentence_ordering'){
   const picks=Array.from({length:fieldCount(q)},(_,i)=>str(a[i]));
   return picks.every(Boolean)&&new Set(picks).size===picks.length;
  }
  if(q.type==='mcq3'||q.type==='listening_mcq')return !!str(a.value);
 const expected=fieldCount(q);
 return expected>0&&Array.from({length:expected},(_,i)=>str(a[i])).every(Boolean);
}
function fieldCount(q){
 const m=q.metadata||{};
 if(['synonym_match','definition_match','sentence_completion','collocation_match'].includes(q.type))return (m.pairs||[]).length;
 if(q.type==='fill_in_blanks_mc')return (m.paragraphs||[]).length;
 if(q.type==='sentence_ordering')return (m.correct_answers||[]).length||(m.sentences||[]).filter(Boolean).length;
 if(q.type==='text_question_match')return (m.questions||[]).length;
 if(q.type==='matching_headings')return (m.paragraphs||[]).length;
 if(q.type==='listening_speaker_match')return (m.items||[]).length;
 if(q.type==='listening_conversation')return (m.statements||[]).length;
 if(q.type==='listening_monologue')return (m.questions||[]).length;
 return 0;
}
const doneCount=()=>tasks.filter(isAnswered).length;
const flagsCount=()=>tasks.filter(t=>S.flags[aid(t.q)]).length;
function allPartsLabel(q){
 if(S.skill==='grammar')return q.part===1?'Grammar':'Vocabulary';
 const lookup={grammar:['Grammar','Vocabulary'],listening:['Information recognition','Information matching','Opinion matching','Longer monologues'],reading:['Sentence comprehension','Text cohesion','Opinion matching','Long text comprehension'],writing:['Word-level writing','Short text writing','Three messages','Informal & formal emails'],speaking:['Personal information','Describe one photo','Compare two photos','Abstract discussion']};
 return lookup[S.skill]?.[q.part-1]||('Part '+q.part);
}
function resetSession(skill,set,full=false,queue=null,at=0){
 stopAudio();stopMic();
 S.skill=skill;S.set=set;S.full=!!full;S.queue=queue||[skill];S.at=at;
 S.index=0;S.answers={};S.flags={};S.seen={};S.plays={};S.results=[];S.filter='all';S.speakIndex=0;
 S.deadline=Date.now()+SKILLS[skill].duration*60*1000;
 tasks=buildTasks(skill,set);S.screen='exam';S.seen[aid(tasks[0]?.q||{})]=true;persist();render();
}
function advanceModule(){
 stopAudio();stopMic();if(S.full&&S.at<S.queue.length-1){
  S.at+=1;const skill=S.queue[S.at];
  S.skill=skill;S.set=1;S.index=0;S.answers={};S.flags={};S.seen={};S.plays={};S.speakIndex=0;
  S.deadline=Date.now()+SKILLS[skill].duration*60*1000;
  tasks=buildTasks(skill,1);if(tasks[0])S.seen[aid(tasks[0].q)]=true;
  S.screen='exam';persist();render();
 }else{S.screen='finish';S.deadline=0;persist();render()}
}
function pauseIfSpeaking(){if(S.skill==='speaking'){stopMic();stopSpeakingTimer();speakStatus='ready';speakRemaining=0}}
function goto(index){
 if(index<0||index>=tasks.length)return;
 stopAudio();pauseIfSpeaking();S.index=index;S.speakIndex=0;
 S.seen[aid(tasks[index].q)]=true;persist();render();
}
function timeExpired(){if(S.screen!=='exam')return;submitModule(true)}
function tick(){
 if(S.screen!=='exam')return;
 const left=timeleft(),el=$('timerval'),wrap=$('timerbox');
 if(el)el.textContent=clock(left);
 if(wrap)wrap.classList.toggle('urgent',left<=300);
 if(left===0)timeExpired();
}
function buildTop(exam=false){
 return `<header class="appbar"><div class="brand"><span class="brand-mark" aria-hidden="true">AS</span><div><strong>Aptis Studio · Exam Practice</strong><small>INDEPENDENT PRACTICE SIMULATOR · NOT AN OFFICIAL EXAM</small></div></div>${exam?`<div class="examtime" id="timerbox"><span>Time remaining</span><b id="timerval">${clock(timeleft())}</b></div>`:`<a class="header-action" href="../#">← Back to study library</a>`}</header>`;
}
function renderWelcome(){
 const boxes=ORDER.map(skill=>{const meta=SKILLS[skill];return `<button type="button" class="skillcard ${S.skill===skill?'selected':''}" data-skill="${skill}" aria-pressed="${S.skill===skill}"><span class="skillbadge">${meta.icon}</span><span><b>${meta.name}</b><small>${meta.duration} minutes<br>${meta.detail}</small></span></button>`}).join('');
 const sets=Array.from({length:totalSets[S.skill]},(_,i)=>`<option value="${i+1}" ${i+1===S.set?'selected':''}>Practice set ${i+1}</option>`).join('');
 const saved=load();
 root.innerHTML=buildTop()+`<main class="container welcome">
 <div class="hero"><div class="smalltag">Practice mode · Computer-based</div><h1>Get familiar with the exam screen</h1><p>Practise one Aptis ESOL General component or work through all five. Read each task, manage your time, flag questions and submit when ready.</p>
 <div class="notice">This is an independent interface simulation using your Aptis Studio question bank. It is <strong>not</strong> the official British Council or TestReach examination. Tasks and media availability may differ from the real exam.</div>
 <div class="skillgrid">${boxes}</div>
 <div class="startsettings"><div class="setleft"><label>Selected component<select id="selectedSkill" disabled><option>${SKILLS[S.skill].name}</option></select></label><label>Question bank<select id="setlist">${sets}</select></label></div><button class="button primary big" data-action="start">Start selected component →</button></div>
 <div class="actions" style="margin-top:13px;display:flex;gap:11px;flex-wrap:wrap"><button class="button soft" data-action="startall">Start all five components (practice)</button>${saved?.screen==='exam'&&saved.deadline>Date.now()?'<button class="button" data-action="resume">Resume saved session</button>':''}</div>
 <p class="microcopy">Time limits: Core 25m · Listening 40m · Reading 35m · Writing 50m · Speaking 12m. Answers are autosaved in this browser. Speaking recordings remain on your device and are not uploaded.</p></div></main>`;
}
function renderSidebar(){
 const list=tasks.map((task,i)=>{const q=task.q,key=aid(q),flag=!!S.flags[key],answered=isAnswered(task),active=i===S.index;
 if(S.filter==='flagged'&&!flag||S.filter==='unanswered'&&answered)return '';
 return `<button class="question-number ${active?'current':''} ${answered?'answered':''} ${flag?'flagged':''}" title="Question ${i+1} · ${answered?'Answered':'Not answered'}${flag?' · Flagged':''}" aria-label="Question ${i+1}" ${active?'aria-current="step"':''} data-goto="${i}">${i+1}</button>`}).join('');
 return `<aside class="sidebar" id="examSidebar"><div class="sectionname">${SKILLS[S.skill].name}</div><div class="side-sub">Practice set ${S.set} · ${SKILLS[S.skill].duration} min · ${tasks.length} task screens</div><div class="filterstrip"><button data-filter="all" class="${S.filter==='all'?'on':''}">All</button><button data-filter="unanswered" class="${S.filter==='unanswered'?'on':''}">Unanswered</button><button data-filter="flagged" class="${S.filter==='flagged'?'on':''}">Flagged ${flagsCount()}</button></div><nav aria-label="Questions" class="question-list">${list||'<span class="microcopy">No questions in this filter</span>'}</nav><div class="sidelegend"><p><span class="legenddot"></span>Answered</p><p><span class="legenddot empty"></span>Not answered</p><p><span class="legenddot flag"></span>Flagged for review</p></div><p class="microcopy">Use the question list to revisit any task before submitting.</p></aside>`;
}
function selectField(q,key,pool,value,extra=''){
 const opts=[`<option value="">Select an answer</option>`].concat([...new Set(pool.map(String))].filter(x=>x!=='Đáp án bỏ'&&x!=='Đáp án sai'&&x!=='Đáp án nhiễu').map(x=>`<option value="${esc(x)}" ${String(value)===String(x)?'selected':''}>${esc(x)}</option>`));
 return `<select data-qid="${aid(q)}" data-key="${esc(key)}" ${extra} aria-label="Answer ${esc(key)}">${opts.join('')}</select>`;
}
function renderGrammar(q){
 const m=q.metadata||{},a=ans(q);
 if(q.type==='mcq3')return `<h2>${esc(sourceLabel(q.stem))}</h2><div class="radio-list">${(m.options||[]).map((o,i)=>`<label class="radio-line"><input type="radio" name="answer-${aid(q)}" data-qid="${aid(q)}" data-key="value" value="${esc(o.id||String(i+1))}" ${a.value===(o.id||String(i+1))?'checked':''}><b>${esc(o.id||String.fromCharCode(65+i))}</b><span>${esc(o.text)}</span></label>`).join('')}</div>`;
 const items=m.pairs||[],pool=m.dropdown_pool||[];
 const display=items.map((x,i)=>`<div class="answerrow"><label for="vocab-${i}"><b>${i+1}.</b> ${esc(x.prompt||x.prefix||'')}${x.after?' ______ '+esc(x.after):''}</label>${selectField(q,i,pool,a[i],`id="vocab-${i}"`)}</div>`).join('');
 return `<div class="instruction">${esc(m.instruction||q.stem||'Match the correct words.')}</div><div class="answerrows">${display}</div><p class="microcopy">Five responses are required for this vocabulary task.</p>`;
}
function renderReading(q){
 const m=q.metadata||{},a=ans(q);
 if(q.type==='fill_in_blanks_mc'){
  const paragraphs=(m.paragraphs||[]).map((s,i)=>`<div class="answerrow"><div>${i+1}. ${esc(s).replace(/\[BLANK\]/g,'_____')}</div>${selectField(q,i,m.choices?.[i]||[],a[i])}</div>`).join('');
  return `<div class="instruction">Read the short text. Select the word that best completes each sentence.</div><div class="answerrows">${paragraphs}</div>`;
 }
 if(q.type==='sentence_ordering'){
  const allSentences=(m.sentences||[]).filter(Boolean);
  const count=(m.correct_answers||[]).length||allSentences.length;
  const fixedOpening=allSentences.length===count+1?allSentences[0]:null;
  const sentences=fixedOpening?allSentences.slice(1):allSentences.slice(0,count);
  const nums=sentences.map((_,i)=>String(i+1));
  return `<h2>${esc(displayName(q))}</h2><div class="instruction">The first sentence is already in place. Put the remaining five sentences in order, using each position once.</div>${fixedOpening?`<div class="groupbox"><b>Opening sentence (fixed)</b><p>${esc(fixedOpening)}</p></div>`:'<p class="microcopy">The opening sentence is missing from this source set; arrange the five supplied sentences.</p>'}<div class="answerrows">${sentences.map((s,i)=>`<div class="answerrow"><div>${esc(s)}</div>${selectField(q,i,nums,a[i])}</div>`).join('')}</div><p class="microcopy">Choose five different positions (1–5).</p>`;
 }
 if(q.type==='text_question_match'){
  return `<h2>${esc(displayName(q))}</h2><div class="instruction">Read the four opinions and match each statement to the correct person.</div><div class="peoplebox">${(m.options||[]).map((p,i)=>`<div class="person"><h3>${esc(m.names?.[i]||'Person '+(i+1))}</h3><p>${esc(p)}</p></div>`).join('')}</div><div class="answerrows">${(m.questions||[]).map((t,i)=>`<div class="answerrow"><label>${i+1}. ${esc(t)}</label>${selectField(q,i,m.names||[],a[i])}</div>`).join('')}</div>`;
 }
 if(q.type==='matching_headings'){
  const headings=m.headings||[];
  return `<h2>${esc(displayName(q))}</h2><div class="instruction">Read the long text and choose a heading for each paragraph.</div>${headings.length<=7?'<p class="notice warning">Source limitation: this practice bank has '+headings.length+' headings; the official practice format normally includes an extra heading.</p>':''}<div class="paragraphs">${(m.paragraphs||[]).map((p,i)=>`<div class="paragraph"><h3>Paragraph ${i+1}</h3><div>${esc(p)}</div><div class="rowanswer">${selectField(q,i,headings,a[i])}</div></div>`).join('')}</div>`;
 }
 return `<div class="notice warning">This reading question format is not available in the current source bank.</div>`;
}
function playbackText(q){
 const m=q.metadata||{};
 if(q.part===1){const p=clean(m.description);const a=clean(m.correct_answer);return p.replace(new RegExp('^'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'').trim().slice(0,1700)}
 if(q.part===2)return (m.descriptions||[]).map((text,i)=>'Speaker '+String.fromCharCode(65+i)+'. '+clean(text.split('</p>')[0])).join(' ').slice(0,3500);
 if(q.part===3){const d=clean(m.description);return d.slice(0,4000)}
 if(q.part===4)return null;
 return null;
}
function renderAudio(q){
 const played=S.plays[aid(q)]||0,src=q.audio?.[0],canSpeak=!!playbackText(q);
 const notice=src?'Audio from the question bank is available (up to two plays), but is not verified as an official Aptis recording.':canSpeak?'Source audio is missing. Text-to-speech is a synthetic practice aid, not the real Aptis recording.':'No source audio or verified transcript is available. This question can be used for interface practice only.';
 return `<div class="audioarea"><button type="button" class="button primary" data-action="audio" ${played>=2||(!src&&!canSpeak)?'disabled':''}>▶ ${src?'Play recording':canSpeak?'Play synthetic practice voice':'Recording unavailable'}</button><span class="counter">Played ${played} / 2</span><div class="audiomsg">${esc(notice)}</div></div>`;
}
function renderListening(q){
 const m=q.metadata||{},a=ans(q),audioBox=renderAudio(q);
 if(q.type==='listening_mcq'){
  const stem=sourceLabel(q.stem).replace(/\s*\(.*\)$/,'');
  return `<h2>${esc(stem)}</h2>${audioBox}<div class="radio-list">${(m.choices||[]).map((c,i)=>`<label class="radio-line"><input type="radio" data-qid="${aid(q)}" data-key="value" name="answer-${aid(q)}" value="${esc(c)}" ${a.value===c?'checked':''}><b>${String.fromCharCode(65+i)}</b><span>${esc(c)}</span></label>`).join('')}</div>`;
 }
 if(q.type==='listening_speaker_match'){
  const pool=(m.choices||[]).filter(v=>!/^Đáp án (bỏ|sai|nhiễu)/i.test(v));
  return `<h2>${esc(displayName(q))}</h2><div class="instruction">Match each speaker to the correct statement.</div>${audioBox}<div class="answerrows">${(m.items||[]).map((n,i)=>`<div class="answerrow"><label>${esc(n)}</label>${selectField(q,i,pool,a[i])}</div>`).join('')}</div>`;
 }
 if(q.type==='listening_conversation'){
  return `<h2>${esc(displayName(q))}</h2><div class="instruction">Listen to two speakers. Who expresses each opinion: Man, Woman or Both?</div>${audioBox}<div class="answerrows">${(m.statements||[]).map((n,i)=>`<div class="answerrow"><label>${i+1}. ${esc(n)}</label>${selectField(q,i,m.shared_choices||['Man','Woman','Both'],a[i])}</div>`).join('')}</div>`;
 }
 if(q.type==='listening_monologue'){
  return `<h2>${esc(m.topic||displayName(q))}</h2><div class="instruction">Listen to the monologue and choose one response to each question.</div>${audioBox}<div class="answerrows">${(m.questions||[]).map((n,i)=>`<div class="answerrow"><label>${i+1}. ${esc(n.question)}</label>${selectField(q,i,n.choices||[],a[i])}</div>`).join('')}</div>`;
 }
 return '<div class="notice warning">Missing listening task metadata.</div>';
}
function renderTextarea(q,key,label,val,range=[0,0],tall=false){
 const count=wordCount(val),max=range[1]||0;
 return `<div class="textarea-wrap"><label for="field-${esc(key)}">${esc(label)}</label><textarea class="writetext ${tall?'tall':''}" id="field-${esc(key)}" data-qid="${aid(q)}" data-key="${esc(key)}" aria-label="${esc(label)}" spellcheck="true">${esc(val||'')}</textarea><div class="wordcount"><span>${max?`Recommended: ${range[0]}–${max} words`:'Use single words or short phrases'}</span><b class="${max&&(count<range[0]||count>max)?'limit':''}" id="count-${esc(key)}">${count} words</b></div></div>`;
}
function renderWriting(q){
 const m=q.metadata||{},a=ans(q);
 if(q.part===1){
  return `<h2>Part 1 · Join the club</h2><div class="instruction">Answer five short questions using a few words or a short phrase.</div>${(m.fields||[]).map((x,i)=>`<div class="textarea-wrap"><label for="write-${i}">${i+1}. ${esc(x.label)}</label><input id="write-${i}" class="input" data-qid="${aid(q)}" data-key="${i}" value="${esc(a[i]||'')}" placeholder="Your answer"></div>`).join('')}`;
 }
 if(q.part===2){
  return `<h2>Part 2 · Short text</h2><div class="instruction">Write 20–30 words in complete sentences.</div><div class="groupbox"><b>${esc(m.scenario||q.stem)}</b></div>${renderTextarea(q,'text','Your response',a.text,[20,30],false)}`;
 }
 if(q.part===3){
  return `<h2>Part 3 · Group chat</h2><div class="instruction">Reply to each of the three messages using approximately 30–40 words.</div>${(m.questions||[]).map((x,i)=>`<div class="groupbox"><h3>Member ${String.fromCharCode(65+i)} says:</h3><p>${esc(x.prompt)}</p>${renderTextarea(q,i,'Your reply',a[i],[30,40])}</div>`).join('')}`;
 }
 if(q.part===4){
  const body=m.email||{};
  return `<h2>Part 4 · Two emails</h2><div class="instruction">Read the message. Write an informal email to a friend and a formal email to the manager.</div><div class="emailbox">${esc([body.greeting,body.body,body.sign_off].filter(Boolean).join('\n\n'))}</div>
   <div class="groupbox"><h3>Email 1 – To a friend</h3><p>${esc(m.task1?.instruction||'Write an informal email to a friend.')}</p>${renderTextarea(q,'friend','Informal email (40–50 words)',a.friend,[40,50])}</div>
   <div class="groupbox"><h3>Email 2 – To a person in authority</h3><p>${esc(m.task2?.instruction||'Write a formal email.')}</p>${renderTextarea(q,'formal','Formal email (120–150 words)',a.formal,[120,150],true)}</div>`;
 }
 return '<div class="notice warning">Writing data not available.</div>';
}
function renderSpeaking(q){
 const m=q.metadata||{},a=ans(q),questions=m.questions||[],index=S.speakIndex;
 const part4=q.part===4;
 const current=part4?questions.join('  ·  '):(questions[index]||'Describe the picture.');
 const images=q.images?.length?q.images:(m.image_paths||[]);
 const imagesHtml=images.length?`<div class="photo-grid ${images.length===1?'single':''}">${images.slice(0,2).map(src=>`<img src="${esc(encodeURI('../'+src))}" alt="Speaking photo provided in the source question" loading="lazy" onerror="this.style.opacity='.3';this.alt='Source picture unavailable'">`).join('')}</div>`:'';
 const limit=part4?120:q.part===1?30:45;
 const labels=questions.map((_,i)=>`<button type="button" class="button ${i===index?'soft':''}" data-speakq="${i}" ${part4?'disabled':''}>Question ${i+1}</button>`).join('');
 const status=speakStatus==='recording'?'● Recording…':speakStatus==='prep'?'Preparation time':speakStatus==='done'?'Recording saved locally':'Ready';
 return `<h2>Part ${q.part} · ${esc(allPartsLabel(q))}</h2><div class="instruction">${part4?'You have one minute to prepare, then two minutes to discuss all three questions.':`There are three questions. Speak for ${limit} seconds per answer.`}</div>${imagesHtml}
 <div class="groupbox"><h3>${part4?'Discuss these questions':`Question ${index+1} of ${questions.length}`}</h3><p>${esc(current)}</p></div>
 ${!part4?`<div class="p3nav" style="display:flex;gap:8px;flex-wrap:wrap">${labels}</div>`:''}
 <div class="recorder"><div class="badge-record">${status}</div><div class="recordtime" id="speakclock">${clock(speakRemaining||limit)}</div><div class="recstatus">Microphone requires permission. Recordings are stored only in this browser session, not uploaded or automatically graded.</div><div class="controls">
 <button class="button primary" data-action="${part4&&speakStatus==='ready'?'prepare':'record'}" ${speakStatus==='recording'||speakStatus==='prep'?'disabled':''}>${part4&&speakStatus==='ready'?'Start 1-minute preparation':'● Start recording'}</button>
 ${speakStatus==='prep'?'<button class="button" data-action="skipprep">Skip preparation</button>':''}
 ${speakStatus==='recording'?'<button class="button danger" data-action="stoprecord">Stop recording</button>':''}
 ${recorded[aid(q)+'-'+index]?`<button class="button" data-action="downloadrecord">Download recording</button>`:''}
 ${q.part!==4&&index<questions.length-1?'<button class="button" data-action="speaknext">Next speaking question →</button>':''}
 </div></div><p class="microcopy">The official Aptis speaking test has fixed timing and recorded answers. This is practice, not an official speaking assessment.</p>`;
}
function currentBody(q){
 if(S.skill==='grammar')return renderGrammar(q);
 if(S.skill==='listening')return renderListening(q);
 if(S.skill==='reading')return renderReading(q);
 if(S.skill==='writing')return renderWriting(q);
 if(S.skill==='speaking')return renderSpeaking(q);
 return 'Unknown component';
}
function renderExam(){
 tasks=buildTasks(S.skill,S.set);
 if(!tasks.length){S.screen='welcome';return renderWelcome()}
 const task=tasks[S.index]||tasks[0],q=task.q;
 S.index=Math.min(Math.max(S.index,0),tasks.length-1);
 const amount=doneCount(),pct=Math.round(amount/tasks.length*100);
 root.innerHTML=buildTop(true)+`<div class="exam-layout">${renderSidebar()}
 <div class="exammain"><div class="progresshead"><button class="button mobile-nav" data-action="sidebar">☰ Questions</button><span><b>Part ${q.part}</b> · ${esc(allPartsLabel(q))}</span><span class="progressrail"><i style="width:${pct}%"></i></span><span>${amount}/${tasks.length} tasks answered</span></div>
 <article class="questioncard"><div class="headrow"><div><div class="questionid">${SKILLS[S.skill].name.toUpperCase()} / QUESTION ${S.index+1} OF ${tasks.length}</div><div class="questionmeta">Part ${q.part} · Set ${S.set}</div></div><button type="button" class="bookmark ${S.flags[aid(q)]?'active':''}" data-action="flag">${S.flags[aid(q)]?'⚑ Bookmarked':'⚐ Bookmark'}</button></div>${currentBody(q)}</article>
 <p class="microcopy">Practice simulation only. It is not an official Aptis ESOL / TestReach examination. Your work is saved locally in this browser.</p></div></div>
 <footer class="examfooter"><div class="footerleft"><button class="button mobile-nav" data-action="sidebar">☰</button><button class="button" data-action="prev" ${S.index===0?'disabled':''}>‹ Previous</button></div><span class="footerinfo">${Math.max(0,flagsCount())} flagged · ${tasks.length-amount} not answered</span><div class="footerright"><button class="button" data-action="submit">Finish</button><button class="button primary" data-action="next" ${S.index===tasks.length-1?'disabled':''}>Next ›</button></div></footer>`;
 tick();persist();
}
function markSummary(){
 let attempts=0,correct=0,total=0;
 for(const task of tasks){
  const q=task.q,m=q.metadata||{},a=S.answers[aid(q)]||{};
  if(S.skill==='writing'||S.skill==='speaking')continue;
  let expected=[],given=[];
  if(q.type==='mcq3') {expected=[m.correct_answer];given=[a.value]}
  else if(q.type==='listening_mcq') {expected=[m.correct_answer];given=[a.value]}
  else if(q.type==='sentence_ordering') {expected=m.correct_answers||[];given=expected.map((_,i)=>a[i])}
  else {expected=m.correct_answers||[];given=expected.map((_,i)=>a[i])}
  for(let i=0;i<expected.length;i++){if(expected[i]===null||expected[i]===undefined||expected[i]==='')continue;total++;if(str(given[i]))attempts++;if(str(expected[i]).toLowerCase()===str(given[i]).toLowerCase())correct++}
 }
 return {attempts,correct,total};
}
function submitModule(expired=false){
 if(S.screen!=='exam')return;
 stopAudio();stopMic();stopSpeakingTimer();
 const summary=markSummary();
 const result={skill:S.skill,set:S.set,done:doneCount(),count:tasks.length,flagged:flagsCount(),...summary,at:new Date().toISOString(),expired};
 S.results.push(result);
 if(S.full&&S.at<S.queue.length-1)advanceModule();else{S.screen='finish';S.deadline=0;persist();render()}
}
function renderFinish(){
 const results=S.results.length?S.results:[];
 const current=results[results.length-1]||{skill:S.skill,set:S.set,done:0,count:0,correct:0,total:0};
 const score=current.total?`${current.correct}/${current.total}`:'Not automatically graded';
 const list=results.map(r=>`<div class="reportitem"><strong>${SKILLS[r.skill].name} · Set ${r.set}</strong><span>${r.done}/${r.count} tasks completed</span><b>${r.total?`${r.correct}/${r.total} responses correct`:'Practice recorded'}</b></div>`).join('');
 root.innerHTML=buildTop()+`<main class="container finished"><div class="hero"><div class="smalltag">Practice session completed</div><h1>Session summary</h1><p>You have finished this practice module. Writing and speaking require human evaluation; these are not official CEFR grades.</p><div class="resultcards"><div class="resultcard"><b>${current.done}/${current.count}</b><small>Task screens answered</small></div><div class="resultcard"><b>${esc(score)}</b><small>${current.total?'Automatically checked responses':'Writing/Speaking'}</small></div><div class="resultcard"><b>${current.flagged}</b><small>Bookmarked tasks</small></div></div><h2 style="margin-top:25px">Components</h2><div class="reportlist">${list}</div><div class="actions" style="display:flex;gap:10px;flex-wrap:wrap"><button class="button primary" data-action="restart">Return to practice selection</button><button class="button" data-action="retry">Try this component again</button></div><p class="microcopy">Statistics are derived only from questions with answer keys in your library. No official scoring, band prediction, AI grading or uploading of microphone recordings takes place.</p></div></main>`;
}
function renderDialog(){
 const content=S.dialog;
 if(!content)return;
 const answered=doneCount(),left=tasks.length-answered,flags=flagsCount();
 const title=content==='submit'?'Finish this component?':'Leave your current session?';
 const text=content==='submit'?`You have answered ${answered} of ${tasks.length} task screens. ${left} remain unanswered and ${flags} are bookmarked. You can go back or submit now.`:'Your latest answers are saved on this device. Are you sure you want to return?';
 root.insertAdjacentHTML('beforeend',`<div class="dialogback" id="dialogOverlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><h2 id="dialogTitle">${title}</h2><p>${text}</p><div class="actions"><button class="button" data-action="cancel">Continue exam</button><button class="button ${content==='submit'?'primary':'danger'}" data-action="${content==='submit'?'confirm-submit':'confirm-leave'}">${content==='submit'?'Submit component':'Return to start'}</button></div></section></div>`);
}
function render(){
 if(!COURSES.length){root.innerHTML='<div class="loading">The question bank could not be loaded. Please check data.js and reload.</div>';return}
 clearInterval(timer);timer=null;
 if(S.screen==='exam'){renderExam();timer=setInterval(tick,1000)}
 else if(S.screen==='finish')renderFinish();
 else renderWelcome();
 if(S.dialog)renderDialog();
}
function setAnswer(qid,key,val){
 S.answers[qid]??={};
 S.answers[qid][key]=val;
 persist();
 const old=$('statusCount');if(old)old.textContent=doneCount()+'/'+tasks.length;
}
function recleanup(){
 if(audio){try{audio.pause();audio.src=''}catch{}audio=null}
 try{speechSynthesis.cancel()}catch{}
}
function stopAudio(){recleanup()}
function stopSpeakingTimer(){if(speaktimer){clearInterval(speaktimer);speaktimer=null}}
function stopMic(){
 if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch{}}
 recorder=null;
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 stopSpeakingTimer();
}
function startSpeechTimer(seconds,onFinish){
 stopSpeakingTimer();speakRemaining=seconds;
 const value=$('speakclock');if(value)value.textContent=clock(speakRemaining);
 speaktimer=setInterval(()=>{speakRemaining=Math.max(0,speakRemaining-1);const target=$('speakclock');if(target)target.textContent=clock(speakRemaining);if(speakRemaining===0){stopSpeakingTimer();onFinish()}},1000);
}
async function recordNow(){
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){alert('Recording is not supported here. Please use a supported HTTPS browser.');return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  recChunks=[];
  const recordedQuestion=tasks[S.index].q;
  const recordedId=aid(recordedQuestion);
  const recordedIndex=S.speakIndex;
  const key=recordedId+'-'+recordedIndex;
  const media=new MediaRecorder(stream);
  media.ondataavailable=e=>{if(e.data.size)recChunks.push(e.data)};
  media.onstop=()=>{
   if(recChunks.length)recorded[key]=new Blob(recChunks,{type:media.mimeType||'audio/webm'});
   if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
   const a=ans(recordedQuestion);a.clips??={};a.clips[recordedIndex]=true;if(recordedQuestion.part===4||Object.keys(a.clips).length>=3)a.done=true;persist();
   if(S.screen==='exam'&&S.skill==='speaking'&&tasks[S.index]?.q.id===recordedQuestion.id&&S.speakIndex===recordedIndex){speakStatus='done';render()}
  };
  recorder=media;media.start();speakStatus='recording';
  const q=tasks[S.index].q;
  const seconds=q.part===4?120:q.part===1?30:45;
  render();
  startSpeechTimer(seconds,()=>stopMic());
 }catch(e){alert('Microphone access was not granted. You can still read the prompts and practise speaking without recording.')}
}
function playSource(){
 const q=tasks[S.index]?.q;if(!q)return;
 const src=q.audio?.[0],script=playbackText(q),n=S.plays[aid(q)]||0;if(n>=2)return;
 stopAudio();
 if(src){
  const player=new Audio(encodeURI('../'+src));audio=player;
  player.play().then(()=>{
   S.plays[aid(q)]=n+1;persist();if(S.screen==='exam'&&tasks[S.index]?.q.id===q.id)render();
  }).catch(()=>{if(audio===player)audio=null;alert('Source audio could not be played. The attempt was not counted.');});
 }else if(script&&'speechSynthesis' in window){
  try{
   const utterance=new SpeechSynthesisUtterance(script);utterance.lang='en-GB';utterance.rate=.92;
   speechSynthesis.speak(utterance);S.plays[aid(q)]=n+1;persist();render();
  }catch{alert('Synthetic speech is not available on this device. No play was counted.')}
 }
}
function requestFinish(){S.dialog='submit';renderDialog()}
function handleAction(action){
 if(action==='start'){resetSession(S.skill,S.set,false);return}
 if(action==='startall'){resetSession('grammar',1,true,[...ORDER]);return}
 if(action==='resume'){const rec=load();if(rec?.screen==='exam'&&rec.deadline>Date.now()){
   Object.assign(S,rec);
   if(S.skill==='speaking')for(const a of Object.values(S.answers)){if(a?.clips){a.clips={};a.done=false;}}
   tasks=buildTasks(S.skill,S.set);render();
  }return}
 if(action==='prev')return goto(S.index-1);
 if(action==='next')return goto(S.index+1);
 if(action==='flag'){const q=tasks[S.index].q;S.flags[aid(q)]=!S.flags[aid(q)];persist();render();return}
 if(action==='sidebar'){$('examSidebar')?.classList.toggle('open');return}
 if(action==='submit'){requestFinish();return}
 if(action==='cancel'){S.dialog=null;render();return}
 if(action==='confirm-submit'){S.dialog=null;submitModule(false);return}
 if(action==='restart'||action==='confirm-leave'){S.dialog=null;S.screen='welcome';stopMic();stopAudio();persist();render();return}
 if(action==='retry'){resetSession(S.skill,S.set);return}
 if(action==='audio'){playSource();return}
 if(action==='prepare'){speakStatus='prep';speakRemaining=60;render();startSpeechTimer(60,recordNow);return}
 if(action==='skipprep'){stopSpeakingTimer();recordNow();return}
 if(action==='record'){recordNow();return}
 if(action==='stoprecord'){stopMic();return}
 if(action==='speaknext'){
  if(S.speakIndex<2){stopMic();S.speakIndex++;speakStatus='ready';persist();render()}return}
 if(action==='downloadrecord'){
  const key=aid(tasks[S.index].q)+'-'+S.speakIndex,b=recorded[key];if(!b)return;
  const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='AptisStudio_Speaking_'+key+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return;
 }
}
root.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(b){handleAction(b.dataset.action);return}
 const p=e.target.closest('[data-skill]');if(p){S.skill=p.dataset.skill;S.set=1;render();return}
 const n=e.target.closest('[data-goto]');if(n){goto(Number(n.dataset.goto));return}
 const f=e.target.closest('[data-filter]');if(f){S.filter=f.dataset.filter;render();return}
 const sq=e.target.closest('[data-speakq]');if(sq){stopMic();S.speakIndex=Number(sq.dataset.speakq);speakStatus='ready';render()}
});
root.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='setlist'){S.set=Number(t.value);render();return}
 if(t.dataset.qid){setAnswer(t.dataset.qid,t.dataset.key,t.value);if(t.type==='radio'){const current=tasks[S.index].q;const els=root.querySelectorAll('.question-number');const el=els[S.index];if(el)el.classList.add('answered')}}});
root.addEventListener('input',e=>{
 const t=e.target;if(!t.dataset.qid)return;
 setAnswer(t.dataset.qid,t.dataset.key,t.value);
 const count=$('count-'+t.dataset.key);if(count){const n=wordCount(t.value);count.textContent=n+' words';}
});
document.addEventListener('keydown',e=>{
 if(S.screen!=='exam'||e.altKey||e.ctrlKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
 if(e.key==='ArrowRight'&&S.index<tasks.length-1)goto(S.index+1);
 if(e.key==='ArrowLeft'&&S.index>0)goto(S.index-1);
 if(e.key.toLowerCase()==='f'){e.preventDefault();handleAction('flag')}
});
window.addEventListener('pagehide',()=>{if(S.screen==='exam')persist();stopAudio();stopMic()});
const former=load();
if(former?.screen==='exam'&&former.deadline>Date.now()){
 S.skill=former.skill||'writing';S.set=former.set||1;S.screen='welcome';
}
const qp=new URLSearchParams(location.search);if(SKILLS[qp.get('skill')])S.skill=qp.get('skill');
render();
})();
