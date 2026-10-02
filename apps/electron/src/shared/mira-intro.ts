/** 冷启动和可重播开场共用的品牌动画；WebGL 水纹仍由各入口绘制。 */
export const MIRA_INTRO_DURATION_MS = 3000
export const MIRA_STARTUP_MIN_MS = MIRA_INTRO_DURATION_MS + 250

/** 原图三段之间的透明间隙分别位于 x+y=790/1390（源图 1080×1080）。 */
export const MIRA_INTRO_STYLES = `
  .mira-intro {
    --intro-duration: var(--mira-intro-duration, ${MIRA_INTRO_DURATION_MS}ms);
    --intro-ink: #f4f5f7;
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    font-size: clamp(28px, min(12vw, 23vh), 100px);
    font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .mira-lockup {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    display: flex; align-items: center; gap: .26em; width: 3.92em; height: 1.5em;
  }
  .mira-mark { position: relative; flex: 0 0 1.5em; width: 1.5em; height: 1.5em; }
  .mira-piece { position: absolute; inset: 0; opacity: 0; transform-origin: center;
    animation: mira-assemble var(--intro-duration) both;
    --turn: -105deg; --lift: -.22em; --stretch-x: .35; --stretch-y: .68;
  }
  .mira-piece img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .mira-piece-top { --turn: -135deg; --lift: -.3em; }
  .mira-piece-top img { clip-path: polygon(0 0, 73.148148% 0, 0 73.148148%); }
  .mira-piece-middle { animation-delay: calc(var(--intro-duration) * .025); --turn: 100deg; --lift: .08em; --stretch-x: .7; --stretch-y: .3; }
  .mira-piece-middle img { clip-path: polygon(73.148148% 0, 100% 0, 100% 28.703704%, 28.703704% 100%, 0 100%, 0 73.148148%); }
  .mira-piece-bottom { animation-delay: calc(var(--intro-duration) * .05); --turn: -155deg; --lift: .3em; }
  .mira-piece-bottom img { clip-path: polygon(100% 28.703704%, 100% 100%, 28.703704% 100%); }
  /* 只裁左侧出场边界，给斜体字形和果冻回弹留出右侧空间，布局宽度保持不变。 */
  .mira-word-reveal { flex: 0 0 2.16em; overflow: visible; clip-path: inset(-.3em -1em -.3em 0); padding-block: .24em; }
  .mira-word { display: flex; align-items: baseline; margin: 0; font-size: 1em; line-height: 1.15;
    font-weight: 600; font-style: italic; letter-spacing: -.055em; color: var(--intro-ink);
  }
  .mira-letter { display: inline-block; opacity: 0; transform-origin: 50% 65%;
    animation: mira-jelly var(--intro-duration) both; --origin-x: -.7em;
  }
  .mira-letter:nth-child(2) { --origin-x: -1em; animation-delay: calc(var(--intro-duration) * .02); }
  .mira-letter:nth-child(3) { --origin-x: -1.3em; animation-delay: calc(var(--intro-duration) * .04); }
  .mira-letter:nth-child(4) { --origin-x: -1.65em; animation-delay: calc(var(--intro-duration) * .06); }
  .mira-beam-track { position: absolute; left: 50%; top: 50%; z-index: 3;
    animation: mira-beam-shift var(--intro-duration) both; }
  .mira-beam { position: absolute; left: 0; top: -50vh; height: 100vh; width: clamp(2px, .045em, 5px);
    border-radius: 50%; opacity: 0; transform-origin: center;
    background: linear-gradient(180deg, transparent, rgba(255,255,255,.38) 15%, #fff 47%, #fff 53%, rgba(255,255,255,.38) 85%, transparent);
    box-shadow: 0 0 7px #fff, 0 0 22px rgba(255,255,255,.65), 0 0 52px rgba(255,255,255,.25);
    animation: mira-beam-rise var(--intro-duration) both;
  }
  .mira-beam::after { content: ''; position: absolute; left: 50%; top: 50%;
    width: 1.5em; height: 1.5em; transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle, #fff 0%, rgba(255,255,255,.48) 9%, rgba(255,255,255,.08) 30%, transparent 66%);
  }
  @keyframes mira-beam-rise {
    0% { opacity: 0; transform: translate(-50%, 105vh) scaleY(.6); }
    5% { opacity: 1; transform: translate(-50%, 100vh) scaleY(.7); animation-timing-function: cubic-bezier(.15,.8,.25,1); }
    18%, 39% { opacity: 1; transform: translate(-50%, 0) scaleY(1); }
    60% { opacity: .7; transform: translate(-50%, 0) scaleY(1); }
    80%, 100% { opacity: 0; transform: translate(-50%, 0) scaleY(.93); }
  }
  @keyframes mira-beam-shift {
    0%, 25% { transform: translateX(0); }
    38%, 100% { transform: translateX(-.34em); }
  }
  @keyframes mira-assemble {
    0%, 35% { opacity: 0; transform: translate(.86em, var(--lift)) rotate(var(--turn)) scale(var(--stretch-x), var(--stretch-y)); }
    39% { opacity: .2; transform: translate(.78em, var(--lift)) rotate(var(--turn)) scale(.4, .65); animation-timing-function: cubic-bezier(.2,.8,.25,1); }
    61% { opacity: 1; transform: translate(-.09em, -.03em) rotate(12deg) scale(1.1, .9); }
    71% { opacity: 1; transform: translate(.035em, .015em) rotate(-5deg) scale(.96, 1.045); }
    83%, 100% { opacity: 1; transform: translate(0, 0) rotate(0) scale(1); }
  }
  @keyframes mira-jelly {
    0%, 39% { opacity: 0; transform: translateX(var(--origin-x)) scale(.65, 1.3) skewX(-14deg); }
    43% { opacity: .3; transform: translateX(var(--origin-x)) scale(.7, 1.22) skewX(-10deg); animation-timing-function: cubic-bezier(.2,.85,.25,1); }
    61% { opacity: 1; transform: translateX(.1em) scale(1.18, .82) skewX(7deg); }
    70% { opacity: 1; transform: translateX(-.05em) scale(.91, 1.13) skewX(-4deg); }
    77% { opacity: 1; transform: translateX(.02em) scale(1.045, .96) skewX(2deg); }
    85%, 100% { opacity: 1; transform: translateX(0) scale(1) skewX(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .mira-piece, .mira-letter { animation: none; opacity: 1; transform: none; }
    .mira-beam-track { display: none; }
  }
`

/** 图片来自打包资源或 Vite import；转义属性，保证同一 DOM 可用于两种入口。 */
export function createMiraIntroMarkup(imageUrl: string): string {
  const src = imageUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const pieces = ['top', 'middle', 'bottom'].map((part) =>
    `<div class="mira-piece mira-piece-${part}"><img src="${src}" alt="" draggable="false" /></div>`,
  ).join('')
  return `<div class="mira-intro" role="img" aria-label="Mira">
    <div class="mira-lockup" aria-hidden="true"><div class="mira-mark">${pieces}</div>
      <div class="mira-word-reveal"><div class="mira-word">${['M', 'i', 'r', 'a'].map((letter) => `<span class="mira-letter">${letter}</span>`).join('')}</div></div>
    </div><div class="mira-beam-track" aria-hidden="true"><div class="mira-beam"></div></div>
  </div>`
}
