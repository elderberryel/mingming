// ==UserScript==
// @name         网页翻译器 (AI增强版)
// @description  谷歌/微软/腾讯/DeepSeek/GLM 多引擎翻译，支持双语对照、API配置、配置导入导出
// @version      2.0
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      translate-pa.googleapis.com
// @connect      edge.microsoft.com
// @connect      transmart.qq.com
// @connect      api.deepseek.com
// @connect      open.bigmodel.cn
// @run-at       document-end
// @namespace    https://github.com/elderberryel/mingming
// @updateURL    https://elderberryel.github.io/mingming/%E7%BD%91%E9%A1%B5%E7%BF%BB%E8%AF%91%E5%99%A8.user.js
// @downloadURL  https://elderberryel.github.io/mingming/%E7%BD%91%E9%A1%B5%E7%BF%BB%E8%AF%91%E5%99%A8.user.js
// ==/UserScript==
(async()=>{
'use strict';
try{if(document.contentType==='application/xml')return}catch(_){}
const sp=s=>s.split(' ');
const kv=s=>{const o={};for(const p of s.split('|')){const i=p.indexOf('=');o[p.slice(0,i)]=p.slice(i+1)}return o};
const $=i=>document.getElementById(i);
const deviceLang=(navigator.language||navigator.userLanguage||'zh-CN').split('-')[0];
const getBadgeSize=()=>window.innerWidth>=768?100:52;
const getPanelWidth=()=>window.innerWidth>=768?300:200;
const getDefaultRight=()=>Math.round((window.innerWidth-getBadgeSize())/2);
const BADGE_MARGIN_BOTTOM=20;
const [_engine,_targetLang,_autoMode,_excludedHosts,_displayMode,_pos,_deepseekKey,_deepseekModel,_glmKey,_glmModel,_savedCache]=await Promise.all([GM_getValue('engine','microsoft'),GM_getValue('targetLang',deviceLang==='zh'?'zh-CN':deviceLang),GM_getValue('autoMode',false),GM_getValue('excludedHosts','[]'),GM_getValue('displayMode','translated'),GM_getValue('uiPos',JSON.stringify({})),GM_getValue('deepseekKey',''),GM_getValue('deepseekModel','deepseek-chat'),GM_getValue('glmKey',''),GM_getValue('glmModel','glm-4-flash'),GM_getValue('translationCache','{}')]);
let currentEngine=_engine;
async function detectEngineAuto(){
try{
const res=await gmFetch({method:'GET',url:'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&q=test',timeout:8000});
console.log('[AutoEngine] 探测响应 status=',res.status,'len=',(res.responseText||'').length);
if(res.status===200){console.log('[AutoEngine] Google 可用 → 使用 Google');return 'google'}
console.log('[AutoEngine] Google 返回非 200 → 使用 Microsoft');
}catch(e){
console.log('[AutoEngine] Google 请求失败 → 使用 Microsoft',{status:e&&e.status,readyState:e&&e.readyState,error:e&&e.error,finalUrl:e&&e.finalUrl,msg:e&&e.message});
}
return 'microsoft'}
let targetLang=_targetLang,autoMode=_autoMode,excludedHosts=JSON.parse(_excludedHosts),displayMode=_displayMode,uiPos=JSON.parse(_pos);
if(!uiPos||typeof uiPos.right!=='number'||typeof uiPos.bottom!=='number')uiPos={right:getDefaultRight(),bottom:BADGE_MARGIN_BOTTOM};
let aiConfig={deepseek:{key:_deepseekKey,model:_deepseekModel},glm:{key:_glmKey,model:_glmModel}};
const CONCURRENCY_LIMIT=6,AI_CONCURRENCY_LIMIT=1,AI_REQUEST_DELAY=300,AI_BATCH_SIZE=25,MS_BATCH_SIZE=25,DEFAULT_BATCH_SIZE=50;
// 任务代号：还原/切换引擎/切换语言/切换模式时递增，旧请求返回后自动作废
let taskGen=0;
const bumpGen=()=>{taskGen++};
let statusEl=null;
function updateStatus(msg){if(statusEl)statusEl.textContent=msg+' · 缓存: '+cache.size}
if(excludedHosts.includes(location.host)){GM_registerMenuCommand('✅ 在此网站重新启用翻译',()=>{const i=excludedHosts.indexOf(location.host);if(i>-1)excludedHosts.splice(i,1);GM_setValue('excludedHosts',JSON.stringify(excludedHosts));location.reload()});return}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function gmFetchWithRetry(opts,maxRetries=3){
let lastError;
for(let attempt=0;attempt<=maxRetries;attempt++){
try{const result=await gmFetch(opts);
if(result.status===429){const w=Math.min(2000*Math.pow(2,attempt),10000);console.warn(`[RateLimit] 429 收到，等待 ${w}ms 后重试 (${attempt+1}/${maxRetries})`);await delay(w);lastError=new Error('429 Too Many Requests');continue}
return result}catch(e){lastError=e;if(attempt<maxRetries){const w=Math.min(1000*Math.pow(2,attempt),8000);console.warn(`[Retry] 请求失败，等待 ${w}ms 后重试 (${attempt+1}/${maxRetries})`);await delay(w)}}}
throw lastError}
const GoogleHelper_v2={
_lastRequestAuthTime:null,_translateAuth:null,_authNotFound:false,_authPromise:null,
get translateAuth(){return this._translateAuth},
_getAlternativeKey(){return String.fromCharCode(65,73,122,97,83,121,65,84,66,88,97,106,118,122,81,76,84,68,72,69,81,98,99,112,113,48,73,104,101,48,118,87,68,72,109,79,53,50,48)},
async findAuth(){
if(this._authPromise)return await this._authPromise;
this._authPromise=new Promise(resolve=>{
let needUpdate=false;
if(this._lastRequestAuthTime){const d=new Date();
if(this._translateAuth)d.setMinutes(d.getMinutes()-20);
else if(this._authNotFound)d.setMinutes(d.getMinutes()-5);
else d.setMinutes(d.getMinutes()-1);
if(d.getTime()>this._lastRequestAuthTime)needUpdate=true}else needUpdate=true;
if(needUpdate){this._lastRequestAuthTime=Date.now();const altKey=this._getAlternativeKey();
GM_xmlhttpRequest({method:'GET',url:'https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main',timeout:8000,
onload:r=>{if(r.responseText&&r.responseText.length>1){const m=r.responseText.match(/['"]x-goog-api-key['"]\s*:\s*['"](\w{39})['"]/i);
if(m&&m.length===2){this._translateAuth=m[1];this._authNotFound=false}else{this._authNotFound=true;this._translateAuth=altKey}}
else{this._authNotFound=true;this._translateAuth=altKey}resolve()},
onerror:()=>{this._translateAuth=altKey;resolve()},
ontimeout:()=>{this._translateAuth=altKey;resolve()}})}else resolve()});
const p=this._authPromise;p.finally(()=>{this._authPromise=null});return await p}};
const ALL_LANGUAGES=kv("zh-CN=中文（简体）|zh-TW=中文（繁體）|en=English|ja=日本語|ko=한국어|fr=Français|de=Deutsch|es=Español|ru=Русский|pt=Português|pt-PT=Português (Portugal)|ar=العربية|th=ไทย|vi=Tiếng Việt|it=Italiano|tr=Türkçe|id=Indonesia|ms=Bahasa Melayu|nl=Nederlands|pl=Polski|uk=Українська|cs=Čeština|sk=Slovenčina|hu=Magyar|ro=Română|bg=Български|hr=Hrvatski|sr=Српски|sl=Slovenščina|lt=Lietuvių|lv=Latviešu|et=Eesti|fi=Suomi|sv=Svenska|da=Dansk|no=Norsk|is=Íslenska|el=Ελληνικά|he=עברית|hi=हिन्दी|bn=বাংলা|ta=தமிழ்|te=తెలుగు|kn=ಕನ್ನಡ|ml=മലയാളം|pa=ਪੰਜਾਬੀ|gu=ગુજરાતી|mr=मराठी|ne=नेपाली|si=සිංහල|ur=اردو|fa=فارسی|ps=پښتو|my=မြန်မာ|km=ខ្មែរ|lo=ລາວ|ka=ქართული|hy=Հայերեն|az=Azərbaycan|kk=Қазақ|uz=Oʻzbek|mn=Монгол|sq=Shqip|mk=Македонски|be=Беларуская|bs=Bosanski|ca=Català|gl=Galego|eu=Euskara|mt=Malti|cy=Cymraeg|ga=Gaeilge|gd=Gàidhlig|lb=Lëtzebuergesch|af=Afrikaans|sw=Kiswahili|ha=Hausa|ig=Igbo|yo=Yorùbá|zu=isiZulu|xh=isiXhosa|sn=chiShona|st=Sesotho|so=Soomaali|am=አማርኛ|ti=ትግርኛ|om=Oromoo|mg=Malagasy|ny=Chichewa|lg=Luganda|rw=Kinyarwanda|tg=Тоҷикӣ|tk=Türkmen|ky=Кыргызча|tt=Татар|eo=Esperanto|la=Latina|co=Corsu|fy=Frysk|haw=ʻŌlelo Hawaiʻi|sm=Gagana Samoa|mi=Te Reo Māori|ceb=Cebuano|fil=Filipino|jv=Basa Jawa|su=Basa Sunda|hmn=Hmong|ht=Kreyòl Ayisyen|ku=Kurdî|ckb=کوردی|sd=سنڌي|or=ଓଡ଼ିଆ|as=অসমীয়া|sa=संस्कृतम्|mai=मैथिली|bho=भोजपुरी|doi=डोगरी|ug=ئۇيغۇرچە|dv=ދިވެހި|ak=Akan|ee=Eʋegbe|gn=Guarani|ay=Aymar|bm=Bamanankan|ln=Lingála|nso=Sepedi|ts=Xitsonga|qu=Runasimi|ilo=Ilokano|kri=Krio|lus=Mizo tawng|mni-Mtei=ꯃꯤꯇꯩꯂꯣꯟ|gom=कोंकणी|ab=Аԥсуа|ace=Bahsa Acèh|ach=Lwo|aa=Qafaraf|alz=Alur|av=Авар|awa=अवधी|ban=ᬩᬮᬶ|bal=بلوچی|bci=Baoulé|ba=Башҡорт|btx=Batak Karo|bts=Batak Simalungun|bbc=Batak Toba|bem=Bemba|bew=Betawi|bik=Bikol|br=Brezhoneg|bua=Буряад|yue=粵語|ch=Chamoru|ce=Нохчийн|chk=Chuukese|cv=Чӑваш|crh=Qırımtatar|prs=دری|din=Thuɔŋjäŋ|dov=Dombe|dyu=Julakan|dz=རྫོང་ཁ|fo=Føroyskt|fj=Na Vosa Vakaviti|fon=Fɔ̀ngbè|fr-CA=Français (Canada)|fur=Furlan|ff=Pulaar|gaa=Gã|cnh=Lai|hil=Hiligaynon|hrx=Hunsrik|iba=Iban|iu-Latn=ᐃᓄᒃᑎᑐᑦ (Latin)|jam=Jamaican Patois|kac=Jingpo|kl=Kalaallisut|kr=Kanuri|pam=Kapampangan|kha=Khasi|cgg=Rukiga|kg=Kikongo|mkw=Kituba|trp=Kokborok|kv=Коми|ltg=Latgaļu|lij=Lìgure|li=Limburgs|lmo=Lombard|luo=Dholuo|mad=Madhurâ|mak=Makassar|ms-Arab=بهاس ملايو|mam=Mam|gv=Gaelg|mh=Kajin Majōl|mwr=मारवाड़ी|mfe=Kreol Morisien|chm=Марий|min=Minangkabau|nhe=Nahuatl|ndc-ZW=Ndau|nr=isiNdebele|new=नेपाल भाषा|nqo=ߒߞߏ|nus=Thok Nath|oc=Occitan|os=Ирон|pag=Pangasinan|pap=Papiamento|pa-Arab=پنجابی|kek=Qʼeqchiʼ|rom=Romani|rn=Ikirundi|se=Davvisámegiella|sg=Sängö|bo=བོད་ཡིག|dsb=Dolnoserbšćina|hsb=Hornjoserbšćina|ikt=Inuinnaqtun|iu=ᐃᓄᒃᑎᑐᑦ|lzh=文言文|mvf=ᠮᠣᠩᠭᠣᠯ|brx=बर'|hne=छत्तीसगढ़ी|ks=कॉशुर|mrj=Мары|sa-Latn=Sanskrit (Latin)|sc=Sardu|scn=Sicilianu|szl=Ślůnski|su-Latn=Sunda (Latin)|tcy=ತುಳು|vec=Vèneto|war=Winaray|wo=Wolof|zap=Zapotec|ms-Latn=Malay (Latin)");
const LANG_GROUPS={'常用':sp('zh-CN zh-TW en ja ko fr de es ru pt ar th vi it tr id'),'欧洲':sp('nl pl uk cs sk hu ro bg hr sr sl lt lv et fi sv da no is el be bs ca gl eu mt cy ga gd lb af eo la co fy fo br oc sc scn szl fur lij lmo li vec ltg dsb hsb gv se'),'亚洲':sp('hi bn ta te kn ml pa gu mr ne si ur fa ps my km lo ka hy az kk uz mn tg tk ky tt ug dv or as sa mai bho doi mni-Mtei gom awa ks brx hne mwr trp kac bo dz yue lzh ms fil ceb jv su hmn ilo hil bik pam pag war ban mad mak min ace btx bts bbc bew iba ms-Arab kha'),'非洲':sp('sw ha ig yo zu xh sn st so am ti om mg ny lg rw ak ee bm ln nso ts kri wo ff gaa fon bci dyu bem luo sg kg mkw dov nus din ach alz ndc-ZW nr rn mfe'),'美洲/大洋洲':sp('pt-PT fr-CA ht qu gn ay haw sm mi fj mh ch chk jam nhe mam kek pap hrx ikt iu iu-Latn kl'),'其他':sp('ab av ba bua ce cv crh kv chm mrj os rom nqo aa bal cnh kr prs pa-Arab sd ckb ku he')};
const GoogleHelper={
googleTranslateTKK:"448487.932609646",
shiftLeftOrRightThenSumOrXor(num,optString){
for(let i=0;i<optString.length-2;i+=3){let acc=optString.charAt(i+2);acc=("a"<=acc)?acc.charCodeAt(0)-87:Number(acc);
acc=(optString.charAt(i+1)==="+")?num>>>acc:num<<acc;
num=(optString.charAt(i)==="+")?(num+acc)&4294967295:num^acc}
return num},
transformQuery(query){
const b=[];let idx=0;
for(let i=0;i<query.length;i++){let c=query.charCodeAt(i);
if(128>c){b[idx++]=c}
else{if(2048>c){b[idx++]=(c>>6)|192}
else{if(55296===(c&64512)&&i+1<query.length&&56320===(query.charCodeAt(i+1)&64512)){c=65536+((c&1023)<<10)+(query.charCodeAt(++i)&1023);b[idx++]=(c>>18)|240;b[idx++]=((c>>12)&63)|128}
else{b[idx++]=(c>>12)|224}
b[idx++]=((c>>6)&63)|128}
b[idx++]=(c&63)|128}}
return b},
calcHash(query){
const s=this.googleTranslateTKK.split(".");const tkkIdx=Number(s[0])||0;const tkkKey=Number(s[1])||0;
const bytes=this.transformQuery(query);let enc=tkkIdx;
for(const item of bytes){enc+=item;enc=this.shiftLeftOrRightThenSumOrXor(enc,"+-a^+6")}
enc=this.shiftLeftOrRightThenSumOrXor(enc,"+-3^+b+-f");enc^=tkkKey;
if(enc<=0)enc=(enc&2147483647)+2147483648;
const n=enc%1000000;return n.toString()+"."+(n^tkkIdx)}};
const unescapeHTML=t=>new DOMParser().parseFromString(t,'text/html').documentElement.textContent;
function gmFetch(opts){return new Promise((resolve,reject)=>{GM_xmlhttpRequest({timeout:20000,...opts,onload:resolve,onerror:reject,ontimeout:reject})})}
const MAX_CACHE=5000,CACHE_SAVE_INTERVAL=30000;
let cacheModified=false,cacheData={};
try{cacheData=JSON.parse(_savedCache)}catch(e){cacheData={}}
const cache=new Map(Object.entries(cacheData));
function cacheKey(text){return currentEngine+'\u0000'+targetLang+'\u0000'+text}
function cacheGet(text){return cache.get(cacheKey(text))}
function cacheSet(text,value){
if(cache.size>=MAX_CACHE){const n=Math.floor(MAX_CACHE*0.2),keys=cache.keys();for(let i=0;i<n;i++)cache.delete(keys.next().value)}
cache.set(cacheKey(text),value);cacheModified=true}
function saveCache(immediate){
if(!cacheModified)return;
const doSave=()=>{try{GM_setValue('translationCache',JSON.stringify(Object.fromEntries(cache)));cacheModified=false}
catch(e){if(e.message&&e.message.includes('quota')){const n=Math.floor(cache.size/2),keys=cache.keys();for(let i=0;i<n;i++)cache.delete(keys.next().value);
try{GM_setValue('translationCache',JSON.stringify(Object.fromEntries(cache)));cacheModified=false}catch(_){}}}};
if(!immediate&&typeof requestIdleCallback==='function')requestIdleCallback(doSave,{timeout:3000});else doSave()}
function clearCache(){cache.clear();GM_setValue('translationCache','{}');cacheModified=false}
async function aiSingleTranslate(text,toLang,apiKey,model,apiUrl,engineName){
const targetLangName=ALL_LANGUAGES[toLang]||toLang;
const systemPrompt="You are a professional translation engine. Translate accurately. Output ONLY the translated text, nothing else.";
const userPrompt=`Translate to ${targetLangName} (${toLang}):\n\n${text}`;
const r=await gmFetchWithRetry({method:'POST',url:apiUrl,headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},data:JSON.stringify({model:model,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],temperature:0.1})});
if(r.status!==200)throw new Error(`${engineName} Error: ${r.status}`);
const data=JSON.parse(r.responseText);
if(data.error)throw new Error(`${engineName} API: ${data.error.message}`);
return data.choices[0].message.content.trim()}
async function aiBatchTranslate(texts,toLang,apiKey,model,apiUrl,engineName){
if(!apiKey)throw new Error(`请配置 ${engineName} API Key`);
if(texts.length===0)return [];
if(texts.length===1)return [await aiSingleTranslate(texts[0],toLang,apiKey,model,apiUrl,engineName)];
const allResults=[],targetLangName=ALL_LANGUAGES[toLang]||toLang;
for(let i=0;i<texts.length;i+=AI_BATCH_SIZE){
const batch=texts.slice(i,i+AI_BATCH_SIZE);
if(batch.length===1){try{allResults.push(await aiSingleTranslate(batch[0],toLang,apiKey,model,apiUrl,engineName))}catch(e){allResults.push(null)}continue}
const numberedTexts=batch.map((t,idx)=>`[${idx}] ${t}`).join('\n\n');
const systemPrompt=`You are a professional batch translator. You will receive multiple numbered text segments. Translate each one to the target language. CRITICAL: You MUST maintain the exact [number] format before each translation. Output ONLY the translations with numbering, nothing else. Do not skip any segment.`;
const userPrompt=`Target language: ${targetLangName} (${toLang})\n\nTranslate ALL segments below. Keep the [number] format exactly:\n\n${numberedTexts}`;
try{
const r=await gmFetchWithRetry({method:'POST',url:apiUrl,headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},data:JSON.stringify({model:model,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],temperature:0.1,max_tokens:4096})});
if(r.status!==200)throw new Error(`${engineName} Error: ${r.status}`);
const data=JSON.parse(r.responseText);
if(data.error)throw new Error(`${engineName} API: ${data.error.message}`);
const parsed=parseNumberedResponse(data.choices[0].message.content.trim(),batch.length);
for(let k=0;k<parsed.length;k++){if(!parsed[k]){try{parsed[k]=await aiSingleTranslate(batch[k],toLang,apiKey,model,apiUrl,engineName)}catch(_){parsed[k]=null}}}
allResults.push(...parsed)}
catch(e){for(const text of batch){try{allResults.push(await aiSingleTranslate(text,toLang,apiKey,model,apiUrl,engineName))}catch(e2){allResults.push(null)}}}
if(i+AI_BATCH_SIZE<texts.length)await delay(500)}
return allResults}
function parseNumberedResponse(responseText,expectedCount){
const results=new Array(expectedCount).fill(null);
const lines=responseText.split('\n');
let currentIdx=-1,currentText='';
for(const line of lines){
const match=line.match(/^\[(\d+)\]\s*(.*)/);
if(match){if(currentIdx>=0&&currentIdx<expectedCount)results[currentIdx]=currentText.trim();currentIdx=parseInt(match[1]);currentText=match[2]||''}
else if(currentIdx>=0&&line.trim())currentText+=(currentText?'\n':'')+line}
if(currentIdx>=0&&currentIdx<expectedCount)results[currentIdx]=currentText.trim();
if(results.every(r=>r===null)){const parts=responseText.split(/\n\s*\n/).filter(s=>s.trim());for(let i=0;i<Math.min(parts.length,expectedCount);i++)results[i]=parts[i].trim().replace(/^\[\d+\]\s*/,'')}
if(results.every(r=>r===null)){const arr=responseText.split('\n').filter(s=>s.trim());for(let i=0;i<Math.min(arr.length,expectedCount);i++)results[i]=arr[i].trim().replace(/^\[\d+\]\s*/,'')}
return results}
const Engine={
google_v2:{
name:'Google (TWP v2)',
_fixLang(lang){return lang==="prs"?"fa-AF":lang},
_transformResponse(result,dontSort){
if(result.indexOf("<pre>")!==-1){result=result.replace("<pre>","");const i=result.indexOf(">");result=result.slice(i+1)}
const sentences=[];let idx=0;
while(true){const s=result.indexOf("<b>",idx);if(s===-1)break;
const e=result.indexOf("</b>",s);
if(e===-1){sentences.push(result.slice(s+3));break}else sentences.push(result.slice(s+3,e));
idx=e}
result=sentences.length>0?sentences.join(" "):result;result=result.replace(/<\/b>/g,"");
let resultArray=[],lastEnd=0;
for(const r of result.matchAll(/(<a i="[0-9]+">)([^<>]*(?=<\/a>))*/g)){
const fl=r[0].length,pos=r.index;
if(pos>lastEnd)resultArray.push(r[1]+result.slice(lastEnd,pos).replace(/<\/a>/g,"")+(r[2]||""));else resultArray.push(r[0]);
lastEnd=pos+fl}
let indexes;
if(resultArray.length>0){indexes=resultArray.map(v=>parseInt(v.match(/[0-9]+(?=>)/g)?.[0])).filter(v=>!isNaN(v));resultArray=resultArray.map(v=>v.slice(v.indexOf(">")+1))}
else{resultArray=[result];indexes=[0]}
resultArray=resultArray.map(v=>unescapeHTML(v));
if(dontSort)return resultArray;
const final=[];
for(const j in indexes){if(final[indexes[j]])final[indexes[j]]+=" "+resultArray[j];else final[indexes[j]]=resultArray[j]}
return final},
async translate(text,toLang){
const to=this._fixLang(toLang);await GoogleHelper_v2.findAuth();
if(!GoogleHelper_v2.translateAuth)throw new Error('No auth');
const r=await gmFetchWithRetry({method:'POST',url:'https://translate-pa.googleapis.com/v1/translateHtml',headers:{'Content-Type':'application/json+protobuf','X-Goog-Api-Key':GoogleHelper_v2.translateAuth},data:JSON.stringify([[[text],"auto",to],"te"])},2);
if(r.status!==200)throw new Error('v2 error: '+r.status);
const data=JSON.parse(r.responseText);
if(data&&data[0]){const raw=Array.isArray(data[0])?data[0][0]:data[0];const parsed=this._transformResponse(raw,false);return parsed[0]||raw}
throw new Error('v2 empty')},
async translateBatch(texts,toLang){
const to=this._fixLang(toLang);await GoogleHelper_v2.findAuth();
if(!GoogleHelper_v2.translateAuth)throw new Error('No auth');
const r=await gmFetchWithRetry({method:'POST',url:'https://translate-pa.googleapis.com/v1/translateHtml',headers:{'Content-Type':'application/json+protobuf','X-Goog-Api-Key':GoogleHelper_v2.translateAuth},data:JSON.stringify([[texts,"auto",to],"te"])},2);
if(r.status!==200)throw new Error('v2 batch error: '+r.status);
const data=JSON.parse(r.responseText);
if(data&&data[0]&&Array.isArray(data[0]))return data[0].map(item=>{const p=this._transformResponse(item,false);return p[0]||item});
if(data&&data[0]){const p=this._transformResponse(Array.isArray(data[0])?data[0][0]:data[0],false);return [p[0]]}
throw new Error('v2 batch empty')}},
google_legacy:{
name:'Google (Legacy)',
async translate(text,toLang){
const tk=GoogleHelper.calcHash(text);
const r=await gmFetchWithRetry({method:'GET',url:'https://translate.googleapis.com/translate_a/single?client=webapp&sl=auto&tl='+toLang+'&hl='+toLang+'&dt=t&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=at&ie=UTF-8&oe=UTF-8&otf=1&ssel=0&tsel=0&kc=7&tk='+tk+'&q='+encodeURIComponent(text)},2);
if(r.status!==200)return await this._gtx(text,toLang);
const data=JSON.parse(r.responseText);return data[0].filter(s=>s&&s[0]).map(s=>s[0]).join('')},
async _gtx(text,to){
const r=await gmFetchWithRetry({method:'GET',url:'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl='+to+'&q='+encodeURIComponent(text)},2);
if(r.status!==200)throw new Error('gtx error');
const data=JSON.parse(r.responseText);return data[0].filter(s=>s&&s[0]).map(s=>s[0]).join('')}},
google:{
name:'Google (Auto)',
async translate(text,toLang){try{return await Engine.google_v2.translate(text,toLang)}catch(e){return await Engine.google_legacy.translate(text,toLang)}},
async translateBatch(texts,toLang){try{return await Engine.google_v2.translateBatch(texts,toLang)}catch(e){const res=[];for(const t of texts){try{res.push(await Engine.google_legacy.translate(t,toLang))}catch(_){res.push(null)}}return res}}},
microsoft:{
name:'Microsoft (Edge)',
langCode(l){const m={'zh':'zh-Hans','zh-CN':'zh-Hans','zh-TW':'zh-Hant','no':'nb','sr':'sr-Cyrl','pt-PT':'pt-pt','fr-CA':'fr-ca'};return m[l]||l},
async translate(text,toLang){
const to=this.langCode(toLang);
const r=await gmFetchWithRetry({method:'POST',url:`https://edge.microsoft.com/translate/translatetext?from=&to=${to}&isEnterpriseClient=false`,headers:{'Content-Type':'application/json'},data:JSON.stringify([text])},2);
if(r.status!==200)throw new Error('MS Edge error: '+r.status);
return JSON.parse(r.responseText)[0].translations[0].text},
async translateBatch(texts,toLang){
const to=this.langCode(toLang),results=[];
for(let b=0;b<texts.length;b+=MS_BATCH_SIZE){
const chunk=texts.slice(b,b+MS_BATCH_SIZE);
try{const r=await gmFetchWithRetry({method:'POST',url:`https://edge.microsoft.com/translate/translatetext?from=&to=${to}&isEnterpriseClient=false`,headers:{'Content-Type':'application/json'},data:JSON.stringify(chunk)},2);
if(r.status===200)JSON.parse(r.responseText).forEach(item=>results.push(item.translations[0].text));
else for(let i=0;i<chunk.length;i++)results.push(null)}
catch(e){for(let i=0;i<chunk.length;i++)results.push(null)}}
return results}},
tencent:{
name:'Tencent',_clientKey:null,
getClientKey(){
if(this._clientKey)return this._clientKey;
let uid=window.crypto?.randomUUID?.()||(Math.random().toString(36).substring(2,15)+Math.random().toString(36).substring(2,15));
this._clientKey='browser-chrome-120.0-Windows_10-'+uid+'-'+Date.now();return this._clientKey},
langCode(l){const m={'zh':'zh','zh-CN':'zh','zh-TW':'zh-TW'};return m[l]||l},
async translate(text,toLang){
const to=this.langCode(toLang);
const r=await gmFetchWithRetry({method:'POST',url:'https://transmart.qq.com/api/imt',headers:{'Content-Type':'application/json'},data:JSON.stringify({header:{fn:'auto_translation',session:'',client_key:this.getClientKey(),user:''},type:'plain',model_category:'normal',text_domain:'general',source:{lang:'auto',text_list:[text]},target:{lang:to}})},2);
if(r.status!==200)throw new Error('Tencent error');return JSON.parse(r.responseText).auto_translation[0]},
async translateBatch(texts,toLang){
const to=this.langCode(toLang);
const r=await gmFetchWithRetry({method:'POST',url:'https://transmart.qq.com/api/imt',headers:{'Content-Type':'application/json'},data:JSON.stringify({header:{fn:'auto_translation',session:'',client_key:this.getClientKey(),user:''},type:'plain',model_category:'normal',text_domain:'general',source:{lang:'auto',text_list:texts},target:{lang:to}})},2);
if(r.status!==200)throw new Error('Tencent batch error');return JSON.parse(r.responseText).auto_translation}},
deepseek:{
name:'DeepSeek (AI)',isAI:true,
async translate(text,toLang){return await aiSingleTranslate(text,toLang,aiConfig.deepseek.key,aiConfig.deepseek.model,'https://api.deepseek.com/chat/completions','DeepSeek')},
async translateBatch(texts,toLang){return await aiBatchTranslate(texts,toLang,aiConfig.deepseek.key,aiConfig.deepseek.model,'https://api.deepseek.com/chat/completions','DeepSeek')}},
glm:{
name:'GLM-4 (AI)',isAI:true,
async translate(text,toLang){return await aiSingleTranslate(text,toLang,aiConfig.glm.key,aiConfig.glm.model,'https://open.bigmodel.cn/api/paas/v4/chat/completions','GLM')},
async translateBatch(texts,toLang){return await aiBatchTranslate(texts,toLang,aiConfig.glm.key,aiConfig.glm.model,'https://open.bigmodel.cn/api/paas/v4/chat/completions','GLM')}}};
async function translate(text){
if(!text||!text.trim())return null;
const trimmed=text.trim();if(/^\d+$/.test(trimmed))return null;
const cached=cacheGet(trimmed);if(cached)return cached;
const gen=taskGen;
const accept=r=>{if(!r||r===trimmed||gen!==taskGen)return null;cacheSet(trimmed,r);return r};
try{const r=accept(await Engine[currentEngine].translate(trimmed,targetLang));if(r)return r}
catch(e){
if(Engine[currentEngine].isAI)return null;
if(currentEngine==='microsoft'){
try{const r=await Engine.tencent.translate(trimmed,targetLang);
if(r&&r!==trimmed){currentEngine='tencent';GM_setValue('engine','tencent');const es=$('tuEngine');if(es)es.value='tencent';updateStatus('⚠️ 微软不可用，已自动切换腾讯');return accept(r)}}catch(e2){}}
const fb=currentEngine==='google'?'microsoft':'google_legacy';
try{const r=accept(await Engine[fb].translate(trimmed,targetLang));if(r)return r}catch(_){}}
return null}
async function batchTranslate(texts){
const gen=taskGen;
const results=new Array(texts.length).fill(null);
const uniqueTexts=[],textToIndices=new Map(),seenInBatch=new Set();
for(let i=0;i<texts.length;i++){
const t=texts[i].trim();if(!t||/^\d+$/.test(t))continue;
const c=cacheGet(t);if(c){results[i]=c;continue}
if(!seenInBatch.has(t)){uniqueTexts.push(t);seenInBatch.add(t);textToIndices.set(t,[i])}else textToIndices.get(t).push(i)}
if(uniqueTexts.length===0)return results;
const engine=Engine[currentEngine];
const fillResults=(text,translation)=>{
if(!translation||gen!==taskGen)return;
cacheSet(text,translation);
const idx=textToIndices.get(text);if(idx)idx.forEach(i=>results[i]=translation)};
if(engine.isAI&&engine.translateBatch){
try{const br=await engine.translateBatch(uniqueTexts,targetLang);
if(br)for(let j=0;j<br.length;j++){if(br[j]&&br[j]!==uniqueTexts[j])fillResults(uniqueTexts[j],br[j])}
return results}catch(e){}}
if(engine.translateBatch){
try{
const BATCH_SIZE=currentEngine==='microsoft'?MS_BATCH_SIZE:DEFAULT_BATCH_SIZE;
for(let b=0;b<uniqueTexts.length;b+=BATCH_SIZE){
const chunk=uniqueTexts.slice(b,b+BATCH_SIZE);
try{const br=await engine.translateBatch(chunk,targetLang);
if(br)for(let j=0;j<br.length;j++){if(br[j]&&br[j]!==chunk[j])fillResults(chunk[j],br[j])}}
catch(e){
if(currentEngine==='microsoft'){
try{const tr=await Engine.tencent.translateBatch(chunk,targetLang);
if(tr){for(let j=0;j<tr.length;j++){if(tr[j]&&tr[j]!==chunk[j])fillResults(chunk[j],tr[j])}
currentEngine='tencent';GM_setValue('engine','tencent');const es=$('tuEngine');if(es)es.value='tencent';updateStatus('⚠️ 微软不可用，已自动切换腾讯');continue}}catch(e2){}}
for(const t of chunk){try{const r=await translate(t);if(r)fillResults(t,r)}catch(_){}}}}
return results}catch(e){}}
const concurrency=engine.isAI?AI_CONCURRENCY_LIMIT:CONCURRENCY_LIMIT;
const requestDelay=engine.isAI?AI_REQUEST_DELAY:0;
for(let i=0;i<uniqueTexts.length;i+=concurrency){
const batch=uniqueTexts.slice(i,i+concurrency);
await Promise.allSettled(batch.map(async(text,idx)=>{
try{if(requestDelay>0)await delay(idx*requestDelay);
const r=await engine.translate(text,targetLang);if(r)fillResults(text,r)}
catch(e){
if(currentEngine==='microsoft'){try{const r2=await Engine.tencent.translate(text,targetLang);if(r2){fillResults(text,r2);currentEngine='tencent';GM_setValue('engine','tencent');updateStatus('⚠️ 微软不可用，已自动切换腾讯')}}catch(_){}}}}));
if(requestDelay>0&&i+concurrency<uniqueTexts.length)await delay(requestDelay)}
return results}
const SKIP_TAGS=/^(script|style|code|pre|svg|math|noscript|iframe|canvas|video|audio|img|br|hr|input|select|option|textarea)$/i;
const SKIP_CLASS=/translate-ui|notranslate|katex|mathjax/i;
function shouldSkip(node){
if(!node)return true;
if(node.nodeType===Node.ELEMENT_NODE){
if(SKIP_TAGS.test(node.tagName))return true;
if(SKIP_CLASS.test(node.className))return true;
if(node.isContentEditable)return true;
if(node.dataset&&node.dataset.translated)return true;
if(node.classList&&node.classList.contains('tu-bi'))return true}
return false}
const SCRIPT_PATTERNS={};
for(const s of sp('Latin Cyrillic Arabic Greek Hebrew Devanagari Thai Lao Khmer Myanmar Bengali Tamil Telugu Kannada Malayalam Gujarati Gurmukhi Sinhala Georgian Armenian'))SCRIPT_PATTERNS[s.toLowerCase()]=new RegExp('^[\\p{Script='+s+'}\\s\\d\\p{P}\\p{S}]+$','u');
const CJK_PATTERNS={zh:/^[\p{Script=Han}\s\d\p{P}\p{S}]+$/u,ja:/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s\d\p{P}\p{S}]+$/u,ko:/^[\p{Script=Hangul}\s\d\p{P}\p{S}]+$/u};
const LANG_SCRIPT={};
for(const [sc,ls] of Object.entries({cyrillic:'ru uk bg sr be mk kk ky mn tg tt',greek:'el',hebrew:'he',arabic:'ar fa ur ps ckb sd ug',devanagari:'hi mr ne sa mai bho',thai:'th',lao:'lo',khmer:'km',myanmar:'my',bengali:'bn as',tamil:'ta',telugu:'te',kannada:'kn',malayalam:'ml',gujarati:'gu',gurmukhi:'pa',sinhala:'si',georgian:'ka',armenian:'hy'}))for(const l of sp(ls))LANG_SCRIPT[l]=sc;
const LATIN_LANGS=new Set(sp('en fr de es it pt nl pl cs sk hu ro hr sl lt lv et fi sv da no is tr id ms vi ca gl eu cy ga gd lb af sw ha ig yo zu xh sn st so mg ny rw eo la co fy sq az uz tk ceb fil jv su hmn ht oc sc scn br war wo'));
const _langRegex={};
function getLangRegex(lang){
if(lang in _langRegex)return _langRegex[lang];
let re=CJK_PATTERNS[lang]||null;
if(!re){const script=LANG_SCRIPT[lang]||(LATIN_LANGS.has(lang)?'latin':null);if(script)re=SCRIPT_PATTERNS[script]}
_langRegex[lang]=re||null;return _langRegex[lang]}
function isTargetLang(text){if(!text||!text.trim())return true;const lang=targetLang.split('-')[0];const re=getLangRegex(lang);return re?re.test(text.trim()):false}
const PRE_WHITELIST_IDS=new Set(['exifInfo']);
function isTranslatablePre(el){return !!el&&el.nodeType===Node.ELEMENT_NODE&&el.tagName==='PRE'&&!!el.id&&PRE_WHITELIST_IDS.has(el.id)}
const EXIF_KEY_MAP=kv("ImageWidth=图像宽度|ImageHeight=图像高度|ImageLength=图像高度|ExifImageWidth=Exif 图像宽度|ExifImageHeight=Exif 图像高度|PixelXDimension=像素宽度|PixelYDimension=像素高度|ResolutionUnit=分辨率单位|XResolution=水平分辨率|YResolution=垂直分辨率|FocalPlaneResolutionUnit=焦平面分辨率单位|FocalPlaneXResolution=焦平面水平分辨率|FocalPlaneYResolution=焦平面垂直分辨率|Make=品牌|Model=型号|Software=软件|HostComputer=设备|LensMake=镜头品牌|LensModel=镜头型号|LensInfo=镜头信息|LensSerialNumber=镜头序列号|BodySerialNumber=机身序列号|SerialNumber=序列号|OwnerName=所有者|Artist=作者|Copyright=版权|ImageDescription=图像描述|UserComment=用户备注|ImageUniqueID=图像唯一标识|Orientation=方向|YCbCrPositioning=YCbCr 定位|YCbCrSubSampling=YCbCr 子采样|Compression=压缩方式|PhotometricInterpretation=色彩解释|BitsPerSample=位深|SamplesPerPixel=每像素采样数|PlanarConfiguration=平面配置|ModifyDate=修改时间|CreateDate=创建时间|DateTimeOriginal=拍摄时间|DateTimeDigitized=数字化时间|DateTime=时间|OffsetTime=时区偏移|OffsetTimeOriginal=拍摄时区偏移|OffsetTimeDigitized=数字化时区偏移|SubSecTime=亚秒时间|SubSecTimeOriginal=原始亚秒时间|SubSecTimeDigitized=数字化亚秒时间|ISO=ISO 感光度|ISOSpeedRatings=ISO 感光度|PhotographicSensitivity=ISO 感光度|SensitivityType=感光度类型|RecommendedExposureIndex=推荐曝光指数|StandardOutputSensitivity=标准输出灵敏度|ExposureTime=快门速度|ShutterSpeedValue=快门速度值|FNumber=光圈|ApertureValue=光圈值|MaxApertureValue=最大光圈值|BrightnessValue=亮度值|ExposureProgram=曝光程序|ExposureMode=曝光模式|ExposureCompensation=曝光补偿|ExposureBiasValue=曝光补偿|MeteringMode=测光模式|LightSource=光源|Flash=闪光灯|FlashEnergy=闪光强度|WhiteBalance=白平衡|FocalLength=焦距|FocalLengthIn35mmFormat=等效 35mm 焦距|DigitalZoomRatio=数码变焦倍数|SensingMethod=感光元件类型|FileSource=文件来源|SceneType=场景类型|SceneCaptureType=场景拍摄类型|CustomRendered=自定义渲染|GainControl=增益控制|Contrast=对比度|Saturation=饱和度|Sharpness=锐度|SubjectDistance=主体距离|SubjectDistanceRange=主体距离范围|SubjectArea=主体区域|ColorSpace=色彩空间|ComponentsConfiguration=分量配置|CompressedBitsPerPixel=每像素压缩位数|ExifVersion=Exif 版本|FlashpixVersion=Flashpix 版本|InteropIndex=互操作索引|InteropVersion=互操作版本|ThumbnailOffset=缩略图偏移|ThumbnailLength=缩略图大小|GPSVersionID=GPS 版本|GPSLatitude=GPS 纬度|GPSLatitudeRef=GPS 纬度基准|GPSLongitude=GPS 经度|GPSLongitudeRef=GPS 经度基准|GPSAltitude=GPS 海拔|GPSAltitudeRef=GPS 海拔基准|GPSTimeStamp=GPS 时间戳|GPSDateStamp=GPS 日期|GPSProcessingMethod=GPS 定位方式|GPSMapDatum=GPS 大地基准|GPSSpeed=GPS 速度|GPSSpeedRef=GPS 速度单位|GPSTrack=GPS 航向|GPSTrackRef=GPS 航向基准|GPSImgDirection=GPS 拍摄方向|GPSImgDirectionRef=GPS 拍摄方向基准|GPSDOP=GPS 精度因子|GPSSatellites=GPS 卫星数|GPSStatus=GPS 状态|GPSMeasureMode=GPS 测量模式|latitude=纬度|longitude=经度|altitude=海拔");
const EXIF_KEEP_VALUE_KEYS=new Set(sp('Make Model Software HostComputer LensMake LensModel LensInfo LensSerialNumber BodySerialNumber SerialNumber OwnerName Artist Copyright ImageUniqueID InteropIndex InteropVersion ExifVersion FlashpixVersion GPSVersionID GPSProcessingMethod ComponentsConfiguration GPSMapDatum GPSSatellites'));
const EXIF_VALUE_MAP=kv("inches=英寸|inch=英寸|cm=厘米|centimeters=厘米|centimeter=厘米|none=无|unknown=未知|not defined=未定义|undefined=未定义|auto=自动|manual=手动|normal=标准|standard=标准|low=低|high=高|soft=柔和|hard=强烈|off=关闭|on=开启|yes=是|no=否|other=其他|normal program=标准程序|program ae=程序自动|program=程序自动|aperture-priority ae=光圈优先|aperture priority=光圈优先|shutter speed priority ae=快门优先|shutter priority=快门优先|manual exposure=手动曝光|bulb=B 门|creative (slow speed)=创意（慢速）|action (high speed)=运动（高速）|portrait=人像|portrait mode=人像模式|landscape=风景|landscape mode=风景模式|one-chip color area sensor=单芯片彩色区域传感器|two-chip color area sensor=双芯片彩色区域传感器|three-chip color area sensor=三芯片彩色区域传感器|color sequential area sensor=色彩顺序区域传感器|color sequential linear sensor=色彩顺序线性传感器|trilinear sensor=三线性传感器|monochrome area sensor=单色区域传感器|monochrome linear sensor=单色线性传感器|centerweightedaverage=中央重点测光|center-weighted average=中央重点测光|center weighted average=中央重点测光|average=平均测光|spot=点测光|multispot=多点测光|multi-spot=多点测光|pattern=分区测光|multi-segment=分区测光|partial=部分测光|directly photographed=直接拍摄|not a directly photographed image=非直接拍摄图像|digital still camera=数码相机|film scanner=胶片扫描仪|reflection print scanner=反射稿扫描仪|flash did not fire=未闪光|flash did not fire, compulsory flash mode=未闪光（强制闪光模式）|flash did not fire, auto mode=未闪光（自动模式）|flash did not fire, compulsory flash suppression=未闪光（强制关闭闪光）|no flash function=无闪光功能|flash fired=已闪光|flash fired, compulsory flash mode=已闪光（强制闪光模式）|flash fired, auto mode=已闪光（自动模式）|flash fired, red-eye reduction=已闪光（防红眼）|off, did not fire=关闭，未闪光|on, fired=开启，已闪光|auto, did not fire=自动，未闪光|auto, fired=自动，已闪光|daylight=日光|fine weather=晴天|cloudy weather=阴天|cloudy=阴天|shade=阴影|shadow=阴影|fluorescent=荧光灯|daylight fluorescent=日光型荧光灯|day white fluorescent=中性白荧光灯|cool white fluorescent=冷白荧光灯|white fluorescent=白色荧光灯|warm white fluorescent=暖白荧光灯|tungsten=白炽灯|tungsten (incandescent light)=白炽灯|flash=闪光灯|standard light a=标准光源 A|standard light b=标准光源 B|standard light c=标准光源 C|iso studio tungsten=ISO 影棚白炽灯|other light source=其他光源|srgb=sRGB|uncalibrated=未校准|adobe rgb=Adobe RGB|auto white balance=自动白平衡|manual white balance=手动白平衡|horizontal (normal)=水平（正常）|rotate 90 cw=顺时针旋转 90°|rotate 180=旋转 180°|rotate 270 cw=顺时针旋转 270°|mirror horizontal=水平镜像|mirror vertical=垂直镜像|mirror horizontal and rotate 90 cw=水平镜像并顺时针旋转 90°|mirror horizontal and rotate 270 cw=水平镜像并顺时针旋转 270°|night scene=夜景|close view=近景|distant view=远景|macro=微距|no gain=无增益|low gain up=低增益提升|high gain up=高增益提升|low gain down=低增益降低|high gain down=高增益降低|normal process=标准处理|custom process=自定义处理|above sea level=海平面以上|below sea level=海平面以下|measurement in progress=测量中|measurement interoperability=测量有效|2-dimensional measurement=二维测量|3-dimensional measurement=三维测量|km/h=公里/小时|mph=英里/小时|knots=节|magnetic north=磁北|true north=真北|north=北|south=南|east=东|west=西");
const HAS_LATIN_WORD=/\p{Script=Latin}{2,}/u;
const DATE_TOSTRING_RE=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}\b/;
const DATE_ISO_RE=/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/;
function localizeDateValue(value){
if(!DATE_TOSTRING_RE.test(value)&&!DATE_ISO_RE.test(value))return null;
const d=new Date(value);
if(isNaN(d.getTime()))return null;
try{const s=new Intl.DateTimeFormat(targetLang,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZoneName:'short'}).format(d);
return s===value?null:s}catch(_){return null}}
function normalizeExifValue(v){return v.trim().toLowerCase().replace(/\s+/g,' ')}
function exifDictEnabled(){return targetLang==='zh-CN'||targetLang==='zh'}
function lookupExifKey(key){
if(!exifDictEnabled())return null;
if(Object.prototype.hasOwnProperty.call(EXIF_KEY_MAP,key))return EXIF_KEY_MAP[key];
const lower=key.toLowerCase();
for(const k in EXIF_KEY_MAP){if(k.toLowerCase()===lower)return EXIF_KEY_MAP[k]}
return null}
function lookupExifValue(value){
if(!exifDictEnabled())return null;
const norm=normalizeExifValue(value);
return Object.prototype.hasOwnProperty.call(EXIF_VALUE_MAP,norm)?EXIF_VALUE_MAP[norm]:null}
const EXIF_KV_RE=/^([^:：]+)([:：][ \t]*)([\s\S]*)$/;
function splitIndent(line){const m=line.match(/^([ \t]*)([\s\S]*?)([ \t]*)$/);return{prefix:m[1],core:m[2],suffix:m[3]}}
function planExifLine(line){
const{prefix,core,suffix}=splitIndent(line);
if(!core)return null;
const m=core.match(EXIF_KV_RE),tokens=[];
let localChanged=false,pending=0;
if(!m){if(!HAS_LATIN_WORD.test(core)||isTargetLang(core))return null;tokens.push({src:core,out:null});return{prefix,suffix,tokens}}
const rawKey=m[1],sep=m[2],rawValue=m[3];
let keyIsForeign=false;
if(!HAS_LATIN_WORD.test(rawKey)||isTargetLang(rawKey))tokens.push({lit:rawKey});
else{keyIsForeign=true;const mapped=lookupExifKey(rawKey.trim());
if(mapped){tokens.push({lit:rawKey.replace(rawKey.trim(),mapped)});localChanged=true}
else{tokens.push({src:rawKey,out:null});pending++}}
tokens.push({lit:sep});
const dateStr=localizeDateValue(rawValue.trim()),dictStr=dateStr?null:lookupExifValue(rawValue);
if(dateStr){tokens.push({lit:rawValue.replace(rawValue.trim(),dateStr)});localChanged=true}
else if(dictStr&&dictStr!==rawValue.trim()){tokens.push({lit:rawValue.replace(rawValue.trim(),dictStr)});localChanged=true}
else if(EXIF_KEEP_VALUE_KEYS.has(rawKey.trim())||!HAS_LATIN_WORD.test(rawValue)||!/\s/.test(rawValue.trim())||!keyIsForeign)tokens.push({lit:rawValue});
else{tokens.push({src:rawValue,out:null});pending++}
if(!localChanged&&pending===0)return null;
return{prefix,suffix,tokens}}
function renderExifPlan(plan){
let out='';
for(const t of plan.tokens)out+=(t.src!==undefined)?(t.out!==null&&t.out!==undefined?t.out:t.src):t.lit;
return plan.prefix+out+plan.suffix}
let suppressMutations=false;
function applyExifJob(job){
const lines=job.original.split('\n');
for(let i=0;i<job.plans.length;i++){const plan=job.plans[i];if(plan)lines[i]=renderExifPlan(plan)}
const rendered=lines.join('\n');
if(rendered===job.original)return false;
const node=job.node,parent=node.parentElement;
if(!parent)return false;
if(node._tuOriginalText===undefined)node._tuOriginalText=job.original;
translatedNodes.add(node);
suppressMutations=true;
try{
if(displayMode==='bilingual'){
let el=node._tuBiEl;
if(!el||!el.isConnected){el=document.createElement('span');el.className='tu-bi';node._tuBiEl=el;
if(node.nextSibling)parent.insertBefore(el,node.nextSibling);else parent.appendChild(el)}
el.textContent='\n'+rendered}
else node.textContent=rendered}
finally{suppressMutations=false}
return true}
async function processExifPre(pre){
if(!pre||!pre.isConnected)return;
if(displayMode==='original')return;
const gen=taskGen;
const jobs=[];
const walker=document.createTreeWalker(pre,NodeFilter.SHOW_TEXT,null);
while(walker.nextNode()){
const node=walker.currentNode,parent=node.parentElement;
if(parent&&parent.classList&&parent.classList.contains('tu-bi'))continue;
const original=node._tuOriginalText!==undefined?node._tuOriginalText:node.textContent;
if(!original||original.indexOf('\n')===-1&&!HAS_LATIN_WORD.test(original))continue;
const plans=original.split('\n').map(planExifLine);
if(!plans.some(Boolean))continue;
jobs.push({node,original,plans})}
if(jobs.length===0)return;
for(const job of jobs)applyExifJob(job);
const texts=[],metas=[];
for(const job of jobs){for(const plan of job.plans){if(!plan)continue;
for(const t of plan.tokens){if(t.src!==undefined&&(t.out===null||t.out===undefined)){texts.push(t.src);metas.push(t)}}}}
if(texts.length===0)return;
const results=await batchTranslate(texts);
if(gen!==taskGen)return;
let any=false;
for(let i=0;i<metas.length;i++){if(results[i]){metas[i].out=results[i];any=true}}
if(!any)return;
for(const job of jobs)applyExifJob(job)}
function collectExifPres(root){
const out=[];
if(!root||root.nodeType!==Node.ELEMENT_NODE)return out;
if(isTranslatablePre(root))out.push(root);
if(root.querySelectorAll)for(const el of root.querySelectorAll('pre')){if(isTranslatablePre(el))out.push(el)}
return out}
function collectTextNodes(root){
const nodes=[];
const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
if(shouldSkip(node.parentElement))return NodeFilter.FILTER_REJECT;
const text=node.textContent.trim();
if(!text||text.length<2||/^\d+$/.test(text))return NodeFilter.FILTER_REJECT;
if(isTargetLang(text))return NodeFilter.FILTER_REJECT;
if(node._tuTranslated)return NodeFilter.FILTER_REJECT;
return NodeFilter.FILTER_ACCEPT}});
while(walker.nextNode())nodes.push(walker.currentNode);
return nodes}
function collectPlaceholders(root){return [...root.querySelectorAll('input[placeholder], textarea[placeholder]')].filter(el=>!el.dataset.translated&&el.placeholder.trim()&&!isTargetLang(el.placeholder))}
let visibilityObserver=null;
const pendingQueue=[];
let processTimer=null;
const translatedNodes=new Set(),translatedElements=new Set();
function initObserver(){
if(visibilityObserver)visibilityObserver.disconnect();
visibilityObserver=new IntersectionObserver(entries=>{
for(const entry of entries){if(entry.isIntersecting){visibilityObserver.unobserve(entry.target);pendingQueue.push(entry.target)}}
if(pendingQueue.length>0&&!processTimer)processTimer=setTimeout(processVisibleQueue,150)},{rootMargin:'300px 0px',threshold:0})}
async function processVisibleQueue(){
processTimer=null;
if(pendingQueue.length===0)return;
const gen=taskGen;
const elements=[...pendingQueue];pendingQueue.length=0;
const texts=[],metas=[];
for(const el of elements){
if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
if(el.dataset.translated)continue;
const t=el.placeholder.trim();
if(t&&!isTargetLang(t)){texts.push(t);metas.push({type:'ph',el:el})}}
else{
const nodes=[];
const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode(node){if(shouldSkip(node.parentElement)||node._tuTranslated)return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});
while(walker.nextNode())nodes.push(walker.currentNode);
for(const node of nodes){const t=node.textContent.trim();if(t&&!isTargetLang(t)){texts.push(t);metas.push({type:'text',node:node})}}}}
if(texts.length===0)return;
const results=await batchTranslate(texts);
if(gen!==taskGen)return;
for(let i=0;i<metas.length;i++){
if(!results[i])continue;
const meta=metas[i];
if(meta.type==='text'){
const parent=meta.node.parentElement;if(!parent||meta.node._tuTranslated)continue;
if(meta.node._tuOriginalText===undefined)meta.node._tuOriginalText=meta.node.textContent;
meta.node._tuTranslated=true;
translatedNodes.add(meta.node);
suppressMutations=true;
try{if(displayMode==='bilingual'){const s=document.createElement('span');s.className='tu-bi';s.textContent=results[i];
if(meta.node.nextSibling)parent.insertBefore(s,meta.node.nextSibling);else parent.appendChild(s)}
else meta.node.textContent=results[i]}
finally{suppressMutations=false}}
else{
if(meta.el.dataset.translated)continue;
meta.el.dataset.originalPlaceholder=meta.el.placeholder;meta.el.placeholder=results[i];meta.el.dataset.translated='1';
translatedElements.add(meta.el)}}}
function scanAndObserve(root){
if(!visibilityObserver)initObserver();
collectExifPres(root).forEach(pre=>{processExifPre(pre).catch(e=>console.warn('[EXIF]',e))});
const nodes=collectTextNodes(root),parents=new Set();
nodes.forEach(node=>{const p=node.parentElement;if(p)parents.add(p)});
collectPlaceholders(root).forEach(el=>{if(!el.dataset.translated)parents.add(el)});
parents.forEach(el=>{try{visibilityObserver.observe(el)}catch(e){}})}
function restorePage(){
bumpGen();
if(visibilityObserver){visibilityObserver.disconnect();visibilityObserver=null}
pendingQueue.length=0;
if(processTimer){clearTimeout(processTimer);processTimer=null}
suppressMutations=true;
try{
document.querySelectorAll('.tu-bi').forEach(el=>el.remove());
translatedNodes.forEach(node=>{
if(node._tuOriginalText!==undefined){
try{node.textContent=node._tuOriginalText}catch(_){}
node._tuTranslated=false;delete node._tuOriginalText;delete node._tuBiEl}})}
finally{suppressMutations=false}
translatedNodes.clear();
translatedElements.forEach(el=>{
if(el.dataset&&el.dataset.originalPlaceholder){el.placeholder=el.dataset.originalPlaceholder;delete el.dataset.originalPlaceholder}
if(el.dataset)delete el.dataset.translated});
translatedElements.clear()}
let mutationRafId=null;
const pendingMutationRoots=new Set();
let mutationObserver=null;
function initMutationObserver(){
if(mutationObserver)mutationObserver.disconnect();
mutationObserver=new MutationObserver(mutations=>{
if(!autoMode||suppressMutations)return;
for(const m of mutations){
if(m.type==='characterData'){const p=m.target.parentElement;if(p&&isTranslatablePre(p))pendingMutationRoots.add(p);continue}
for(const node of m.addedNodes){
if(node.nodeType===Node.ELEMENT_NODE){if(isTranslatablePre(node)||!shouldSkip(node))pendingMutationRoots.add(node)}
else if(node.nodeType===Node.TEXT_NODE){const p=node.parentElement;if(p&&isTranslatablePre(p))pendingMutationRoots.add(p)}}}
if(pendingMutationRoots.size>0&&!mutationRafId){
mutationRafId=setTimeout(()=>{
mutationRafId=null;
const roots=[...pendingMutationRoots];pendingMutationRoots.clear();
const pres=roots.filter(isTranslatablePre),others=roots.filter(r=>!isTranslatablePre(r));
pres.forEach(p=>{processExifPre(p).catch(e=>console.warn('[EXIF]',e))});
if(others.length>5)scanAndObserve(document.body);else others.forEach(r=>scanAndObserve(r))},200)}});
mutationObserver.observe(document.body,{childList:true,subtree:true,characterData:true})}
function buildLangOptions(){
let html='';
for(const [group,codes] of Object.entries(LANG_GROUPS)){
html+='<optgroup label="'+group+'">';
for(const code of codes){const name=ALL_LANGUAGES[code]||code;html+='<option value="'+code+'"'+(code===targetLang?' selected':'')+'>'+name+'</option>'}
html+='</optgroup>'}
return html}
function isPageInTargetLang(){const lang=(document.documentElement.lang||'').split('-')[0].toLowerCase();const target=targetLang.split('-')[0].toLowerCase();return lang===target}
function initWhenBodyReady(){if(document.body)init();else requestAnimationFrame(initWhenBodyReady)}
let _initialized=false,abortController=null,cacheSaveTimer=null,msMonitorTimer=null;
function addEvent(target,type,listener,options={}){
if(!abortController)abortController=new AbortController();
target.addEventListener(type,listener,{...options,signal:abortController.signal})}
function cleanup(){
bumpGen();
if(abortController){abortController.abort();abortController=null}
if(cacheSaveTimer){clearInterval(cacheSaveTimer);cacheSaveTimer=null}
if(msMonitorTimer){clearInterval(msMonitorTimer);msMonitorTimer=null}
if(processTimer){clearTimeout(processTimer);processTimer=null}
if(mutationRafId){clearTimeout(mutationRafId);mutationRafId=null}
if(visibilityObserver){visibilityObserver.disconnect();visibilityObserver=null}
if(mutationObserver){mutationObserver.disconnect();mutationObserver=null}
const ui=document.querySelector('.translate-ui');if(ui)ui.remove();
const style=$('tu-custom-styles');if(style)style.remove();
pendingQueue.length=0;pendingMutationRoots.clear();translatedNodes.clear();translatedElements.clear();
statusEl=null}
function clampUiPos(ui){
const badgeSize=getBadgeSize();
const maxRight=Math.max(0,window.innerWidth-badgeSize),maxBottom=Math.max(0,window.innerHeight-badgeSize);
let changed=false;
if(uiPos.right<0){uiPos.right=0;changed=true}
if(uiPos.right>maxRight){uiPos.right=maxRight;changed=true}
if(uiPos.bottom<0){uiPos.bottom=0;changed=true}
if(uiPos.bottom>maxBottom){uiPos.bottom=maxBottom;changed=true}
if(changed){ui.style.right=uiPos.right+'px';ui.style.bottom=uiPos.bottom+'px'}
return changed}
function updateUIPos(ui){
const badgeSize=getBadgeSize();
ui.style.width=badgeSize+'px';ui.style.height=badgeSize+'px';
const btn=$('tuBtn');if(btn){btn.style.width=badgeSize+'px';btn.style.height=badgeSize+'px'}
clampUiPos(ui)}
function startMicrosoftMonitor(){
if(msMonitorTimer)clearInterval(msMonitorTimer);
msMonitorTimer=setInterval(async()=>{
if(currentEngine!=='microsoft')return;
try{await Engine.microsoft.translate('test','zh-CN')}
catch(e){try{await Engine.tencent.translate('test','zh-CN');
currentEngine='tencent';GM_setValue('engine','tencent');
const es=$('tuEngine');if(es)es.value='tencent';
updateStatus('⚠️ 微软引擎失联，已自动切换腾讯')}catch(e2){}}},5*60*1000)}
async function init(){
if(_initialized)return;
cleanup();
_initialized=true;
document.querySelectorAll('[data-translated]').forEach(el=>{
if(el.dataset.originalText){
for(const child of el.childNodes){if(child.nodeType===Node.TEXT_NODE&&child._tuOriginalText===undefined){child.textContent=el.dataset.originalText;break}}
delete el.dataset.originalText}
if(el.dataset.originalPlaceholder){el.placeholder=el.dataset.originalPlaceholder;delete el.dataset.originalPlaceholder}
delete el.dataset.translated});
if(_engine==='microsoft'||_engine==='google')currentEngine=await detectEngineAuto();else currentEngine=_engine;
if(!$('tu-custom-styles')){
const IB=sp('a span em strong b i label small sub sup u').map(t=>t+' .tu-bi').join(',');
const IBB=IB.replace(/\.tu-bi/g,'.tu-bi::before'),IBA=IB.replace(/\.tu-bi/g,'.tu-bi::after');
const styleEl=document.createElement('style');
styleEl.id='tu-custom-styles';
styleEl.textContent=`.translate-ui{position:fixed;z-index:999999;font-family:system-ui,-apple-system,sans-serif;touch-action:none;overflow:visible}.translate-ui *{box-sizing:border-box;margin:0;padding:0}.tu-btn{border-radius:50%;border:none;background:#1e1e2f;color:#fff;cursor:grab;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,.3);transition:transform .2s,background .2s}.tu-btn:active{cursor:grabbing;transform:scale(.9)}.tu-btn.active{background:#1f5a3a;color:#c3e8c3}.tu-panel{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);max-height:80vh;overflow-y:auto;background:rgba(20,22,27,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.5);padding:12px;display:none;color:#eef2ff;font-size:13px;margin-bottom:8px;border:1px solid rgba(70,80,100,.5)}.tu-panel.show{display:block}.tu-panel label{display:block;margin:8px 0 4px;font-size:11px;color:#a0adc0;text-transform:uppercase;letter-spacing:.5px;font-weight:500}.tu-panel select,.tu-panel input{width:100%;padding:6px 10px;border:1px solid #3a3f4e;border-radius:10px;font-size:12px;background:#2a2e3a;color:#f0f3fa;outline:none;appearance:auto;transition:all .15s}.tu-panel select:focus,.tu-panel input:focus{border-color:#5a7cbf;box-shadow:0 0 0 2px rgba(90,124,191,.3)}.tu-panel option{background:#2a2e3a;color:#f0f3fa}.tu-ai-config{background:#1e2532;padding:8px 10px;border-radius:12px;margin-top:6px;border:1px solid #2f3b4e;display:none}.tu-ai-config.show{display:block}.tu-ai-config input{margin-top:6px;background:#262d3c}.tu-status{margin-top:10px;padding:8px;background:#1a1e26;border-radius:10px;font-size:11px;color:#b0becc;text-align:center;border:1px solid #2e3540}.tu-modes{display:flex;margin-top:8px;background:#232833;border-radius:12px;padding:3px;gap:4px}.tu-modes button{flex:1;padding:6px 0;border:none;border-radius:8px;font-size:11px;cursor:pointer;background:transparent;color:#a0aec0;transition:all .2s;font-weight:500}.tu-modes button.on{background:#3a4a6e;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}.tu-modes button:hover:not(.on){background:#2f3648;color:#e2e8ff}.tu-row{display:flex;gap:8px;margin-top:12px}.tu-row button{flex:1;padding:8px 0;border:none;border-radius:10px;font-size:12px;cursor:pointer;transition:all .2s;font-weight:500}.tu-row .tu-restore{background:#2a2f3c;color:#cbd5e6;border:1px solid #3f4658}.tu-row .tu-restore:hover{background:#353c4c;color:#fff}.tu-row .tu-go{background:#2c5a7c;color:#fff}.tu-row .tu-go:hover{background:#3671a0}.tu-row .tu-exclude{background:#6b2e3a;color:#ffcdd6}.tu-row .tu-exclude:hover{background:#8a3a48}.tu-row .tu-io{background:#3a3e52;color:#dce6f5}.tu-row .tu-io:hover{background:#4e546c}.tu-bi{display:block;margin-top:3px;font-size:.9em;line-height:1.5;color:#9ab9e0;border-left:2px solid #5a7cbf;padding-left:8px}${IB}{display:inline;border-left:none;padding-left:0;margin-top:0;margin-left:5px;font-size:.88em}${IBB}{content:"("}${IBA}{content:")"}pre .tu-bi{display:block;border-left:2px solid #5a7cbf;padding-left:8px;margin-top:0;font-size:1em}pre .tu-bi::before,pre .tu-bi::after{content:none}.tu-panel::-webkit-scrollbar{width:5px}.tu-panel::-webkit-scrollbar-track{background:#1e222a;border-radius:10px}.tu-panel::-webkit-scrollbar-thumb{background:#525c72;border-radius:10px}.tu-panel::-webkit-scrollbar-thumb:hover{background:#6f7c98}`;
document.head.appendChild(styleEl)}
const ui=document.createElement('div');
ui.className='translate-ui';
ui.style.right=uiPos.right+'px';ui.style.bottom=uiPos.bottom+'px';
ui.innerHTML='<div class="tu-panel" id="tuPanel">'+
'<label>翻译引擎</label><select id="tuEngine"><option value="microsoft">Microsoft Edge (默认)</option><option value="google">Google (Auto)</option><option value="tencent">Tencent</option><option value="deepseek">DeepSeek (AI)</option><option value="glm">GLM-4 (AI)</option><option value="google_v2">Google (v2)</option><option value="google_legacy">Google (Legacy)</option></select>'+
'<div id="tuAiConfig" class="tu-ai-config"><label style="margin-top:0">API Key</label><input type="text" id="tuApiKey" placeholder="sk-..."><label>模型名称</label><input type="text" id="tuModel" placeholder="例如: deepseek-chat"></div>'+
'<label>目标语言</label><select id="tuLang">'+buildLangOptions()+'</select>'+
'<label>显示模式</label><div class="tu-modes" id="tuModes"><button data-m="translated"'+(displayMode==='translated'?' class="on"':'')+'>仅译文</button><button data-m="bilingual"'+(displayMode==='bilingual'?' class="on"':'')+'>双语</button><button data-m="original"'+(displayMode==='original'?' class="on"':'')+'>原文</button></div>'+
'<div class="tu-status" id="tuStatus">Ready · 缓存: '+cache.size+'</div>'+
'<div class="tu-row"><button class="tu-restore" id="tuRestore">还原</button><button class="tu-go" id="tuGo">翻译</button></div>'+
'<div class="tu-row"><button class="tu-exclude" id="tuExclude">排除此站</button><button class="tu-io" id="tuClearCache">清缓存</button></div>'+
'<div class="tu-row"><button class="tu-io" id="tuExport">导出配置</button><button class="tu-io" id="tuImport">导入配置</button></div>'+
'<input type="file" id="tuFileInput" accept=".json" style="display:none;">'+
'</div>'+
'<button class="tu-btn'+(autoMode?' active':'')+'" id="tuBtn" draggable="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg></button>';
document.body.appendChild(ui);
updateUIPos(ui);
const panel=$('tuPanel');panel.style.width=getPanelWidth()+'px';
const btn=$('tuBtn'),engineSelect=$('tuEngine'),langSelect=$('tuLang');
statusEl=$('tuStatus');
const modesEl=$('tuModes'),aiConfigDiv=$('tuAiConfig'),apiKeyInput=$('tuApiKey'),modelInput=$('tuModel');
engineSelect.value=currentEngine;langSelect.value=targetLang;
function updateAiConfigUI(){
const se=engineSelect.value,isAI=Engine[se]?.isAI;
if(isAI){aiConfigDiv.classList.add('show');
if(se==='deepseek'){apiKeyInput.value=aiConfig.deepseek.key;modelInput.value=aiConfig.deepseek.model;modelInput.placeholder="deepseek-chat"}
else if(se==='glm'){apiKeyInput.value=aiConfig.glm.key;modelInput.value=aiConfig.glm.model;modelInput.placeholder="glm-4-flash"}}
else aiConfigDiv.classList.remove('show')}
updateAiConfigUI();
let isDragging=false,startX,startY,startRight,startBottom,hasMoved=false;
addEvent(btn,'pointerdown',e=>{isDragging=true;startX=e.clientX;startY=e.clientY;startRight=uiPos.right;startBottom=uiPos.bottom;hasMoved=false;btn.setPointerCapture(e.pointerId)});
addEvent(btn,'pointermove',e=>{
if(!isDragging)return;
const dx=startX-e.clientX,dy=startY-e.clientY;
if(Math.abs(dx)>3||Math.abs(dy)>3)hasMoved=true;
let newRight=startRight+dx,newBottom=startBottom+dy;
const badgeSize=getBadgeSize();
newRight=Math.max(0,Math.min(newRight,Math.max(0,window.innerWidth-badgeSize)));
newBottom=Math.max(0,Math.min(newBottom,Math.max(0,window.innerHeight-badgeSize)));
ui.style.right=newRight+'px';ui.style.bottom=newBottom+'px'});
addEvent(btn,'pointerup',()=>{if(!isDragging)return;isDragging=false;uiPos.right=parseInt(ui.style.right);uiPos.bottom=parseInt(ui.style.bottom);GM_setValue('uiPos',JSON.stringify(uiPos))});
addEvent(btn,'click',e=>{if(hasMoved)return;e.stopPropagation();panel.classList.toggle('show')});
addEvent(document,'click',e=>{if(!ui.contains(e.target))panel.classList.remove('show')});
addEvent(engineSelect,'change',async()=>{
currentEngine=engineSelect.value;GM_setValue('engine',currentEngine);bumpGen();updateAiConfigUI();
updateStatus('切换至: '+(Engine[currentEngine]?Engine[currentEngine].name:currentEngine));
if(displayMode!=='original'&&autoMode){restorePage();updateStatus('正在重新翻译...');scanAndObserve(document.body)}});
addEvent(apiKeyInput,'blur',()=>{
const val=apiKeyInput.value.trim();
if(engineSelect.value==='deepseek'){aiConfig.deepseek.key=val;GM_setValue('deepseekKey',val)}
else if(engineSelect.value==='glm'){aiConfig.glm.key=val;GM_setValue('glmKey',val)}});
addEvent(modelInput,'blur',()=>{
const val=modelInput.value.trim();
if(engineSelect.value==='deepseek'){aiConfig.deepseek.model=val;GM_setValue('deepseekModel',val)}
else if(engineSelect.value==='glm'){aiConfig.glm.model=val;GM_setValue('glmModel',val)}});
addEvent(langSelect,'change',async()=>{
targetLang=langSelect.value;GM_setValue('targetLang',targetLang);bumpGen();
updateStatus('语种切为: '+(ALL_LANGUAGES[targetLang]||targetLang));
if(displayMode!=='original'&&autoMode){restorePage();updateStatus('正在更新翻译...');scanAndObserve(document.body)}});
addEvent(modesEl,'click',async e=>{
const b=e.target.closest('button[data-m]');if(!b)return;
const m=b.dataset.m;if(m===displayMode)return;
modesEl.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
displayMode=m;GM_setValue('displayMode',m);
if(m==='original'){restorePage();btn.classList.remove('active');updateStatus('显示原文')}
else{restorePage();btn.classList.add('active');updateStatus(m==='bilingual'?'双语翻译中...':'翻译中...');scanAndObserve(document.body)}});
addEvent($('tuGo'),'click',async()=>{
if(apiKeyInput.value)apiKeyInput.dispatchEvent(new Event('blur'));
if(modelInput.value)modelInput.dispatchEvent(new Event('blur'));
panel.classList.remove('show');btn.classList.add('active');
autoMode=true;GM_setValue('autoMode',true);restorePage();
updateStatus('翻译中...');scanAndObserve(document.body);
setTimeout(()=>updateStatus('已开始处理可见区域...'),100)});
addEvent($('tuRestore'),'click',()=>{panel.classList.remove('show');btn.classList.remove('active');autoMode=false;GM_setValue('autoMode',false);restorePage();updateStatus('已还原')});
addEvent($('tuExclude'),'click',()=>{if(!excludedHosts.includes(location.host)){excludedHosts.push(location.host);GM_setValue('excludedHosts',JSON.stringify(excludedHosts))}location.reload()});
addEvent($('tuClearCache'),'click',()=>{if(confirm('确定要清除所有翻译缓存吗？')){clearCache();updateStatus('缓存已清空')}});
addEvent($('tuExport'),'click',()=>{
saveCache(true);
const data={engine:currentEngine,targetLang:targetLang,autoMode:autoMode,excludedHosts:excludedHosts,displayMode:displayMode,uiPos:uiPos,deepseek:aiConfig.deepseek,glm:aiConfig.glm,translationCache:Object.fromEntries(cache)};
const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download="翻译配置.json";a.click();URL.revokeObjectURL(url);
updateStatus("✅ 配置已导出（含 API Key，请妥善保管）")});
const fileInput=$('tuFileInput');
addEvent($('tuImport'),'click',()=>fileInput.click());
addEvent(fileInput,'change',e=>{
const file=e.target.files[0];if(!file)return;
const reader=new FileReader();
reader.onload=evt=>{
try{
const imported=JSON.parse(evt.target.result);
if(imported.engine)GM_setValue('engine',imported.engine);
if(imported.targetLang)GM_setValue('targetLang',imported.targetLang);
if(typeof imported.autoMode==='boolean')GM_setValue('autoMode',imported.autoMode);
if(imported.displayMode)GM_setValue('displayMode',imported.displayMode);
if(imported.excludedHosts)GM_setValue('excludedHosts',JSON.stringify(imported.excludedHosts));
if(imported.uiPos)GM_setValue('uiPos',JSON.stringify(imported.uiPos));
if(imported.deepseek){if(imported.deepseek.key)GM_setValue('deepseekKey',imported.deepseek.key);if(imported.deepseek.model)GM_setValue('deepseekModel',imported.deepseek.model)}
if(imported.glm){if(imported.glm.key)GM_setValue('glmKey',imported.glm.key);if(imported.glm.model)GM_setValue('glmModel',imported.glm.model)}
if(imported.translationCache)GM_setValue('translationCache',JSON.stringify(imported.translationCache));
alert("✅ 导入成功，即将刷新页面");location.reload()}
catch(err){alert("❌ 解析文件失败，请检查 JSON 格式")}};
reader.readAsText(file);fileInput.value=''});
addEvent(window,'resize',()=>{panel.style.width=getPanelWidth()+'px';updateUIPos(ui);GM_setValue('uiPos',JSON.stringify(uiPos))});
GM_registerMenuCommand('🚀 立即翻译当前页面',()=>{scanAndObserve(document.body)});
GM_registerMenuCommand('⏪ 还原当前页面',()=>{restorePage()});
GM_registerMenuCommand('🗑️ 清除翻译缓存',()=>{clearCache();updateStatus('缓存已清空')});
cacheSaveTimer=setInterval(saveCache,CACHE_SAVE_INTERVAL);
addEvent(window,'beforeunload',()=>saveCache(true));
initMutationObserver();
startMicrosoftMonitor();
if(autoMode&&!isPageInTargetLang()&&displayMode!=='original'){
queueMicrotask(async()=>{updateStatus(displayMode==='bilingual'?'双语翻译中...':'自动翻译中...');scanAndObserve(document.body)})}}
initWhenBodyReady();
})();
