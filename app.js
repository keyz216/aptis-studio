const icons={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3z',reading:'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15',listening:'M4 14v-3a8 8 0 0 1 16 0v3 M4 12H2v8h5v-8z M20 12h2v8h-5v-8z',writing:'m4 16-1 5 5-1L21 7l-5-5z M14 4l6 6',speaking:'M9 3h6v12H9z M5 11v3a7 7 0 0 0 14 0v-3 M12 21v-3',grammar:'m3 19 6-15 6 15 M5 14h8 M16 6h5 M18.5 3v6'};
const info={reading:{name:'Reading',vi:'Đọc hiểu',desc:'Đọc hiểu, sắp xếp câu và nối tiêu đề.',color:'#4b8061',tint:'#edf4e8'},listening:{name:'Listening',vi:'Nghe hiểu',desc:'Luyện nghe và nắm bắt thông tin chính.',color:'#b48a4d',tint:'#faf0df'},writing:{name:'Writing',vi:'Viết',desc:'Từ câu trả lời ngắn đến email hoàn chỉnh.',color:'#608aaf',tint:'#eaf1fa'},speaking:{name:'Speaking',vi:'Nói',desc:'Luyện phản xạ và diễn đạt qua từng chủ đề.',color:'#ae7667',tint:'#f7ede8'},grammar:{name:'Grammar & Vocabulary',vi:'Ngữ pháp & Từ vựng',desc:'Củng cố ngữ pháp và mở rộng vốn từ.',color:'#8b79a7',tint:'#f0edf7'}};
const svg=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${icons[k]}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent||''};
var saved={};try{saved=JSON.parse(localStorage.getItem('aptis-answers')||'{}')}catch{}
var userSettings={shuffleQuestions:false,shuffleOptions:false,memorizationMode:false};try{Object.assign(userSettings,JSON.parse(localStorage.getItem('aptis-settings')||'{}'))}catch{}
function persistSettings(){try{localStorage.setItem('aptis-settings',JSON.stringify(userSettings))}catch{toast('Không thể lưu tùy chỉnh trên trình duyệt này.')}}
function shuffleArray(arr){const res=[...arr];for(let i=res.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[res[i],res[j]]=[res[j],res[i]]}return res;}
let activeGroup,qi=0,mockTestMode=false,mockSubmitted=false,mockTimeLeft=0,mockTimer,timer,stream,recorder,objectUrls=[],audioChunks=[];
let practiceSaved=saved;
const app=document.querySelector('#app');
function persist(){if(mockTestMode)return true;try{localStorage.setItem('aptis-answers',JSON.stringify(saved));return true}catch{toast('Trình duyệt không lưu được dữ liệu.');return false}}
function toast(s){const t=document.querySelector('#toast');t.textContent=s;t.style.display='block';clearTimeout(timer);timer=setTimeout(()=>t.style.display='none',4200)}
function answered(q){return Object.values(saved[q.id]||{}).some(x=>String(x).trim())}
function route(){if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());objectUrls.forEach(URL.revokeObjectURL);objectUrls=[];clearInterval(mockTimer);const [view,id,n]=location.hash.slice(1).split('/');if(mockTestMode){saved=practiceSaved;mockTestMode=false;}if(view!=='lesson')activeGroup=null;const skill=view==='lesson'?COURSES[Number(id)]?.skill:view;document.querySelector('#nav').innerHTML=`<a href="#" class="${!view?'active':''}">${svg('home')}Tổng quan</a><a href="#mocktest" class="${view==='mocktest'?'active':''}">${svg('reading')}Thi thử Aptis</a>`+Object.entries(info).map(([k,v])=>`<a href="#${k}" class="${skill===k?'active':''}">${svg(k)}${v.name}</a>`).join('');document.querySelector('#breadcrumb').textContent='Góc học tập / '+(view==='mocktest'?'Thi thử Aptis':info[skill]?.name||'Tổng quan');if(view==='mocktest')mockTestStart();else if(view==='lesson'&&COURSES[Number(id)]){
    mockTestMode=false;
    if(activeGroup?.id !== COURSES[Number(id)].id) {
        activeGroup={...COURSES[Number(id)]};
        if(userSettings.shuffleQuestions) activeGroup.questions=shuffleArray(activeGroup.questions);
    }
    qi=Math.max(0,Math.min(activeGroup.questions.length-1,Number(n)||0));
    practice()
}else if(info[view])library(view);else home();window.scrollTo(0,0)}
function home(){const total=new Set(COURSES.flatMap(g=>g.questions.map(q=>q.id))).size,done=new Set(COURSES.flatMap(g=>g.questions.filter(answered).map(q=>q.id))).size;let last;try{last=localStorage.getItem('aptis-last')}catch{}app.innerHTML=`<div class="welcome"><div><div class="eyebrow">YOUR LEARNING SPACE</div><h1>Hôm nay, mình học gì?</h1><div class="muted">Dành một chút thời gian để tiếng Anh tiến bộ mỗi ngày.</div></div><span class="date-tag">${new Intl.DateTimeFormat('vi-VN',{day:'numeric',month:'long'}).format(new Date())}</span></div><section class="banner"><div><div class="eyebrow">TỪNG BƯỚC CHINH PHỤC APTIS</div><h2>Một mục tiêu. Năm kỹ năng.<br>Bắt đầu từ bài tập hôm nay.</h2><p>Thư viện bài tập của bạn đã sẵn sàng.</p><a class="primary" href="${last&&/^#lesson\/\d+\/\d+$/.test(last)?last:'#reading'}">${last?'Tiếp tục học':'Bắt đầu luyện tập'} <span>↗</span></a></div><div class="book-art" aria-hidden="true"><div class="book back">ABC<br>↗</div><div class="book front">English<small>ONE STEP A DAY</small></div></div></section><div class="stats"><div class="stat"><span class="stat-icon">▤</span><div><strong>${COURSES.length}</strong><small>Bộ bài luyện tập</small></div></div><div class="stat"><span class="stat-icon">◎</span><div><strong>${total}</strong><small>Câu hỏi trong thư viện</small></div></div><div class="stat"><span class="stat-icon">✓</span><div><strong>${done}</strong><small>Câu đã luyện tập</small></div></div></div><div class="section-head"><h2>Luyện tập theo kỹ năng</h2><span>Chọn kỹ năng bạn muốn cải thiện</span></div><div class="skills">${Object.entries(info).map(([k,v])=>{const groups=COURSES.filter(g=>g.skill===k);return `<a class="skill-card" style="--accent:${v.color};--tint:${v.tint}" href="#${k}"><div class="card-top"><span class="tile-icon">${svg(k)}</span><span class="part-tag">${v.vi}</span></div><h3>${v.name}</h3><p>${v.desc}</p><div class="card-bottom"><span>${groups.length} bộ bài</span><b>Luyện tập ↗</b></div></a>`}).join('')}<div class="skill-card note-card"><div class="eyebrow">A LITTLE, EVERY DAY</div><h3>“Practice makes<br>progress.”</h3><p>Không cần hoàn hảo.<br>Chỉ cần tốt hơn hôm qua một chút.</p></div></div>`}
function library(skill){const meta=info[skill];app.innerHTML=`<a class="secondary" href="#" style="display:inline-flex; align-items:center; gap:6px; margin-bottom: 20px; font-size:14px; padding: 8px 16px;"><span>←</span> Quay lại Tổng quan</a><div class="eyebrow">THƯ VIỆN BÀI TẬP</div><h1>${meta.name}</h1><p class="muted">${meta.desc} Chọn một bộ bài để bắt đầu.</p><div class="toolbar"><input id="search" type="search" aria-label="Tìm bài tập" placeholder="Tìm theo tên bài, chủ đề hoặc phần thi…"></div><div id="lessons" class="lessons"></div>`;const render=()=>{const term=document.querySelector('#search').value.toLocaleLowerCase('vi');const groups=COURSES.filter(g=>g.skill===skill&&`${g.title} ${g.questions.map(q=>q.title+' '+q.stem).join(' ')}`.toLocaleLowerCase('vi').includes(term));document.querySelector('#lessons').innerHTML=groups.map(g=>{const title=groupTitle(g);return `<a class="lesson" href="#lesson/${g.id}/0"><small>${info[g.skill].vi} · ${g.questions.length} câu</small><h3>${esc(title)}</h3><p>${g.questions.filter(answered).length}/${g.questions.length} câu đã luyện tập <span style="float:right;color:var(--primary-color)">Mở bài →</span></p></a>`}).join('')||'<div class="empty">Không tìm thấy bài phù hợp. Thử một từ khóa khác.</div>'};document.querySelector('#search').addEventListener('input',render);render()}
function groupTitle(g){if(g.skill==='writing')return (g.questions[0].title||`Đề ${g.title}`).replace(/ - Part \d+/,'');if(g.skill==='speaking')return `Speaking · Đề ${g.title.replace('Đề ','')}`;return g.title}

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
    return template.innerHTML;
}

function select(label,choices,key){
    let cList=choices.map((c,origI)=>({c,origI}));
    if(userSettings.shuffleOptions)cList=shuffleArray(cList);
    return `<label class="field">${renderHTML(label)}<select data-key="${key}" aria-label="${esc(plain(label))}"><option value="">Chọn đáp án</option>${cList.map(({c,origI})=>{const val=typeof c==='object'?c.id??origI:c,text=typeof c==='object'?c.text??c.label??c.id:c;return `<option value="${esc(val)}">${esc(plain(text))}</option>`}).join('')}</select></label>`;
}
function translateAsyncHTML(text) {
    if(!window.translateToVi || !text) return '';
    let id = 'vi-' + Math.random().toString(36).substr(2, 9);
    Promise.resolve(translateToVi(text)).then(vi => {
        let el = document.getElementById(id);
        if(el) {
            if (vi) el.innerHTML = vi;
            else el.style.display = 'none';
        }
    }).catch(()=>{});
    return `<div id="${id}" class="vi-translation" style="color:var(--text-muted);font-size:14px;margin-top:6px;font-style:italic;"></div>`;
}
function writing(label,key,limit,short=false){
    let labelHtml = renderHTML(label) + translateAsyncHTML(label);
    return `<label class="field">${labelHtml}${short?`<input data-key="${key}" placeholder="Nhập câu trả lời…">`:`<textarea data-key="${key}" placeholder="Viết câu trả lời của bạn…"></textarea>`}<span class="count">0 từ${limit?` · Gợi ý ${limit.min}–${limit.max} từ`:''}</span></label>`;
}
function passage(s){return `<div class="passage">${renderHTML(s)}</div>`}
function reference(s){return s?`<details class="reference-details"><summary>Xem nội dung tham khảo</summary>${passage(s)}</details>`:''}

function questionBody(q){
    const m=q.metadata||{};
    let out='';
    let images = (q.images && q.images.length) ? q.images : (m.image_paths || (m.image_path ? [m.image_path] : []));
    if(images.length){
        out+=`<div class="q-images">${images.map(src=>{
            const filename = src.split('/').pop();
            const fallback = 'https://milaedu.com/storage/speaking_images/' + filename;
            const initial = src.startsWith('http') ? src : (src.startsWith('Spek/') ? src : 'https://milaedu.com/storage/' + src.replace(/^storage\//,''));
            return `<img src="${esc(initial)}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${fallback}';}" alt="Hình minh họa cho bài ${info[q.skill]?.name||'thi'} ${q.part||''}">`;
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
            return `<audio controls ${fallbackAttr} src="${esc(initial)}"></audio>`;
        }).join(''):'<div class="notice">Chưa có file audio cho bài này.</div>';
    }
    if(m.instructions){out+=passage(m.instructions);out+=translateAsyncHTML(m.instructions);}
    if(m.instruction){out+=passage(m.instruction);out+=translateAsyncHTML(m.instruction);}
    
    if(q.type==='fill_in_blanks_mc')out+=m.paragraphs.map((p,i)=>select(`${i+1}. ${p}`,m.choices[i],`a${i}`)).join('');
    else if(q.type==='sentence_ordering'){out+='<p class="muted">Chọn vị trí của từng câu để tạo thành đoạn văn. Mỗi vị trí chỉ dùng một lần.</p>';if(m.sentences[0])out+=`<div class="passage"><b>Câu mở đầu (cố định)</b><br>${esc(plain(m.sentences[0]))}</div>`;const rows=m.sentences.slice(1);out+=rows.map((s,i)=>select(s,rows.map((_,j)=>j+1),readingAnswerKey(q,i))).join('');}
    else if(q.type==='matching_headings')out+=m.paragraphs.map((p,i)=>passage(p)+select(`Tiêu đề đoạn ${i+1}`,m.headings,`a${i}`)).join('');
    else if(q.type==='text_question_match'){out+=m.options.map((p,i)=>passage(`${m.names[i]}\n${p}`)).join('');out+=m.questions.map((s,i)=>select(s,m.names,`a${i}`)).join('');}
    else if(m.pairs)out+=m.pairs.map((p,i)=>select(`${p.prompt||p.prefix||''} ${p.after||p.suffix||''}`,m.dropdown_pool||[],`a${i}`)).join('');
    else if(m.fields)out+=m.fields.map((f,i)=>writing(f.label,`a${i}`,null,true)).join('');
    else if(m.email){out+=passage([m.email.greeting,m.email.body,m.email.sign_off].join('\n\n'));out+=[m.task1,m.task2].filter(Boolean).map((t,i)=>writing(t.instruction,`a${i}`,t.word_limit)+reference(t.sample_answer || (window.generateSampleAnswer ? generateSampleAnswer(q.skill, q.part, i) : ''))).join('');}
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
            return `<label class="choice"><input type="radio" name="answer" data-key="a0" value="${esc(value)}"><span>${String.fromCharCode(65+i)}. ${renderHTML(text)}</span></label>`;
        }).join('');
    }
    else out+=writing('Câu trả lời của bạn','a0');
    
    if(q.skill==='speaking')out+=`<div class="notice">Chuẩn bị: ${m.prep_time||0} giây · Trả lời: ${m.total_answer_time||m.answer_time_per_question||45} giây${m.total_answer_time?' tổng cộng':' mỗi câu'}. Bạn có thể ghi âm và tải về để nghe lại.</div><div class="record"><button id="record" class="secondary">● Bắt đầu ghi âm</button><span id="record-status" role="status"></span><div id="recordings"></div></div>`;
    
    let tips='';
    if(q.skill==='speaking'){
        if(q.part===1) tips='<b>Part 1:</b> Trả lời trực tiếp trọng tâm (1 câu) và mở rộng 1-2 câu giải thích hoặc ví dụ. Đừng nói quá dài.<br><br><b>Form chung:</b> <i>"I really enjoy... because it helps me... For example..."</i>';
        else if(q.part===2) tips='<b>Part 2:</b> Bắt đầu bằng 1 câu miêu tả tổng quan bức tranh. Sau đó nói chi tiết và kết thúc bằng việc đoán cảm xúc.<br><br><b>Form chung:</b> <i>"In the picture, I can see... They look... I think they are..."</i>';
        else if(q.part===3) tips='<b>Part 3:</b> Tập trung vào sự so sánh thay vì chỉ miêu tả đơn thuần. Dùng từ nối: However, On the other hand.<br><br><b>Form chung:</b> <i>"Both pictures show... However, in the first picture... while in the second..."</i>';
        else if(q.part===4) tips='<b>Part 4:</b> Dành 1 phút chuẩn bị để gạch đầu dòng 3 ý chính. Trả lời có mở bài, thân bài (Point - Reason - Example) và kết luận rõ ràng.<br><br><b>Form chung:</b> <i>"I would like to talk about... First of all... Secondly... Finally..."</i>';
    } else if(q.skill==='writing'){
        if(q.part===1) tips='<b>Part 1 (Điền từ):</b> Chỉ viết ngắn gọn 1-5 từ. Rất cẩn thận lỗi chính tả và viết hoa đúng chữ.<br><br><b>Form chung:</b> <i>Trả lời trực tiếp (vd: "twice a week", "pop music").</i>';
        else if(q.part===2) tips='<b>Part 2 (Viết câu):</b> Viết đúng số từ yêu cầu (20-30 từ). Dùng 1-2 liên từ cơ bản (because, so, but) để câu có chiều sâu.<br><br><b>Form chung:</b> <i>"I am very interested in... because I want to..."</i>';
        else if(q.part===3) tips='<b>Part 3 (Mạng xã hội):</b> Trả lời đủ 3 câu hỏi. Dùng giọng văn thân mật. Nên tỏ thái độ đồng tình hoặc hào hứng.<br><br><b>Form chung:</b> <i>"I completely agree with you. It is a great idea because..."</i>';
        else if(q.part===4) tips='<b>Part 4 (Viết Email):</b> Cần thể hiện rõ 2 sắc thái. Email 1 (cho bạn): Thân mật (Hi, How are you). Email 2 (cho quản lý): Trang trọng (Dear Sir/Madam, I am writing to...).';
    }
    if(tips) out+=`<div class="tips-panel"><h3>💡 Mẹo trả lời ăn điểm & Form chung</h3><p>${tips}</p></div>`;
    
    let generatedSample = window.generateSampleAnswer ? generateSampleAnswer(q.skill, q.part) : '';
    let sampleHtml = m.sample_answer || generatedSample;
    out+=reference(m.description)+reference((m.descriptions||[]).join('\n\n'))+reference(sampleHtml);
    return out;
}

function mockTestStart(){
    practiceSaved=saved;saved={};mockTestMode=true;mockSubmitted=false;const tId=Date.now();const mockQs=[];
    ['grammar','reading','listening','writing','speaking'].forEach(sk=>{
        const pools=COURSES.filter(g=>g.skill===sk);
        if(pools.length){const p=pools[Math.floor(Math.random()*pools.length)];mockQs.push(...p.questions);}
    });
    activeGroup={id:'mock_'+tId,skill:'mock',title:'Đề Thi Thử Aptis',questions:mockQs};
    if(userSettings.shuffleQuestions) activeGroup.questions=shuffleArray(activeGroup.questions);
    qi=0;mockTimeLeft=120*60;
    practice();
    mockTimer=setInterval(()=>{
        mockTimeLeft--;
        const mm=Math.floor(mockTimeLeft/60).toString().padStart(2,'0');
        const ss=(mockTimeLeft%60).toString().padStart(2,'0');
        const tl=document.querySelector('#mock-timer');if(tl)tl.textContent=mm+':'+ss;
        if(mockTimeLeft<=0){clearInterval(mockTimer);alert('Hết giờ làm bài!');checkAllMock();}
    },1000);
}

function checkAllMock(){
    clearInterval(mockTimer);
    let score=0,totalScoreable=0;
    activeGroup.questions.forEach(q=>{
        if(q.review&&typeof gradeReading==='function'){
            const result=gradeReading(q,saved[q.id]);
            if(result){totalScoreable+=result.total;score+=result.correct;}
        }else{
            const m=q.metadata||{},key=m.correct_option??m.correct_answer??m.answer??m.key??q.correct_option??q.correct_answer??q.answer??q.key;
            if(key!==undefined&&key!==null&&key!==''){
                totalScoreable++;if(String(saved[q.id]?.a0)===String(key))score++;
            }
        }
    });
    document.querySelector('#feedback').innerHTML=`<div class="notice" style="background:#e8f4fd;border-color:#1877f2"><b>Kết quả Thi Thử:</b> Bạn đạt ${score} / ${totalScoreable} câu có đáp án tự động chấm. Vui lòng xuất bài làm để xem lại các câu tự luận/nói.</div>`;
    mockSubmitted=true;
    document.querySelectorAll('[data-key],#submit-mock,#set-sq,#set-so,#set-mm').forEach(el=>el.disabled=true);
}

function revealAnswers(q){
    const m=q.metadata||{};
    let answers=q.review?.answers;
    if(!answers){
        const key=m.correct_option??m.correct_answer??m.answer??m.key??q.correct_option??q.correct_answer;
        if(key!==undefined&&key!==null&&key!==''){
            const option=(m.options||[]).find(o=>String(o.id)===String(key));
            answers=[option?.text??key];
        }
    }
    document.querySelector('#feedback').innerHTML=answers?`<div class="notice"><b>Đáp án để học</b><ol>${answers.map(a=>`<li>${esc(a)}</li>`).join('')}</ol>${q.review?.explanation?`<div class="explanation">${renderHTML(q.review.explanation)}</div>`:''}<p>Phần này không thay đổi câu trả lời của bạn.</p></div>`:'<div class="notice">Bài này chưa có đáp án để hiển thị.</div>';
    document.querySelectorAll('details.reference-details').forEach(d=>d.open=true);
}

function practice(){
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
        navHTML += `<button data-jump="${i}" class="${i===qi?'active':answered(x)?'done':''}" aria-label="Đến câu ${i+1}">${i+1}</button>`;
    });

    app.innerHTML=`<div class="practice-top"><div><div class="eyebrow">${(info[q.skill]?.name||'THI THỬ').toUpperCase()} · PART ${q.part||1}</div><h1>${esc(groupTitle(activeGroup))}</h1></div><a class="secondary" href="${mockTestMode?'#':'#'+q.skill}" style="display:inline-flex; align-items:center; gap:6px; font-size:14px; padding: 8px 16px;"><span>←</span> ${mockTestMode?'Thoát':'Quay lại'}</a></div><div class="workspace"><section class="question-panel"><div style="display:flex;justify-content:space-between;align-items:center"><span class="muted">Câu ${qi+1} / ${activeGroup.questions.length}</span>${mockTestMode?`<strong id="mock-timer" style="color:var(--error);font-variant-numeric:tabular-nums;font-size:24px">${Math.floor(mockTimeLeft/60).toString().padStart(2,'0')}:${(mockTimeLeft%60).toString().padStart(2,'0')}</strong>`:''}</div><h2>${renderHTML(q.title||q.stem)}</h2>${q.title&&q.stem!==q.title?`<p>${renderHTML(q.stem)}</p>`:''}${translateAsyncHTML(q.stem)}<div id="question-body">${questionBody(q)}</div><div id="feedback" aria-live="polite"></div><div class="question-actions"><button id="prev" class="secondary" ${qi===0?'disabled':''}>Câu trước</button>${mockTestMode?`<button id="submit-mock" class="primary">Nộp Bài</button>`:`<button id="check" class="secondary">Kiểm tra bài</button>`}<button id="next" class="primary">${qi===activeGroup.questions.length-1?'Hoàn thành':'Câu tiếp theo  '}</button></div></section><aside class="question-nav"><b style="font-size:14px; color:var(--text-main); display:block; margin-bottom:10px;">Tiến độ luyện tập</b><p class="muted" id="progress-label"></p><progress id="progress" max="${activeGroup.questions.length}"></progress><div class="numbers">${navHTML}</div><div class="settings-panel" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color)"><b>Tùy chỉnh:</b><label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="set-sq" ${userSettings.shuffleQuestions?'checked':''}> Trộn câu (Cần chọn lại bài)</label><label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="set-so" ${userSettings.shuffleOptions?'checked':''}> Đảo đáp án</label><label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="set-mm" ${userSettings.memorizationMode?'checked':''}> Học thuộc lòng (Hiện đáp án)</label></div><p class="muted" style="margin-top:16px;font-size:12px">Câu trả lời tự động lưu trên trình duyệt này.</p><button id="export" class="secondary" style="width:100%;justify-content:center;margin-top:10px;">  Xuất bài làm</button></aside></div>`;
    document.querySelectorAll('[data-key]').forEach(el=>{
        const value=saved[q.id]?.[el.dataset.key];
        if(el.type==='radio')el.checked=value===el.value;else el.value=value||'';
        updateCount(el);
        el.addEventListener('input',()=>{
            saved[q.id]??={};saved[q.id][el.dataset.key]=el.value;persist();updateCount(el);progress();document.querySelector('#feedback').innerHTML='';
        })
    });
    progress();
    document.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{
        if(mockTestMode){qi=Number(el.dataset.jump);practice();}
        else location.hash=`lesson/${activeGroup.id}/${el.dataset.jump}`;
    });
    document.querySelector('#prev').onclick=()=>{
        if(mockTestMode){qi--;practice();}
        else location.hash=`lesson/${activeGroup.id}/${qi-1}`;
    };
    document.querySelector('#next').onclick=()=>{
        if(qi<activeGroup.questions.length-1){
            if(mockTestMode){qi++;practice();}
            else location.hash=`lesson/${activeGroup.id}/${qi+1}`;
        }
        else{
            if(mockTestMode){checkAllMock();return}
            const count=activeGroup.questions.filter(answered).length;
            document.querySelector('#feedback').innerHTML=`<div class="notice">Đã lưu bài luyện tập: ${count}/${activeGroup.questions.length} câu có câu trả lời. Bạn có thể xem lại các câu và xuất bài làm.</div>`;
            toast('Đã kết thúc lượt luyện tập.')
        }
    };
    if(!mockTestMode)document.querySelector('#check').onclick=()=>check(q);
    else document.querySelector('#submit-mock').onclick=()=>checkAllMock();
    document.querySelector('#export').onclick=exportWork;
    if(document.querySelector('#record'))document.querySelector('#record').onclick=record;
    
    ['sq','so','mm'].forEach(k=>{
        const el=document.getElementById('set-'+k);
        if(el)el.onchange=(e)=>{
            userSettings[{'sq':'shuffleQuestions','so':'shuffleOptions','mm':'memorizationMode'}[k]]=e.target.checked;
            persistSettings();
            if(k==='sq')toast('Chọn lại bộ bài để áp dụng Trộn Câu.');
            else practice();
        }
    });
    if(mockTestMode){document.querySelector('#set-mm').disabled=true;document.querySelector('#set-sq').disabled=true;}
    if(mockSubmitted&&mockTestMode)checkAllMock();
    else if(userSettings.memorizationMode&&!mockTestMode)revealAnswers(q);
}

function updateCount(el){
    const count=el.parentElement.querySelector('.count');
    if(count)count.textContent=count.textContent.replace(/^\d+ từ/,`${el.value.trim()?el.value.trim().split(/\s+/).length:0} từ`);
}

function progress(){
    const done=activeGroup.questions.filter(answered).length;
    document.querySelector('#progress-label').textContent=`${done}/${activeGroup.questions.length} câu đã luyện`;
    document.querySelector('#progress').value=done;
    document.querySelectorAll('[data-jump]').forEach(el=>{
        if(Number(el.dataset.jump)!==qi)el.classList.toggle('done',answered(activeGroup.questions[Number(el.dataset.jump)]));
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

function exportWork(){
    const content={
        title:groupTitle(activeGroup),
        exportedAt:new Date().toISOString(),
        questions:activeGroup.questions.map(q=>({id:q.id,part:q.part,title:q.title,question:q.stem,answers:saved[q.id]||{}}))
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`aptis-${activeGroup.skill}-${activeGroup.id}.json`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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

function initMobileMenu() {
    const toggle = document.querySelector('#menu-toggle');
    const close = document.querySelector('#sidebar-close');
    const backdrop = document.querySelector('#sidebar-backdrop');
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const openSidebar = () => {
        sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    };
    const closeSidebar = () => {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
    };

    if (toggle) toggle.onclick = openSidebar;
    if (close) close.onclick = closeSidebar;
    if (backdrop) backdrop.onclick = closeSidebar;

    const nav = document.querySelector('#nav');
    if (nav) nav.addEventListener('click', e => {
        if (e.target.closest('a')) closeSidebar();
    });
}

function initBackupRestore() {
    const backupBtn = document.querySelector('#backup-btn');
    const restoreBtn = document.querySelector('#restore-btn');
    const restoreInput = document.querySelector('#restore-input');

    if (backupBtn) {
        backupBtn.onclick = () => {
            const backupData = {
                app: 'AptisStudio',
                version: 1,
                exportedAt: new Date().toISOString(),
                answers: saved,
                settings: userSettings,
                reviews: (typeof reviewedReading !== 'undefined' ? reviewedReading : {})
            };
            const count = Object.keys(saved).length;
            const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aptis-tien-do-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast(`Đã xuất dữ liệu sao lưu của ${count} câu đã làm.`);
        };
    }

    if (restoreBtn && restoreInput) {
        restoreBtn.onclick = () => restoreInput.click();
        restoreInput.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.answers && typeof data.answers === 'object') {
                        saved = data.answers;
                        localStorage.setItem('aptis-answers', JSON.stringify(saved));
                        if (data.settings) {
                            userSettings = data.settings;
                            localStorage.setItem('aptis-settings', JSON.stringify(userSettings));
                        }
                        if (data.reviews) {
                            localStorage.setItem('aptis-reading-reviews', JSON.stringify(data.reviews));
                            if (typeof reviewedReading !== 'undefined') reviewedReading = data.reviews;
                        }
                        toast(`Khôi phục thành công dữ liệu ${Object.keys(saved).length} câu!`);
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        toast('Tệp tin không đúng định dạng dữ liệu Aptis.');
                    }
                } catch {
                    toast('Không thể đọc tệp sao lưu này.');
                }
            };
            reader.readAsText(file);
            restoreInput.value = '';
        };
    }
}

initMobileMenu();
initBackupRestore();
window.addEventListener('hashchange',route);
route();
