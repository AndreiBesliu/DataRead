/**
 * Elemente decorative animate interactive pentru Landing Pages. PUR (compilarea nu atinge Firebase):
 * `compileDecor` produce un <canvas> + <script> inline self-contained (motorul de animație trăiește
 * DOAR aici, în TS) — paginile servite primesc string-ul deja compilat, deci serveLp nu cunoaște
 * motorul. 4 efecte × 4 interacțiuni; respectă prefers-reduced-motion (fallback static). Culoarea
 * implicită = variabila temei --accent (citită la runtime), deci decorul se asortează cu design-ul.
 */

export const LP_DECOR_EFFECTS = ['none', 'dots', 'constellation', 'shapes', 'grid', 'waves', 'bubbles', 'rings'] as const;
export type LpDecorEffect = (typeof LP_DECOR_EFFECTS)[number];

export const LP_DECOR_INTERACTIONS = ['none', 'mouseReact', 'mouseParallax', 'scrollParallax'] as const;
export type LpDecorInteraction = (typeof LP_DECOR_INTERACTIONS)[number];

export interface LpDecor {
  effect: LpDecorEffect;
  interaction: LpDecorInteraction;
  density: number; // 1..100
  speed: number; // 0..100
  size: number; // 1..40 (px de bază)
  color: string; // hex sau '' (= --accent)
  opacity: number; // 0..1
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clampN = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

export function defaultDecor(): LpDecor {
  return { effect: 'none', interaction: 'none', density: 40, speed: 40, size: 3, color: '', opacity: 0.6 };
}

export function coerceToLpDecor(raw: unknown): LpDecor {
  if (!raw || typeof raw !== 'object') return defaultDecor();
  const d = raw as Record<string, unknown>;
  return {
    effect: LP_DECOR_EFFECTS.includes(d.effect as LpDecorEffect) ? (d.effect as LpDecorEffect) : 'none',
    interaction: LP_DECOR_INTERACTIONS.includes(d.interaction as LpDecorInteraction) ? (d.interaction as LpDecorInteraction) : 'none',
    density: clampN(d.density, 1, 100, 40),
    speed: clampN(d.speed, 0, 100, 40),
    size: clampN(d.size, 1, 40, 3),
    color: typeof d.color === 'string' && HEX.test(d.color) ? d.color : '',
    opacity: clampN(d.opacity, 0, 1, 0.6),
  };
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
    'var sf=(C.speed||40)/40,base=C.size||3,op=C.opacity!=null?C.opacity:0.6,eff=C.effect;' +
    'var mx=-9999,my=-9999,scy=0,t=0,P=[],i,raf;' +
    'function rnd(a,b){return a+Math.random()*(b-a);}var SH=["circle","square","tri","diamond","star","ring","hex"];' +
    'if(C.interaction==="mouseReact"||C.interaction==="mouseParallax"){window.addEventListener("mousemove",function(e){var r=el.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;});}' +
    'if(C.interaction==="scrollParallax"){window.addEventListener("scroll",function(){scy=window.scrollY||window.pageYOffset||0;},{passive:true});}' +
    'function build(){P=[];if(eff==="grid"||eff==="waves")return;if(eff==="rings"){var nr=Math.max(3,Math.round((C.density||40)/100*8)),mr=Math.max(W,H)*0.7;for(i=0;i<nr;i++){P.push({r:i/nr*mr,max:mr});}return;}var n=eff==="shapes"?Math.round((C.density||40)/100*40):Math.round((C.density||40)/100*120);n=Math.max(6,n);for(i=0;i<n;i++){P.push({x:Math.random()*W,y:Math.random()*H,vx:rnd(-0.4,0.4)*sf,vy:eff==="bubbles"?-rnd(0.3,1.1)*sf-0.2:rnd(-0.4,0.4)*sf,r:eff==="shapes"?rnd(base*2,base*6):eff==="bubbles"?rnd(base*1.2,base*4):rnd(base*0.6,base*1.7),s:SH[i%SH.length],rot:Math.random()*6.28,vr:rnd(-0.01,0.01)*sf});}}' +
    'build();window.addEventListener("resize",build);' +
    'function px(){return C.interaction==="mouseParallax"&&mx>-9000?(mx-W/2)*0.03:0;}' +
    'function py(){var a=C.interaction==="mouseParallax"&&my>-9000?(my-H/2)*0.03:0;var b=C.interaction==="scrollParallax"?(scy*0.08)%(H+200)-100:0;return a+b;}' +
    'function poly(x,y,r,n){ctx.beginPath();for(var k=0;k<n;k++){var ang=-1.57+k*6.283/n,xx=x+Math.cos(ang)*r,yy=y+Math.sin(ang)*r;if(k)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.closePath();}' +
    'function star(x,y,ro,ri,pts){ctx.beginPath();for(var s=0;s<pts*2;s++){var rad=s%2?ri:ro,a=-1.57+s*3.14159/pts,xx=x+Math.cos(a)*rad,yy=y+Math.sin(a)*rad;if(s)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}ctx.closePath();}' +
    'function draw(){ctx.clearRect(0,0,W,H);ctx.globalAlpha=op;ctx.fillStyle=col;ctx.strokeStyle=col;var ox=px(),oy=py();' +
    'if(eff==="grid"){var gap=Math.max(22,70-(C.density||40)*0.45);for(var gx=-gap;gx<=W+gap;gx+=gap){for(var gy=-gap;gy<=H+gap;gy+=gap){var wob=reduce?0:Math.sin((gx+gy)*0.01+t*0.001*sf)*3;ctx.beginPath();ctx.arc(gx+ox,gy+oy+wob,Math.max(1,base*0.5),0,6.283);ctx.fill();}}ctx.globalAlpha=op*0.35;for(var lx=0;lx<=W;lx+=gap){ctx.beginPath();ctx.moveTo(lx+ox,0);ctx.lineTo(lx+ox,H);ctx.stroke();}return;}' +
    'if(eff==="waves"){var nw=3+Math.round((C.density||40)/30);for(var w=0;w<nw;w++){var yb=H*(w+1)/(nw+1)+oy,amp=10+base*3;ctx.globalAlpha=op*(0.3+0.5*w/nw);ctx.beginPath();for(var wx=0;wx<=W;wx+=6){var wy=yb+Math.sin(wx*0.012+t*0.002*sf+w*0.9)*amp;if(wx)ctx.lineTo(wx+ox,wy);else ctx.moveTo(wx+ox,wy);}ctx.stroke();}return;}' +
    'if(eff==="rings"){var rcx=(C.interaction==="mouseReact"&&mx>-9000?mx:W/2),rcy=(C.interaction==="mouseReact"&&my>-9000?my:H/2);for(i=0;i<P.length;i++){var rr=P[i].r;ctx.globalAlpha=op*Math.max(0,1-rr/P[i].max);ctx.beginPath();ctx.arc(rcx+ox,rcy+oy,rr,0,6.283);ctx.stroke();}return;}' +
    'if(eff==="bubbles"){for(i=0;i<P.length;i++){var bp=P[i];ctx.globalAlpha=op*0.7;ctx.beginPath();ctx.arc(bp.x+ox,bp.y+oy,bp.r,0,6.283);ctx.stroke();}return;}' +
    'for(i=0;i<P.length;i++){var p=P[i],dx=p.x+ox,dy=p.y+oy;if(eff==="shapes"){ctx.save();ctx.translate(dx,dy);ctx.rotate(p.rot);ctx.beginPath();var st=false;if(p.s==="circle"){ctx.arc(0,0,p.r,0,6.283);}else if(p.s==="ring"){ctx.arc(0,0,p.r,0,6.283);st=true;}else if(p.s==="square"){ctx.rect(-p.r,-p.r,p.r*2,p.r*2);}else if(p.s==="diamond"){poly(0,0,p.r,4);}else if(p.s==="hex"){poly(0,0,p.r,6);}else if(p.s==="star"){star(0,0,p.r,p.r*0.45,5);}else{poly(0,0,p.r,3);}if(st)ctx.stroke();else ctx.fill();ctx.restore();}else{ctx.beginPath();ctx.arc(dx,dy,p.r,0,6.283);ctx.fill();}}' +
    'if(eff==="constellation"){var D=120;for(i=0;i<P.length;i++){for(var j=i+1;j<P.length;j++){var a=P[i],b2=P[j],d2=(a.x-b2.x)*(a.x-b2.x)+(a.y-b2.y)*(a.y-b2.y);if(d2<D*D){ctx.globalAlpha=op*0.5*(1-Math.sqrt(d2)/D);ctx.beginPath();ctx.moveTo(a.x+ox,a.y+oy);ctx.lineTo(b2.x+ox,b2.y+oy);ctx.stroke();}}}if(mx>-9000){for(i=0;i<P.length;i++){var pp=P[i],dm=(pp.x-mx)*(pp.x-mx)+(pp.y-my)*(pp.y-my);if(dm<170*170){ctx.globalAlpha=op*0.6*(1-Math.sqrt(dm)/170);ctx.beginPath();ctx.moveTo(pp.x+ox,pp.y+oy);ctx.lineTo(mx,my);ctx.stroke();}}}}}' +
    'function step(){t+=16;if(eff==="rings"){for(i=0;i<P.length;i++){P[i].r+=0.5*sf+0.4;if(P[i].r>P[i].max)P[i].r=0;}return;}for(i=0;i<P.length;i++){var p=P[i];p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;if(eff==="bubbles"){if(p.y<-p.r-6){p.y=H+p.r+6;p.x=Math.random()*W;}}else{if(p.x<-12)p.x=W+12;if(p.x>W+12)p.x=-12;if(p.y<-12)p.y=H+12;if(p.y>H+12)p.y=-12;}if(C.interaction==="mouseReact"&&mx>-9000){var ddx=p.x-mx,ddy=p.y-my,dd=ddx*ddx+ddy*ddy;if(dd<120*120&&dd>0.5){var dist=Math.sqrt(dd),f=(1-dist/120)*2.4;p.x+=ddx/dist*f;p.y+=ddy/dist*f;}}}}' +
    'function loop(){step();draw();raf=window.requestAnimationFrame(loop);}' +
    'if(reduce){draw();}else{loop();}' +
    '})();'
  );
}

/** Compilează un decor în markup self-contained (canvas + script). '' dacă effect==='none'. */
export function compileDecor(decor: LpDecor, id: string, mode: 'page' | 'block'): string {
  if (!decor || decor.effect === 'none') return '';
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '') || 'x';
  const cfg = JSON.stringify({
    effect: decor.effect,
    interaction: decor.interaction,
    density: decor.density,
    speed: decor.speed,
    size: decor.size,
    color: decor.color,
    opacity: decor.opacity,
  }).replace(/</g, '\\u003c');
  const pos = mode === 'page'
    ? 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden'
    : 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden';
  return `<div id="lpd-${safeId}" style="${pos}"><canvas style="display:block;width:100%;height:100%"></canvas></div><script>${decorEngine(safeId, cfg)}</script>`;
}
