/* Shared-vertex paper surface: no independently sampled vertical strips. */
(() => {
'use strict';
function create(canvas) {
 let gl;
 try { gl = canvas.getContext('webgl', {alpha:false, antialias:true, depth:false, stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:false}); }
 catch { window.KissPaperSurface.lastError='WebGL context unavailable';return null; }
 if (!gl){window.KissPaperSurface.lastError='WebGL context unavailable';return null;}
 const vertex = `
 attribute vec2 aUV;
 uniform vec2 uSize;
 uniform vec3 uSpread;
 uniform float uProgress;
 uniform mediump float uTurning;
 varying mediump vec2 vUV;
 varying mediump float vAngle;
 void main(){
   vec2 p=aUV;
   float angle=0.0;
   if(uTurning>0.5){
     float t=clamp(uProgress+0.035*sin(3.14159265*uProgress)*(aUV.y-0.5),0.0,1.0);
     float bend=1.12*sin(3.14159265*t);
     float base=3.14159265*t-bend*0.5;
     float x;float z;
     if(abs(bend)<0.00001){x=aUV.x*cos(base);z=aUV.x*sin(base);}
     else{x=(sin(base+bend*aUV.x)-sin(base))/bend;z=(cos(base)-cos(base+bend*aUV.x))/bend;}
     float perspective=4.6/(4.6-z);
     p=vec2(x*perspective,(aUV.y-0.5)*perspective+0.5);
     angle=base+bend*aUV.x;
   }
   p=vec2(uSpread.x,uSpread.y)+p*uSpread.z;
   gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0);
   vUV=aUV;vAngle=angle;
 }`;
 const fragment = `
 precision mediump float;
 uniform sampler2D uFront;
 uniform sampler2D uBack;
 uniform mediump float uTurning;
 uniform float uSpine;
 varying mediump vec2 vUV;
 varying mediump float vAngle;
 void main(){
   vec2 uv=vUV;
   if(uTurning>0.5 && !gl_FrontFacing)uv.x=1.0-uv.x;
   vec4 color=(uTurning<0.5 || gl_FrontFacing)?texture2D(uFront,uv):texture2D(uBack,uv);
   float shade=uTurning>0.5?0.15*(1.0-abs(cos(vAngle))):0.0;
   shade+=uSpine*exp(-vUV.x*34.0);
   gl_FragColor=vec4(color.rgb*(1.0-shade),1.0);
 }`;
 let program,uvBuffer,indexBuffer,front,back,gallery,vert,frag,disposed=false;
 function dispose(){if(disposed)return;disposed=true;for(const t of [front,back,gallery])if(t)gl.deleteTexture(t);for(const b of [uvBuffer,indexBuffer])if(b)gl.deleteBuffer(b);if(program)gl.deleteProgram(program);if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag);}
 try {
   function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s)||'Paper shader unavailable';gl.deleteShader(s);throw Error(message);}return s;}
   vert=shader(gl.VERTEX_SHADER,vertex);frag=shader(gl.FRAGMENT_SHADER,fragment);
   program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Paper renderer unavailable');
   const cols=64,rows=8,uv=[],indices=[];
   for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)uv.push(x/cols,y/rows);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c);}
   uvBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
   indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
   const uniform=name=>gl.getUniformLocation(program,name),size=uniform('uSize'),spread=uniform('uSpread'),progress=uniform('uProgress'),turning=uniform('uTurning'),spine=uniform('uSpine');
   gl.useProgram(program);const attr=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
   gl.uniform1i(uniform('uFront'),0);gl.uniform1i(uniform('uBack'),1);gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);gl.frontFace(gl.CW);
   function texture(old,face){const tex=old||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,face);return tex;}
   function bind(a,b){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,b);}
   function upload(faces){gl.activeTexture(gl.TEXTURE0);front=texture(front,faces[0]);back=texture(back,faces[1]);gallery=texture(gallery,faces[2]);}
   function draw({p,z,shadow}){
     if(disposed)return;
     gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(238/255,237/255,232/255,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
     gl.uniform2f(size,canvas.width,canvas.height);gl.uniform3f(spread,z.x,z.y,z.scale);gl.uniform1f(progress,p);
     // A complete resting page, followed by one continuous front/back sheet.
     bind(gallery,gallery);gl.uniform1f(turning,0);gl.uniform1f(spine,shadow);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
     bind(front,back);gl.uniform1f(turning,1);gl.uniform1f(spine,shadow);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
   }
   return {upload,draw,dispose,kind:'webgl-continuous'};
 }catch(error){window.KissPaperSurface.lastError=String(error.message||error);dispose();return null;}
}
window.KissPaperSurface={create};
})();
