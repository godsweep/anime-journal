const PUBLIC_SITE=document.documentElement.dataset.publicSite==='true';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={data:null,group:'all',search:'',grade:'all',sort:'recommendation',view:'cards',profile:'profile',recordsSearch:''};
const names={home:'手记首页',library:'番剧书架',reports:'每周来信',records:'观看记录',profile:'偏好与来源',doc:'手记阅读'};
let toastTimer,loadSequence=0;
function route(){const [view='home',...rest]=location.hash.slice(1).split('/');let id='';try{id=decodeURIComponent(rest.join('/'));}catch{}return {view:names[view]?view:'home',id};}
function docURL(id){return '#doc/'+encodeURIComponent(id);}
function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function external(url,label){const safe=safeURL(url);return safe?`<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:esc(label);}
function inline(text){
 const tokens=String(text).split(/(`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*)/g);
 return tokens.map(t=>{
  if(t.startsWith('`')&&t.endsWith('`'))return `<code>${esc(t.slice(1,-1))}</code>`;
  if(t.startsWith('[[')&&t.endsWith(']]')){const [name,label]=t.slice(2,-2).split('|');const doc=state.data?.docs.find(d=>d.name===name||d.id===name);return doc?`<a href="${docURL(doc.id)}">${esc(label||doc.title)}</a>`:`<span class="broken-link">${esc(label||name)}</span>`;}
  const m=t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);if(m)return external(m[2],m[1]);
  if(t.startsWith('**')&&t.endsWith('**'))return `<strong>${esc(t.slice(2,-2))}</strong>`;
  return esc(t).replace(/&lt;br\s*\/?&gt;/gi,'<br>');
 }).join('');
}
function markdown(body){
 const lines=String(body).replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/);let html='',i=0;
 const isTableSeparator=l=>/^\s*\|[\s:|\-]+\|\s*$/.test(l??'');
 const row=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(x=>inline(x.trim().replace(/\\\|/g,'|').replace(/&#10;/g,'\n').replace(/&#124;/g,'|').replace(/&#92;/g,'\\').replace(/&amp;/g,'&')));
 while(i<lines.length){
  const line=lines[i];if(!line.trim()){i++;continue;}
  if(line.startsWith('```')){let code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;html+=`<pre><code>${esc(code.join('\n'))}</code></pre>`;continue;}
  if(line.trim().startsWith('|')&&isTableSeparator(lines[i+1])){const headers=row(line);i+=2;let rows='';while(i<lines.length&&lines[i].trim().startsWith('|')){rows+=`<tr>${row(lines[i++]).map(c=>`<td>${c}</td>`).join('')}</tr>`;}html+=`<div class="table-wrap"><table><thead><tr>${headers.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;continue;}
  const h=line.match(/^(#{1,4}) (.+)$/);if(h){html+=`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;i++;continue;}
  if(/^---+$/.test(line.trim())){html+='<hr>';i++;continue;}
  if(/^> ?/.test(line)){const parts=[];while(i<lines.length&&/^> ?/.test(lines[i]))parts.push(inline(lines[i++].replace(/^> ?/,'')));html+=`<blockquote>${parts.join('<br>')}</blockquote>`;continue;}
  if(/^\s*(?:[-*] |\d+\. )/.test(line)){const ordered=/^\s*\d+\. /.test(line),parts=[];while(i<lines.length&&new RegExp(ordered?'^\\s*\\d+\\. ':'^\\s*[-*] ').test(lines[i]))parts.push(`<li>${inline(lines[i++].replace(/^\s*(?:[-*] |\d+\. )/,''))}</li>`);html+=`<${ordered?'ol':'ul'}>${parts.join('')}</${ordered?'ol':'ul'}>`;continue;}
  const paragraph=[inline(line)];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4} |>|```|[-*] |\d+\. |\|)/.test(lines[i]))paragraph.push(inline(lines[i++]));html+=`<p>${paragraph.join('<br>')}</p>`;
 }
 return html;
}
const score=value=>/^\s*(\d+(?:\.\d+)?)(?:\s|\/|$)/.exec(value??'')?.[1]??'';
const grade=item=>/^[ABCD]/.exec(item.recommendation)?.[0]??'待判断';
const numericScore=value=>score(value)===''?-1:Number(score(value));
const year=item=>item.year||item.date?.match(/\d{4}/)?.[0]||'';
const indexOf=item=>state.data.library.indexOf(item);
function art(item,i,kind='book-art'){const letters=item.title.replace(/第[一二三四五六七八九十]+季|第一季|\s/g,'').slice(0,2);return `<div class="${kind} art-${i%4}" aria-hidden="true"><b>${esc(letters)}</b><i>ANIME JOURNAL / ${esc(year(item))}</i></div>`;}
function pageTop(english,title,subtitle,action=''){return `<div class="page-top"><div><span class="eyebrow">${english}</span><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;}
function rail(){const n=state.data.records.length;return `<aside class="rail">
 <section class="rail-card"><div class="rail-label">ABOUT MY TASTE / 我的偏好</div><div class="sprout" aria-hidden="true">♧</div><h3>${n?'每个记录，都是线索':'口味，正在慢慢生长'}</h3><p>${n?`已收集 ${n} 部真实记录。你的分数和原话会成为下一次推荐的依据。`:'还没有观看记录。记下喜欢的故事，也记下不喜欢的理由，推荐才会慢慢像你。'}</p><div class="profile-progress"><span></span></div><p class="rail-small">${n} 部真实记录 · ${n?'偏好分析见画像笔记':'个人匹配待学习'}</p><a class="text-link" href="#profile">看看我的偏好 <span>↗</span></a></section>
 <section class="rail-card"><div class="rail-label">WEEKLY LETTER / 周末来信</div><div class="schedule"><span>每周六</span><strong>15:00</strong></div><p>新番近况、值得补的好故事，<br>还有推荐改变的理由。</p><div class="rail-divider"></div><p class="rail-small">北京时间 · 沿用现有周更任务<br>外部资料更新后，会同步到这里。</p><a class="text-link" href="#reports">翻翻往期来信 <span>↗</span></a></section>
 <section class="rail-card"><div class="rail-label">VOICES I FOLLOW / 参考来源</div><div class="source-row"><span><b class="source-avatar">泛</b>泛式</span><small>固定参考</small></div><div class="source-row"><span><b class="source-avatar">瓶</b>瓶子君152</span><small>固定参考</small></div><div class="rail-divider"></div><p>Bangumi · bgm.tv 评分与讨论</p><p class="rail-foot">补充：尕丶天堂、中二电波台。<br>UP 观点只在读到原视频后收录。</p><a class="text-link" href="#profile/sources">查看核验状态 <span>↗</span></a></section>
 <div class="quote-card"><blockquote>“不急着看完，<br>先好好喜欢。”</blockquote><small>A LITTLE NOTE FOR MYSELF</small></div>
 </aside>`;}
function reportCard(report){const date=report.date||'日期待补',d=date.split('-');return `<a class="report-card" href="${docURL(report.id)}"><div class="date-tile"><strong>${esc(d[2]||'—')}</strong><span>${esc(d.slice(0,2).join('.'))}</span></div><div><span class="badge ${report.baseline?'clay':''}">${report.baseline?'初始化基线':'每周追番周报'}</span><h3>${esc(report.title)}</h3><p>${esc(report.excerpt.slice(0,105))}${report.excerpt.length>105?'…':''}</p><span class="text-link">打开这封来信 <span>↗</span></span></div></a>`;}
function home(){const d=state.data,picks=d.library.filter(item=>grade(item)==='A').slice(0,3);return `${pageTop('SLOW STORIES, GOOD DAYS','我的追番手记','把看过的、想看的，和那些忘不掉的故事收在这里。','<button class="button primary" data-action="record">记一部番 <span>＋</span></button>')}
 <div class="home-grid"><div class="main-column"><section class="hero"><img src="./landscape.svg" alt="秋日山野插画"><div class="hero-copy"><span class="eyebrow">${esc(d.quarter||'2026 秋季')} · A NEW CHAPTER</span><h2>故事有新章，<br>喜欢有回响。</h2><p>在新一季的故事里，<br>找一点期待，也留一点自己的感受。</p><a class="button primary" href="#library">去逛逛番剧书架 <span>↗</span></a></div><div class="season-stamp" aria-hidden="true">秋<small>2026</small></div><span class="hero-caption">STORIES BETWEEN THE SEASONS</span></section>
 <div class="stats"><div class="stat"><strong>${d.library.length}</strong><span class="unit">部</span><p>书架里的候选</p></div><div class="stat"><strong>${d.records.length}</strong><span class="unit">部</span><p>我的真实观看记录</p></div><div class="stat"><strong>${d.reports.length.toString().padStart(2,'0')}</strong><span class="unit">封</span><p>收进档案的来信</p></div></div>
 <div class="section-head"><h2>最近一封来信<span>Weekly letter</span></h2><a class="text-link" href="#reports">全部来信 ↗</a></div>${d.reports[0]?reportCard(d.reports[0]):'<div class="empty-record"><p>第一封来信还在路上。</p></div>'}
 <div class="section-head"><h2>先从这几部开始<span>On the shelf</span></h2><a class="text-link" href="#library">完整书架 ↗</a></div><div class="home-picks">${picks.map((item,i)=>`<button class="pick-card" data-action="detail" data-index="${indexOf(item)}">${art(item,i)}<div class="pick-body"><h3>${esc(item.title)}</h3><p>${esc(item.genres)}</p><div class="pick-meta"><span>A · 优先考虑</span><b>我的分 ${esc(item.personal)}</b></div></div></button>`).join('')}</div><p class="home-note">暂按通用口味推荐 · 个人匹配待学习 · 社区评分来源在详情中分列</p>
 <div class="section-head"><h2>留一点观后感<span>Watching notes</span></h2></div><div class="empty-record"><div><h3>${d.records.length?'最近看过什么？':'第一篇观看记录，从你开始'}</h3><p>一句喜欢，一句不喜欢，都值得记下来。</p></div><button class="button light small" data-action="record">写一笔 ＋</button></div>
 </div>${rail()}</div>`;}
function library(){return `${pageTop('THE ANIME SHELF','番剧书架','2000 年后的日本动画 · 当季新番与较近年份的补番候选','<button class="button primary" data-action="record">记一部番 ＋</button>')}
 <div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="library-search" type="search" placeholder="搜索番名、类型或推荐理由" aria-label="搜索书架" value="${esc(state.search)}"></label><div class="filters" aria-label="筛选范围">${[['all','全部'],['season','当季关注'],['archive','补番候选']].map(([v,l])=>`<button class="chip" data-action="group" data-value="${v}" aria-pressed="${state.group===v}">${l}</button>`).join('')}</div><label class="select-control">推荐<select id="grade-filter">${[['all','全部等级'],['A','A · 优先考虑'],['B','B · 可以试'],['C','C · 先观望'],['D','D · 不推荐']].map(([v,l])=>`<option value="${v}" ${state.grade===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="select-control">排序<select id="sort-filter">${[['recommendation','推荐程度'],['year','年份较新'],['bangumi','Bangumi 分'],['bilibili','B站社区分'],['personal','我的评分']].map(([v,l])=>`<option value="${v}" ${state.sort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
 <div class="results-line"><span id="library-count"></span><div class="view-toggle">${[['cards','卡片'],['table','总表']].map(([v,l])=>`<button class="chip" data-action="view" data-value="${v}" aria-pressed="${state.view===v}">${l}</button>`).join('')}</div></div><div id="library-results"></div>
 <p class="home-note">评分为笔记中的采集快照；两站分数分开保留。待核验不会计作 0 分。点击番名查看人数、采集时间与完整说明。</p>
 <details class="discovery"><summary>本季发现目录 · ${state.data.discovery.length} 条（发现条目不等于推荐）</summary><p>以下来自原本季番单，只作发现入口；未逐一核验，也未全部加入推荐书架。</p><div class="table-wrap"><table><thead><tr><th>首播（北京）</th><th>中文名</th><th>原名</th><th>资料入口</th></tr></thead><tbody>${state.data.discovery.map(item=>`<tr><td>${esc(item.date)}</td><td>${esc(item.title)}</td><td>${esc(item.original)}</td><td>${item.url?external(item.url,'来源'):'待补'}</td></tr>`).join('')}</tbody></table></div></details>`;}
function filterLibrary(){let items=state.data.library.filter(item=>(state.group==='all'||item.group===state.group)&&(state.grade==='all'||grade(item)===state.grade)&&`${item.title} ${item.genres} ${item.reason}`.toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));items.sort((a,b)=>state.sort==='recommendation'?(grade(a).localeCompare(grade(b),'en')):state.sort==='year'?Number(year(b))-Number(year(a)):(numericScore(b[state.sort])-numericScore(a[state.sort])));return items;}
function updateLibrary(){
 const result=$('#library-results');if(!result)return;
 const items=filterLibrary();$('#library-count').textContent=`${items.length} 部 / 共 ${state.data.library.length} 部 · 推荐为暂定通用建议`;
 if(!items.length){result.innerHTML='<div class="empty-state"><h2>这层书架暂时空着</h2><p>换个关键词或筛选条件，再找找看。</p><button class="button" data-action="reset-filters">清空筛选</button></div>';return;}
 if(state.view==='table'){result.innerHTML=`<div class="table-wrap"><table class="library-table"><thead><tr><th>番剧 / 年份</th><th>类型概括</th><th>Bangumi</th><th>B站社区分</th><th>我的分</th><th>推荐程度 / 个人匹配</th><th>记录</th></tr></thead><tbody>${items.map(item=>`<tr><td><button class="title-button" data-action="detail" data-index="${indexOf(item)}">${esc(item.title)}</button><p class="muted">${esc(year(item))} · ${item.group==='season'?'当季':'补番'}</p></td><td>${esc(item.genres)}</td><td>${esc(item.bangumi)}</td><td>${esc(item.bilibili)}</td><td>${esc(item.personal)}</td><td>${esc(item.recommendation)}<p class="muted">${esc(item.match)}</p></td><td><button class="button small" data-action="record" data-index="${indexOf(item)}">记一笔</button></td></tr>`).join('')}</tbody></table></div>`;return;}
 result.innerHTML=`<div class="library-grid">${items.map(item=>`<article class="library-card"><button class="library-cover" data-action="detail" data-index="${indexOf(item)}" aria-label="查看${esc(item.title)}详情"><span class="cover-label">${item.group==='season'?'当季关注':'补番候选'} · ${esc(year(item))}</span>${art(item,indexOf(item))}</button><div class="library-info"><button class="title-button" data-action="detail" data-index="${indexOf(item)}">${esc(item.title)}</button><p class="genres">${esc(item.genres)}</p><div class="score-grid">${[['Bangumi',item.bangumi],['B站社区分',item.bilibili],['我的分',item.personal]].map(([label,v])=>`<div><span>${label}</span><strong class="${score(v)?'':'unverified'}">${esc(score(v)||(/^未评/.test(v)?'未评':'待核验'))}</strong></div>`).join('')}</div><p class="recommendation">${esc(item.recommendation)}</p><p class="card-reason">${esc(item.reason)}</p><div class="card-actions"><span class="status-tag">${esc(item.status)}</span><button class="button small" data-action="record" data-index="${indexOf(item)}">记一笔 ＋</button></div></div></article>`).join('')}</div>`;
}
function reports(){return `${pageTop('LETTERS FROM THE WEEKEND','每周来信','每周六下午，把值得关注的变化收进一封信。')}<div class="archive-intro">这里展示已保存的真实周报。初始化基线用于建档；最新资料以每篇正文的采集时间和核验状态为准。</div><div class="year-heading">${esc(state.data.today.slice(0,4))}</div><div class="report-list">${state.data.reports.map(reportCard).join('')||'<div class="empty-state"><h2>还没有来信</h2><p>周报写入笔记后，会自动出现在这里。</p></div>'}</div>`;}
function records(){const items=state.data.records.filter(r=>`${r.title} ${r.liked} ${r.disliked}`.toLowerCase().includes(state.recordsSearch.toLowerCase()));return `${pageTop('MY WATCHING NOTES','观看记录','不只记录看完了什么，也记下为什么喜欢。','<button class="button primary" data-action="record">添加观看记录 ＋</button>')}
 ${state.data.records.length?`<div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="records-search" type="search" value="${esc(state.recordsSearch)}" placeholder="搜索番名或观后感" aria-label="搜索观看记录"></label><span class="muted">${state.data.records.length} 部真实记录</span></div><div class="record-list">${items.map(r=>`<article class="record-item"><header><h3>${esc(r.title)}</h3><button class="button small" data-action="edit-record" data-title="${esc(r.title)}">编辑 ✎</button></header><div class="record-meta"><span class="badge">${esc(r.status)}</span><span>${r.episode!==''?'第 '+esc(r.episode)+' 集':'集数未记'}</span><strong>我的评分 ${esc(r.score)}${score(r.score)?' / 10':''}</strong><span>${esc(r.date)}</span></div><div class="record-thoughts"><div><span>喜欢的点</span><p>${esc(r.liked||'还没写，慢慢补。')}</p></div><div><span>不喜欢的点 / 弃番原因</span><p>${esc(r.disliked||'暂未记录')}</p></div></div></article>`).join('')||'<p class="muted">没有匹配的记录。</p>'}</div>`:`<div class="empty-state"><div class="sprout" aria-hidden="true">✎</div><h2>第一条记录，留给你的故事</h2><p>先写番名就能收录。评分和感受慢慢补，想看、在看、弃番也都能记。书架里的候选不会自动变成你看过的番。</p><button class="button primary" data-action="record">写下第一部 ＋</button></div>`}
 <div class="section-head"><h2>随手写，也可以</h2></div><div class="archive-intro">你仍然可以直接编辑 Obsidian 的观看记录。网页会同步已填写的表格；随手区的原话会保留，等待下次维护时整理。网页保存前会备份原笔记。</div><a class="text-link" href="${docURL(state.data.docs.find(d=>d.kind==='records')?.id||'')}">打开观看笔记全文 ↗</a>`;}
function profile(id){const selected=id==='sources'?'sources':state.profile;state.profile=selected;const doc=state.data.docs.find(d=>d.kind===selected);return `${pageTop('A TASTE OF MY OWN','偏好与来源','让每个判断有来处，让每次推荐更接近自己。')}<div class="tab-bar">${[['profile','我的偏好'],['sources','参考与核验']].map(([v,l])=>`<button class="chip" data-action="profile-tab" data-value="${v}" aria-pressed="${selected===v}">${l}</button>`).join('')}</div><div class="profile-layout"><article class="paper markdown">${doc?markdown(doc.body):'<p>对应笔记暂未找到。</p>'}</article><aside class="rail-card"><div class="rail-label">A FEW GROUND RULES</div><h3>有记录，才有依据</h3><ul class="profile-facts"><li>真实观看样本<b>${state.data.records.length} 部</b></li><li>候选入库<b>${state.data.library.length} 部</b></li><li>年份范围<b>2000 年以后</b></li><li>周更时间<b>周六 15:00</b></li></ul><p>你的分数、Bangumi 分、B站分分别保存。缺失信息保持待核验。</p><div class="rail-divider"></div><p>页面即时同步本地笔记；偏好画像和外部资料由现有维护流程更新。</p><button class="button small" data-action="record">补充我的记录 ＋</button></aside></div>`;}
function documentView(id){const doc=state.data.docs.find(d=>d.id===id);if(!doc)return `<div class="empty-state"><h2>这篇笔记暂时没找到</h2><p>它可能已经改名或移动。可以从首页重新进入。</p><a class="button" href="#home">回到首页</a></div>`;return `<div class="article-toolbar"><a class="text-link" href="${doc.kind==='report'?'#reports':'#home'}">← ${doc.kind==='report'?'返回每周来信':'返回首页'}</a><span class="muted">本地笔记 · ${esc(doc.date)}${state.data.reports.find(r=>r.id===id)?.baseline?' · 初始化基线':''}</span></div><article class="paper markdown">${markdown(doc.body)}</article>`;}
function publicView(){
 document.querySelectorAll('[data-action="record"],[data-action="edit-record"]').forEach(button=>button.remove());
 document.querySelectorAll('.archive-intro').forEach(el=>{if(el.textContent.includes('Obsidian'))el.textContent='作者在本机维护记录，发布后在这里更新。公开版仅供浏览。';});
 document.querySelectorAll('.empty-state p').forEach(el=>{if(el.textContent.includes('先写番名'))el.textContent='作者还没有发布观看记录，之后会在这里补充。';});
 document.querySelectorAll('.empty-record').forEach(el=>el.hidden=true);
}
function render({focus=false}={}){
 if(!state.data)return;const r=route();
 $('#crumb').textContent=names[r.view];document.title=`${names[r.view]} · 番间`;
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===r.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 const views={home,library,reports,records,profile:()=>profile(r.id),doc:()=>documentView(r.id)};
 $('#main').innerHTML=views[r.view]();if(r.view==='library')updateLibrary();if(PUBLIC_SITE)publicView();
 if(focus){$('#main').focus({preventScroll:true});window.scrollTo(0,0);}
}
function showDetail(i){const item=state.data.library[i];if(!item)return;$('#detail-content').innerHTML=`<span class="eyebrow">${item.group==='season'?'THIS SEASON':'FROM THE ARCHIVE'} / ${esc(year(item))}</span><h2>${esc(item.title)}</h2><p class="detail-genres">${esc(item.genres)}</p>${[['Bangumi',item.bangumi],['B站社区分',item.bilibili],['我的分',item.personal],['推荐程度',item.recommendation],['个人匹配',item.match],['首播 / 年份',item.date||item.year],['推荐理由',item.reason]].map(([l,v])=>`<div class="detail-row"><span>${l}</span><p>${esc(v)}</p></div>`).join('')}<p class="detail-note">补番 B站评分采集于 2026-10-17；Bangumi 客户端显示值以记录内的时间说明为准。外部入口需要网络。</p><div class="dialog-actions"><button class="button primary" data-action="record" data-index="${i}">写下我的记录 ＋</button>${safeURL(item.url)?`<a class="button" href="${esc(safeURL(item.url))}" target="_blank" rel="noopener noreferrer">条目来源 ↗</a>`:''}</div>`;$('#detail-dialog').showModal();}
function openRecord(title=''){
 if(PUBLIC_SITE){toast('公开版仅供浏览，作者在本机编辑。');return;}
 const existing=state.data.records.find(r=>r.title===title),form=$('#record-form');form.reset();$('#form-error').textContent='';
 $('#form-title').textContent=existing?'更新观看记录':'记下一部番';
 const values=existing??{title,status:'想看',episode:'',score:'',liked:'',disliked:''};
 for(const name of ['title','status','episode','score','liked','disliked'])form.elements[name].value=name==='score'&&values[name]==='未评'?'':values[name]??'';
 form.elements.title.readOnly=!!existing;
 $('#anime-titles').innerHTML=state.data.library.map(item=>`<option value="${esc(item.title)}"></option>`).join('');
 if($('#detail-dialog').open)$('#detail-dialog').close();$('#record-dialog').showModal();form.elements[existing?'status':'title'].focus();
}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function notice(message){$('#notice').textContent=message;$('#notice').hidden=!message;}
function sync(online,text){$('#sync').classList.toggle('offline',!online);$('#sync').innerHTML=`<i class="dot"></i>${esc(text)}`;}
async function load(){const seq=++loadSequence;try{const response=await fetch(PUBLIC_SITE?'./data.json':'/api/data',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();if(seq!==loadSequence)return;if(PUBLIC_SITE&&state.data?.revision===data.revision){sync(true,'公开手记 · '+data.updated);return;}state.data=data;render();sync(true,(PUBLIC_SITE?'公开手记 · ':'本地笔记已同步 · ')+data.updated);notice('');}catch{sync(false,PUBLIC_SITE?'网络连接中断':'本地连接中断');notice(PUBLIC_SITE?'暂时无法加载，已打开的内容保留。网络恢复后自动重试。':'暂时连不上本地服务。已有内容保留；重新运行启动入口后会自动恢复。');if(!state.data)$('#main').innerHTML='<div class="empty-state"><h2>手记暂时没能打开</h2><p>请检查连接，然后重试。</p><button class="button" data-action="reload">重新连接</button></div>';}}
document.addEventListener('click',event=>{
 const close=event.target.closest('.close-dialog');if(close){close.closest('dialog').close();return;}
 const button=event.target.closest('[data-action]');if(!button)return;const {action,index,value,title}=button.dataset;
 if(action==='detail')showDetail(Number(index));
 if(action==='record')openRecord(index!==undefined?state.data.library[Number(index)]?.title:'');
 if(action==='edit-record')openRecord(title);
 if(action==='group'){state.group=value;document.querySelectorAll('[data-action=group]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.value===value));updateLibrary();}
 if(action==='view'){state.view=value;document.querySelectorAll('[data-action=view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.value===value));updateLibrary();}
 if(action==='reset-filters'){state.search='';state.grade='all';state.group='all';render();}
 if(action==='profile-tab'){state.profile=value;if(location.hash!=='#profile')location.hash='profile';else render();}
 if(action==='reload')load();
});
document.addEventListener('input',event=>{
 if(event.target.id==='library-search'){state.search=event.target.value;updateLibrary();}
 if(event.target.id==='records-search'){const input=event.target,position=input.selectionStart;state.recordsSearch=input.value;render();$('#records-search').focus();$('#records-search').setSelectionRange(position,position);}
});
document.addEventListener('change',event=>{if(event.target.id==='grade-filter'){state.grade=event.target.value;updateLibrary();}if(event.target.id==='sort-filter'){state.sort=event.target.value;updateLibrary();}});
$('#record-form').addEventListener('submit',async event=>{
 event.preventDefault();if(PUBLIC_SITE)return;const form=event.currentTarget;if(!form.reportValidity())return;const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='正在保存…';$('#form-error').textContent='';
 try{const payload=Object.fromEntries(new FormData(form));const response=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json','X-Write-Token':state.data.token},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败，请重试');$('#record-dialog').close();await load();toast(result.message);}catch(error){$('#form-error').textContent=error.message==='Failed to fetch'?'连接中断，尚未确认保存成功，请恢复服务后检查记录。':error.message;}finally{submit.disabled=false;submit.innerHTML='保存记录 <span aria-hidden="true">↗</span>';}
});
window.addEventListener('hashchange',()=>render({focus:true}));
await load();
if(PUBLIC_SITE){setInterval(load,30000);}else{
const events=new EventSource('/api/events');
events.addEventListener('ready',()=>load());
events.addEventListener('change',()=>load());
events.addEventListener('source-error',event=>{notice(JSON.parse(event.data).message);sync(false,'本地笔记读取失败');});
events.onerror=()=>{sync(false,'等待本地服务重连');notice('本地连接暂时中断，已有内容保留。连接恢复后会自动同步。');};

}
