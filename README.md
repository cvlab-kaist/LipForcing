# Lip Forcing — Project Page

Self-contained static site for the Lip Forcing project. No build step. Open
`index.html` directly in a browser.

```
page/
├── index.html         # the page
├── style.css          # hand-written CSS, themed via :root variables
├── script.js          # scroll-spy + progress bar + bibtex copy
├── assets/
│   ├── teaser.png             # hero teaser (from paper teaser_v2.pdf)
│   ├── combined_analysis.png  # CFG fidelity-sync tradeoff figure (motivation)
│   ├── main_arch.png          # architecture overview (method)
│   └── pareto.png             # Pareto frontier (results)
└── videos/
    ├── main_demo.mp4          # YOU FILL — concatenated demo for the top slot
    ├── speed_demo.mp4         # YOU FILL — screen-cap of live frame generation
    ├── qual_ours/             # YOU FILL — Lip Forcing-only qualitative clips
    │   ├── 01.mp4
    │   └── …
    └── vs/                    # YOU FILL — same-input rows vs. baselines
        ├── row1/
        │   ├── input.mp4
        │   ├── wav2lip.mp4
        │   ├── videoretalking.mp4
        │   ├── musetalk.mp4
        │   ├── latentsync.mp4
        │   └── ours.mp4
        ├── row2/…
        └── row3/…
```

## How to fill the video placeholders

### Main demo (top of page)

Place your concatenated demo clip at `videos/main_demo.mp4`. The
`<video>` element already references that path — when the file appears the
striped placeholder overlay vanishes automatically.

To regenerate the overlay style after deletion, edit `index.html` and add
`data-empty="true"` back to the `.video-hero` element.

### Qualitative — ours only (6 slots)

Drop 6 MP4s into `videos/qual_ours/` and replace each placeholder figure in
`#qual-ours-grid` with:

```html
<figure class="video-frame">
  <video src="videos/qual_ours/01.mp4" controls preload="metadata" muted loop playsinline></video>
  <figcaption>Caption here</figcaption>
</figure>
```

### Comparison vs. baselines (3 rows × 5 methods + input)

For each row, replace the placeholder figures with `<video>` elements:

```html
<figure class="video-frame vs-input">
  <video src="videos/vs/row1/input.mp4" controls preload="metadata" muted loop playsinline></video>
</figure>
<figure class="video-frame">
  <video src="videos/vs/row1/wav2lip.mp4" controls preload="metadata" muted loop playsinline></video>
</figure>
…
<figure class="video-frame vs-cell-ours">
  <video src="videos/vs/row1/ours.mp4" controls preload="metadata" muted loop playsinline></video>
</figure>
```

## How to serve locally

Open `index.html` directly — works as a `file://` page. If you want a local
server (some browsers block local file fetch for video metadata):

```bash
cd page
python3 -m http.server 8080
# then open http://localhost:8080
```

## How to customize the look

All colors and spacing live in CSS variables at the top of `style.css`:

```css
:root{
  --accent:        #6E45E2;
  --accent-strong: #5733C9;
  --accent-cyan:   #22B8CF;
  --content-max:   1180px;
  /* … */
}
```

Tweak those and the rest of the page recolors automatically.
