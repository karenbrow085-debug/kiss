const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/modules/status-preset-preview.js'),'utf8');
const scope={window:{addEventListener(){}},document:{getElementById(){return null}}};
vm.createContext(scope);vm.runInContext(source,scope);
const api=scope.window.KissStatusPresetPreview;
test('opening an empty test field generates a usable multi-field preview',()=>{
 assert.equal(api.makeSample('<h3>$1</h3><p>$2</p><small>$3</small>','(.*)','',''),'<h3>记得好好吃饭</h3><p>今天也有在想你。</p><small>09:41</small>');
});
test('any sentence replaces a text slot without needing to match regex',()=>{
 assert.equal(api.makeSample('<h3>$1</h3><p>$2</p>','\\[STICKY:(.*?)\\|(.*?)\\]','一起看海吧'),'<h3>一起看海吧</h3><p>今天也有在想你。</p>');
});
test('percentage and digit captures get numeric examples while free text fills a text slot',()=>{
 const html=api.makeSample('<div style="width:$1%">$1</div><p>$2</p>','(\\d+)(.*?)','今天很好');
 assert.equal(html,'<div style="width:80%">80</div><p>今天很好</p>');
});
test('capture substitution does not confuse $1 with $10 or reinterpret dollar signs',()=>{
 const m=['all','<b>$2</b>',...Array(8).fill('x'),'ten'];
 assert.equal(api.substitute('$1 / $10 / $2',m,null),'&lt;b&gt;$2&lt;/b&gt; / ten / x');
});
test('named and optional captures work without leaking undefined',()=>{
 assert.equal(api.substitute('$<note>/$1/$2',['all','hello',undefined],{note:'<3'}),'&lt;3/hello/');
});
test('regex literals share the chat renderer gs default and preserve supplied flags',()=>{
 assert.equal(api.normalizeRegex('/a(.*?)b/is').flags,'is');
 assert.equal(api.normalizeRegex('a(.*?)b').flags,'gs');
 assert.equal(api.normalizeRegex('/a(.*?)b/').source,'a(.*?)b');
});
test('sample text is escaped even when it looks like HTML',()=>{
 assert.equal(api.makeSample('<h3>$1</h3>','(.*?)','<img src=x onerror=alert(1)>'),'<h3>&lt;img src=x onerror=alert(1)&gt;</h3>');
});
test('sample color and image URL slots retain valid presentation values',()=>{
 const html=api.makeSample('<div style="color:$1"><img src="$2"><p>$3</p></div>','(.*)(.*)(.*)','test');
 assert.ok(html.includes('color:#a7b4ca'));assert.ok(html.includes('data:image/svg+xml,'));assert.ok(html.includes('<p>test</p>'));
});
