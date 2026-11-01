/* City names to canonical IANA zones; local matches work without a network. */
(() => {
'use strict';
const entries=[
 ['曼彻斯特','Europe/London','Manchester','曼城','英国曼彻斯特'],['伦敦','Europe/London','London'],['爱丁堡','Europe/London','Edinburgh'],['伯明翰','Europe/London','Birmingham'],['利物浦','Europe/London','Liverpool'],['格拉斯哥','Europe/London','Glasgow'],['利兹','Europe/London','Leeds'],['牛津','Europe/London','Oxford'],['剑桥','Europe/London','Cambridge'],['卡迪夫','Europe/London','Cardiff'],
 ['上海','Asia/Shanghai','Shanghai'],['北京','Asia/Shanghai','Beijing','Peking'],['广州','Asia/Shanghai','Guangzhou','Canton'],['深圳','Asia/Shanghai','Shenzhen'],['成都','Asia/Shanghai','Chengdu'],['重庆','Asia/Shanghai','Chongqing'],['杭州','Asia/Shanghai','Hangzhou'],['南京','Asia/Shanghai','Nanjing'],['武汉','Asia/Shanghai','Wuhan'],['西安','Asia/Shanghai','Xian'],['苏州','Asia/Shanghai','Suzhou'],['厦门','Asia/Shanghai','Xiamen'],['天津','Asia/Shanghai','Tianjin'],['青岛','Asia/Shanghai','Qingdao'],['长沙','Asia/Shanghai','Changsha'],['郑州','Asia/Shanghai','Zhengzhou'],['沈阳','Asia/Shanghai','Shenyang'],['大连','Asia/Shanghai','Dalian'],['哈尔滨','Asia/Shanghai','Harbin'],['昆明','Asia/Shanghai','Kunming'],['乌鲁木齐','Asia/Shanghai','Urumqi'],
 ['香港','Asia/Hong_Kong','Hong Kong'],['澳门','Asia/Macau','Macau','Macao'],['台北','Asia/Taipei','Taipei'],['高雄','Asia/Taipei','Kaohsiung'],['东京','Asia/Tokyo','Tokyo','東京'],['大阪','Asia/Tokyo','Osaka'],['京都','Asia/Tokyo','Kyoto'],['首尔','Asia/Seoul','Seoul'],['釜山','Asia/Seoul','Busan'],['新加坡','Asia/Singapore','Singapore'],['吉隆坡','Asia/Kuala_Lumpur','Kuala Lumpur'],['曼谷','Asia/Bangkok','Bangkok'],['河内','Asia/Ho_Chi_Minh','Hanoi'],['胡志明市','Asia/Ho_Chi_Minh','Ho Chi Minh'],['雅加达','Asia/Jakarta','Jakarta'],['马尼拉','Asia/Manila','Manila'],['新德里','Asia/Kolkata','New Delhi'],['孟买','Asia/Kolkata','Mumbai'],['迪拜','Asia/Dubai','Dubai'],
 ['巴黎','Europe/Paris','Paris'],['柏林','Europe/Berlin','Berlin'],['慕尼黑','Europe/Berlin','Munich','München'],['罗马','Europe/Rome','Rome'],['米兰','Europe/Rome','Milan'],['马德里','Europe/Madrid','Madrid'],['巴塞罗那','Europe/Madrid','Barcelona'],['阿姆斯特丹','Europe/Amsterdam','Amsterdam'],['布鲁塞尔','Europe/Brussels','Brussels'],['苏黎世','Europe/Zurich','Zurich'],['维也纳','Europe/Vienna','Vienna'],['都柏林','Europe/Dublin','Dublin'],['里斯本','Europe/Lisbon','Lisbon'],['莫斯科','Europe/Moscow','Moscow'],['赫尔辛基','Europe/Helsinki','Helsinki'],['斯德哥尔摩','Europe/Stockholm','Stockholm'],['奥斯陆','Europe/Oslo','Oslo'],
 ['纽约','America/New_York','New York','NYC'],['波士顿','America/New_York','Boston'],['华盛顿','America/New_York','Washington DC'],['芝加哥','America/Chicago','Chicago'],['达拉斯','America/Chicago','Dallas'],['休斯顿','America/Chicago','Houston'],['丹佛','America/Denver','Denver'],['洛杉矶','America/Los_Angeles','Los Angeles','LA'],['旧金山','America/Los_Angeles','San Francisco'],['西雅图','America/Los_Angeles','Seattle'],['温哥华','America/Vancouver','Vancouver'],['多伦多','America/Toronto','Toronto'],['蒙特利尔','America/Toronto','Montreal'],['夏威夷','Pacific/Honolulu','Hawaii','Honolulu'],['墨西哥城','America/Mexico_City','Mexico City'],['圣保罗','America/Sao_Paulo','Sao Paulo'],
 ['悉尼','Australia/Sydney','Sydney'],['墨尔本','Australia/Melbourne','Melbourne'],['布里斯班','Australia/Brisbane','Brisbane'],['珀斯','Australia/Perth','Perth'],['阿德莱德','Australia/Adelaide','Adelaide'],['奥克兰','Pacific/Auckland','Auckland'],['惠灵顿','Pacific/Auckland','Wellington'],['开罗','Africa/Cairo','Cairo'],['开普敦','Africa/Johannesburg','Cape Town'],['UTC','UTC','GMT']
];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\s_.'’\-/]/g,'').replace(/市$/,'');
const cache=new Map();
function valid(z){try{new Intl.DateTimeFormat('en',{timeZone:z}).format();return !!z;}catch{return false;}}
function searchLocal(query){
 const q=norm(query);if(!q)return [];
 const scored=entries.map(([label,timeZone,...aliases])=>({label,timeZone,rank:Math.min(...[label,...aliases].map(n=>norm(n)===q?0:q.length>=2&&norm(n).startsWith(q)?1:q.length>=3&&norm(n).includes(q)?2:99))})).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank);
 if(scored.length)return scored;
 let zones=[];try{zones=Intl.supportedValuesOf('timeZone');}catch{}
 return zones.filter(z=>norm(z.split('/').pop()).startsWith(q)).slice(0,10).map(timeZone=>({label:timeZone.split('/').pop().replaceAll('_',' '),timeZone,rank:1}));
}
function lookup(value){const s=String(value||'').trim();if(!s)return {label:'',timeZone:''};if(cache.has(norm(s)))return cache.get(norm(s));if(valid(s))return {timeZone:s,label:entries.find(e=>e[1]===s)?.[0]||s.split('/').pop().replaceAll('_',' ')};const rows=searchLocal(s);if(rows[0]?.rank===0||rows.length===1)return rows[0];return null;}
async function search(query,{signal}={}){
 const local=searchLocal(query);if(local[0]?.rank===0||local.length===1)return local;
 if(String(query).trim().length<2)return local;
 const u=new URL('https://geocoding-api.open-meteo.com/v1/search');u.searchParams.set('name',query.trim());u.searchParams.set('count','8');u.searchParams.set('language','zh');
 try{const response=await fetch(u.href,{signal,referrerPolicy:'no-referrer'});if(!response.ok)throw Error('城市查询暂时不可用');const data=await response.json();const remote=(data.results||[]).filter(r=>valid(r.timezone)).map(r=>({label:r.name,timeZone:r.timezone,detail:[r.admin1,r.country].filter(Boolean).join(' · ')}));return [...local,...remote.filter(r=>!local.some(l=>l.label===r.label&&l.timeZone===r.timeZone))];}catch(e){if(e.name==='AbortError')throw e;if(local.length)return local;throw Error('城市未匹配，请检查名称或稍后重试');}
}
function remember(value,city){cache.set(norm(value),{label:city.label,timeZone:city.timeZone});cache.set(norm(city.label),{label:city.label,timeZone:city.timeZone});}
window.KissCityTimezones={lookup,searchLocal,search,remember,valid};
})();
