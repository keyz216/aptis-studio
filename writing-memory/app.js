(function writingMemoryApp(){
'use strict';
const courses=(window.COURSES||[]).filter(c=>c.skill==='writing').sort((a,b)=>Number(a.title)-Number(b.title));
const cores=window.WRITING_CORES?.core||{},names=window.WRITING_CORES?.names||{},actions=window.WRITING_PART4||{};
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const decode=s=>String(s??'').replace(/&amp;#039;|&#039;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&amp;/gi,'&').trim();
const words=t=>(String(t).trim().match(/\S+/g)||[]).length;
const data=Object.fromEntries(courses.map(c=>[Number(c.title),c]));
const ids=courses.map(c=>Number(c.title));
const STORAGE='dingdang-aptis-writing-memory-v1';
let persisted;try{persisted=JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{persisted={}}
if(!persisted.progress)persisted.progress={};
const q=new URLSearchParams(location.search);
const hasId=Number(q.get('id'));
const S={id:ids.includes(hasId)?hasId:10,part:['p2','p3','p4a','p4b'].includes(q.get('part'))?q.get('part'):'p2',qi:0,mode:'ghost',slots:false};
const suffixes={
exp:["I remember that experience clearly because it was important to me. I also learned something useful and still think about it today.","I still remember that experience, and I learned something useful from it."],
hab:["I enjoy this because it is simple and useful. It helps me relax and enjoy my free time with other people.","I enjoy it because it makes my everyday life easier and more pleasant."],
adv:["This is a simple and practical idea. It could make things easier and save time. I hope it works well for everyone.","I think this would be a useful and practical solution for you."],
opi:["I think this can make a real difference in everyday life. However, we should also be careful and consider other people's needs.","I believe this is important, and we should think about it carefully."],
future:["This could help me learn new things and become more confident. I hope to make good progress and meet other people in the future.","I hope this will help me become more confident and successful."]
};
const extra=" I think this is important to me.";
function answerP3(raw){
const split=String(raw||'').lastIndexOf('|'),core=raw.slice(0,split),kind=raw.slice(split+1);
let tail=(suffixes[kind]||suffixes.opi).find(t=>words(core+' '+t)>=30&&words(core+' '+t)<=40);
if(!tail)tail=(suffixes[kind]||suffixes.opi).find(t=>words(core+' '+t)<=40)||(suffixes[kind]||suffixes.opi)[1];
while(words(core+' '+tail)<30&&words(core+' '+tail+extra)<=40)tail+=extra;
return [{t:core,v:1},{t:' '+tail,v:0}];
}
function answerP2(id){
 const core=cores[id]?.[0]||"I like learning new things.";
 const past=/\\b(last|yesterday|this morning|I visited|I read a short book)\\b/i.test(core);
 const special=id===12?"It was not easy, but I was glad I arrived on time.":null;
 const choices=[special,past?"It was a good experience, and I felt happy about it.":null,
 "I like it because it is simple and useful. It also makes me feel happy.",
 "It is easy and useful for me. I really enjoy it.",
 "It is important to me and helps me learn more."].filter(Boolean);
 const tail=choices.find(x=>words(core+' '+x)>=20&&words(core+' '+x)<=30)||choices[choices.length-1];
 return [{t:core,v:1},{t:' '+tail,v:0}];
}
function answerP4(id,formal){
 const v=actions[id];if(!v)return null;
 const slot=t=>({t,v:1}),fix=t=>({t,v:0});
 if(!formal)return [
 fix("Hi Sam,\\n\\nHave you heard about "),slot(v[0]),
 fix("? I feel "),slot(v[1]),fix(" about it. I think we should "),
 slot(v[2]),fix(". It may help our members. What do you think? Please write back soon. I hope we can discuss this together soon.\\n\\nBest,\\nAlex")
 ];
 return [
 fix("Dear Sir or Madam,\\n\\nI am writing about "),slot(v[0]),
 fix(". Thank you for asking members to share their views.\\n\\nI believe the best approach would be to "),
 slot(v[2]),fix(". In my opinion, this would be a practical choice because it could help many members and make the situation easier for everyone.\\n\\nI would also suggest that the club should "),
 slot(v[3]),fix(". For example, it could ask members for their opinions before making a final decision. This would help the organisers understand what people really need.\\n\\nFinally, please explain the next steps clearly so that everyone has enough time to prepare. I hope these ideas will be useful.\\n\\nThank you for your time. I look forward to hearing from you.\\n\\nYours faithfully,\\nAlex")
 ];
}
function current(){
 const group=data[S.id],qs=group?.questions||[];
 const p=part=>qs.find(x=>x.part===part)?.metadata||{};
 if(S.part==='p2')return {prompt:decode(p(2).scenario),segments:answerP2(S.id),label:'Part 2 · Form (20–30 words)',range:[20,30]};
 if(S.part==='p3'){const question=p(3).questions?.[S.qi];return {prompt:decode(question?.prompt),segments:answerP3(cores[S.id]?.[S.qi+1]||"I think this is a good idea.|opi"),label:'Part 3 · Chat response '+(S.qi+1)+'/3',range:[30,40]}}
 if(S.part==='p4a'||S.part==='p4b')return {prompt:decode(p(4).email?.body),segments:answerP4(S.id,S.part==='p4b'),label:S.part==='p4a'?'Part 4A · Email to a friend':'Part 4B · Email to the manager',range:S.part==='p4a'?[40,50]:[120,150]};
 return {prompt:'',segments:null,label:'',range:[0,0]};
}
function key(){return S.id+'-'+S.part+'-'+S.qi+(S.slots?'-slots':'-full')}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(persisted))}catch{}}
function piecesText(segments){return segments.map(x=>x.t).join('')}
function targetText(segments){return S.slots?segments.filter(x=>x.v).map(x=>x.t.trim()).filter(Boolean).join('\\n'):piecesText(segments)}
function completionCount(){return Object.entries(persisted.progress).filter(([k,v])=>!k.endsWith('-slots')&&v.best>=98).length}
function updateTop(){
 $('mastered').textContent=completionCount()+'/176';
 $('overallBar').style.width=Math.min(100,completionCount()/176*100)+'%';
 $('topic').value=String(S.id);
 document.querySelectorAll('[data-part]').forEach(b=>{b.classList.toggle('active',b.dataset.part===S.part);b.setAttribute('aria-pressed',String(b.dataset.part===S.part))});
}
function toast(msg){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.hidden=true,2200)}
function next(){
 if(S.part==='p3'&&S.qi<2){S.qi++;return render()}
 if(S.part==='p2'){S.part='p3';S.qi=0}
 else if(S.part==='p3'){S.part='p4a';S.qi=0}
 else if(S.part==='p4a'){S.part='p4b'}
 else {S.id=ids[(ids.indexOf(S.id)+1)%ids.length];S.part='p2';S.qi=0}
 S.slots=false;S.mode='ghost';render();
}
function mirrorHTML(typed,target){
 let html='',buff='',prev='';
 const flush=()=>{if(buff)html+='<span class="'+prev+'">'+escape(buff)+'</span>';buff=''};
 for(let i=0;i<typed.length;i++){
 const type=target[i]!==undefined&&typed[i].toLowerCase()===target[i].toLowerCase()?'good':'bad';
 if(type!==prev){flush();prev=type}
 buff+=typed[i];
 }
 flush();
 const rem=target.slice(typed.length);
 if(rem)html+='<span class="'+(S.mode==='exam'?'hidden-text':'todo')+'">'+escape(rem)+'</span>';
 return html||'<span class="'+(S.mode==='exam'?'hidden-text':'todo')+'">'+escape(target)+'</span>';
}
function mirrorUpdate(){
 const area=$('writer'),mirror=$('ghost'),d=current();
 if(!area||!mirror||!d.segments)return;
 const target=targetText(d.segments),typed=area.value;
 mirror.innerHTML=mirrorHTML(typed,target);
 const correct=[...typed].reduce((s,ch,i)=>s+(target[i]!==undefined&&ch.toLowerCase()===target[i].toLowerCase()?1:0),0);
 const pct=target.length?Math.min(100,Math.round(correct/target.length*100)):0;
 $('writeScore').textContent=pct+'% đúng';
 $('writeStats').textContent=correct+'/'+target.length+' ký tự';
 $('writeBar').style.width=pct+'%';
 $('wordCount').textContent=words(typed)+'/'+words(target)+' từ';
 const k=key(),obj=persisted.progress[k]||{best:0};
 obj.typed=typed;obj.best=Math.max(pct,obj.best||0);persisted.progress[k]=obj;
 save();updateTop();
 if(pct===100&&typed.length===target.length&&!area.dataset.finished){area.dataset.finished='yes';toast('✓ Bạn đã gõ đúng toàn bộ bài!')}
 else if(pct<100)area.dataset.finished='';
}
function readingPreview(parts){
 return '<div class="preview" id="preview">'+parts.map(p=>'<span class="'+(p.v?'variable':'fixed')+'">'+escape(p.t)+'</span>').join('')+'</div>';
}
function render(){
 const d=current();updateTop();
 const paper=$('paper');
 const label=document.createElement('div');label.textContent=S.id+' · '+(names[S.id]||'Writing');
 const a=d.segments,score=a?words(piecesText(a)):0;
 const warn=score<d.range[0]||score>d.range[1];
 const heading=`<div class="topline"><span class="step">${escape(d.label)}</span><span class="wc" id="sampleCount">${a?(warn?'⚠ ':'✓ ')+score+' từ · mục tiêu '+d.range[0]+'–'+d.range[1]:''}</span></div>
 <h2>Đề ${S.id} · ${escape(names[S.id]||'Writing')}</h2>
 <p class="subnote">Luyện gõ đúng nguyên mẫu đã soạn sẵn. <b>Màu vàng</b> là phần thay theo đề; màu xanh là phần cố định.</p>`;
 const qbar=S.part==='p3'?`<div class="p3nav">${[0,1,2].map(i=>'<button type="button" class="'+(i===S.qi?'active':'')+'" data-q="'+i+'">Câu '+(i+1)+'</button>').join('')}</div>`:'';
 const prompt=`${qbar}<div class="source"><div class="source-label">NỘI DUNG ĐỀ GỐC TRÊN GITHUB</div>${escape(d.prompt||'Chưa có nội dung tình huống trong dữ liệu nguồn.')}</div>`;
 if(!a){paper.innerHTML=heading+prompt+'<div class="empty"><b>Đề này chưa có tình huống Part 4 trong GitHub.</b><p>Tôi không tự tạo tình huống thay cho nguồn đang trống. Bạn có thể luyện Part 2 hoặc Part 3 của đề này.</p></div><div class="actions"><button id="next" class="primary">Bài tiếp theo →</button></div>';paper.querySelector('#next').onclick=next;paper.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{S.qi=Number(b.dataset.q);render()});return;}
 const k=key(),saved=persisted.progress[k]?.typed||'';
 const progressModes=`<div class="modebar">
 <button class="${S.mode==='read'?'active':''}" data-mode="read">1. Xem & nhớ</button>
 <button class="${S.mode==='ghost'?'active':''}" data-mode="ghost">2. Gõ chữ mờ</button>
 <button class="${S.mode==='exam'?'active':''}" data-mode="exam">3. Che chữ</button></div>`;
 const full=readingPreview(a);
 const practice=S.mode==='read'?full:`<div class="ghostbox"><div id="ghost" class="ghost" aria-hidden="true"></div><textarea id="writer" class="writer" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Gõ theo mẫu chữ mờ" placeholder="" wrap="soft"></textarea></div>
 <div class="typestatus"><b id="writeScore">0% đúng</b><span id="writeStats">0 ký tự</span><div class="scorebar"><i id="writeBar"></i></div><span id="wordCount"></span></div>`;
 paper.innerHTML=heading+prompt+`<div class="hint"><span class="legend"><span class="dot"></span> Câu mẫu giữ nguyên</span><span class="legend"><span class="dot slot"></span> Từ/cụm thay theo đề</span><span>Gõ đúng sẽ sáng lên · Sai hiện đỏ</span></div>`+
 progressModes+`<label class="slotbar"><input id="onlySlots" type="checkbox" ${S.slots?'checked':''}><span>Chỉ luyện phần phải thay theo đề (nhớ nhanh hơn)</span></label>`+
 practice+`<div class="actions"><button id="repeat" type="button">↻ Gõ lại</button><button id="showCopy" type="button">Sao chép mẫu</button><button id="next" class="primary" type="button">Bài tiếp theo →</button></div>
 <p class="footer-note">Mẫu dùng để luyện nhớ, không phải câu trả lời bảo đảm điểm. Khi thi nếu đề thay đổi, hãy trả lời đúng tất cả ý được hỏi.</p>`;
 paper.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;render();if(S.mode!=='read')$('writer')?.focus()});
 paper.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{S.qi=Number(b.dataset.q);S.slots=false;render()});
 $('onlySlots').onchange=e=>{S.slots=e.target.checked;render();$('writer')?.focus()};
 $('next').onclick=next;
 $('showCopy').onclick=()=>{const text=piecesText(a);if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast('Đã sao chép mẫu')).catch(()=>toast('Không sao chép được'))}else toast('Trình duyệt chưa hỗ trợ sao chép')};
 $('repeat').onclick=()=>{persisted.progress[key()]={best:persisted.progress[key()]?.best||0,typed:''};save();render();$('writer')?.focus()};
 if(S.mode!=='read'){
  const area=$('writer');
  const t=targetText(a),charsPerLine=Math.max(23,Math.floor((paper.clientWidth-55)/(window.innerWidth<620?9.0:9.8)));
  const height=Math.max(235,t.split('\\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/charsPerLine)),0)*30+70);
  area.style.height=height+'px';
  area.value=saved;
  area.addEventListener('input',mirrorUpdate);
  mirrorUpdate();
 }
}
if(courses.length!==30||Object.keys(cores).length!==30)throw Error("Writing data missing");
$('topic').innerHTML=ids.map(id=>'<option value="'+id+'">Đề '+id+' · '+escape(names[id]||'Writing')+'</option>').join('');
$('topic').onchange=e=>{S.id=Number(e.target.value);S.qi=0;S.slots=false;S.mode='ghost';render()};
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{S.part=b.dataset.part;S.qi=0;S.slots=false;S.mode='ghost';render()});
if(new URLSearchParams(location.search).get('embed')==='1')document.documentElement.classList.add('embed');
render();
})();
