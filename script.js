// =============================================================================
// Lip Forcing — Project Page Behavior
// - Reading progress bar (top of viewport)
// - Scroll-spy sidebar active-link highlight
// - IntersectionObserver fade-in for figures / sections
// - Copy-to-clipboard for BibTeX
// =============================================================================

(function(){
  'use strict';

  // ---------- Reading-progress bar ----------
  const progress = document.getElementById('progress-bar');
  function updateProgress(){
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    if(total <= 0){ progress.style.width = '0%'; return; }
    const pct = Math.min(100, (window.scrollY / total) * 100);
    progress.style.width = pct.toFixed(1) + '%';
  }
  document.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  // ---------- Sidebar scroll-spy ----------
  const navLinks = Array.from(document.querySelectorAll('.sidebar-nav .nav-link'));
  const navMap = new Map();   // section id → nav-link element
  navLinks.forEach(a => {
    const id = a.getAttribute('href').replace('#','');
    navMap.set(id, a);
  });
  const sections = Array.from(
    new Set(
      navLinks
        .map(a => document.getElementById(a.getAttribute('href').replace('#','')))
        .filter(Boolean)
    )
  );

  function setActive(id){
    navLinks.forEach(a => a.classList.remove('active'));
    if(id && navMap.has(id)){
      navMap.get(id).classList.add('active');
    }
  }

  // IntersectionObserver — track the topmost section in view
  const spyObserver = new IntersectionObserver((entries) => {
    // When we're scrolled near the very top, always show Overview as active
    // (the hero's top edge sits in the observer's negative top-margin band, so
    // it may not fire — fall back to "near top" detection here).
    if(window.scrollY < 80 && sections.length){
      setActive(sections[0].id);
      return;
    }
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if(visible.length){
      setActive(visible[0].target.id);
    }
  }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
  sections.forEach(s => spyObserver.observe(s));

  // Also re-check on every scroll (cheap) so the near-top → Overview rule
  // fires immediately when the user scrolls all the way back up.
  document.addEventListener('scroll', () => {
    if(window.scrollY < 80 && sections.length){
      setActive(sections[0].id);
    }
  }, { passive: true });

  // Initial active: first observed target
  if(sections.length) setActive(sections[0].id);

  // ---------- Video placeholders ----------
  document.querySelectorAll('.video-frame .placeholder-overlay').forEach(overlay => {
    const frame = overlay.closest('.video-frame');
    const video = frame ? frame.querySelector('video') : null;
    if(!frame || !video) return;

    const markReady = () => frame.removeAttribute('data-empty');
    const markEmpty = () => frame.setAttribute('data-empty', 'true');

    if(video.readyState >= 1 && video.currentSrc){
      markReady();
    }
    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('error', markEmpty);
    video.querySelectorAll('source').forEach(source => {
      source.addEventListener('error', markEmpty);
    });
  });

  // ---------- Fade-in on scroll ----------
  const fadeTargets = document.querySelectorAll(
    '.figure-wide, .figure-medium, .num-item, .stat-card, .vs-row, .table-wrap, .tldr, .hero-teaser'
  );
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('fade-in');
        fadeObserver.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  fadeTargets.forEach(t => fadeObserver.observe(t));

  // ---------- VS-baselines testset arrows + sample picker ----------
  // The vs-stage contains 9 panels: 3 testsets × 3 samples. Only the panel
  // matching (currentTestset, currentSample) is visible at any time.
  const TESTSETS = ['talkvid', 'hdtf', 'hallo3'];
  const TESTSET_LABELS = { talkvid: 'TalkVid', hdtf: 'HDTF', hallo3: 'Hallo3' };
  let currentTestset = 'talkvid';
  let currentSample  = '1';

  const pickButtons = document.querySelectorAll('.vs-pick-btn');
  const gridPanels  = document.querySelectorAll('.vs-grid-panel');
  const tsetPrev    = document.getElementById('vs-tset-prev');
  const tsetNext    = document.getElementById('vs-tset-next');
  const tsetName    = document.getElementById('vs-tset-name');
  const capTset     = document.getElementById('vs-cap-tset');

  function showActivePanel(){
    gridPanels.forEach(p => {
      const match = p.dataset.testset === currentTestset
                 && p.dataset.row     === currentSample;
      if(match){
        p.removeAttribute('hidden');
      }else{
        p.setAttribute('hidden', '');
        p.querySelectorAll('video').forEach(v => {
          try{ v.pause(); }catch(e){}
        });
      }
    });
  }

  function updateSampleButtons(){
    pickButtons.forEach(b => {
      const isActive = b.dataset.row === currentSample;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
  }

  function updateTestsetUi(){
    if(tsetName){
      tsetName.classList.add('changing');
      setTimeout(() => {
        tsetName.textContent = TESTSET_LABELS[currentTestset];
        tsetName.classList.remove('changing');
      }, 90);
    }
    if(capTset){
      capTset.textContent = TESTSET_LABELS[currentTestset];
    }
  }

  function cycleTestset(direction){
    const idx = TESTSETS.indexOf(currentTestset);
    const next = TESTSETS[(idx + direction + TESTSETS.length) % TESTSETS.length];
    if(next === currentTestset) return;
    currentTestset = next;
    updateTestsetUi();
    showActivePanel();
  }

  if(tsetPrev) tsetPrev.addEventListener('click', () => cycleTestset(-1));
  if(tsetNext) tsetNext.addEventListener('click', () => cycleTestset(+1));

  pickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.dataset.row;
      if(row === currentSample) return;
      currentSample = row;
      updateSampleButtons();
      showActivePanel();
    });
  });

  // Initial state already matches the markup (TalkVid + Sample 1 visible).

  // ---------- VS-baselines magnifier (toggle-gated, offset, controls-aware) ----------
  // Lens shows a zoomed view of the area UNDER the cursor, but the lens itself
  // sits OFFSET from the cursor (upper-right by default, flipped near viewport
  // edges) so the cursor target stays visible. The lens also dodges the bottom
  // ~50px of the hovered cell so it never covers the video controls strip
  // (play/pause/scrub/mute/fullscreen).
  if(!matchMedia('(hover: none)').matches){
    const LENS    = 220;     // lens side length (px)
    const ZOOM    = 2.5;     // magnification multiplier
    const OFFSET  = 24;      // gap between cursor and the nearest lens edge
    const MARGIN  = 10;      // keep this far from viewport edges
    const CTRL_H  = 50;      // height of the video controls strip (px)

    // Build the lens once
    const lens = document.createElement('div');
    lens.className = 'vs-lens';
    lens.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('video');
    inner.muted = true;
    inner.loop = true;
    inner.playsInline = true;
    inner.preload = 'auto';
    lens.appendChild(inner);
    const badge = document.createElement('span');
    badge.className = 'vs-lens-badge';
    badge.textContent = '×' + ZOOM;
    lens.appendChild(badge);
    lens.style.width  = LENS + 'px';
    lens.style.height = LENS + 'px';
    document.body.appendChild(lens);
    window.__vsLens = lens;

    // Toggle wiring
    const toggle = document.getElementById('vs-zoom-input');
    let enabled = false;
    function setEnabled(on){
      enabled = !!on;
      document.querySelectorAll('.vs-cell').forEach(c => {
        c.classList.toggle('vs-cell-zoomable', enabled);
      });
      if(!enabled){
        lens.classList.remove('visible');
        try{ inner.pause(); }catch(e){}
      }
    }
    if(toggle){
      toggle.addEventListener('change', () => setEnabled(toggle.checked));
    }

    let currentSrc = '';
    let currentSrcVid = null;   // direct reference to whichever .vs-cell video the lens is mirroring

    // Compute lens (x,y) given cursor position + the hovered cell's rect
    function placeLens(cx, cy, cellRect){
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const candidates = [
        // [x, y]  — upper-right, lower-right, upper-left, lower-left of cursor
        [cx + OFFSET,            cy - OFFSET - LENS],
        [cx + OFFSET,            cy + OFFSET],
        [cx - OFFSET - LENS,     cy - OFFSET - LENS],
        [cx - OFFSET - LENS,     cy + OFFSET],
      ];
      // Bottom 50px of the hovered cell holds the video controls — treat as
      // a no-fly zone for the lens rectangle.
      const ctrlTop = cellRect.bottom - CTRL_H;
      function overlapsCtrls(x, y){
        const lensRight  = x + LENS;
        const lensBottom = y + LENS;
        return (lensRight > cellRect.left && x < cellRect.right
                && lensBottom > ctrlTop   && y < cellRect.bottom);
      }
      function inViewport(x, y){
        return x >= MARGIN && y >= MARGIN
            && x + LENS <= vw - MARGIN
            && y + LENS <= vh - MARGIN;
      }
      // Pick the first candidate that's fully in-viewport AND clear of the
      // controls strip.
      for(const [x, y] of candidates){
        if(inViewport(x, y) && !overlapsCtrls(x, y)) return { x, y };
      }
      // Fallback: clamp the first candidate to viewport, then push above the
      // controls strip if it still collides.
      let [x, y] = candidates[0];
      x = Math.max(MARGIN, Math.min(vw - LENS - MARGIN, x));
      y = Math.max(MARGIN, Math.min(vh - LENS - MARGIN, y));
      if(overlapsCtrls(x, y)){
        const lifted = ctrlTop - LENS - 6;
        if(lifted >= MARGIN) y = lifted;
      }
      return { x, y };
    }

    function onMove(e){
      if(!enabled){ lens.classList.remove('visible'); return; }
      const cell = e.currentTarget;
      const srcVid = cell.querySelector('video');
      if(!srcVid){ lens.classList.remove('visible'); return; }
      const rect = srcVid.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if(x < 0 || y < 0 || x > rect.width || y > rect.height){
        lens.classList.remove('visible'); return;
      }
      // Sync source + play state
      const desiredSrc = srcVid.currentSrc || srcVid.src;
      if(currentSrc !== desiredSrc){
        currentSrc = desiredSrc;
        currentSrcVid = srcVid;
        inner.src = desiredSrc;
      }else{
        currentSrcVid = srcVid;
      }
      if(srcVid.paused){
        if(!inner.paused) inner.pause();
        inner.currentTime = srcVid.currentTime;
      }else{
        if(inner.paused){
          inner.currentTime = srcVid.currentTime;
          inner.play().catch(()=>{});
        }
        if(Math.abs(inner.currentTime - srcVid.currentTime) > 0.3){
          inner.currentTime = srcVid.currentTime;
        }
      }
      // Position the lens (offset from cursor, controls-aware)
      const { x: lx, y: ly } = placeLens(e.clientX, e.clientY, cell.getBoundingClientRect());
      lens.style.transform = `translate(${lx}px, ${ly}px)`;
      // Position the inner video so the magnified region matches the cursor
      const w = rect.width  * ZOOM;
      const h = rect.height * ZOOM;
      inner.style.width  = w + 'px';
      inner.style.height = h + 'px';
      inner.style.transform = `translate(${-(x * ZOOM - LENS/2)}px, ${-(y * ZOOM - LENS/2)}px)`;
      lens.classList.add('visible');
    }
    function onLeave(){
      lens.classList.remove('visible');
      try{ inner.pause(); }catch(e){}
    }

    document.querySelectorAll('.vs-cell').forEach(cell => {
      cell.addEventListener('mousemove', onMove);
      cell.addEventListener('mouseleave', onLeave);
    });

    // Mirror the source video's play / pause / seek into the inner lens video
    // EVEN WHEN THE MOUSE IS STILL. Without this, the lens kept playing when
    // the source got paused via the controls without moving the cursor.
    document.querySelectorAll('.vs-cell video').forEach(v => {
      v.addEventListener('pause', () => {
        if(v !== currentSrcVid) return;
        try{ inner.pause(); }catch(e){}
        inner.currentTime = v.currentTime;
      });
      v.addEventListener('play', () => {
        if(v !== currentSrcVid || !enabled) return;
        inner.currentTime = v.currentTime;
        inner.play().catch(()=>{});
      });
      v.addEventListener('seeking', () => {
        if(v !== currentSrcVid) return;
        inner.currentTime = v.currentTime;
      });
    });

    // SAFETY NET: poll every 100ms. If the source paused but the inner
    // somehow kept playing (race condition, missed event, browser quirk),
    // force a pause within a single tick. Cheap — runs only when there's
    // an active source and the toggle is on.
    setInterval(() => {
      if(!enabled || !currentSrcVid) return;
      if(currentSrcVid.paused && !inner.paused){
        try{ inner.pause(); }catch(e){}
      }
    }, 100);
  }

  // ---------- VS-baselines synchronized playback ----------
  // All 6 videos within a single .vs-grid-panel play / pause / seek as one.
  // Each panel is independent so the 3 samples don't bleed into each other.
  // Per-panel `suppress` flag prevents the sync handler from triggering itself.
  gridPanels.forEach(panel => {
    const videos = Array.from(panel.querySelectorAll('video'));
    if(videos.length < 2) return;

    let suppress = false;
    const SEEK_THRESHOLD = 0.15;     // seconds — only resync if drift is real

    function syncOthers(action, src){
      if(suppress) return;
      suppress = true;
      videos.forEach(v => {
        if(v === src) return;
        try{
          if(action === 'play'){
            if(Math.abs(v.currentTime - src.currentTime) > SEEK_THRESHOLD){
              v.currentTime = src.currentTime;
            }
            if(v.paused){ v.play().catch(()=>{}); }
          }else if(action === 'pause'){
            if(!v.paused){ v.pause(); }
          }else if(action === 'seek'){
            if(Math.abs(v.currentTime - src.currentTime) > SEEK_THRESHOLD){
              v.currentTime = src.currentTime;
            }
          }
        }catch(e){}
      });
      // release the lock on the next tick — long enough that the play/pause
      // events fired on the followers don't re-enter syncOthers
      setTimeout(()=>{ suppress = false; }, 40);
    }

    videos.forEach(v => {
      v.addEventListener('play',    () => syncOthers('play',  v));
      v.addEventListener('pause',   () => syncOthers('pause', v));
      v.addEventListener('seeking', () => syncOthers('seek',  v));

      // Audio polish: if the user unmutes one video, mute the rest so we
      // don't get six overlapping audio tracks at once.
      v.addEventListener('volumechange', () => {
        if(v.muted) return;
        videos.forEach(other => { if(other !== v) other.muted = true; });
      });
    });
  });

  // ---------- Copy BibTeX ----------
  const copyBtn = document.getElementById('copy-bib');
  if(copyBtn){
    copyBtn.addEventListener('click', () => {
      const code = copyBtn.parentElement.querySelector('code');
      if(!code) return;
      const text = code.textContent.trim();
      const done = () => {
        copyBtn.classList.add('copied');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = 'Copy';
        }, 1600);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done).catch(() => {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try{ document.execCommand('copy'); done(); } catch(e){}
          document.body.removeChild(ta);
        });
      }
    });
  }
})();
