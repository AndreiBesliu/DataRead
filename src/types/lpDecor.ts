/**
 * Elemente decorative animate interactive pentru Landing Pages. PUR (compilarea nu atinge Firebase):
 * `compileDecor` produce un <canvas> + <script> inline self-contained (motorul de animație trăiește
 * DOAR aici, în TS) — paginile servite primesc string-ul deja compilat, deci serveLp nu cunoaște
 * motorul. 4 efecte × 4 interacțiuni; respectă prefers-reduced-motion (fallback static). Culoarea
 * implicită = variabila temei --accent (citită la runtime), deci decorul se asortează cu design-ul.
 */

export const LP_DECOR_EFFECTS = ['none', 'dots', 'constellation', 'shapes', 'grid', 'waves', 'bubbles', 'rings', 'custom'] as const;
export type LpDecorEffect = (typeof LP_DECOR_EFFECTS)[number];

export const LP_DECOR_INTERACTIONS = ['none', 'mouseReact', 'mouseAttract', 'mouseParallax', 'scrollParallax'] as const;
export type LpDecorInteraction = (typeof LP_DECOR_INTERACTIONS)[number];

export interface LpDecor {
  effect: LpDecorEffect;
  interaction: LpDecorInteraction;
  density: number; // 1..100
  speed: number; // 0..100
  size: number; // 1..40 (px de bază)
  color: string; // hex sau '' (= --accent)
  opacity: number; // 0..1
  /** Intensitatea reacției la interacțiune (0..100; 50 = normal) — scalează forța mouse + parallax. */
  intensity: number;
  /** Doar pentru effect 'custom' (plasare liberă): elementele poziționate individual. */
  elements: LpElement[];
}

export const LP_ELEMENT_SHAPES = ['dot', 'circle', 'ring', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'line'] as const;
export type LpElementShape = (typeof LP_ELEMENT_SHAPES)[number];
export const LP_ELEMENT_ANIMS = ['none', 'float', 'pulse', 'spin', 'drift'] as const;
export type LpElementAnim = (typeof LP_ELEMENT_ANIMS)[number];

export interface LpElement {
  id: string;
  shape: LpElementShape;
  x: number; // % 0..100
  y: number; // % 0..100
  size: number; // px
  rotation: number; // grade
  color: string; // hex sau '' (= --accent)
  opacity: number; // 0..1
  anim: LpElementAnim;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clampN = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

export function defaultDecor(): LpDecor {
  return { effect: 'none', interaction: 'none', density: 40, speed: 40, size: 3, color: '', opacity: 0.6, intensity: 50, elements: [] };
}

export function defaultElement(shape: LpElementShape = 'circle'): LpElement {
  return { id: '', shape, x: 50, y: 50, size: 40, rotation: 0, color: '', opacity: 0.85, anim: 'float' };
}

export function coerceElements(raw: unknown): LpElement[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).map((r, i) => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : `e${i}`,
      shape: LP_ELEMENT_SHAPES.includes(o.shape as LpElementShape) ? (o.shape as LpElementShape) : 'circle',
      x: clampN(o.x, 0, 100, 50),
      y: clampN(o.y, 0, 100, 50),
      size: clampN(o.size, 4, 400, 40),
      rotation: clampN(o.rotation, -360, 360, 0),
      color: typeof o.color === 'string' && HEX.test(o.color) ? o.color : '',
      opacity: clampN(o.opacity, 0, 1, 0.85),
      anim: LP_ELEMENT_ANIMS.includes(o.anim as LpElementAnim) ? (o.anim as LpElementAnim) : 'none',
    };
  });
}

export function coerceToLpDecor(raw: unknown): LpDecor {
  if (!raw || typeof raw !== 'object') return defaultDecor();
  const d = raw as Record<string, unknown>;
  const effect = LP_DECOR_EFFECTS.includes(d.effect as LpDecorEffect) ? (d.effect as LpDecorEffect) : 'none';
  let interaction = LP_DECOR_INTERACTIONS.includes(d.interaction as LpDecorInteraction) ? (d.interaction as LpDecorInteraction) : 'none';
  // 'custom' (DOM, plasare liberă) suportă doar parallax — reacțiile de particule (repel/attract) nu se
  // aplică; le normalizăm la 'none' ca select-ul, slider-ul de intensitate și modelul salvat să coincidă.
  if (effect === 'custom' && (interaction === 'mouseReact' || interaction === 'mouseAttract')) interaction = 'none';
  return {
    effect,
    interaction,
    density: clampN(d.density, 1, 100, 40),
    speed: clampN(d.speed, 0, 100, 40),
    size: clampN(d.size, 1, 40, 3),
    color: typeof d.color === 'string' && HEX.test(d.color) ? d.color : '',
    opacity: clampN(d.opacity, 0, 1, 0.6),
    intensity: clampN(d.intensity, 0, 100, 50),
    elements: coerceElements(d.elements),
  };
}

const STAR_PTS = '50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%';
const HEX_PTS = '25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%';
const TRI_PTS = '50% 0%,0% 100%,100% 100%';
const DIA_PTS = '50% 0%,100% 50%,50% 100%,0% 50%';

/** Stilul formei plasate (camelCase — pt. React în editor ȘI serializat la compile). Sursă unică. */
export function elementStyle(el: LpElement): Record<string, string | number> {
  const c = el.color || 'var(--accent)';
  const s: Record<string, string | number> = { width: `${el.size}px`, height: `${el.size}px`, opacity: el.opacity, transform: `rotate(${el.rotation}deg)`, boxSizing: 'border-box' };
  const border = Math.max(2, Math.round(el.size * 0.12));
  switch (el.shape) {
    case 'dot': { const d = `${Math.max(4, Math.round(el.size * 0.4))}px`; s.width = d; s.height = d; s.background = c; s.borderRadius = '50%'; break; }
    case 'circle': s.background = c; s.borderRadius = '50%'; break;
    case 'ring': s.borderRadius = '50%'; s.border = `${border}px solid ${c}`; s.background = 'transparent'; break;
    case 'square': s.background = c; break;
    case 'triangle': s.background = c; s.clipPath = `polygon(${TRI_PTS})`; break;
    case 'diamond': s.background = c; s.clipPath = `polygon(${DIA_PTS})`; break;
    case 'star': s.background = c; s.clipPath = `polygon(${STAR_PTS})`; break;
    case 'hexagon': s.background = c; s.clipPath = `polygon(${HEX_PTS})`; break;
    case 'line': s.height = `${Math.max(2, Math.round(el.size * 0.08))}px`; s.background = c; s.borderRadius = '2px'; break;
  }
  return s;
}

function styleToCss(s: Record<string, string | number>): string {
  return Object.keys(s).map((k) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${s[k]}`).join(';');
}

// Motorul de animație (JS inline, self-contained per instanță). Fără backticks/${} înăuntru —
// se interpolează doar id-ul + configul JSON. Nu conține `</script>`.
function decorEngine(id: string, cfgJson: string): string {
  return (
    '(function(){' +
    "var el=document.getElementById('lpd-" + id + "');if(!el)return;" +
    'var cv=el.querySelector("canvas");if(!cv)return;var ctx=cv.getContext("2d");if(!ctx)return;' +
    'var C=' + cfgJson + ';' +
    'var col=C.color||getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#38bdf8";' +
    'var DPR=Math.min(window.devicePixelRatio||1,2),W=1,H=1;' +
    'function sz(){var r=el.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);}' +
    'sz();window.addEventListener("resize",sz);' +
    'var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;' +
    'var sf=(C.speed||40)/40,base=C.size||3,op=C.opacity!=null?C.opacity:0.6,eff=C.effect,k=(C.intensity!=null?C.intensity:50)/50;' +
    // Scalare responsivă: dimensiunile decorului se raportează la lățimea containerului (REF=1100),
    // ca elementele să se micșoreze/mărească odată cu boxul (mobil↔desktop), nu să rămână fixe în px.
    'var REF=1100;function scl(){return Math.max(0.5,Math.min(1.25,W/REF));}' +
    'var mx=-9999,my=-9999,scy=0,t=0,P=[],i,raf;' +
    'function rnd(a,b){return a+Math.random()*(b-a);}var SH=["circle","square","tri","diamond","star","ring","hex"];' +
    'if(C.interaction==="mouseReact"||C.interaction==="mouseAttract"||C.interaction==="mouseParallax"){window.addEventListener("mousemove",function(e){var r=el.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;});}' +
    'if(C.interaction==="scrollParallax"){window.addEventListener("scroll",function(){scy=window.scrollY||window.pageYOffset||0;},{passive:true});}' +
    'function build(){P=[];if(eff==="grid"||eff==="waves")return;if(eff==="rings"){var nr=Math.max(3,Math.round((C.density||40)/100*8)),mr=Math.max(W,H)*0.7;for(i=0;i<nr;i++){P.push({r:i/nr*mr,max:mr});}return;}var n=eff==="shapes"?Math.round((C.density||40)/100*40):Math.round((C.density||40)/100*120);n=Math.max(6,n);for(i=0;i<n;i++){P.push({x:Math.random()*W,y:Math.random()*H,vx:rnd(-0.4,0.4)*sf,vy:eff==="bubbles"?-rnd(0.3,1.1)*sf-0.2:rnd(-0.4,0.4)*sf,r:(eff==="shapes"?rnd(base*2,base*6):eff==="bubbles"?rnd(base*1.2,base*4):rnd(base*0.6,base*1.7))*scl(),s:SH[i%SH.length],rot:Math.random()*6.28,vr:rnd(-0.01,0.01)*sf});}}' +
    'build();window.addEventListener("resize",build);' +
    // În reduced-motion desenăm o singură dată (fără rAF); sz() golește canvas-ul la resize, deci
    // trebuie să redesenăm explicit la noua dimensiune, altfel decorul static dispare după resize.
    'if(reduce)window.addEventListener("resize",draw);' +
    'function px(){return C.interaction==="mouseParallax"&&mx>-9000?(mx-W/2)*0.03*k:0;}' +
    'function py(){var a=C.interaction==="mouseParallax"&&my>-9000?(my-H/2)*0.03*k:0;var b=C.interaction==="scrollParallax"?(scy*0.08*k)%(H+200)-100:0;return a+b;}' +
    'function poly(x,y,r,n){ctx.beginPath();for(var k=0;k<n;k++){var ang=-1.57+k*6.283/n,xx=x+Math.cos(ang)*r,yy=y+Math.sin(ang)*r;if(k)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.closePath();}' +
    'function star(x,y,ro,ri,pts){ctx.beginPath();for(var s=0;s<pts*2;s++){var rad=s%2?ri:ro,a=-1.57+s*3.14159/pts,xx=x+Math.cos(a)*rad,yy=y+Math.sin(a)*rad;if(s)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.closePath();}' +
    'function draw(){ctx.clearRect(0,0,W,H);ctx.globalAlpha=op;ctx.fillStyle=col;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,scl());var ox=px(),oy=py();' +
    'if(eff==="grid"){var SCg=scl();var gap=Math.max(22,70-(C.density||40)*0.45);for(var gx=-gap;gx<=W+gap;gx+=gap){for(var gy=-gap;gy<=H+gap;gy+=gap){var wob=reduce?0:Math.sin((gx+gy)*0.01+t*0.001*sf)*3*SCg;ctx.beginPath();ctx.arc(gx+ox,gy+oy+wob,Math.max(1,base*0.5*SCg),0,6.283);ctx.fill();}}ctx.globalAlpha=op*0.35;for(var lx=0;lx<=W;lx+=gap){ctx.beginPath();ctx.moveTo(lx+ox,0);ctx.lineTo(lx+ox,H);ctx.stroke();}return;}' +
    'if(eff==="waves"){var nw=3+Math.round((C.density||40)/30);for(var w=0;w<nw;w++){var yb=H*(w+1)/(nw+1)+oy,amp=(10+base*3)*scl();ctx.globalAlpha=op*(0.3+0.5*w/nw);ctx.beginPath();for(var wx=0;wx<=W;wx+=6){var wy=yb+Math.sin(wx*0.012+t*0.002*sf+w*0.9)*amp;if(wx)ctx.lineTo(wx+ox,wy);else ctx.moveTo(wx+ox,wy);}ctx.stroke();}return;}' +
    'if(eff==="rings"){var rcx=(C.interaction==="mouseReact"&&mx>-9000?mx:W/2),rcy=(C.interaction==="mouseReact"&&my>-9000?my:H/2);for(i=0;i<P.length;i++){var rr=P[i].r;ctx.globalAlpha=op*Math.max(0,1-rr/P[i].max);ctx.beginPath();ctx.arc(rcx+ox,rcy+oy,rr,0,6.283);ctx.stroke();}return;}' +
    'if(eff==="bubbles"){for(i=0;i<P.length;i++){var bp=P[i];ctx.globalAlpha=op*0.7;ctx.beginPath();ctx.arc(bp.x+ox,bp.y+oy,bp.r,0,6.283);ctx.stroke();}return;}' +
    'for(i=0;i<P.length;i++){var p=P[i],dx=p.x+ox,dy=p.y+oy;if(eff==="shapes"){ctx.save();ctx.translate(dx,dy);ctx.rotate(p.rot);ctx.beginPath();var st=false;if(p.s==="circle"){ctx.arc(0,0,p.r,0,6.283);}else if(p.s==="ring"){ctx.arc(0,0,p.r,0,6.283);st=true;}else if(p.s==="square"){ctx.rect(-p.r,-p.r,p.r*2,p.r*2);}else if(p.s==="diamond"){poly(0,0,p.r,4);}else if(p.s==="hex"){poly(0,0,p.r,6);}else if(p.s==="star"){star(0,0,p.r,p.r*0.45,5);}else{poly(0,0,p.r,3);}if(st)ctx.stroke();else ctx.fill();ctx.restore();}else{ctx.beginPath();ctx.arc(dx,dy,p.r,0,6.283);ctx.fill();}}' +
    'if(eff==="constellation"){var D=120*scl(),MR=170*scl();for(i=0;i<P.length;i++){for(var j=i+1;j<P.length;j++){var a=P[i],b2=P[j],d2=(a.x-b2.x)*(a.x-b2.x)+(a.y-b2.y)*(a.y-b2.y);if(d2<D*D){ctx.globalAlpha=op*0.5*(1-Math.sqrt(d2)/D);ctx.beginPath();ctx.moveTo(a.x+ox,a.y+oy);ctx.lineTo(b2.x+ox,b2.y+oy);ctx.stroke();}}}if(mx>-9000){for(i=0;i<P.length;i++){var pp=P[i],dm=(pp.x-mx)*(pp.x-mx)+(pp.y-my)*(pp.y-my);if(dm<MR*MR){ctx.globalAlpha=op*0.6*(1-Math.sqrt(dm)/MR);ctx.beginPath();ctx.moveTo(pp.x+ox,pp.y+oy);ctx.lineTo(mx,my);ctx.stroke();}}}}}' +
    'function step(){t+=16;if(eff==="rings"){for(i=0;i<P.length;i++){P[i].r+=0.5*sf+0.4;if(P[i].r>P[i].max)P[i].r=0;}return;}var react=C.interaction==="mouseReact"||C.interaction==="mouseAttract",dir=C.interaction==="mouseAttract"?-1:1,R=Math.max(30,120*k);for(i=0;i<P.length;i++){var p=P[i];p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;if(eff==="bubbles"){if(p.y<-p.r-6){p.y=H+p.r+6;p.x=Math.random()*W;}}else{if(p.x<-12)p.x=W+12;if(p.x>W+12)p.x=-12;if(p.y<-12)p.y=H+12;if(p.y>H+12)p.y=-12;}if(react&&mx>-9000){var ddx=p.x-mx,ddy=p.y-my,dd=ddx*ddx+ddy*ddy;if(dd<R*R&&dd>0.5){var dist=Math.sqrt(dd),f=(1-dist/R)*2.4*k;p.x+=dir*ddx/dist*f;p.y+=dir*ddy/dist*f;}}}}' +
    'function loop(){step();draw();raf=window.requestAnimationFrame(loop);}' +
    'function start(){if(reduce){draw();return;}if(!raf)loop();}function stop(){if(raf){cancelAnimationFrame(raf);raf=null;}}' +
    // Rulează rAF DOAR cât timp decorul e pe ecran (multe blocuri cu decor → altfel multe bucle rAF simultane).
    'if("IntersectionObserver" in window){var io=new IntersectionObserver(function(es){for(var q=0;q<es.length;q++){if(es[q].isIntersecting)start();else stop();}});io.observe(el);}else{start();}' +
    '})();'
  );
}

const LPF_KEYFRAMES =
  '@keyframes lpf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}' +
  '@keyframes lpf-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}' +
  '@keyframes lpf-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
  '@keyframes lpf-drift{0%,100%{transform:translate(0,0)}25%{transform:translate(10px,-8px)}50%{transform:translate(-8px,8px)}75%{transform:translate(8px,10px)}}';
const LPF_CLASSES =
  '.lpf-float{animation:lpf-float 6s ease-in-out infinite}.lpf-pulse{animation:lpf-pulse 4s ease-in-out infinite}' +
  '.lpf-spin{animation:lpf-spin 14s linear infinite}.lpf-drift{animation:lpf-drift 11s ease-in-out infinite}';

/** Plasare liberă (effect 'custom'): elemente DOM poziționate + animații CSS + parallax JS opțional. */
function compileCustomDecor(decor: LpDecor, safeId: string, pos: string): string {
  const els = Array.isArray(decor.elements) ? decor.elements : [];
  if (!els.length) return '';
  const items = els
    .map((el, i) => {
      const animClass = el.anim !== 'none' ? `lpf-${el.anim}` : '';
      const delay = (i % 7) * 0.4;
      // scale(var(--lpf-s,1)) → elementele se micșorează/mărească odată cu containerul (vezi scaleScript).
      return `<div style="position:absolute;left:${el.x}%;top:${el.y}%;transform:translate(-50%,-50%) scale(var(--lpf-s,1))"><div class="${animClass}" style="animation-delay:${delay}s"><div style="${styleToCss(elementStyle(el))}"></div></div></div>`;
    })
    .join('');
  const style = `<style>@media (prefers-reduced-motion: no-preference){${LPF_KEYFRAMES}${LPF_CLASSES}}</style>`;
  const layerId = `lpfl-${safeId}`;
  const k = (decor.intensity != null ? decor.intensity : 50) / 50;
  const mf = (0.04 * k).toFixed(4);
  const sfp = (0.06 * k).toFixed(4);
  let script = '';
  if (decor.interaction === 'mouseParallax') {
    script = `<script>(function(){var L=document.getElementById("${layerId}");if(!L)return;var p=L.parentNode;window.addEventListener("mousemove",function(e){var r=p.getBoundingClientRect();L.style.transform="translate("+((e.clientX-r.left-r.width/2)*${mf})+"px,"+((e.clientY-r.top-r.height/2)*${mf})+"px)";});})();</script>`;
  } else if (decor.interaction === 'scrollParallax') {
    script = `<script>(function(){var L=document.getElementById("${layerId}");if(!L)return;window.addEventListener("scroll",function(){L.style.transform="translateY("+(((window.scrollY||0)*${sfp})%120)+"px)";},{passive:true});})();</script>`;
  }
  // Scalare responsivă: setează --lpf-s = lățime container / REF (1100), recalculat la resize. Independent
  // de parallax (care folosește transform pe layer); scale-ul stă pe variabila CSS moștenită de elemente.
  const scaleScript = `<script>(function(){var L=document.getElementById("${layerId}");if(!L)return;function s(){var w=L.clientWidth||(L.parentNode&&L.parentNode.clientWidth)||1100;L.style.setProperty("--lpf-s",Math.max(0.5,Math.min(1.25,w/1100)).toFixed(3));}s();window.addEventListener("resize",s);})();</script>`;
  return `<div id="lpd-${safeId}" style="${pos}">${style}<div id="${layerId}" style="position:absolute;inset:0;will-change:transform">${items}</div></div>${script}${scaleScript}`;
}

/** Compilează un decor în markup self-contained (canvas/DOM + script). '' dacă effect==='none'. */
export function compileDecor(decor: LpDecor, id: string, mode: 'page' | 'block'): string {
  if (!decor || decor.effect === 'none') return '';
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '') || 'x';
  const pos = mode === 'page'
    ? 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden'
    : 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden';
  if (decor.effect === 'custom') return compileCustomDecor(decor, safeId, pos);
  const cfg = JSON.stringify({
    effect: decor.effect,
    interaction: decor.interaction,
    density: decor.density,
    speed: decor.speed,
    size: decor.size,
    color: decor.color,
    opacity: decor.opacity,
    intensity: decor.intensity,
  }).replace(/</g, '\\u003c');
  return `<div id="lpd-${safeId}" style="${pos}"><canvas style="display:block;width:100%;height:100%"></canvas></div><script>${decorEngine(safeId, cfg)}</script>`;
}
