const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(storage=new Map()){
 const handlers=new Map(),classes=new Set(),ball={style:{},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){}},panel={style:{},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){}};
 ball.closest=s=>s==='button'?ball:ball;panel.closest=s=>s==='button'?null:panel;
 const host={clientWidth:374,clientHeight:690},root={querySelector:s=>s==='.mm-ball'?ball:panel,contains:()=>true,classList:{add:s=>classes.add(s),remove:s=>classes.delete(s)},addEventListener:(k,v)=>handlers.set(k,v),removeEventListener:k=>handlers.delete(k)};
 const ctx={window:null,URL,console,performance:{now:()=>10},document:{currentScript:{src:'https://fixture.test/js/modules/kiss-hearu-sky.js'},addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},ResizeObserver:class{constructor(fn){this.fn=fn}observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};ctx.window=ctx;
 let source=fs.readFileSync('js/modules/kiss-hearu-sky.js','utf8').replace('root.KissTogetherSky={run,sync,update};','root.KissTogetherSky={run,sync,update,dragGalaxy};');vm.runInNewContext(source,ctx);
 const drag=ctx.KissTogetherSky.dragGalaxy(root,host);
 const send=(kind,x,y,target=ball)=>handlers.get(kind)?.({pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y,target,cancelable:true,preventDefault(){},stopImmediatePropagation(){}});
 return {drag,ball,panel,host,storage,handlers,classes,send};
}
function xy(el){return el.style.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px/).slice(1).map(Number)}
test('compact galaxy freely drags within the whole phone and restores its released position',()=>{
 const t=setup();t.send('pointerdown',325,400);t.send('pointermove',105,110);t.send('pointerup',105,110);
 const [x,y]=xy(t.ball);assert.ok(x<100&&y<100);assert.ok(t.storage.size);assert.equal(t.classes.has('kt-dragging'),false);
 const restored=setup(t.storage);assert.deepEqual(xy(restored.ball),[x,y]);t.drag.dispose();assert.equal(t.handlers.size,0);
});
test('expanded galaxy clamps to phone boundaries and dragging cannot click a playback action',()=>{
 const t=setup();t.drag.expanded(true);t.send('pointerdown',200,300,t.panel);t.send('pointermove',-600,-900,t.panel);t.send('pointerup',-600,-900,t.panel);assert.deepEqual(xy(t.panel),[4,4]);
 let prevented=false,stopped=false;t.handlers.get('click')({preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});assert.equal(prevented,true);assert.equal(stopped,true);
 t.drag.expanded(false);const [x,y]=xy(t.ball);assert.ok(x>=4&&y>=4);assert.ok(x+78<=374&&y+54<=690);
});
test('tapping a galaxy control without dragging keeps normal click behavior',()=>{
 const t=setup();t.send('pointerdown',300,400);t.send('pointerup',300,400);let blocked=false;t.handlers.get('click')({preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.equal(blocked,false);assert.equal(t.storage.size,0);
});
