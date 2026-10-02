/* Shared learning tools. No external services or dependencies. */
const Studio = (() => {
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };
  let preferences = read('aptis-studio', {});
  if (!object(preferences)) preferences = {};
  preferences.pins = Array.isArray(preferences.pins) ? preferences.pins : [];
  preferences.goal = [3,5,10].includes(preferences.goal) ? preferences.goal : 5;
  preferences.scale = [0.9,1,1.1,1.2].includes(preferences.scale) ? preferences.scale : 1;
  let activity = read('aptis-activity', {});
  if (!object(activity)) activity = {};
  const day = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const complete = question => {
    const answers=saved[question.id]||{},m=question.metadata||{};
    if(question.review){const result=gradeReading(question,answers);return result?.unanswered===0&&!result.invalidOrder;}
    let required=1;
    if(question.type==='fill_in_blanks_mc'||question.type==='matching_headings')required=m.paragraphs?.length||1;
    else if(question.type==='sentence_ordering')required=(m.sentences?.length||2)-1;
    else if(m.pairs)required=m.pairs.length;
    else if(m.fields)required=m.fields.length;
    else if(m.email)required=[m.task1,m.task2].filter(Boolean).length;
    else if(m.statements)required=m.statements.length;
    else if(m.items)required=m.items.length;
    else if(m.questions)required=m.questions.length;
    return Array.from({length:required},(_,i)=>String(answers['a'+i]??'').trim()).every(Boolean);
  };
  const groupStats = group => {
    const done = group.questions.filter(complete).length,started=group.questions.some(answered);
    return { done, total:group.questions.length, percent:Math.round(done/group.questions.length*100), state:!started?'new':done===group.questions.length?'done':'progress' };
  };
  const pins = () => preferences.pins;
  const lessonLink = group => {
    let last;try{last=localStorage.getItem('aptis-last')}catch{}
    const match=last?.match(/^#lesson\/(\d+)\/(\d+)$/);
    if(match&&Number(match[1])===group.id&&group.questions[Number(match[2])])return last;
    let questions=group.questions;
    if(userSettings.shuffleQuestions){
      try{const order=JSON.parse(sessionStorage.getItem('aptis-order-'+group.id));if(Array.isArray(order)&&order.length===questions.length&&new Set(order).size===order.length){const arranged=order.map(id=>questions.find(q=>q.id===id));if(arranged.every(Boolean))questions=arranged}}catch{}
    }
    const next=questions.findIndex(q=>!complete(q));
    return `#lesson/${group.id}/${Math.max(0,next)}`;
  };
  const pin = id => {
    preferences.pins = pins().includes(id) ? pins().filter(x=>x!==id) : [...pins(),id];
    return write('aptis-studio', preferences);
  };
  const record = id => {
    const key = day(), entries = Array.isArray(activity[key]) ? activity[key] : [];
    if (!entries.includes(id)) {
      activity[key] = [...entries,id];
      const dates = Object.keys(activity).sort().slice(-90);
      activity = Object.fromEntries(dates.map(d=>[d,activity[d]]));
      write('aptis-activity',activity);
    }
  };
  const today = () => Array.isArray(activity[day()]) ? activity[day()].length : 0;
  const goal = value => {
    if ([3,5,10].includes(value)) { preferences.goal=value; write('aptis-studio',preferences); }
    return preferences.goal;
  };
  const scale = change => {
    if(change) {
      const levels=[0.9,1,1.1,1.2];
      preferences.scale=levels[Math.max(0,Math.min(3,levels.indexOf(preferences.scale)+change))];
      write('aptis-studio',preferences);
    }
    document.documentElement.style.setProperty('--study-scale',preferences.scale);
    const label=document.querySelector('#font-scale');
    if(label)label.textContent=`${Math.round(preferences.scale*100)}%`;
  };
  const focus = () => {
    document.body.classList.toggle('focus-mode');
    const button=document.querySelector('#focus-study');
    if(button) { button.setAttribute('aria-pressed',String(document.body.classList.contains('focus-mode'))); button.textContent=document.body.classList.contains('focus-mode')?'Thoát tập trung':'Tập trung'; }
  };
  const resetLesson = () => {
    if(mockTestMode || !activeGroup)return;
    const group=activeGroup,ids=new Set(group.questions.map(q=>q.id));
    const shared=COURSES.some(other=>other.id!==group.id&&other.questions.some(q=>ids.has(q.id)));
    const message=`Làm lại “${groupTitle(group)}”?\n\nXóa lựa chọn và kết quả kiểm tra của ${ids.size} câu trong bộ này.${shared?' Các câu trùng trong bộ khác cũng sẽ được đặt lại.':''}`;
    if(!window.confirm(message))return;
    const nextAnswers={...saved},nextReviews={...reviewedReading};
    ids.forEach(id=>{delete nextAnswers[id];delete nextReviews[id]});
    if(!write('aptis-answers',nextAnswers)){
      toast('Không thể đặt lại bài trên trình duyệt này.','error');return;
    }
    if(!write('aptis-reading-reviews',nextReviews)){
      write('aptis-answers',saved);
      toast('Không thể xóa kết quả cũ. Hãy thử lại.','error');return;
    }
    saved=nextAnswers;practiceSaved=saved;reviewedReading=nextReviews;
    try{sessionStorage.removeItem('aptis-order-'+group.id)}catch{}
    activeGroup=null;
    const target=`#lesson/${group.id}/0`;
    if(location.hash===target)route();else location.hash=target;
    toast('Đã làm mới bộ đề. Bạn có thể bắt đầu lại từ câu 1.','success');
  };
  const bindPractice = () => {
    scale();
    const button=document.querySelector('#focus-study');
    if(button) { button.onclick=focus; button.setAttribute('aria-pressed',String(document.body.classList.contains('focus-mode'))); button.textContent=document.body.classList.contains('focus-mode')?'Thoát tập trung':'Tập trung'; }
    document.querySelector('#font-smaller')?.addEventListener('click',()=>scale(-1));
    document.querySelector('#font-larger')?.addEventListener('click',()=>scale(1));
    document.querySelector('#reset-lesson')?.addEventListener('click',resetLesson);
  };
  const savedStatus = success => {
    const label=document.querySelector('#save-status');
    if(label) { label.textContent=mockTestMode?'Trong phiên thi':success?'Đã lưu':'Chưa lưu được'; label.classList.toggle('save-error',!success); }
  };
  let searchIndex;
  function initSearch() {
    const dialog=document.querySelector('#search-dialog'),input=document.querySelector('#global-search'),results=document.querySelector('#search-results');
    if(!dialog)return;
    let origin;
    const render=()=>{
      const query=normalize(input.value.trim());
      if(!searchIndex) searchIndex=COURSES.map(g=>({g,text:normalize(`${groupTitle(g)} ${info[g.skill].name} ${info[g.skill].vi} ${g.questions.map(q=>plain(q.title||q.stem)).join(' ')}`)}));
      const matches=searchIndex.filter(item=>query.split(/\s+/).every(word=>item.text.includes(word))).slice(0,12);
      results.innerHTML=matches.map(({g})=>`<a class="search-result" href="${lessonLink(g)}"><span class="search-icon">${svg(g.skill)}</span><span><strong>${esc(groupTitle(g))}</strong><small>${info[g.skill].name} · ${g.questions.length} câu</small></span><span aria-hidden="true">↗</span></a>`).join('')||'<p class="search-empty">Không tìm thấy bài. Thử tên chủ đề hoặc kỹ năng khác.</p>';
      document.querySelector('#search-result-count').textContent=`${matches.length} bộ bài${matches.length===12?' đầu tiên':''}`;
    };
    const open=()=>{ if(document.body.classList.contains('study-panel-open'))return; origin=document.activeElement; input.value=''; render(); dialog.showModal(); input.focus(); };
    const close=()=>dialog.close();
    document.querySelector('#open-search').onclick=open;
    document.querySelector('#close-search').onclick=close;
    input.oninput=render;
    results.onclick=e=>{ if(e.target.closest('a')) { close(); document.querySelector('.sidebar')?.classList.remove('open'); document.body.style.overflow=''; } };
    input.onkeydown=e=>{ if(e.key==='ArrowDown') { e.preventDefault(); results.querySelector('a')?.focus(); } };
    dialog.addEventListener('click',e=>{ if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();} });
    dialog.addEventListener('close',()=>origin?.isConnected&&origin.focus());
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!dialog.open)open();else close();}
      const editing=e.target.closest('input,select,textarea,[contenteditable="true"]');
      if(!editing&&!dialog.open&&!document.body.classList.contains('study-panel-open')&&location.hash.startsWith('#lesson/')) {
        if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();document.querySelector('#next')?.click();}
        if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();document.querySelector('#prev')?.click();}
      }
    });
  }
  window.addEventListener('DOMContentLoaded',initSearch);
  return {read,object,write,normalize,complete,groupStats,pins,pin,lessonLink,record,today,goal,scale,bindPractice,savedStatus};
})();
