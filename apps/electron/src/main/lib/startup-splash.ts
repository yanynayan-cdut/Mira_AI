import { createMiraIntroMarkup, MIRA_INTRO_STYLES } from '../../shared/mira-intro'
import { INTRO_FLUID_FRAGMENT_SHADER, INTRO_FLUID_VERTEX_SHADER } from '../../shared/intro-fluid-shader'

export interface StartupSplashBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 以目标显示器工作区的四分之一尺寸居中生成 Splash 初始 bounds。 */
export function createCenteredStartupSplashBounds(workArea: StartupSplashBounds): StartupSplashBounds {
  const width = Math.max(1, Math.round(workArea.width * 0.25))
  const height = Math.max(1, Math.round(workArea.height * 0.25))
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  }
}

/** 保留原始 WebGL 水纹，并叠加冷启动/重播共用的 Mira 品牌动画。 */
export function createStartupSplashHtml(isDark: boolean, iconUrl = ''): string {
  const background = isDark ? '#0b0b0c' : '#f7f7f5'
  const foreground = isDark ? '#f3f3f3' : '#101114'
  const muted = isDark ? 'rgba(243,243,243,.28)' : 'rgba(16,17,20,.46)'
  const vertex = JSON.stringify(INTRO_FLUID_VERTEX_SHADER)
  const fragment = JSON.stringify(INTRO_FLUID_FRAGMENT_SHADER)

  return `<!doctype html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background};color:${foreground};font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;user-select:none;-webkit-user-select:none}
    body{display:grid;place-items:center;-webkit-app-region:drag}.stage{position:relative;width:100vw;height:100vh;display:grid;place-items:center;background:${background};-webkit-app-region:drag}
    #fluid{position:absolute;inset:0;width:100%;height:100%;z-index:0}
    ${MIRA_INTRO_STYLES}
    .mira-intro{--intro-ink:${foreground}}
    .status{position:absolute;z-index:4;bottom:8%;font:10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.32em;text-transform:uppercase;color:${muted}}
  </style></head><body><main class="stage"><canvas id="fluid"></canvas>${createMiraIntroMarkup(iconUrl)}<div class="status">Loading</div></main><script>
  (function(){var c=document.getElementById('fluid'),gl=c.getContext('webgl',{alpha:false,antialias:false}),dark=${isDark ? 'true' : 'false'};if(!gl)return;function shader(type,src){var x=gl.createShader(type);if(!x)return null;gl.shaderSource(x,src);gl.compileShader(x);return gl.getShaderParameter(x,gl.COMPILE_STATUS)?x:null}var v=shader(gl.VERTEX_SHADER,${vertex}),f=shader(gl.FRAGMENT_SHADER,${fragment});if(!v||!f)return;var p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))return;var b=gl.createBuffer(),a=gl.getAttribLocation(p,'aPosition'),time=gl.getUniformLocation(p,'uTime'),res=gl.getUniformLocation(p,'uResolution'),op=gl.getUniformLocation(p,'uOpacity'),seed=gl.getUniformLocation(p,'uSeed'),theme=gl.getUniformLocation(p,'uThemeLight'),continuous=gl.getUniformLocation(p,'uContinuous');if(!b||a<0||!time||!res||!op||!seed||!theme||!continuous)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);var w=1,h=1,started=performance.now(),seedValue=Math.random()*1000;function resize(){var r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5),nw=Math.max(1,Math.round(r.width*d)),nh=Math.max(1,Math.round(r.height*d));if(nw===w&&nh===h)return;w=nw;h=nh;c.width=w;c.height=h}resize();if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(c);addEventListener('resize',resize);function draw(now){var elapsed=now-started;gl.viewport(0,0,w,h);gl.clearColor(dark?.043:.969,dark?.043:.969,dark?.047:.961,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.uniform1f(time,elapsed/625);gl.uniform2f(res,w,h);gl.uniform1f(op,1);gl.uniform1f(seed,seedValue);gl.uniform1f(theme,dark?0:1);gl.uniform1f(continuous,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);requestAnimationFrame(draw)}requestAnimationFrame(draw)})();
  </script></body></html>`
}
