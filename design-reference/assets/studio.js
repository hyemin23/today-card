/* ============================================================
   INK. Studio — workspace controller
   ============================================================ */
(function(){
  'use strict';

  /* ---------- card slide rendering (instagram carousel preview) ---------- */
  function slideHTML(kind, title){
    if (kind === 'cover') {
      return `<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#1b1b1a,#1b1b1a 10px,#202020 10px,#202020 20px)"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(17,17,16,.85),rgba(17,17,16,.25) 55%,rgba(17,17,16,.5))"></div>
        <div style="position:absolute;inset:0;padding:22px;display:flex;flex-direction:column;color:#fff">
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.75"><span style="border:1px solid rgba(255,255,255,.4);border-radius:100px;padding:3px 9px">사회</span><span>01 / 05</span></div>
          <div style="margin-top:auto;font-family:var(--serif);font-weight:800;letter-spacing:-.035em;font-size:25px;line-height:1.08">조용하던 도심,<br>다시 붐비기<br>시작했다</div>
          <div style="font-family:var(--mono);font-size:9px;opacity:.6;margin-top:12px">출처 · 도시신문</div>
        </div>`;
    }
    if (kind === 'cta') {
      return `<div style="position:absolute;inset:0;background:#111110"></div>
        <div style="position:absolute;inset:0;padding:22px;display:flex;flex-direction:column;color:#fff">
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.6"><span>05 / 05</span><span>CTA</span></div>
          <div style="margin-top:auto;font-family:var(--serif);font-weight:800;letter-spacing:-.03em;font-size:23px;line-height:1.1">팔로우하고<br>더 보기</div>
          <div style="height:1px;background:rgba(255,255,255,.18);margin:12px 0"></div>
          <div style="font-size:10px;opacity:.7;line-height:1.6">#카드뉴스 #오늘의이슈<br>#INK매거진</div>
          <div style="font-family:var(--mono);font-size:9px;opacity:.55;margin-top:8px">@ink.daily ↗</div>
        </div>`;
    }
    return `<div style="position:absolute;inset:0;background:#fff"></div>
      <div style="position:absolute;inset:0;padding:22px;display:flex;flex-direction:column;color:#111110">
        <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.5"><span>본문</span><span>· / 05</span></div>
        <div style="margin-top:auto;font-family:var(--serif);font-weight:800;letter-spacing:-.03em;font-size:21px;line-height:1.12">${title||''}</div>
        <div style="height:1px;background:rgba(17,17,16,.14);margin:12px 0"></div>
        <div style="font-size:11px;line-height:1.55;color:#4a4945">기사 제목·요약문을 바탕으로 구성된 본문 카드입니다.</div>
        <div style="font-family:var(--mono);font-size:9px;opacity:.55;margin-top:auto">출처 · 도시신문</div>
      </div>`;
  }
  document.querySelectorAll('.cslide').forEach(function(s){
    s.innerHTML = slideHTML(s.dataset.k, s.dataset.t);
  });

  /* ---------- stage switching ---------- */
  var maxReached = 1;
  function setStage(n){
    n = +n;
    document.querySelectorAll('.stage-pane').forEach(function(p, i){ p.classList.toggle('is-active', i === n-1); });
    document.querySelectorAll('.stepc').forEach(function(s){
      var g = +s.dataset.go;
      s.classList.toggle('is-on', g === n);
      s.classList.toggle('is-done', g < n);
      s.setAttribute('aria-disabled', g > maxReached ? 'true' : 'false');
    });
    var wrap = document.querySelector('.stagewrap');
    if (wrap) wrap.scrollTop = 0;
    document.querySelectorAll('.stage-pane').forEach(function(p){ p.scrollTop = 0; });
  }
  function unlock(n){ maxReached = Math.max(maxReached, n); }

  document.addEventListener('click', function(e){
    var go = e.target.closest('[data-go]');
    if (go){
      var n = +go.dataset.go;
      if (go.classList.contains('stepc') && n > maxReached) return; // locked step
      setStage(n);
    }
  });

  /* ---------- tag selection ---------- */
  var sel = new Set();
  var selBox = document.getElementById('selTags');
  function renderTags(){
    selBox.innerHTML = '';
    sel.forEach(function(t){
      var el = document.createElement('span');
      el.className = 'seltag';
      el.innerHTML = t + ' <b>✕</b>';
      el.querySelector('b').onclick = function(){ sel.delete(t); syncPtags(); renderTags(); };
      selBox.appendChild(el);
    });
  }
  function syncPtags(){
    document.querySelectorAll('.ptag').forEach(function(p){ p.classList.toggle('on', sel.has(p.textContent.trim())); });
  }
  document.querySelectorAll('.ptag').forEach(function(p){
    p.addEventListener('click', function(){
      var t = p.textContent.trim();
      if (sel.has(t)) sel.delete(t); else sel.add(t);
      p.classList.toggle('on', sel.has(t));
      renderTags();
    });
  });

  // prefill from landing hero
  var input = document.getElementById('topicInput');
  var heroTopic = sessionStorage.getItem('ink_topic') || new URLSearchParams(location.search).get('q');
  if (heroTopic){ input.value = heroTopic; sessionStorage.removeItem('ink_topic'); }

  /* ---------- crawl ---------- */
  window.startCrawl = function(e){
    if (e) e.preventDefault();
    var topic = input.value.trim();
    var scope = (sel.size ? Array.from(sel).join(' · ') : (topic || '전체'));
    var crawl = document.getElementById('crawl');
    var bar = document.getElementById('crawlBar');
    var count = document.getElementById('crawlCount');
    var msg = document.getElementById('crawlMsg');
    var results = document.getElementById('results');
    var srcs = Array.prototype.slice.call(document.querySelectorAll('#crawlSrcs .crawl__src'));
    document.getElementById('resScope').textContent = scope;
    msg.textContent = '‘' + (topic || Array.from(sel)[0] || '전체') + '’ 관련 기사를 모으는 중…';
    results.classList.add('hidden');
    crawl.classList.add('show');
    srcs.forEach(function(s){ s.classList.remove('hit'); });
    bar.style.width = '0'; var p = 0;
    var iv = setInterval(function(){
      p = Math.min(100, p + Math.random()*16 + 7);
      bar.style.width = p + '%';
      count.textContent = '수집된 기사 ' + Math.round(p/100*24) + '건';
      var hitN = Math.round(p/100*srcs.length);
      srcs.forEach(function(s, i){ if (i < hitN) s.classList.add('hit'); });
      if (p >= 100){
        clearInterval(iv);
        setTimeout(function(){
          crawl.classList.remove('show');
          results.classList.remove('hidden');
        }, 350);
      }
    }, 170);
    return false;
  };

  /* ---------- pick article → generate → stage 2 ---------- */
  document.querySelectorAll('.art').forEach(function(art){
    art.addEventListener('click', function(){
      var parts = (art.dataset.pick || '').split('|');
      var title = parts[0] || '', cat = parts[1] || '', src = parts[2] || '';
      var over = document.getElementById('genover');
      var gm = document.getElementById('genMsg');
      over.classList.add('show');
      var steps = ['기사 핵심을 분석하는 중…','5컷 구성을 짜는 중…','한국어 카피를 다듬는 중…','매거진 톤을 입히는 중…'];
      var k = 0; gm.textContent = steps[0];
      var iv = setInterval(function(){ k++; if (steps[k]) gm.textContent = steps[k]; }, 460);
      setTimeout(function(){
        clearInterval(iv);
        over.classList.remove('show');
        // load picked article into editor cover card
        if (title){
          document.getElementById('cvTitle').innerHTML = title.replace(/, /, ',<br>');
          document.getElementById('th0').textContent = title;
          if (cat) document.getElementById('cvCat').textContent = cat;
          var handle = document.getElementById('magName').dataset.handle || '@ink.daily';
          document.getElementById('cvSrc').textContent = '출처 · ' + (src || '뉴스') + ' · @ink.daily';
        }
        unlock(2); unlock(3);
        setStage(2);
      }, 1900);
    });
  });

  /* ---------- editor: rail / swatches / align ---------- */
  document.getElementById('thumbs').addEventListener('click', function(e){
    var t = e.target.closest('.thumb'); if (!t) return;
    this.querySelectorAll('.thumb').forEach(function(x){ x.classList.remove('is-on'); });
    t.classList.add('is-on');
  });
  document.querySelectorAll('.swrow, .swatches').forEach(function(g){
    g.querySelectorAll('.sw2, .swatch').forEach(function(s){
      s.addEventListener('click', function(){ g.querySelectorAll('.sw2, .swatch').forEach(function(x){ x.classList.remove('on','is-on'); }); s.classList.add(s.classList.contains('swatch') ? 'is-on' : 'on'); });
    });
  });
  document.querySelectorAll('.align').forEach(function(g){
    g.querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ g.querySelectorAll('button').forEach(function(x){ x.classList.remove('on'); }); b.classList.add('on'); }); });
  });

  /* ---------- carousel ---------- */
  var cur = 0; var n = document.querySelectorAll('.cslide').length;
  var dotsBox = document.getElementById('dots');
  for (var i = 0; i < n; i++){ var d = document.createElement('i'); if (i===0) d.className='on'; dotsBox.appendChild(d); }
  window.slide = function(dir){
    cur = (cur + dir + n) % n;
    document.getElementById('track').style.transform = 'translateX(' + (-cur*100) + '%)';
    document.getElementById('csCount').textContent = (cur+1) + '/' + n;
    dotsBox.querySelectorAll('i').forEach(function(x, j){ x.classList.toggle('on', j === cur); });
  };

  /* ---------- copy caption ---------- */
  var copyBtn = document.getElementById('copyCap');
  if (copyBtn) copyBtn.addEventListener('click', function(){
    var cap = document.querySelector('.cap').textContent.trim();
    var hash = document.querySelector('.hashbox').textContent.trim();
    var txt = cap + '\n\n' + hash + '\n\n출처 · 도시신문';
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    var old = copyBtn.innerHTML; copyBtn.innerHTML = '✓ 복사됨';
    setTimeout(function(){ copyBtn.innerHTML = old; }, 1500);
  });

  /* ---------- magazine drawer ---------- */
  var drawer = document.getElementById('drawer'), scrim = document.getElementById('scrim');
  function openD(){ drawer.classList.add('show'); scrim.classList.add('show'); }
  function closeD(){ drawer.classList.remove('show'); scrim.classList.remove('show'); }
  document.getElementById('openDrawer').addEventListener('click', openD);
  document.getElementById('closeDrawer').addEventListener('click', closeD);
  scrim.addEventListener('click', closeD);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeD(); });

  document.querySelectorAll('.mag-card input').forEach(function(r){
    r.addEventListener('change', function(){
      document.querySelectorAll('.mag-card').forEach(function(c){ c.classList.remove('is-active'); });
      r.closest('.mag-card').classList.add('is-active');
    });
  });
  document.getElementById('saveMag').addEventListener('click', function(){
    var active = document.querySelector('.mag-card input:checked');
    if (active){
      document.getElementById('magName').textContent = active.dataset.name;
      document.getElementById('magSw').style.background = active.dataset.color;
    }
    closeD();
  });
})();
