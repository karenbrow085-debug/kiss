const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('morrow-assets/magazine-start-v1/magazine-gpu.js','utf8');
function setup(){
 const calls=[],buffers=[];let next=0;
 const gl={};for(const name of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER','STATIC_DRAW','FLOAT','CULL_FACE','DEPTH_TEST','CW','TEXTURE_2D','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','RGBA','UNSIGNED_BYTE','TEXTURE0','TEXTURE1','COLOR_BUFFER_BIT','TRIANGLES','UNSIGNED_SHORT'])gl[name]=++next;
 for(const name of ['createShader','createProgram','createBuffer','createTexture'])gl[name]=()=>({id:++next});
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','useProgram','enableVertexAttribArray','vertexAttribPointer','uniform1i','disable','frontFace','bindTexture','texParameteri','activeTexture','viewport','clearColor','clear','uniform2f','uniform3f','uniform1f','texImage2D','drawElements','deleteTexture','deleteBuffer','deleteProgram','deleteShader'])gl[name]=(...args)=>calls.push({name,args});
 gl.bufferData=(...args)=>buffers.push(args);gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getUniformLocation=(p,n)=>n;gl.getAttribLocation=()=>0;
 const ctx={window:null};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 return {api:ctx.KissPaperSurface,gl,calls,buffers};
}
test('paper uses shared vertices across adjacent triangles and only two surface draws per frame',()=>{
 const s=setup(),surface=s.api.create({width:585,height:1266,getContext:()=>s.gl});assert(surface);
 assert.equal(surface.kind,'webgl-continuous');const vertices=s.buffers[0][1],indices=s.buffers[1][1];
 assert.equal(vertices.length,(64+1)*(8+1)*2);assert.equal(indices.length,64*8*6);
 assert.equal(indices[1],indices[3]);assert.equal(indices[2],indices[5]);
 surface.upload([{}, {}, {}]);assert.equal(s.calls.filter(x=>x.name==='texImage2D').length,3);
 for(const p of [0,.2,.5,.8,1])surface.draw({p,z:{x:.5,y:.25,scale:.5},shadow:.1});
 assert.equal(s.calls.filter(x=>x.name==='drawElements').length,10);assert.equal(s.calls.filter(x=>x.name==='texImage2D').length,3);
 surface.dispose();surface.dispose();assert.equal(s.calls.filter(x=>x.name==='deleteTexture').length,3);assert.equal(s.calls.filter(x=>x.name==='deleteBuffer').length,2);
});
test('unsupported GPU and shader failure leave the whole-page 2D fallback available',()=>{
 const s=setup();assert.equal(s.api.create({getContext:()=>null}),null);
 assert.equal(s.api.create({getContext(){throw Error('not available')}}),null);
 s.gl.getShaderParameter=()=>false;s.gl.getShaderInfoLog=()=> 'compile failed';assert.equal(s.api.create({getContext:()=>s.gl}),null);
});
