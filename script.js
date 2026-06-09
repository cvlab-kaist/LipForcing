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

  // ---------- VS-baselines sample picker ----------
  const pickButtons = document.querySelectorAll('.vs-pick-btn');
  const gridPanels  = document.querySelectorAll('.vs-grid-panel');
  if(pickButtons.length && gridPanels.length){
    pickButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.dataset.row;
        // Update buttons
        pickButtons.forEach(b => {
          const isActive = b.dataset.row === row;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', String(isActive));
        });
        // Show/hide panels + pause videos in hidden panels
        gridPanels.forEach(p => {
          if(p.dataset.row === row){
            p.removeAttribute('hidden');
          }else{
            p.setAttribute('hidden', '');
            p.querySelectorAll('video').forEach(v => {
              try{ v.pause(); }catch(e){}
            });
          }
        });
        // Hide the magnifier whenever the panel swaps
        if(window.__vsLens) window.__vsLens.classList.remove('visible');
      });
    });
  }

  // ---------- VS-baselines magnifier (loupe) ----------
  // One shared lens element follows the mouse. Inside it, a cloned video
  // mirrors whichever .vs-cell video is currently being hovered, scaled up
  // to give a magnified view of the region under the cursor.
  if(!matchMedia('(hover: none)').matches){
    const LENS = 200;        // lens square size in px
    const ZOOM = 2.5;        // magnification multiplier

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
    document.body.appendChild(lens);
    window.__vsLens = lens;

    lens.style.width  = LENS + 'px';
    lens.style.height = LENS + 'px';

    let currentSrc = '';

    function onMove(e){
      const cell = e.currentTarget;
      const srcVid = cell.querySelector('video');
      if(!srcVid){ lens.classList.remove('visible'); return; }

      const rect = srcVid.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Outside the video area? hide.
      if(x < 0 || y < 0 || x > rect.width || y > rect.height){
        lens.classList.remove('visible');
        return;
      }

      // Match the lens content to the hovered video
      const desiredSrc = srcVid.currentSrc || srcVid.src;
      if(currentSrc !== desiredSrc){
        currentSrc = desiredSrc;
        inner.src = desiredSrc;
      }

      // Mirror play state + currentTime (resync if drift > 0.3s)
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

      // Position lens at the cursor (fixed positioning, no scroll math needed)
      lens.style.transform = `translate(${e.clientX - LENS/2}px, ${e.clientY - LENS/2}px)`;

      // Size the inner video to ZOOM × the source video's displayed size,
      // then translate it so the magnified point matches the cursor
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
  }

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
