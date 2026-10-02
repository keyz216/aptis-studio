const icons={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',reading:'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15',listening:'M4 14v-3a8 8 0 0 1 16 0v3 M4 12H2v8h5v-8z M20 12h2v8h-5v-8z',writing:'m4 16-1 5 5-1L21 7l-5-5z M14 4l6 6',speaking:'M9 3h6v12H9z M5 11v3a7 7 0 0 0 14 0v-3 M12 21v-3',grammar:'m3 19 6-15 6 15 M5 14h8 M16 6h5 M18.5 3v6'};
const info={reading:{name:'Reading',vi:'Đọc hiểu',desc:'Đọc hiểu, sắp xếp câu và nối tiêu đề.',color:'#4b8061',tint:'#edf4e8'},listening:{name:'Listening',vi:'Nghe hiểu',desc:'Luyện nghe và nắm bắt thông tin chính.',color:'#b48a4d',tint:'#faf0df'},writing:{name:'Writing',vi:'Viết',desc:'Từ câu trả lời ngắn đến email hoàn chỉnh.',color:'#608aaf',tint:'#eaf1fa'},speaking:{name:'Speaking',vi:'Nói',desc:'Luyện phản xạ và diễn đạt qua từng chủ đề.',color:'#ae7667',tint:'#f7ede8'},grammar:{name:'Grammar & Vocabulary',vi:'Ngữ pháp & Từ vựng',desc:'Củng cố ngữ pháp và mở rộng vốn từ.',color:'#8b79a7',tint:'#f0edf7'}};
const svg=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${icons[k]}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent||''};
var saved=Studio.read('aptis-answers',{});
if(!Studio.object(saved))saved={};
for(const [key,value] of Object.entries(saved))if(!Studio.object(value))delete saved[key];
var userSettings={shuffleQuestions:false,shuffleOptions:false,memorizationMode:false};
const storedSettings=Studio.read('aptis-settings',{});
for(const key of Object.keys(userSettings))if(typeof storedSettings?.[key]==='boolean')userSettings[key]=storedSettings[key];
function persistSettings(){try{localStorage.setItem('aptis-settings',JSON.stringify(userSettings))}catch{toast('Không thể lưu tùy chỉnh trên trình duyệt này.')}}
function shuffleArray(arr){const res=[...arr];for(let i=res.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[res[i],res[j]]=[res[j],res[i]]}return res;}
let activeGroup,qi=0,mockTestMode=false,mockSubmitted=false,mockTimeLeft=0,mockTimer,timer,stream,recorder,objectUrls=[],audioChunks=[];
let mockSections=[],mockCurrentSection=0;
let practiceSaved=saved;
const app=document.querySelector('#app');
function persist(){
    if(mockTestMode){Studio.savedStatus(true);return true;}
    const ok=Studio.write('aptis-answers',saved);Studio.savedStatus(ok);
    if(!ok)toast('Trình duyệt không lưu được dữ liệu.','error');
    return ok;
}
function toast(message,type=''){
    const node=document.querySelector('#toast');
    node.textContent=message;node.className=type;node.style.display='block';
    node.classList.add('show');clearTimeout(timer);
    timer=setTimeout(()=>{node.classList.remove('show');},3500);
}
function answered(q){return Object.values(saved[q.id]||{}).some(x=>String(x).trim())}
function route(){document.body.classList.remove('study-panel-open');if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());objectUrls.forEach(URL.revokeObjectURL);objectUrls=[];const [view,id,n]=location.hash.slice(1).split('/');if(mockTestMode&&view!=='mocktest'){clearInterval(mockTimer);mockTimer=null;saved=practiceSaved;mockTestMode=false;mockSections=[];mockCurrentSection=0;}if(view!=='lesson'){activeGroup=null;document.body.classList.remove('focus-mode');}const skill=view==='lesson'?COURSES[Number(id)]?.skill:view;document.querySelector('#nav').innerHTML=`<a href="#" class="${!view?'active':''}">${svg('home')}Tổng quan</a><a href="#mocktest" class="${view==='mocktest'?'active':''}">${svg('reading')}Thi thử Aptis</a>`+Object.entries(info).map(([k,v])=>`<a href="#${k}" class="${skill===k?'active':''}">${svg(k)}${v.name}</a>`).join('');document.querySelector('#breadcrumb').textContent='Góc học tập / '+(view==='mocktest'?'Thi thử Aptis':info[skill]?.name||'Tổng quan');if(view==='mocktest')mockTestStart();else if(view==='lesson'&&COURSES[Number(id)]){
    mockTestMode=false;
    if(activeGroup?.id !== COURSES[Number(id)].id) {
        activeGroup={...COURSES[Number(id)]};
        if(userSettings.shuffleQuestions) {
            const key='aptis-order-'+activeGroup.id;
            let order;try{order=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
            const valid=Array.isArray(order)&&order.length===activeGroup.questions.length&&new Set(order).size===order.length&&order.every(id=>activeGroup.questions.some(q=>q.id===id));
            if(!valid){order=shuffleArray(activeGroup.questions).map(q=>q.id);try{sessionStorage.setItem(key,JSON.stringify(order))}catch{}}
            activeGroup.questions=order.map(id=>activeGroup.questions.find(q=>q.id===id));
        }
    }
    qi=Math.max(0,Math.min(activeGroup.questions.length-1,Number(n)||0));
    practice()
}else if(info[view])library(view);else home();document.querySelectorAll('#nav a').forEach(a=>{if(a.classList.contains('active'))a.setAttribute('aria-current','page')});window.scrollTo(0,0)}
function home(){
    const unique=[...new Map(COURSES.flatMap(g=>g.questions).map(q=>[q.id,q])).values()];
    const done=unique.filter(Studio.complete).length;
    let last;try{last=localStorage.getItem('aptis-last')}catch{}
    const match=last?.match(/^#lesson\/(\d+)\/(\d+)$/);
    const group=match?COURSES[Number(match[1])]:null;
    const resume=group&&group.questions[Number(match[2])];
    const today=Studio.today(),goal=Studio.goal();
    app.innerHTML=`
      <div class="welcome"><div><div class="eyebrow">APTIS STUDIO / YOUR STUDY SPACE</div><h1>Học có mục tiêu.<br><span>Tiến bộ mỗi ngày.</span></h1><p class="muted">Chọn một kỹ năng, luyện từng bài và theo dõi tiến độ của bạn.</p></div><span class="date-tag">${new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'numeric',month:'long'}).format(new Date())}</span></div>
      <div class="dashboard-overview"><div class="stats"><div class="stat"><small>Thư viện đề</small><strong>${COURSES.length}<span>bộ bài</span></strong></div><div class="stat"><small>Đã luyện tập</small><strong>${done}<span>/ ${unique.length} câu</span></strong></div><div class="stat"><small>Kỹ năng</small><strong>05<span>cùng một mục tiêu</span></strong></div></div>
      <section class="daily-goal" aria-label="Mục tiêu mỗi ngày"><div class="goal-top"><span class="goal-label">MỤC TIÊU HÔM NAY</span><label><span class="sr-only">Số câu mục tiêu mỗi ngày</span><select id="daily-goal">${[3,5,10].map(n=>`<option value="${n}" ${n===goal?'selected':''}>${n} câu / ngày</option>`).join('')}</select></label></div><div class="goal-number"><strong>${today}</strong><span>/ ${goal} câu</span><span class="goal-message">${today>=goal?'Đạt mục tiêu hôm nay ✓':'Từng câu một, bạn đang tiến bộ.'}</span></div><progress value="${Math.min(today,goal)}" max="${goal}" aria-label="Tiến độ hôm nay"></progress></section></div>
      <div class="section-head"><div><div class="eyebrow">THƯ VIỆN LUYỆN TẬP</div><h2>Năm kỹ năng. Một lộ trình.</h2></div><span>Tiến độ được cập nhật từ bài đã làm</span></div>
      <div class="skills">${Object.entries(info).map(([k,v])=>{
          const groups=COURSES.filter(g=>g.skill===k),qs=[...new Map(groups.flatMap(g=>g.questions).map(q=>[q.id,q])).values()],count=qs.filter(Studio.complete).length,pct=qs.length?Math.round(count/qs.length*100):0;
          return `<a class="skill-card" style="--accent:${v.color};--tint:${v.tint}" href="#${k}"><div class="card-top"><span class="tile-icon">${svg(k)}</span><span class="part-tag">${v.vi}</span></div><h3>${v.name}</h3><p>${v.desc}</p><div class="skill-progress"><span>${count}/${qs.length} câu đã luyện</span><b>${pct}%</b></div><progress value="${count}" max="${qs.length}" aria-label="Tiến độ ${v.name}"></progress><div class="card-bottom"><span>${groups.length} bộ bài</span><b>Mở thư viện <span aria-hidden="true">↗</span></b></div></a>`;
      }).join('')}<a class="skill-card note-card" href="#mocktest"><div class="eyebrow">SẴN SÀNG THỬ SỨC?</div><h3>Thi thử Aptis</h3><p>Luyện tập đủ năm kỹ năng trong một phiên thi có đồng hồ đếm ngược.</p><span class="mock-card-link">Bắt đầu phiên thi <span aria-hidden="true">↗</span></span></a></div>
      ${Studio.pins().length?`<section class="pinned-section"><div class="section-head"><h2>Bộ bài đã ghim</h2><span>Mở nhanh những bài bạn đang quan tâm</span></div><div class="pinned-grid">${COURSES.filter(g=>Studio.pins().includes(g.id)).map(g=>`<a class="pinned-item" href="${Studio.lessonLink(g)}"><span class="tile-icon">${svg(g.skill)}</span><span><small>${info[g.skill].name}</small><strong>${esc(groupTitle(g))}</strong></span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`:''}
      <a class="quick-study" href="${resume?last:'#reading'}" title="${resume?esc('Học tiếp: '+groupTitle(group)):'Mở thư viện Reading'}"><span class="quick-study-icon" aria-hidden="true">${svg('reading')}</span><span>${resume?'Học tiếp':'Luyện tập'}</span><span aria-hidden="true">↗</span></a>`;
    document.querySelector('#daily-goal').onchange=e=>{Studio.goal(Number(e.target.value));home()};
}
function library(skill){
    const meta=info[skill],pool=COURSES.filter(g=>g.skill===skill);
    let status='all';
    app.innerHTML=`<a class="back-link" href="#">← Tổng quan</a><div class="library-heading"><span class="tile-icon" style="--accent:${meta.color};--tint:${meta.tint}">${svg(skill)}</span><div><div class="eyebrow">THƯ VIỆN / ${meta.vi.toUpperCase()}</div><h1>${meta.name}</h1><p class="muted">${meta.desc}</p></div></div><div class="library-controls"><div class="search-field"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="Tìm bài tập" placeholder="Tìm bộ bài hoặc chủ đề…"></div><label class="sort-control"><span class="sr-only">Sắp xếp bộ bài</span><select id="lesson-sort"><option value="default">Thứ tự bộ bài</option><option value="progress">Bài đang học trước</option><option value="name">Tên A → Z</option></select></label></div><div class="library-filter-row"><div class="filter-tabs" role="group" aria-label="Lọc theo tiến độ">${[['all','Tất cả'],['new','Chưa học'],['progress','Đang học'],['done','Đã làm hết'],['pinned','Đã ghim']].map(([id,label])=>`<button class="filter-tab ${id==='all'?'active':''}" data-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><span id="result-count" aria-live="polite"></span></div><div id="lessons" class="lessons"></div>`;
    const indexed=pool.map(g=>({g,text:Studio.normalize(`${groupTitle(g)} ${g.questions.map(q=>plain(q.title+' '+q.stem)).join(' ')}`)}));
    const render=()=>{
        const term=Studio.normalize(document.querySelector('#search').value.trim());
        let groups=indexed.filter(item=>term.split(/\s+/).every(word=>item.text.includes(word))).map(item=>item.g).filter(g=>status==='all'||(status==='pinned'?Studio.pins().includes(g.id):Studio.groupStats(g).state===status));
        const sort=document.querySelector('#lesson-sort').value;
        if(sort==='name')groups.sort((a,b)=>groupTitle(a).localeCompare(groupTitle(b),'vi',{numeric:true}));
        if(sort==='progress')groups.sort((a,b)=>(Studio.groupStats(b).state==='progress')-(Studio.groupStats(a).state==='progress')||Studio.groupStats(b).percent-Studio.groupStats(a).percent);
        document.querySelector('#result-count').textContent=`${groups.length} / ${pool.length} bộ bài`;
        document.querySelector('#lessons').innerHTML=groups.map(g=>{
            const {done,total,percent,state}=Studio.groupStats(g),pinned=Studio.pins().includes(g.id);
            return `<article class="lesson"><div class="lesson-top"><span class="lesson-state state-${state}">${state==='new'?'Chưa học':state==='done'?'Đã làm hết':'Đang học'}</span><button class="pin-button ${pinned?'pinned':''}" data-pin="${g.id}" aria-pressed="${pinned}" aria-label="${pinned?'Bỏ ghim':'Ghim'} ${esc(groupTitle(g))}" title="${pinned?'Bỏ ghim':'Ghim bộ bài'}">${pinned?'★':'☆'}</button></div><a class="lesson-main" href="${Studio.lessonLink(g)}"><small>${meta.vi} · ${total} câu</small><h3>${esc(groupTitle(g))}</h3><div class="lesson-progress"><span>${done}/${total} câu đã luyện</span><span>${percent}%</span></div><progress value="${done}" max="${total}" aria-label="Tiến độ ${esc(groupTitle(g))}"></progress><div class="lesson-open">${done?'Tiếp tục luyện tập':'Bắt đầu bài'} <span aria-hidden="true">↗</span></div></a></article>`;
        }).join('')||'<div class="empty"><strong>Chưa có bộ bài phù hợp</strong><p>Thử một từ khóa khác hoặc chọn “Tất cả”.</p><button class="secondary" id="reset-filters">Xóa bộ lọc</button></div>';
        document.querySelectorAll('[data-pin]').forEach(button=>button.onclick=()=>{if(!Studio.pin(Number(button.dataset.pin)))toast('Không thể lưu ghim trên trình duyệt này.');render()});
        const reset=document.querySelector('#reset-filters');if(reset)reset.onclick=()=>{document.querySelector('#search').value='';setFilter('all')};
    };
    const setFilter=value=>{status=value;document.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});render()};
    document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>setFilter(button.dataset.filter));
    document.querySelector('#search').oninput=render;document.querySelector('#lesson-sort').onchange=render;render();
}
function groupTitle(g){if(g.skill==='reading'){const part=g.questions[0]?.part;return `Reading · Part ${part} — ${({1:'Điền từ',2:'Sắp xếp câu',3:'Ghép thông tin',4:'Ghép tiêu đề'})[part]||'Đọc hiểu'}`}if(g.skill==='writing')return (g.questions[0].title||`Đề ${g.title}`).replace(/ - Part \d+/,'');if(g.skill==='speaking')return `Speaking · Đề ${g.title.replace('Đề ','')}`;return g.title}

// SAFE HTML RENDERING
function renderHTML(s){
    if(!s) return '';
    let h = String(s);
    const base = activeGroup?.source ? activeGroup.source.split('/').slice(0,-1).join('/')+'/' : '';
    const template=document.createElement('template');
    template.innerHTML=h;
    template.content.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,svg,math').forEach(el=>el.remove());
    template.content.querySelectorAll('*').forEach(el=>{
        for(const attr of [...el.attributes]){
            if(!['src','alt','href','title','colspan','rowspan'].includes(attr.name))el.removeAttribute(attr.name);
        }
        for(const attr of ['src','href']){
            const value=el.getAttribute(attr);
            if(value && !/^(https?:|(?:\.\.?\/)?[^:]*$)/i.test(value.trim()))el.removeAttribute(attr);
        }
        if(el.tagName==='IMG'){
            let src=el.getAttribute('src');
            if(src&&!/^(https?:|\/)/i.test(src))el.setAttribute('src',base+src.replace(/^\.\//,''));
        }
    });
    let finalHtml = template.innerHTML;
    finalHtml = finalHtml.replace(/_{2,}/g, match => `<span style="color:var(--primary); font-weight:700; letter-spacing:2px;">${match}</span>`);
    finalHtml = finalHtml.replace(/\[BLANK\]/g, `<span style="color:var(--primary); font-weight:700; letter-spacing:2px;">_______</span>`);
    return finalHtml;
}

function select(label,choices,key){
    let cList=choices.map((c,origI)=>({c,origI}));
    if(userSettings.shuffleOptions)cList=shuffleArray(cList);
    return `<label class="field">${renderHTML(label)}${translateAsyncHTML(label)}<select data-key="${key}" aria-label="${esc(plain(label))}"><option value="">Chọn đáp án</option>${cList.map(({c,origI})=>{const val=typeof c==='object'?c.id??origI:c,text=typeof c==='object'?c.text??c.label??c.id:c,vi=viCompanion(text);return `<option value="${esc(val)}">${esc(plain(text))}${vi?' — '+esc(vi):''}</option>`}).join('')}</select></label>`;
}
function translateAsyncHTML(text) {
    const vi=viCompanion(text);
    return vi?`<span class="vi-translation" lang="vi"><span class="vi-label">Tiếng Việt</span>${esc(vi).replace(/\[BLANK\]/g,'_______')}</span>`:'';
}
function writing(label,key,limit,short=false){
    let labelHtml = renderHTML(label) + translateAsyncHTML(label);
    return `<label class="field">${labelHtml}${short?`<input data-key="${key}" placeholder="Nhập câu trả lời…">`:`<textarea data-key="${key}" placeholder="Viết câu trả lời của bạn…"></textarea>`}<span class="count">0 từ${limit?` · Gợi ý ${limit.min}–${limit.max} từ`:''}</span></label>`;
}
function passage(s){return `<div class="passage">${renderHTML(s)}${translateAsyncHTML(s)}</div>`}
function explanationHTML(s){
    // Source explanations already pair English examples with Vietnamese prose.
    // Retain these translations; add a companion for explanations in English.
    return renderHTML(s)+(/[À-ỹĐđ]/.test(plain(s))?'':translateAsyncHTML(s));
}
function reference(s){return s?`<details class="reference-details"><summary>Xem nội dung tham khảo</summary>${passage(s)}</details>`:''}

function readingInstructions(q){
    return ({fill_in_blanks_mc:'Chọn từ phù hợp để hoàn thành từng câu.',sentence_ordering:'Sắp xếp các câu thành đoạn văn. Mỗi vị trí chỉ dùng một lần.',matching_headings:'Đọc từng đoạn văn và chọn tiêu đề phù hợp.',text_question_match:'Đọc thông tin của từng người và chọn đáp án phù hợp với mỗi nhận định.'})[q.type]||'Đọc nội dung và trả lời đầy đủ các ý.';
}
function questionBody(q){
    const m=q.metadata||{};
    let out='';
    let images = (q.images && q.images.length) ? q.images : (m.image_paths || (m.image_path ? [m.image_path] : []));
    if(images.length){
        out+=`<div class="q-images">${images.map(src=>{
            const filename = src.split('/').pop();
            const fallback = 'https://milaedu.com/storage/speaking_images/' + filename;
            const initial = src.startsWith('http') ? src : (src.startsWith('Spek/') ? src : 'https://milaedu.com/storage/' + src.replace(/^storage\//,''));
            return `<img loading="lazy" decoding="async" src="${esc(initial)}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${fallback}';}" alt="Hình minh họa cho bài ${info[q.skill]?.name||'thi'} ${q.part||''}">`;
        }).join('')}</div>`;
    }
    let audioSources = [];
    let isLocalAudio = false;
    if (q.audio && q.audio.length > 0 && q.audio[0]) {
        audioSources = q.audio;
        isLocalAudio = true;
    }
    else if (q.audio_path) audioSources = [q.audio_path];
    else if (m.audio_files && m.audio_files.length > 0) audioSources = m.audio_files;
    
    if(q.skill==='listening'){
        const serverFallback = q.audio_path ? ('https://milaedu.com/storage/' + q.audio_path) : '';
        out+=audioSources.length?audioSources.map(src=>{
            const isHttp = src.startsWith('http');
            const initial = (isHttp || isLocalAudio) ? src : ('https://milaedu.com/storage/' + src);
            const fallbackAttr = (isLocalAudio && serverFallback) ? `onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${esc(serverFallback)}';this.load();}"` : '';
            return `<audio controls preload="none" ${fallbackAttr} src="${esc(initial)}"></audio>`;
        }).join(''):'<div class="notice">Chưa có file audio cho bài này.</div>';
    }
    if(m.instructions&&q.skill!=='reading')out+=passage(m.instructions);
    if(m.instruction&&q.skill!=='reading')out+=passage(m.instruction);
    if(m.context)out+=passage(m.context);
    
    if(q.type==='fill_in_blanks_mc')out+=m.paragraphs.map((p,i)=>select(`${i+1}. ${p}`,m.choices[i],`a${i}`)).join('');
    else if(q.type==='sentence_ordering'){if(m.sentences[0])out+=`<div class="passage"><b>Câu mở đầu (cố định)</b><br>${esc(plain(m.sentences[0]))}${translateAsyncHTML(m.sentences[0])}</div>`;const rows=m.sentences.slice(1);out+=rows.map((s,i)=>select(s,rows.map((_,j)=>j+1),readingAnswerKey(q,i))).join('');}
    else if(q.type==='matching_headings')out+=m.paragraphs.map((p,i)=>passage(p)+select(`Tiêu đề đoạn ${i+1}`,m.headings,`a${i}`)).join('');
    else if(q.type==='text_question_match'){out+=m.options.map((p,i)=>`<div class="speaker-name">${esc(m.names[i])}</div>`+passage(p)).join('');out+=m.questions.map((s,i)=>select(s,m.names,`a${i}`)).join('');}
    else if(m.pairs)out+=m.pairs.map((p,i)=>select(`${p.prompt||p.prefix||''} ${p.after||p.suffix||''}`,m.dropdown_pool||[],`a${i}`)).join('');
    else if(m.fields)out+=m.fields.map((f,i)=>writing(f.label,`a${i}`,null,true)).join('');
    else if(m.email){out+=[m.email.greeting,m.email.body,m.email.sign_off].filter(Boolean).map(passage).join('');out+=[m.task1,m.task2].filter(Boolean).map((t,i)=>writing(t.instruction,`a${i}`,t.word_limit)+reference(t.sample_answer || (window.generateSampleAnswer ? generateSampleAnswer(q.skill, q.part, i) : ''))).join('');}
    else if(m.scenario)out+=writing(m.scenario,'a0',m.word_limit);
    else if(m.statements)out+=m.statements.map((s,i)=>select(s,m.shared_choices||[],`a${i}`)).join('');
    else if(m.items)out+=m.items.map((s,i)=>select(s,m.choices||[],`a${i}`)).join('');
    else if(m.questions)out+=m.questions.map((s,i)=>{if(typeof s==='object')return s.choices?select(s.question||s.prompt,s.choices,`a${i}`):writing(s.prompt||s.question,`a${i}`,s.word_limit)+reference(s.sample_answer || (window.generateSampleAnswer ? generateSampleAnswer(q.skill, q.part, i) : ''));return writing(s,`a${i}`)}).join('');
    else if(m.options||m.choices){
        const choices=m.options||m.choices;
        let cList=choices.map((c,origI)=>({c,origI}));
        if(userSettings.shuffleOptions)cList=shuffleArray(cList);
        out+=cList.map(({c,origI},i)=>{
            const value=typeof c==='object'?c.id??origI:c;
            const text=typeof c==='object'?c.text:c;
            return `<label class="choice"><input type="radio" name="answer" data-key="a0" value="${esc(value)}"><span>${String.fromCharCode(65+i)}. ${renderHTML(text)}${translateAsyncHTML(text)}</span></label>`;
        }).join('');
    }
    else out+=writing('Câu trả lời của bạn','a0');
    
    if(q.skill==='speaking')out+=`<div class="notice">Chuẩn bị: ${m.prep_time||0} giây · Trả lời: ${m.total_answer_time||m.answer_time_per_question||45} giây${m.total_answer_time?' tổng cộng':' mỗi câu'}. Bạn có thể ghi âm và tải về để nghe lại.</div><div class="record"><button id="record" class="secondary">● Bắt đầu ghi âm</button><span id="record-status" role="status"></span><div id="recordings"></div></div>`;
    
    let tips='';
    if(q.skill==='speaking'){
        if(q.part===1) tips='<b>Part 1:</b> Trả lời trực tiếp trọng tâm (1 câu) và mở rộng 1-2 câu giải thích hoặc ví dụ. Đừng nói quá dài.<br><br><b>Form chung:</b> <i>"I really enjoy... because it helps me... For example..."<br>Tôi rất thích... vì điều đó giúp tôi... Ví dụ...</i>';
        else if(q.part===2) tips='<b>Part 2:</b> Bắt đầu bằng 1 câu miêu tả tổng quan bức tranh. Sau đó nói chi tiết và kết thúc bằng việc đoán cảm xúc.<br><br><b>Form chung:</b> <i>"In the picture, I can see... They look... I think they are..."<br>Trong ảnh, tôi thấy... Họ trông... Tôi nghĩ họ đang...</i>';
        else if(q.part===3) tips='<b>Part 3:</b> Tập trung vào sự so sánh thay vì chỉ miêu tả đơn thuần. Dùng từ nối: However (tuy nhiên), On the other hand (mặt khác).<br><br><b>Form chung:</b> <i>"Both pictures show... However, in the first picture... while in the second..."<br>Cả hai ảnh đều thể hiện... Tuy nhiên, ở ảnh thứ nhất... trong khi ở ảnh thứ hai...</i>';
        else if(q.part===4) tips='<b>Part 4:</b> Dành 1 phút chuẩn bị để gạch đầu dòng 3 ý chính. Trả lời có mở bài, thân bài (Point - Reason - Example (ý chính - lý do - ví dụ)) và kết luận rõ ràng.<br><br><b>Form chung:</b> <i>"I would like to talk about... First of all... Secondly... Finally..."<br>Tôi muốn nói về... Trước hết... Thứ hai... Cuối cùng...</i>';
    } else if(q.skill==='writing'){
        if(q.part===1) tips='<b>Part 1 (Điền từ):</b> Chỉ viết ngắn gọn 1-5 từ. Rất cẩn thận lỗi chính tả và viết hoa đúng chữ.<br><br><b>Form chung:</b> <i>Trả lời trực tiếp (vd: "twice a week" (hai lần mỗi tuần), "pop music" (nhạc pop)).</i>';
        else if(q.part===2) tips='<b>Part 2 (Viết câu):</b> Viết đúng số từ yêu cầu (20-30 từ). Dùng 1-2 liên từ cơ bản (because: bởi vì; so: vì vậy; but: nhưng) để câu có chiều sâu.<br><br><b>Form chung:</b> <i>"I am very interested in... because I want to..."<br>Tôi rất quan tâm đến... vì tôi muốn...</i>';
        else if(q.part===3) tips='<b>Part 3 (Mạng xã hội):</b> Trả lời đủ 3 câu hỏi. Dùng giọng văn thân mật. Nên tỏ thái độ đồng tình hoặc hào hứng.<br><br><b>Form chung:</b> <i>"I completely agree with you. It is a great idea because..."<br>Tôi hoàn toàn đồng ý với bạn. Đó là một ý tưởng hay vì...</i>';
        else if(q.part===4) tips='<b>Part 4 (Viết Email):</b> Cần thể hiện rõ 2 sắc thái. Email 1 (cho bạn): Thân mật (Hi: chào bạn; How are you: bạn có khỏe không?). Email 2 (cho quản lý): Trang trọng (Dear Sir/Madam: kính gửi ông/bà; I am writing to...: tôi viết thư để...).';
    }
    if(tips) out+=`<div class="tips-panel"><h3>💡 Mẹo trả lời ăn điểm & Form chung</h3><p>${tips}</p></div>`;
    
    let generatedSample = window.generateSampleAnswer ? generateSampleAnswer(q.skill, q.part) : '';
    let sampleHtml = m.sample_answer || generatedSample;
    out+=reference(m.description)+(m.descriptions||[]).map(reference).join('')+reference(sampleHtml);
    return out;
}

function mockTestStart(){
    if(mockSections.length === 0) {
        // First entry: save practice answers, create new mock test
        if(!mockTestMode)practiceSaved=saved;saved={};mockSubmitted=false;mockTimeLeft=120*60;
        ['grammar','listening','reading','writing','speaking'].forEach(sk=>{
            const pools=COURSES.filter(g=>g.skill===sk);
            if(pools.length){
                const p=pools[Math.floor(Math.random()*pools.length)];
                const parts = Array.from(new Set(p.questions.map(q=>q.part||1))).sort((a,b)=>a-b);
                let qs = [];
                parts.forEach(pt => {
                    let partQs = p.questions.filter(q=>(q.part||1)===pt);
                    qs.push(...shuffleArray(partQs));
                });
                mockSections.push({skill:sk, label:info[sk].name, questions:qs, parts:parts, sourceId: p.id});
            }
        });
    }
    mockTestMode=true;
    
    // Count answered questions per section
    const sectionStatus = mockSections.map(sec => {
        const done = sec.questions.filter(answered).length;
        return {done, total: sec.questions.length, pct: Math.round(done/sec.questions.length*100)};
    });
    const totalAnswered = sectionStatus.reduce((s,x) => s+x.done, 0);
    const totalQuestions = sectionStatus.reduce((s,x) => s+x.total, 0);
    
    app.innerHTML=`<div class="practice-top" style="background: #fff1f0; border-bottom: 1px solid #ffa39e;">
        <div>
            <div class="eyebrow" style="color:#cf1322; font-weight:bold;">
                <span style="display:inline-block;background:#ff4d4f;color:white;padding:2px 6px;border-radius:4px;margin-right:6px;">THI THỬ</span> ĐỀ THI APTIS
            </div>
            <h1 style="color:#cf1322;">Bài thi mô phỏng</h1>
        </div>
        <a class="secondary" href="#" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; padding: 8px 16px; color:#cf1322;border-color:#ffa39e;background:white;"><span>←</span> Thoát thi thử</a>
    </div>
    <div class="workspace" style="max-width: 800px; margin: 40px auto; display: block;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="font-size: 24px; margin-bottom: 8px; color: var(--text-main);">Cấu trúc đề thi</h2>
                <p style="color: var(--text-muted); margin-bottom: 8px;">Chọn phần thi bất kỳ để bắt đầu. Thời gian: 120 phút.</p>
                <p style="color: var(--text-muted); font-size: 14px;">Đã làm: <strong style="color: var(--primary-color);">${totalAnswered}/${totalQuestions}</strong> câu</p>
            </div>
            <div style="display: grid; gap: 12px; margin-bottom: 24px;">
                ${mockSections.map((sec, i) => {
                    const st = sectionStatus[i];
                    const statusColor = st.done === 0 ? 'var(--text-muted)' : st.done === st.total ? 'var(--success)' : '#f59e0b';
                    const statusText = st.done === 0 ? 'Chưa làm' : st.done === st.total ? '✓ Hoàn thành' : st.done + '/' + st.total + ' câu';
                    return `
                <button onclick="window.mockShowSection(${i})" style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background: white; text-align: left; cursor: pointer; width: 100%; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.08)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div>
                        <strong style="color: var(--primary-color); display: block; margin-bottom: 4px; font-size: 16px;">Phần ${i+1}: ${sec.label}</strong>
                        <span style="font-size: 13px; color: ${statusColor}; font-weight: 600;">${statusText}</span>
                    </div>
                    <div style="background: var(--primary-color); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">
                        ${st.done > 0 ? 'Tiếp tục →' : 'Làm bài →'}
                    </div>
                </button>`;
                }).join('')}
            </div>
            <div style="text-align: center;">
                <button class="primary" style="font-size: 16px; padding: 12px 32px; border-radius: 8px; background: #ff4d4f; border-color: #ff4d4f;" onclick="if(confirm('Bạn có chắc chắn muốn nộp bài thi ngay?')) checkAllMock()">Nộp toàn bộ bài thi</button>
            </div>
        </div>
    </div>`;
    
    // Start global timer if not started
    if(!mockTimer) {
        mockTimer=setInterval(()=>{
            mockTimeLeft--;
            const mm=Math.floor(mockTimeLeft/60).toString().padStart(2,'0');
            const ss=(mockTimeLeft%60).toString().padStart(2,'0');
            const tl=document.querySelector('#mock-timer');if(tl)tl.textContent=mm+':'+ss;
            if(mockTimeLeft<=0){clearInterval(mockTimer);mockTimer=null;alert('Hết giờ làm bài!');checkAllMock();}
        },1000);
    }
}

window.mockShowSection = function(idx) {
    mockCurrentSection = idx;
    const sec = mockSections[idx];
    activeGroup = {id:'mock_'+sec.skill, skill:sec.skill, title: `Phần ${idx+1}/5: ${sec.label}`, questions: sec.questions};
    qi = 0;
    practice();
};

window.mockSectionSummary = function() {
    const sec = mockSections[mockCurrentSection];
    const answeredCount = sec.questions.filter(answered).length;
    const isLast = mockCurrentSection === mockSections.length - 1;
    
    app.innerHTML=`<div class="practice-top" style="background: #fff1f0; border-bottom: 1px solid #ffa39e;">
        <div>
            <div class="eyebrow" style="color:#cf1322; font-weight:bold;">
                <span style="display:inline-block;background:#ff4d4f;color:white;padding:2px 6px;border-radius:4px;margin-right:6px;">THI THỬ</span> ĐỀ THI APTIS
            </div>
            <h1 style="color:#cf1322;">Hoàn thành Phần ${mockCurrentSection+1}: ${sec.label}</h1>
        </div>
        <strong id="mock-timer" style="color:#cf1322;font-variant-numeric:tabular-nums;font-size:24px;font-weight:900;">${Math.floor(mockTimeLeft/60).toString().padStart(2,'0')}:${(mockTimeLeft%60).toString().padStart(2,'0')}</strong>
    </div>
    <div class="workspace" style="max-width: 800px; margin: 40px auto; display: block;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center;">
            <h2 style="font-size: 24px; margin-bottom: 16px; color: var(--text-main);">Tiến độ phần thi</h2>
            <div style="font-size: 48px; font-weight: 800; color: ${answeredCount===sec.questions.length?'var(--success)':'var(--error)'}; margin-bottom: 16px;">
                ${answeredCount} / ${sec.questions.length}
            </div>
            <p style="color: var(--text-muted); margin-bottom: 32px;">Số câu hỏi đã hoàn thành trong phần này.</p>
            <div style="display: flex; gap: 16px; justify-content: center;">
                <button class="secondary" style="padding: 12px 24px;" onclick="mockShowSection(mockCurrentSection)">← Xem lại phần này</button>
                <button class="primary" style="padding: 12px 24px;" onclick="mockTestStart()">Về danh sách phần thi →</button>
            </div>
        </div>
    </div>`;
};

function checkAllMock(){
    clearInterval(mockTimer);
    mockTimer=null;mockSubmitted=true;
    let totalScore = 0;
    let totalMax = 0;
    let sectionsHtml = '';
    
    mockSections.forEach((sec, idx) => {
        let secScore = 0;
        let secMax = 0;
        let qsHtml = '';
        
        sec.questions.forEach((q, i) => {
            let isCorrect = false;
            let hasAutoCheck = false;
            let uAns = Object.values(saved[q.id]||{}).filter(Boolean).join(', ');
            
            if(q.review&&typeof gradeReading==='function'){
                const result=gradeReading(q,saved[q.id]);
                if(result){
                    secMax+=result.total;
                    secScore+=result.correct;
                    hasAutoCheck = true;
                    isCorrect = result.correct === result.total;
                }
            }else{
                const m=q.metadata||{},key=m.correct_option??m.correct_answer??m.answer??m.key??q.correct_option??q.correct_answer??q.answer??q.key;
                if(key!==undefined&&key!==null&&key!==''){
                    hasAutoCheck = true;
                    secMax++;
                    if(String(saved[q.id]?.a0)===String(key)){
                        secScore++;
                        isCorrect = true;
                    }
                }
            }
            
            let statusIcon = !hasAutoCheck ? '<span style="color:var(--text-muted)">📝 Tự luận</span>' : (uAns ? (isCorrect ? '<span style="color:var(--success)">✓ Đúng</span>' : '<span style="color:var(--error)">✗ Sai</span>') : '<span style="color:var(--text-muted)">— Trống</span>');
            let bgColor = !hasAutoCheck ? 'transparent' : (uAns ? (isCorrect ? 'var(--success-bg)' : 'var(--error-bg)') : 'transparent');
            
            qsHtml += `<div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; background: ${bgColor}; transition: background 0.2s;">
                <div style="flex: 1;">
                    <strong style="display:block;font-size:13px;color:var(--text-muted);margin-bottom:4px;">Câu ${i+1} (Part ${q.part||1})</strong>
                    <div style="font-size:15px;color:var(--text-main);margin-bottom:8px;line-height:1.5;">${esc(plain(q.stem||q.title))}</div>
                    <div style="font-size:14px;color:var(--text-muted);">Trả lời của bạn: <strong style="color:var(--text-main); background: white; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${esc(uAns||'(Không có)')}</strong></div>
                </div>
                <div style="white-space: nowrap; font-weight: bold; font-size: 14px; background: white; padding: 4px 12px; border-radius: 20px; box-shadow: var(--shadow-sm);">
                    ${statusIcon}
                </div>
            </div>`;
        });
        
        totalScore += secScore;
        totalMax += secMax;
        let pct = secMax > 0 ? Math.round(secScore/secMax*100) : 0;
        let color = pct >= 70 ? 'var(--success)' : (pct >= 50 ? '#f59e0b' : 'var(--error)');
        if(secMax === 0) color = 'var(--text-muted)';
        
        sectionsHtml += `
        <div style="margin-bottom: 32px; background: white; border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-md);">
            <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 16px;">Phần ${idx+1}: ${sec.label}</strong>
                <span style="font-weight: bold; color: ${color}; background: white; padding: 4px 12px; border-radius: 20px; box-shadow: var(--shadow-sm);">${secMax>0 ? secScore+'/'+secMax : 'Không chấm tự động'}</span>
            </div>
            <div>
                ${qsHtml}
            </div>
        </div>`;
    });
    
    let overallPct = totalMax > 0 ? Math.round(totalScore/totalMax*100) : 0;
    let mainColor = overallPct>=70?'var(--success)':overallPct>=50?'#f59e0b':'var(--error)';
    
    app.innerHTML=`
    <div class="practice-top">
        <div>
            <div class="eyebrow" style="color:var(--primary-color); font-weight:bold;">KẾT QUẢ THI THỬ</div>
            <h1>Tổng kết bài làm</h1>
        </div>
        <div style="display:flex;gap:12px;">
            <a class="secondary" href="#mocktest" onclick="event.preventDefault();mockSections=[];mockTestStart();">↻ Thi lại đề khác</a>
            <a class="primary" href="#">🏠 Về trang chủ</a>
        </div>
    </div>
    <div class="workspace" style="max-width: 800px; margin: 0 auto; display: block;">
        <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 16px; border: 1px solid var(--border-color); margin-bottom: 40px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; align-items: center;">
            <h2 style="font-size: 20px; color: var(--text-muted); margin-bottom: 24px; font-weight: 600;">Điểm các phần trắc nghiệm</h2>
            
            <svg viewBox="0 0 36 36" class="circular-chart" style="stroke: ${mainColor};">
              <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="circle" stroke-dasharray="${overallPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="20.35" class="percentage">${overallPct}%</text>
            </svg>
            
            <div style="font-size: 24px; font-weight: 800; color: var(--text-main); margin-top: 24px;">
                ${totalScore} <span style="font-size: 16px; color: var(--text-muted); font-weight: 500;">/ ${totalMax} câu đúng</span>
            </div>
            <div style="margin-top: 12px; color: var(--text-muted); font-size: 14px; max-width: 400px;">Phần thi Tự luận & Nói sẽ được giáo viên chấm điểm thủ công.</div>
        </div>
        ${sectionsHtml}
    </div>`;
}

function revealAnswers(q){
    if(!answered(q)) return;
    if(q.review && (gradeReading(q, saved[q.id]).unanswered || gradeReading(q, saved[q.id]).invalidOrder || reviewedReading[q.id] !== JSON.stringify(saved[q.id] || {}))) return;
    const m=q.metadata||{};
    let answers=q.review?.answers;
    if(!answers){
        const key=m.correct_option??m.correct_answer??m.answer??m.key??q.correct_option??q.correct_answer;
        if(key!==undefined&&key!==null&&key!==''){
            const option=(m.options||[]).find(o=>String(o.id)===String(key));
            answers=[option?.text??key];
        }
    }
    document.querySelector('#feedback').innerHTML=answers?`<div class="notice"><b>Đáp án để học</b><ol>${answers.map(a=>`<li>${esc(a)}${translateAsyncHTML(a)}</li>`).join('')}</ol>${q.review?.explanation?`<div class="explanation">${explanationHTML(q.review.explanation)}</div>`:''}<p>Phần này không thay đổi câu trả lời của bạn.</p></div>`:'<div class="notice">Bài này chưa có đáp án để hiển thị.</div>';
    document.querySelectorAll('details.reference-details').forEach(d=>d.open=true);
}

function practice(){
    document.body.classList.remove('study-panel-open');
    if(recorder?.state==='recording')recorder.stop();
    stream?.getTracks().forEach(t=>t.stop());
    const q=activeGroup.questions[qi];
    try{if(!mockTestMode)localStorage.setItem('aptis-last',`#lesson/${activeGroup.id}/${qi}`)}catch{}
    let navHTML = '';
    let currentPart = null;
    activeGroup.questions.forEach((x, i) => {
        if (x.part && x.part !== currentPart) {
            currentPart = x.part;
            navHTML += `<div style="grid-column: 1 / -1; margin-top: 10px; font-size: 13px; font-weight: bold; color: var(--text-main); text-transform: uppercase;">PART ${currentPart}</div>`;
        }
        navHTML += `<button data-jump="${i}" class="${i===qi?'active':Studio.complete(x)?'done':answered(x)?'partial':''}" ${i===qi?'aria-current="step"':''} aria-label="Đến câu ${i+1}, ${Studio.complete(x)?'đã làm đủ':answered(x)?'đang làm':'chưa làm'}">${i+1}</button>`;
    });

    app.innerHTML=`<div class="practice-top" ${mockTestMode?'style="background: #fff1f0; border-bottom: 1px solid #ffa39e;"':''}><div>${mockTestMode ? `<div class="eyebrow" style="color:#cf1322; font-weight:bold;"><span style="display:inline-block;background:#ff4d4f;color:white;padding:2px 6px;border-radius:4px;margin-right:6px;">THI THỬ</span> PART ${q.part||1}</div>` : `<div class="eyebrow">${(info[q.skill]?.name||'THI THỬ').toUpperCase()} · PART ${q.part||1}</div>`}<h1 ${mockTestMode?'style="color:#cf1322;"':''}>${esc(groupTitle(activeGroup))}</h1></div><a class="secondary" href="${mockTestMode?'#':'#'+q.skill}" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; padding: 8px 16px; ${mockTestMode?'color:#cf1322;border-color:#ffa39e;background:white;':''}"><span>←</span> ${mockTestMode?'Thoát thi thử':'Quay lại'}</a></div><div class="workspace"><section class="question-panel"><div style="display:flex;justify-content:space-between;align-items:center"><span class="muted" style="display:flex;align-items:center;gap:12px;">Câu ${qi+1} / ${activeGroup.questions.length} <div class="font-controls"><button id="font-smaller" aria-label="Thu nhỏ chữ">A−</button><span id="font-scale">100%</span><button id="font-larger" aria-label="Phóng to chữ">A+</button></div></span>${mockTestMode?`<strong id="mock-timer" style="color:#cf1322;font-variant-numeric:tabular-nums;font-size:24px;font-weight:900;">${Math.floor(mockTimeLeft/60).toString().padStart(2,'0')}:${(mockTimeLeft%60).toString().padStart(2,'0')}</strong>`:''}</div><div class="study-toolbar"><span id="save-status" role="status">${mockTestMode?'Trong phiên thi':'Đã lưu'}</span><div class="study-tools">${mockTestMode?'':'<button id="reset-lesson" class="reset-lesson-button" title="Xóa lựa chọn và kết quả cũ của bộ đề này"><span aria-hidden="true">↻</span> Làm lại đề</button>'}<button id="focus-study" class="focus-button" aria-pressed="false">Tập trung</button></div></div><div id="q-anim" class="animated-content"><h2>${renderHTML(q.title||q.stem)}</h2>${translateAsyncHTML(q.title||q.stem)}${q.title&&(q.skill==='reading'||q.stem!==q.title)?`<p class="question-instruction">${renderHTML(q.skill==='reading'?readingInstructions(q):q.stem)}</p>`:''}${q.title&&q.stem!==q.title&&q.skill!=='reading'?translateAsyncHTML(q.stem):''}<div id="question-body">${questionBody(q)}</div></div><div id="feedback" aria-live="polite"></div><div class="question-actions"><button id="prev" class="secondary" ${qi===0?'disabled':''}>Câu trước</button>${mockTestMode?(qi===activeGroup.questions.length-1 ? `<button id="next-mock-section" class="primary" style="background:#1890ff;border-color:#1890ff;color:white;">Phần tiếp theo</button>` : `<button id="next" class="primary">Câu tiếp theo</button>`) : `<button id="check" class="secondary">Kiểm tra bài</button><button id="next" class="primary">${qi===activeGroup.questions.length-1?'Hoàn thành':'Câu tiếp theo'}</button>`}</div></section><button class="nav-toggle-btn" id="q-nav-toggle" aria-controls="q-nav-drawer" aria-expanded="false"><span aria-hidden="true">☷</span> Tùy chỉnh & tiến độ <span class="nav-count">${qi+1}/${activeGroup.questions.length}</span></button><div class="nav-backdrop" id="q-nav-backdrop"></div><aside class="question-nav drawer" id="q-nav-drawer" aria-labelledby="study-panel-title"><div class="study-panel-heading"><div><strong id="study-panel-title">Bảng luyện tập</strong><small>Tùy chỉnh và chuyển câu nhanh</small></div><button class="drawer-close-btn" id="q-nav-close" aria-label="Đóng bảng luyện tập">✕</button></div>${mockTestMode?'':`<details class="settings-panel"><summary>Tùy chỉnh bài tập</summary><label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer"><input type="checkbox" id="set-sq" ${userSettings.shuffleQuestions?'checked':''}> <span>Trộn câu<small>Áp dụng khi mở lại bộ bài</small></span></label><label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer"><input type="checkbox" id="set-so" ${userSettings.shuffleOptions?'checked':''}> Đảo đáp án</label><label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:14px;cursor:pointer"><input type="checkbox" id="set-mm" ${userSettings.memorizationMode?'checked':''}> <span>Học thuộc lòng<small>Ôn đáp án sau khi làm và kiểm tra bài</small></span></label></details>`}<b style="font-size:14px; color:var(--text-main); display:block; margin-bottom:10px;">${mockTestMode?'Tiến độ làm bài thi':'Tiến độ luyện tập'}</b><p class="muted" id="progress-label"></p><progress id="progress" max="${activeGroup.questions.length}"></progress><div class="nav-legend"><span>○ Chưa làm</span><span>◐ Đang làm</span><span>● Đã làm đủ</span></div><div class="numbers">${navHTML}</div>${mockTestMode ? `<button id="submit-mock-side" class="primary" style="width:100%;justify-content:center;margin-top:20px;background:#ff4d4f;border-color:#ff4d4f;color:white;padding:12px;font-size:16px;">Nộp bài thi</button>` : ''}<p class="muted" style="margin-top:16px;font-size:12px">Câu trả lời tự động lưu trên trình duyệt này.</p></aside></div>`;
    document.querySelectorAll('[data-key]').forEach(el=>{
        const value=saved[q.id]?.[el.dataset.key];
        if(el.type==='radio')el.checked=value===el.value;else el.value=value||'';
        updateCount(el);
        el.addEventListener('input',()=>{
            saved[q.id]??={};saved[q.id][el.dataset.key]=el.value;persist();if(!mockTestMode&&Studio.complete(q))Studio.record(q.id);updateCount(el);progress();document.querySelector('#feedback').innerHTML='';
        })
    });
    progress();
    Studio.bindPractice();
    document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{
        closeDrawer();
        if(mockTestMode){qi=Number(el.dataset.jump);practice();}
        else location.hash=`lesson/${activeGroup.id}/${el.dataset.jump}`;
    });
    document.querySelector('#prev').onclick=()=>{
        if(mockTestMode){qi--;practice();}
        else location.hash=`lesson/${activeGroup.id}/${qi-1}`;
    };
    const nextBtn = document.querySelector('#next');
    if(nextBtn) nextBtn.onclick=()=>{
        if(qi<activeGroup.questions.length-1){
            if(mockTestMode){qi++;practice();}
            else location.hash=`lesson/${activeGroup.id}/${qi+1}`;
        }
        else{
            if(!mockTestMode) {
                const count=activeGroup.questions.filter(answered).length;
                document.querySelector('#feedback').innerHTML=`<div class="notice">Đã lưu bài luyện tập: ${count}/${activeGroup.questions.length} câu có câu trả lời. Bạn có thể xem lại các câu và xuất bài làm.</div>`;
                toast('Đã kết thúc lượt luyện tập.')
            }
        }
    };
    const nextMockSecBtn = document.querySelector('#next-mock-section');
    if(nextMockSecBtn) {
        nextMockSecBtn.onclick = () => window.mockSectionSummary();
        if(mockCurrentSection === mockSections.length - 1) {
             nextMockSecBtn.textContent = 'Nộp bài thi';
             nextMockSecBtn.style.background = '#ff4d4f';
             nextMockSecBtn.style.borderColor = '#ff4d4f';
        }
    }
    const subSide = document.querySelector('#submit-mock-side');
    if(subSide) subSide.onclick = () => { if(confirm('Bạn chắc chắn nộp bài?')) checkAllMock() };
    const ck = document.querySelector('#check');
    if(ck) ck.onclick = () => check(q);
    if(document.querySelector('#record'))document.querySelector('#record').onclick=record;
    
    const drawer = document.getElementById('q-nav-drawer');
    const backdrop = document.getElementById('q-nav-backdrop');
    const toggleBtn = document.getElementById('q-nav-toggle');
    const closeBtn = document.getElementById('q-nav-close');
    const mobilePanel = () => window.matchMedia('(max-width: 991px)').matches;
    const closeDrawer = () => {
        drawer.classList.remove('open'); backdrop.classList.remove('open');
        document.body.classList.remove('study-panel-open');
        toggleBtn.setAttribute('aria-expanded','false');
        drawer.removeAttribute('role'); drawer.removeAttribute('aria-modal');
        if(mobilePanel()) toggleBtn.focus();
    };
    const openDrawer = () => {
        drawer.classList.add('open'); backdrop.classList.add('open');
        document.body.classList.add('study-panel-open');
        toggleBtn.setAttribute('aria-expanded','true');
        drawer.setAttribute('role','dialog'); drawer.setAttribute('aria-modal','true');
        setTimeout(() => {
            if(drawer.isConnected && drawer.classList.contains('open')) closeBtn.focus({preventScroll:true});
        }, 220);
    };
    toggleBtn.onclick = openDrawer;
    closeBtn.onclick = closeDrawer;
    backdrop.onclick = closeDrawer;
    drawer.onkeydown = e => {
        if(!mobilePanel() || !drawer.classList.contains('open')) return;
        if(e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
        if(e.key === 'Tab') {
            const items = [...drawer.querySelectorAll('button,input,summary')].filter(el => !el.disabled && el.getClientRects().length);
            const first = items[0], last = items[items.length-1];
            if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    };

    ['sq','so','mm'].forEach(k=>{
        const el=document.getElementById('set-'+k);
        if(el)el.onchange=(e)=>{
            userSettings[{'sq':'shuffleQuestions','so':'shuffleOptions','mm':'memorizationMode'}[k]]=e.target.checked;
            persistSettings();
            if(k==='sq')toast('Chọn lại bộ bài để áp dụng Trộn Câu.');
            else practice();
        }
    });
    if(mockTestMode){const smm=document.querySelector('#set-mm');const ssq=document.querySelector('#set-sq');if(smm)smm.disabled=true;if(ssq)ssq.disabled=true;}
    if(mockSubmitted&&mockTestMode)checkAllMock();
    else if(!mockTestMode&&q.review&&reviewedReading[q.id]===JSON.stringify(saved[q.id]||{})){if(userSettings.memorizationMode)revealAnswers(q);else restoreReadingReview();}
}

function updateCount(el){
    const count=el.parentElement.querySelector('.count');
    if(count)count.textContent=count.textContent.replace(/^\d+ từ/,`${el.value.trim()?el.value.trim().split(/\s+/).length:0} từ`);
}

function progress(){
    const done=activeGroup.questions.filter(Studio.complete).length;
    document.querySelector('#progress-label').textContent=`${done}/${activeGroup.questions.length} câu đã luyện`;
    document.querySelector('#progress').value=done;
    document.querySelectorAll('[data-jump]').forEach(el=>{
        if(Number(el.dataset.jump)!==qi)el.classList.toggle('done',Studio.complete(activeGroup.questions[Number(el.dataset.jump)]));
        el.classList.toggle('partial',answered(activeGroup.questions[Number(el.dataset.jump)])&&!Studio.complete(activeGroup.questions[Number(el.dataset.jump)]));
    })
}

function check(q){
    if(q.review){showReadingReview(q);return}
    const m=q.metadata||{},values=Object.values(saved[q.id]||{}).filter(Boolean);
    let message;
    if(!values.length) message='Hãy nhập câu trả lời trước khi kiểm tra.';
    else if(q.type==='sentence_ordering'&&new Set(values).size!==values.length) message='Có vị trí bị trùng. Hãy dùng mỗi vị trí một lần.';
    else{
        const key=m.correct_option??m.correct_answer??m.answer??m.key??q.correct_option??q.correct_answer??q.answer??q.key;
        if(key!==undefined&&key!==null&&key!=='') message=String(saved[q.id]?.a0)===String(key)?'Chính xác!':'Câu trả lời chưa đúng. Hãy thử lại.';
        else message='Đã lưu câu trả lời. Dữ liệu gốc chưa có đáp án chấm tự động cho câu này. Hãy đối chiếu nội dung tham khảo nếu có.'
    }
    document.querySelector('#feedback').innerHTML=`<div class="notice">${esc(message)}</div>`;
}

async function record(){
    const button=document.querySelector('#record'),status=document.querySelector('#record-status'),holder=document.querySelector('#recordings');
    if(recorder?.state==='recording'){recorder.stop();return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Ghi âm cần trình duyệt hỗ trợ microphone trên localhost hoặc HTTPS.');return}
    try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        if(!button.isConnected){stream.getTracks().forEach(t=>t.stop());return}
        recorder=new MediaRecorder(stream);
        const currentRecorder=recorder,currentStream=stream;
        const chunks=[];
        recorder.ondataavailable=e=>chunks.push(e.data);
        recorder.onstop=()=>{
            currentStream.getTracks().forEach(t=>t.stop());
            if(!holder.isConnected)return;
            const blob=new Blob(chunks,{type:currentRecorder.mimeType});
            const url=URL.createObjectURL(blob);
            objectUrls.push(url);
            currentStream.getTracks().forEach(t=>t.stop());
            holder.innerHTML=`<audio src="${url}" controls></audio><a class="secondary" href="${url}" download="speaking-${Date.now()}.${currentRecorder.mimeType.includes('mp4')?'m4a':'webm'}">Tải bản ghi âm</a><p>Bản ghi âm chỉ tồn tại trong phiên này. Tải về trước khi chuyển câu.</p>`;
            button.textContent='● Ghi âm lại';status.textContent='Đã ghi xong';
        };
        recorder.start();
        button.textContent='■ Dừng ghi âm';status.textContent='Đang ghi âm…';
    }catch{toast('Không thể truy cập microphone. Kiểm tra quyền microphone của trình duyệt.')}
}

function initMobileMenu(){
    const toggle=document.querySelector('#menu-toggle'),close=document.querySelector('#sidebar-close'),backdrop=document.querySelector('#sidebar-backdrop'),sidebar=document.querySelector('.sidebar');
    const hide=()=>{sidebar.classList.remove('open');backdrop.classList.remove('show');document.body.style.overflow='';toggle.setAttribute('aria-expanded','false');};
    const show=()=>{sidebar.classList.add('open');backdrop.classList.add('show');document.body.style.overflow='hidden';toggle.setAttribute('aria-expanded','true');setTimeout(()=>close.focus({preventScroll:true}),180)};
    toggle.onclick=show;close.onclick=()=>{hide();toggle.focus()};backdrop.onclick=hide;
    document.querySelector('#nav').addEventListener('click',e=>{if(e.target.closest('a'))hide()});
    sidebar.onkeydown=e=>{
        if(!sidebar.classList.contains('open'))return;
        if(e.key==='Escape'){e.preventDefault();hide();toggle.focus()}
        if(e.key==='Tab'){
            const items=[...sidebar.querySelectorAll('a,button')].filter(el=>el.getClientRects().length),first=items[0],last=items[items.length-1];
            if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
            else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
        }
    };
    window.matchMedia('(min-width:992px)').addEventListener('change',e=>{
        if(e.matches){hide();document.querySelector('#q-nav-close')?.click();document.body.classList.remove('study-panel-open')}
    });
    document.querySelector('.skip-link').onclick=e=>{e.preventDefault();app.focus();app.scrollIntoView({block:'start'})};
}
initMobileMenu();
window.addEventListener('hashchange',route);
route();
