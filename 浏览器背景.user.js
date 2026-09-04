// ==UserScript==
// @name         浏览器背景
// @namespace    明明
// @version      5.5
// @description  浏览器背景
// @author       明明
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_deleteValue
// @updateURL    https://elderberryel.github.io/mingming/%E6%B5%8F%E8%A7%88%E5%99%A8%E8%83%8C%E6%99%AF.user.js
// @downloadURL  https://elderberryel.github.io/mingming/%E6%B5%8F%E8%A7%88%E5%99%A8%E8%83%8C%E6%99%AF.user.js
// ==/UserScript==

(function(){
'use strict';
const _t0=(document.title||'').toLowerCase();
if(/just a moment|attention required|cloudflare|please wait|checking your browser|verify you are human|one more step/.test(_t0)||/\/cdn-cgi\//.test(location.pathname))return;

const SCRIPT_VERSION=(typeof GM_info!=='undefined'&&GM_info&&GM_info.script&&GM_info.script.version)||'5.5';
const CONFIG_VERSION=SCRIPT_VERSION,NODE_ID_VERSION='v89';
const CACHE_AVAILABLE=typeof caches!=='undefined'&&typeof caches.open==='function';
const THEME={LIGHT_TEXT:1,DARK_TEXT:2},THEME_LABEL={1:'浅字（暗底）',2:'深字（亮底）'},THEME_LABEL_SHORT={1:'浅字',2:'深字'};
const isValidTheme=t=>t===1||t===2;

const KEYS={url:'Vie背景图片',theme:'Vie背景',opacity:'Vie背景透明度',blur:'Vie背景模糊',enabled:'Vie背景启用',floatVisible:'Vie背景悬浮按钮显示',listMode:'Vie背景列表模式',floatPos:'Vie背景悬浮位置',nativeElementBlur:'Vie背景原生弹层模糊',overlayBlur:'Vie背景动态弹层模糊',overlayAlpha:'Vie背景动态弹层透明度',siteList:'Vie背景站点列表',siteConfigMap:'Vie背景站点配置'};
const DEFAULTS={url:'https://im.gurl.eu.org/file/AgACAgEAAxkDAAEBp_1qmih0cKuixFJVVL37VIdQdW95pAACFgxrG95F0EQR6lJDI44cmAEAAwIAA3cAAz0E.jpeg',theme:1,opacity:.5,blur:0,enabled:true,floatVisible:true,listMode:'blacklist',floatPos:{right:10,bottom:90},nativeElementBlur:10,overlayBlur:10,overlayAlpha:.1};

const STYLE_ID='vie-browser-bg-style-'+NODE_ID_VERSION,FLOAT_ID='vie-browser-bg-float-'+NODE_ID_VERSION,NATIVE_BLUR_STYLE_ID='vie-browser-bg-native-blur-style-'+NODE_ID_VERSION;
const CACHE_NAME='vie-browser-bg-images-v1',CACHE_PREFIX='[cache:local]',GM_BACKUP_PREFIX='Vie背景图片备份_',GM_FILENAME_MAP='Vie背景图片文件名映射';
const COMPRESS_THRESHOLD=1024000,COMPRESS_TARGET=1024000,MAX_IMAGE_WIDTH=1600,MAX_IMAGE_HEIGHT=2560,MAX_FILE_SIZE=15728640;
const SKELETON_BG='#999999',CONFIG_CACHE_TTL=500;
const CAPTCHA_SELECTORS=['iframe[src*="challenges.cloudflare.com"]','iframe[src*="hcaptcha.com"]','iframe[src*="recaptcha.net"]','iframe[src*="recaptcha"]','.cf-turnstile','.h-captcha','.g-recaptcha'];
const CAPTCHA_CSS_SELECTOR=CAPTCHA_SELECTORS.join(',');
const CAPTCHA_IGNORE_SRC=/recaptcha\/api2\/(aframe|webworker)|recaptcha\/releases\/|recaptcha\/api\.js/;
const SPA_WHITELIST=['pixiv.net','twitter.com','x.com','fanbox.cc'];
const X_DROPDOWN_GUARD='[id^="typeaheadDropdown"],[role="listbox"],[role="menu"],[role="combobox"],[role="dialog"],.search-suggest,.sug-list,.s-sug,[class*="suggest"],[class*="dropdown"],[class*="autocomplete"],[class*="typeahead"],[id*="search-result"],[class*="search-result"]';

const _T='transparent!important';
const BG0=`background:${_T};background-color:${_T};background-image:none!important;`;
const SH0='box-shadow:none!important;',BD0=`border-color:${_T};`;
const BF0='backdrop-filter:none!important;-webkit-backdrop-filter:none!important;';
const BD3='border-color:rgba(255,255,255,.3)!important;';
const SIDEBAR0=`[data-slot^="sidebar"]{background:${_T};background-color:${_T};${BF0}${SH0}}`;
const PSEUDO0='content:""!important;position:fixed!important;inset:0!important;z-index:-2147483647!important;pointer-events:none!important;';
const kid=s=>s.split(',').map(x=>x+' *:not(img)').join(',');
const htmlBefore=(bg,bl)=>`html::before{${PSEUDO0}${bg}opacity:1!important;filter:blur(${bl}px)!important;transform:translateZ(0)!important;}`;
const CSSVAR0=['background','card','popover','sidebar','color-background','color-card','color-popover','color-sidebar'].map(v=>`--${v}:${_T};`).join('');
const ROOT_HARDEN=`html:root,html:root body,html:root #root,html:root #app,html:root #__next,html:root #root>div{${BG0}}html:root,html:root .dark,html:root [data-theme]{${CSSVAR0}}${SIDEBAR0}`;
const MOBILE_BAR=`header.mobile-bar,.mobile-bar,[class*="mobile-bar"],.mobile-bar::before,.mobile-bar::after,.mobile-bar .mb-btn,.mobile-bar .mb-name,.mobile-bar .mb-burger,.mobile-bar .mb-theme{${BG0}${SH0}${BD0}${BF0}}.mobile-bar .mb-btn svg,.mobile-bar .mb-name{color:inherit!important;}`;
const BGVAR_SEL='[class*="bg-[rgb(var(--bg-tertiary))]"],[class*="bg-[rgb(var(--bg-secondary))]"],[class*="bg-[rgb(var(--bg-primary))]"]';

const SLOT_POPUP='[data-slot="select-content"],[data-slot="dropdown-menu-content"],[data-slot="popover-content"],[data-slot="context-menu-content"],[data-slot="menubar-content"],[data-slot="navigation-menu-content"],[data-slot="hover-card-content"],[data-slot="tooltip-content"],[data-slot="combobox-content"],[data-slot="command"],[data-slot="command-list"],[data-slot="select-popup"],[data-slot="menu-popup"],[data-slot="popover-popup"],[data-slot="tooltip-popup"]';
const SLOT_POPUP_CHILD=kid(SLOT_POPUP);
const POPUP_PANEL='[data-slot="select-content"] [data-slot="select-group"],[data-slot="select-content"] [data-slot="select-viewport"],[data-slot="command"] [data-slot="command-list"],[role="listbox"] [role="group"],[role="menu"] [role="group"],[id^="base-ui-"][id$="-list"]';
const POPUP_UNFILTER='[data-slot="select-content"],[data-slot="dropdown-menu-content"],[data-slot="context-menu-content"],[data-slot="menubar-content"],[data-slot="popover-content"],[data-slot="hover-card-content"],[data-slot="tooltip-content"],[data-slot="select-popup"],[data-slot="menu-popup"],[data-slot="popover-popup"],[id^="base-ui-"][id$="-popup"]';
const POPUP_LEAF='[data-slot="select-item"],[data-slot="select-item-text"],[data-slot="dropdown-menu-item"],[data-slot="command-item"],[role="option"],[role="menuitem"]';
const DROP='[id^="typeaheadDropdown"],.search-suggest,.sug-list,.s-sug,[class*="suggest"],[class*="dropdown"],[class*="autocomplete"],[id*="search-result"],[id*="search-results"],[id*="searchResult"],[id*="search_result"],[class*="search-result"],[class*="searchResult"],[class*="search-results"],[role="listbox"],[role="menu"],[id^="base-ui-"][id$="-list"],[id^="base-ui-"][id$="-popup"],'+SLOT_POPUP;
const DROP_CHILD=kid('[id^="typeaheadDropdown"],.search-suggest,.sug-list,.s-sug,[class*="suggest"],[id*="search-result"],[id*="search-results"],[class*="search-result"],[role="listbox"],[role="menu"],[id^="base-ui-"][id$="-list"],[id^="base-ui-"][id$="-popup"],'+SLOT_POPUP);

const XPC='[data-testid="primaryColumn"]',XABB='[data-testid="app-bar-back"]',XNAV='nav[aria-live="polite"][role="navigation"]';
const X_CSS=`${XPC} div:has(${XNAV}),${XPC} div:has(> div > div > ${XNAV}),${XPC} div:has(> ${XABB}),${XPC} div:has(> div > ${XABB}),${XPC} > div:first-child,${XPC} > div:first-child > div,${XPC} > div:first-child > div > div{background-color:${_T};${BF0}}${XPC} .r-1e5uvyk{${BF0}}${XPC} .r-17c3jg3{background-color:${_T};}${XNAV},${XNAV} > div,${XNAV} div[role="tablist"],${XNAV} div[role="presentation"],${XNAV} div[role="tab"]{background-color:${_T};${BF0}}`;

const TIEBA_CSS=`.forum_content,.forum_content .main,#content_wrap,.content_leftList,.j-content-leftList,.thread_list_bottom,.th_footer_bright,.th_footer_l,#frs_list_pager,.pagination-default,.aside,#aside,[id^="pagelet_frs-list"],[id^="pagelet_platform"],[id^="pagelet_live"],[id^="pagelet_frs-aside"],.forum_content .thread_list,.forum_content li,.forum_content .t_con,.pb_content,.left_section,.right_section,.core_title_wrap_bright,.core_title_bg,.j_core_title_bg,.tittle_fill_dom,.p_postlist,.l_post,.l_post_bright,.j_l_post,.d_post_content_main,.d_post_content,.p_content,.core_reply,.core_reply_wrapper,.core_reply_content,.j_lzl_container,.core_reply_tail,.post-tail-wrap,.pb_footer,.p_thread,.thread_theme_5,.thread_theme_7,.l_thread_info,.card_top_wrap,.card_top,.card_title,.card_head,.card_num,.sign_mod_bright,#sign_mod,.region-login,#embedded-login,.region_bright,.app_download_box,.topic_list_box,.topic_list,.item_hd,#tieba-notice,.unordered-list,.tb_rich_poster_container,.tb_rich_poster,.poster_head,.poster_body,.editor_wrapper,.editor_content_wrapper,.ueditor_container,.old_style_wrapper,.edui-container,.edui-editor-body,.edui-editor-middle,.edui-body-container,.poster_component,.editor_bottom_panel,.right_section .region_bright,#pb_content,#thread_theme_5,#thread_theme_7,.nav_wrap,.nav_wrap_add_border,#tb_nav,.nav_list,.j_nav_list,.j_tbnav_tab,.content-sec,.left-sec,.right-sec,.r-top-sec,.r-left-sec,.r-right-sec,.left-cont-wraper,#left-cont-wraper,.aggregate_entrance_wrap,.aggregate_entrance_title,.entrance_item,.u-f-t,.f-d-w,#f-d-w,.f-d-item,.f-d-item-content,.directory-wraper,.all-wraper,.all,.more-txt,.center-fixed,.forum_rcmd,#forum_rcmd,.class_title,.hot_icon_wrap,.rcmd_forum_list,.rcmd_forum_item,.rcmd_forum_link,.rcmd_forum_info,.sub_nav_wrap,.sub_nav_list,.nav_bar_fixd,#sub_nav_wrap,#like-tag-nav,#info-section,.new_list,#new_list,.j_feed_li,.n_right,.n_txt,.n_reply,.n_img,.title-tag-wraper,.thread-name-wraper,.list-post-num,.right_wrap,#right_wrap,.notice_item,#notice_item,.notice_list,.notice,.topic_list_hot,.topic_item,.btn_more,.data_loading,.data_error_bar,.lu-home-wrapper,.lu-home-wrapper-seat{${BG0}${SH0}${BD0}}#frs_list_pager .pagination-item,.pagination-default .pagination-item,.pager_theme_4 a,.pager_theme_5 a{${BG0}${BD3}}.j_signbtn,.sign_btn_bright{background:rgba(0,0,0,.25)!important;background-color:rgba(0,0,0,.25)!important;background-image:none!important;${SH0}border:1px solid rgba(255,255,255,.3)!important;border-radius:6px!important;}.j_feed_li{border-bottom:1px solid rgba(255,255,255,.12)!important;}.pass-text-input{background-color:rgba(255,255,255,.9)!important;color:#333!important;}.edui-body-container,#ueditor_replace{background-color:rgba(255,255,255,.08)!important;}`;

const Utils={
clamp(n,a,b){return Math.min(b,Math.max(a,n));},
getHost(){return location.hostname||'';},
safeJSONParse(s,d){try{return JSON.parse(s);}catch(e){return d;}},
safePos(p){const vw=innerWidth||360,vh=innerHeight||640;return{right:Utils.clamp(Number(p&&p.right)||10,0,Math.max(0,vw-46)),bottom:Utils.clamp(Number(p&&p.bottom)||90,0,Math.max(0,vh-46))};},
normalizeHost(h){return String(h||'').trim().toLowerCase();},
hostMatch(rule,host){
 rule=Utils.normalizeHost(rule);host=Utils.normalizeHost(host);
 if(!rule||!host)return false;
 if(host===rule||host.endsWith('.'+rule))return true;
 const rP=rule.split('.'),hP=host.split('.');
 if(rP.length===2)return hP.length>=2&&hP.slice(-2).join('.')===rule;
 if(rP.length>2&&hP.length>=rP.length)return hP.slice(-rP.length).join('.')===rule;
 return false;},
getTopDomain(host){
 host=Utils.normalizeHost(host);
 if(!host)return '';
 if(/^\d+\.\d+\.\d+\.\d+$/.test(host))return host;
 const p=host.split('.');
 if(p.length<=2)return host;
 const sld=['com','net','org','gov','edu','co','ac','ne','or','go'];
 if(sld.includes(p[p.length-2])&&p[p.length-1].length<=3)return p.slice(-3).join('.');
 return p.slice(-2).join('.');},
isDataImageUrl(u){return typeof u==='string'&&/^data:image\//i.test(u.trim());},
dataUrlToUint8Array(d){const b=d.split(',')[1];if(!b)return new Uint8Array(0);const s=atob(b),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;},
dataUrlToBlob(d){return new Blob([Utils.dataUrlToUint8Array(d)],{type:d.split(',')[0].match(/:(.*?);/)[1]});},
uint8ArrayToDataUrl(u,mime){let b='';const C=0x8000;for(let i=0;i<u.length;i+=C)b+=String.fromCharCode.apply(null,u.subarray(i,i+C));return 'data:'+mime+';base64,'+btoa(b);},
simpleHash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return Math.abs(h).toString(36);},
guessExt(u){if(Utils.isDataImageUrl(u)){const m=u.match(/^data:image\/(\w+)/);return m?m[1].replace('jpeg','jpg'):'png';}const m=u.match(/\.(\w{3,4})(?:\?|$)/);return m?m[1].toLowerCase():'jpg';},
getExtFromFilename(f){if(!f)return 'jpg';const p=f.split('.');return p.length<2?'jpg':p.pop().toLowerCase().replace('jpeg','jpg');},
toAbsoluteUrl(u){if(!u)return '';if(/^(data|blob|https?):/.test(u))return u;if(u.startsWith('//'))return location.protocol+u;try{return new URL(u,location.href).href;}catch(e){return u;}}
};

const Store={get:(k,d)=>GM_getValue(k,d),set:(k,v)=>GM_setValue(k,v),del(k){try{GM_deleteValue(k);}catch(e){}}};

const ImageStore={
getFilenameMap(){return Utils.safeJSONParse(Store.get(GM_FILENAME_MAP,'{}'),{});},
setFilenameMap(m){Store.set(GM_FILENAME_MAP,JSON.stringify(m));},
saveOriginalFilename(k,f){if(!k||!f)return;const m=ImageStore.getFilenameMap();m[k]=f;ImageStore.setFilenameMap(m);},
getOriginalFilename(k){if(!k)return null;return ImageStore.getFilenameMap()[k]||null;},
deleteFilenameRecord(k){if(!k)return;const m=ImageStore.getFilenameMap();delete m[k];ImageStore.setFilenameMap(m);},
generateCacheKey(){return `img_${Date.now()}_${Math.random().toString(36).substring(2,8)}`;},
isCacheKey(u){return typeof u==='string'&&u.startsWith(CACHE_PREFIX);},
extractCacheKey(u){return ImageStore.isCacheKey(u)?u.replace(CACHE_PREFIX,''):null;},
buildCacheKeyUrl(k){return CACHE_PREFIX+k;},
saveGMBackup(k,d){try{Store.set(GM_BACKUP_PREFIX+k,d);}catch(e){}},
async _put(key,dataUrl){if(!CACHE_AVAILABLE)return;try{const c=await caches.open(CACHE_NAME),b=Utils.dataUrlToBlob(dataUrl);await c.put(new Request('/'+key),new Response(b,{headers:{'Content-Type':b.type||'image/jpeg'}}));}catch(e){}},
async store(dataUrl,key,origName){
 const ck=key||ImageStore.generateCacheKey();
 await ImageStore._put(ck,dataUrl);
 ImageStore.saveGMBackup(ck,dataUrl);
 if(origName)ImageStore.saveOriginalFilename(ck,origName);
 return ck;},
async get(key){
 if(CACHE_AVAILABLE){try{const c=await caches.open(CACHE_NAME),r=await c.match(new Request('/'+key));if(r)return URL.createObjectURL(await r.blob());}catch(e){}}
 const b=Store.get(GM_BACKUP_PREFIX+key,'');
 if(b&&b.startsWith('data:image/')){await ImageStore._put(key,b);return b;}
 return null;},
async readBytes(key){
 let bytes=null;
 if(CACHE_AVAILABLE){try{const c=await caches.open(CACHE_NAME),r=await c.match(new Request('/'+key));if(r)bytes=new Uint8Array(await r.arrayBuffer());}catch(e){}}
 if(!bytes){const b=Store.get(GM_BACKUP_PREFIX+key,'');if(b&&b.startsWith('data:image/'))bytes=Utils.dataUrlToUint8Array(b);}
 return bytes;},
async remove(key){
 if(CACHE_AVAILABLE){try{await caches.open(CACHE_NAME).then(c=>c.delete(new Request('/'+key)));}catch(e){}}
 Store.del(GM_BACKUP_PREFIX+key);ImageStore.deleteFilenameRecord(key);}
};

const Config={
_cache:null,_cacheTime:0,
invalidate(){Config._cache=null;Config._cacheTime=0;},
getList(){return Utils.safeJSONParse(Store.get(KEYS.siteList,'[]'),[]);},
setList(a){Store.set(KEYS.siteList,JSON.stringify(a));},
inSiteList(host){const td=Utils.getTopDomain(host);if(!td)return false;return Config.getList().some(i=>Utils.getTopDomain(i)===td||Utils.hostMatch(i,host));},
getSiteMap(){return Utils.safeJSONParse(Store.get(KEYS.siteConfigMap,'{}'),{});},
setSiteMap(m){Store.set(KEYS.siteConfigMap,JSON.stringify(m));},
getSite(h){return Config.getSiteMap()[h]||null;},
setSite(h,c){const m=Config.getSiteMap();m[h]=c;Config.setSiteMap(m);},
removeSite(h){const m=Config.getSiteMap();delete m[h];Config.setSiteMap(m);},
getGlobal(){return{
 url:Store.get(KEYS.url,DEFAULTS.url),
 theme:Number(Store.get(KEYS.theme,DEFAULTS.theme)),
 opacity:Utils.clamp(Number(Store.get(KEYS.opacity,DEFAULTS.opacity)),.1,1),
 blur:Utils.clamp(Number(Store.get(KEYS.blur,DEFAULTS.blur)),0,50),
 enabled:Store.get(KEYS.enabled,DEFAULTS.enabled),
 floatVisible:Store.get(KEYS.floatVisible,DEFAULTS.floatVisible),
 listMode:Store.get(KEYS.listMode,DEFAULTS.listMode),
 floatPos:Utils.safeJSONParse(Store.get(KEYS.floatPos,JSON.stringify(DEFAULTS.floatPos)),DEFAULTS.floatPos),
 nativeElementBlur:Utils.clamp(Number(Store.get(KEYS.nativeElementBlur,DEFAULTS.nativeElementBlur)),0,20),
 overlayBlur:Utils.clamp(Number(Store.get(KEYS.overlayBlur,DEFAULTS.overlayBlur)),0,40),
 overlayAlpha:Utils.clamp(Number(Store.get(KEYS.overlayAlpha,DEFAULTS.overlayAlpha)),0,.8)};},
shouldApply(host,g){
 if(!g.enabled)return false;
 const s=Config.getSite(host);
 if(s&&s.enabled===false)return false;
 if(s&&s.enabled===true)return true;
 if(g.listMode==='whitelist')return Config.inSiteList(host);
 return !Config.inSiteList(host);},
merge(host){
 const now=Date.now();
 if(Config._cache&&Config._cache._host===host&&(now-Config._cacheTime)<CONFIG_CACHE_TTL)return Config._cache;
 const g=Config.getGlobal(),s=Config.getSite(host);
 const r={
  url:s&&typeof s.url==='string'?s.url:g.url,
  theme:s&&isValidTheme(s.theme)?s.theme:g.theme,
  opacity:s&&typeof s.opacity==='number'?Utils.clamp(s.opacity,.1,1):g.opacity,
  blur:s&&typeof s.blur==='number'?Utils.clamp(s.blur,0,50):g.blur,
  enabled:Config.shouldApply(host,g),
  floatVisible:g.floatVisible,listMode:g.listMode,floatPos:g.floatPos,
  nativeElementBlur:s&&typeof s.nativeElementBlur==='number'?Utils.clamp(s.nativeElementBlur,0,20):g.nativeElementBlur,
  overlayBlur:s&&typeof s.overlayBlur==='number'?Utils.clamp(s.overlayBlur,0,40):g.overlayBlur,
  overlayAlpha:s&&typeof s.overlayAlpha==='number'?Utils.clamp(s.overlayAlpha,0,.8):g.overlayAlpha,
  _host:host};
 Config._cache=r;Config._cacheTime=now;return r;},
getEffectiveOverlayValues(){
 const c=Config.merge(Utils.getHost());
 return{blur:LivePreview.overlayBlur!==null?LivePreview.overlayBlur:c.overlayBlur,alpha:LivePreview.overlayAlpha!==null?LivePreview.overlayAlpha:c.overlayAlpha};},
setGlobalValue(k,v){Config.invalidate();Store.set(k,v);StyleManager.applyAgain();},
updateCurrentSite(p){Config.invalidate();const h=Utils.getHost();Config.setSite(h,Object.assign({},Config.getSite(h)||{},p));StyleManager.applyAgain();},
toggleCurrentSiteInList(){
 const host=Utils.getHost();if(!host)return;
 const td=Utils.getTopDomain(host);let list=Config.getList();
 const sc=Config.getSite(host);if(sc&&'enabled' in sc){delete sc.enabled;Config.setSite(host,sc);}
 const tc=Config.getSite(td);if(tc&&'enabled' in tc){delete tc.enabled;Config.setSite(td,tc);}
 const i=list.findIndex(x=>Utils.getTopDomain(x)===td||Utils.hostMatch(x,host));
 const white=Config.getGlobal().listMode==='whitelist',modeText=white?'白名单':'黑名单';
 if(i>-1){list.splice(i,1);alert(`✅ 已从站点列表移除：${td}\n\n当前模式：${modeText}\n当前状态：${white?'未命中，背景已关闭':'未命中，背景已开启'}`);}
 else{list.push(td);alert(`✅ 已加入站点列表：${td}\n\n当前模式：${modeText}\n当前状态：${white?'已命中，背景已开启':'已命中，背景已关闭'}`);}
 Config.setList(list);StyleManager.applyAgain();}
};

const LivePreview={
overlayBlur:null,overlayAlpha:null,config:null,
clear(){LivePreview.overlayBlur=null;LivePreview.overlayAlpha=null;LivePreview.config=null;},
reset(){if(LivePreview.overlayBlur!==null||LivePreview.overlayAlpha!==null||LivePreview.config!==null)LivePreview.clear();StyleManager.applyStyle();OverlayEnhancer.request();}
};

const BackgroundImage={
url:null,objectUrl:null,cacheKey:null,ready:false,_readyCallbacks:[],
setUrl(u){
 if(BackgroundImage.objectUrl&&BackgroundImage.objectUrl!==u){try{URL.revokeObjectURL(BackgroundImage.objectUrl);}catch(e){}BackgroundImage.objectUrl=null;}
 BackgroundImage.url=u||null;
 if(typeof u==='string'&&u.startsWith('blob:'))BackgroundImage.objectUrl=u;},
onReady(cb){if(BackgroundImage.ready){cb();return;}BackgroundImage._readyCallbacks.push(cb);},
notifyReady(){BackgroundImage.ready=true;BackgroundImage._readyCallbacks.forEach(cb=>{try{cb();}catch(e){}});BackgroundImage._readyCallbacks=[];},
async preload(){
 const cfg=Config.merge(Utils.getHost());
 if(!cfg.enabled){BackgroundImage.ready=true;BackgroundImage.cacheKey=null;BackgroundImage.setUrl(null);BackgroundImage.notifyReady();return;}
 if(ImageStore.isCacheKey(cfg.url)){
  const key=ImageStore.extractCacheKey(cfg.url);
  if(key===BackgroundImage.cacheKey&&BackgroundImage.objectUrl){BackgroundImage.ready=true;BackgroundImage.notifyReady();return;}
  const u=await ImageStore.get(key);
  BackgroundImage.cacheKey=key;BackgroundImage.setUrl(u||null);
 }else if(Utils.isDataImageUrl(cfg.url)){
  const ck=await ImageStore.store(cfg.url,null,'migrated_image.jpg');
  if(ck){
   const h=Utils.getHost(),nu=ImageStore.buildCacheKeyUrl(ck);
   if(Config.getSite(h)&&Config.getSite(h).url===cfg.url)Config.setSite(h,Object.assign({},Config.getSite(h),{url:nu}));
   else Store.set(KEYS.url,nu);
   Config.invalidate();BackgroundImage.cacheKey=ck;BackgroundImage.setUrl(cfg.url);}
 }else{BackgroundImage.cacheKey=null;BackgroundImage.setUrl(cfg.url);}
 BackgroundImage.ready=true;BackgroundImage.notifyReady();}
};

const StyleBuilder={
background(cfg,finalUrl){
 const dm=Utils.clamp(1-cfg.opacity,0,.9),img=finalUrl||'';
 const bgCss=img
  ?htmlBefore(`background-color:${SKELETON_BG}!important;background-image:linear-gradient(rgba(0,0,0,${dm}),rgba(0,0,0,${dm})),url("${img}")!important;background-repeat:no-repeat!important;background-position:center!important;background-size:100% 100%,cover!important;`,cfg.blur)
  :htmlBefore(`background:${SKELETON_BG}!important;background-image:none!important;`,cfg.blur);
 return `html,body{${BG0}}#bgCanvas{display:none!important;}${bgCss}body::before{${PSEUDO0.replace('-2147483647','-2147483646')}background:${_T};}`
 +`*:not(img):not(svg):not(video):not(canvas):not(.translate-ui):not(.translate-ui *):not(.cf-turnstile):not(.h-captcha):not(.g-recaptcha):not(input):not(select):not(textarea):not([id^="typeaheadDropdown"]):not(.search-suggest):not(.sug-list):not(.s-sug):not([class*="suggest"]):not([class*="dropdown"]):not([class*="autocomplete"]):not([id*="search-result"]):not([id*="search-results"]):not([class*="search-result"]):not([role="listbox"]):not([role="menu"]){background-color:${_T};}`
 +`[id^="_r_"],[id^="_r_"] *{${BG0}${SH0}}`
 +`#container,#header,#logo,#wrapper,#page,#main,.container,.wrapper,header,footer,nav,.navbar,.top-bar,.row1,.header,.logo,#top,.top,#site-header,.site-header{${BG0}${SH0}${BD0}}`
 +`#header::before,#header::after,#top::before,#top::after,#topbar::before,#topbar::after,#top-bar::before,#top-bar::after,#topBar::before,#topBar::after,#mobile-topbar::before,#mobile-topbar::after,#mobileTopbar::before,#mobileTopbar::after,#mobile-header::before,#mobile-header::after,#mobile-nav::before,#mobile-nav::after,#mobile-bar::before,#mobile-bar::after,#navbar::before,#navbar::after,#nav-bar::before,#nav-bar::after,#masthead::before,#masthead::after,#site-header::before,#site-header::after,#page-header::before,#page-header::after,#app-bar::before,#app-bar::after,#toolbar::before,#toolbar::after,header::before,header::after,nav::before,nav::after{${BG0}${SH0}${BF0}}`
 +`#additional-info,.user-content,#script-info,.width-constraint,#install-area,.good-bad,.discussion-list,article,.post-body,.entry-content,.markdown-body,.topic-body,.post-content,#readme,.Box-body{${BG0}${SH0}${BD0}--bg-color:${_T};--color-canvas-default:${_T};}`
 +`.ippure-wrapper,.ippure-container{${BG0}${SH0}${BD0}}`
 +`.translate-ui .tu-btn{background:#1e1e2f!important;}.translate-ui .tu-btn.active{background:#1f5a3a!important;}.translate-ui .tu-panel{background:rgba(20,22,27,.96)!important;}`
 +`${CAPTCHA_CSS_SELECTOR},${CAPTCHA_SELECTORS.map(s=>s+' *').join(',')}{background-color:initial!important;background:initial!important;${BF0}filter:none!important;opacity:1!important;pointer-events:auto!important;mix-blend-mode:normal!important;}`
 +`:root{--color-canvas-default:${_T};--color-canvas-subtle:${_T};--color-canvas-inset:${_T};--color-page-header-bg:${_T};--color-header-bg:rgba(0,0,0,.18)!important;}`
 +`[class*="bg"],[class*="Bg"],[class*="color-bg"],[class*="ColorBg"],[class*="bgColor"],.Box,.Box-body,.Box-header,.file-navigation,.repository-content,.AppHeader,.Layout-sidebar,.Layout-main,.UnderlineNav,.BorderGrid,.flash,.modal,.modal-dialog,.modal-body,.drawer,.drawer-body,.diff-table,.diff-header,.blob-code,.blob-num,.file,.file-header,.commit,.timeline-comment,.review-comment,.inline-comment-form,.select-menu,.dropdown,.Popover,.overlay,.signed-commit,.blankslate,.paginate-container,.pagination,.State,.Label,.Counter,.TimelineItem,.commit-ref,.sha,.IssueLabel{${BG0}${SH0}${BD0}}`
 +`td,th,thead,tbody,tfoot,.rounded-top-2,.rounded-bottom-2,.rounded-2{${BG0}}`
 +`.GlobalNav,.UnderlineNav,.LocalNavigation,[class*="UnderlineNav"],[class*="GlobalNav"]{${BF0}}`;},
skeleton(cfg){return `html,body{${BG0}}`+htmlBefore(`background:${SKELETON_BG}!important;`,cfg.blur)+ROOT_HARDEN;},
theme(t){const L=t===1;return `input:not(.translate-ui input),div,${L?'font,':''}h1,h2,h3,h4,h5,h6,p,li,span:not(.tu-bi),label,strong,em{color:${L?'#ddd':'#222'}!important;}a:not([style]){color:#98DD98!important;}textarea,pre,code{color:${L?'#fff':'#000'}!important;}`;},
nativeBlur(b,theme){
 if(b<=0)return '';
 const dark=theme===1,GF=`blur(${b}px) saturate(105%)`;
 const glassBg=dark?'rgba(28,30,38,0.28)':'rgba(255,255,255,0.22)';
 const bord=dark?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.55)';
 const hov=dark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.08)';
 const hl=dark?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.7)';
 const sh=dark?'rgba(0,0,0,0.5)':'rgba(0,0,0,0.18)';
 const GS=`0 8px 32px ${sh}, inset 0 1px 1px ${hl}, inset 0 -1px 2px rgba(0,0,0,0.06)`;
 const BFG=`backdrop-filter:${GF}!important;-webkit-backdrop-filter:${GF}!important;`;
 return `.modal,.dialog,.popup,.dropdown,.menu,.popover,.tooltip,[role="dialog"],[role="menu"],[role="tooltip"],[role="listbox"],[role="grid"],.layer,.fancybox,.swal-modal,.ant-modal,.el-dialog,.el-popper,.notification,.Toastify__toast-container,.position-fixed,.z-50{${BFG}box-shadow:${GS}!important;}`
 +`${DROP}{${BFG}background-color:${glassBg}!important;border:1px solid ${bord}!important;box-shadow:${GS}!important;border-radius:12px!important;transform:translateZ(0)!important;isolation:isolate!important;overflow:hidden!important;}`
 +`${DROP_CHILD}{background-color:${_T};${SH0}}`
 +`${POPUP_UNFILTER}{filter:none!important;}`
 +`${POPUP_PANEL}{${BFG}background-color:${glassBg}!important;border-radius:12px!important;box-shadow:${GS}!important;isolation:isolate!important;}`
 +`${POPUP_LEAF}{background-color:${_T};${SH0}}`
 +`input:not(.translate-ui input),textarea,select,[type="text"],[type="search"],[type="email"],[type="password"],[type="url"],[type="number"],[contenteditable="true"]{${BG0}${BF0}${SH0}border-color:${bord}!important;}`
 +`button:hover,[role="option"]:hover,div[class*="suggest"] li:hover,div[class*="suggest"] div:hover,[id*="search-result"] .search-result:hover,[id*="search-result"] a:hover{background-color:${hov}!important;}`
 +SIDEBAR0;},
buildAll(cfg,finalUrl){
 let css=StyleBuilder.background(cfg,finalUrl)+StyleBuilder.theme(cfg.theme)
 +`.search_ipt,.search_ipt_wr{${BF0}background:${_T};}`
 +`input:not(.translate-ui input),textarea,select,[contenteditable="true"]{${BG0}${BF0}${SH0}outline:none!important;}`
 +`nav.segmented-control.shadow-sm,nav.apple-navbar,nav.apple-navbar .container-fluid{${BG0}${SH0}${BF0}}`
 +`.ant-menu.ant-menu-horizontal,.ant-menu-root.ant-menu-horizontal,ul.ant-menu.ant-menu-horizontal,.ant-menu-horizontal>.ant-menu-item,.ant-menu-horizontal>.ant-menu-submenu,.ant-menu-horizontal .ant-menu-submenu-title,.ant-btn.ant-btn-default,.ant-btn-variant-outlined,button.ant-btn{${BG0}${SH0}${BD3}}`
 +`:root,${BGVAR_SEL},[class*="bg-[rgb(var(--bg-"]{--bg-tertiary:${_T};--bg-secondary:${_T};--bg-primary:${_T};${BG0}${SH0}}`
 +`${BGVAR_SEL}{${BD3}}`
 +`.btn-close{box-sizing:content-box!important;width:1em!important;height:1em!important;padding:.25em!important;background:transparent url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e") center/1em auto no-repeat!important;border:0!important;border-radius:.375rem!important;opacity:.7!important;}`
 +`.btn-close-white{filter:invert(1) grayscale(100%) brightness(200%)!important;}`
 +MOBILE_BAR;
 if(SiteAdapters.isXSite())css+=X_CSS;
 if(SiteAdapters.isTiebaSite())css+=TIEBA_CSS;
 return css+ROOT_HARDEN;}
};

const SiteAdapters={
isXSite(){const h=Utils.getHost();return /(^|\.)x\.com$/.test(h)||/(^|\.)twitter\.com$/.test(h);},
isTiebaSite(){return /(^|\.)tieba\.baidu\.com$/.test(Utils.getHost());},
stripXHeaderBlur(){
 if(!SiteAdapters.isXSite()||CaptchaGuard.active)return;
 if(!Config.merge(Utils.getHost()).enabled)return;
 const prot=el=>{if(!el||!el.closest)return false;try{return !!el.closest(X_DROPDOWN_GUARD);}catch(e){return false;}};
 const glass=bg=>{
  if(!bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)')return false;
  const n=bg.match(/[\d.]+/g);if(!n||n.length<3)return false;
  const r=+n[0],g=+n[1],b=+n[2],a=n.length>=4?+n[3]:1;
  if(a<1)return true;
  return (Math.max(r,g,b)-Math.min(r,g,b))<24;};
 const clear=(el,st)=>{
  if(!el||!el.style||prot(el))return;
  st=st||getComputedStyle(el);
  const bf=st.backdropFilter||st.webkitBackdropFilter||'';
  if(bf&&bf!=='none'){el.style.setProperty('backdrop-filter','none','important');el.style.setProperty('-webkit-backdrop-filter','none','important');}
  if(glass(st.backgroundColor||''))el.style.setProperty('background-color','transparent','important');};
 const strip=anchor=>{
  if(!anchor)return;
  const col=anchor.closest?anchor.closest(XPC):null,stop=col||document.body;
  let header=null,el=anchor;
  for(let i=0;i<8&&el&&el!==stop&&el!==document.body;i++){
   const st=getComputedStyle(el),bf=st.backdropFilter||st.webkitBackdropFilter||'';
   if((bf&&bf!=='none')||st.position==='sticky'||st.position==='fixed')header=el;
   el=el.parentElement;}
  if(!header){header=anchor;for(let i=0;i<4&&header.parentElement&&header.parentElement!==stop;i++)header=header.parentElement;}
  if(prot(header))return;
  clear(header);
  let p=header.parentElement,hop=0;
  while(p&&p!==stop&&p!==document.body&&hop<5){clear(p);p=p.parentElement;hop++;}
  const kids=header.getElementsByTagName('*');
  for(let j=0;j<kids.length;j++)clear(kids[j]);};
 document.querySelectorAll(XABB).forEach(strip);
 document.querySelectorAll(XNAV).forEach(nav=>{
  strip(nav);
  if(!prot(nav)){nav.style.setProperty('background-color','transparent','important');nav.style.setProperty('backdrop-filter','none','important');nav.style.setProperty('-webkit-backdrop-filter','none','important');}});}
};

const StyleManager={
styleNode:null,nativeBlurNode:null,
styleFollowedBySiteSheet(node){
 let s=node.nextSibling;
 while(s){
  if(s.nodeType===1){
   const t=s.tagName;
   if(t==='LINK'&&(s.getAttribute('rel')||'').toLowerCase().indexOf('stylesheet')>-1)return true;
   if(t==='STYLE'&&s.id!==NATIVE_BLUR_STYLE_ID)return true;}
  s=s.nextSibling;}
 return false;},
ensureStyleNode(){
 const parent=document.head||document.documentElement;
 let s=StyleManager.styleNode;
 if(!s||!document.contains(s)){
  s=document.getElementById(STYLE_ID);
  if(!s){s=document.createElement('style');s.id=STYLE_ID;}
  parent.appendChild(s);StyleManager.styleNode=s;return s;}
 if(StyleManager.styleFollowedBySiteSheet(s)){
  parent.appendChild(s);
  const nb=StyleManager.nativeBlurNode||document.getElementById(NATIVE_BLUR_STYLE_ID);
  if(nb&&document.contains(nb))parent.appendChild(nb);}
 return s;},
removeStyle(){
 const s=StyleManager.styleNode||document.getElementById(STYLE_ID);
 if(s){s.remove();StyleManager.styleNode=null;}
 const nb=StyleManager.nativeBlurNode||document.getElementById(NATIVE_BLUR_STYLE_ID);
 if(nb){nb.remove();StyleManager.nativeBlurNode=null;}},
applyNativeBlur(b,theme){
 const css=b<=0?'':StyleBuilder.nativeBlur(b,theme);
 let s=StyleManager.nativeBlurNode||document.getElementById(NATIVE_BLUR_STYLE_ID);
 if(!css){if(s){s.remove();StyleManager.nativeBlurNode=null;}return;}
 if(!s||!document.contains(s)){s=document.createElement('style');s.id=NATIVE_BLUR_STYLE_ID;(document.head||document.documentElement).appendChild(s);StyleManager.nativeBlurNode=s;}
 if(s.textContent!==css)s.textContent=css;},
applySkeletonStyle(){
 if(CaptchaGuard.active)return;
 const cfg=Config.merge(Utils.getHost());
 if(!cfg.enabled)return;
 const s=StyleManager.ensureStyleNode();
 if(s.textContent)return;
 s.textContent=StyleBuilder.skeleton(cfg);},
applyStyle(){
 if(CaptchaGuard.active)return;
 const cfg=Config.merge(Utils.getHost());
 if(!cfg.enabled){StyleManager.removeStyle();BackgroundImage.setUrl(null);BackgroundImage.cacheKey=null;return;}
 let eff=cfg,url=BackgroundImage.url||'';
 if(LivePreview.config){
  eff=Object.assign({},cfg,LivePreview.config,{enabled:true});
  url=ImageStore.isCacheKey(eff.url)?(BackgroundImage.url||''):(eff.url||'');}
 const css=StyleBuilder.buildAll(eff,url),s=StyleManager.ensureStyleNode();
 if(s.textContent!==css)s.textContent=css;
 StyleManager.applyNativeBlur(eff.nativeElementBlur,eff.theme);
 SiteAdapters.stripXHeaderBlur();},
async applyStyleFull(){if(!BackgroundImage.ready)await BackgroundImage.preload();StyleManager.applyStyle();},
applyAgain(){Config.invalidate();BackgroundImage.ready=false;StyleManager.applyStyleFull();OverlayEnhancer.request();}
};

const CaptchaGuard={
active:false,_lastCheck:0,_enterTimer:null,
throttledCheck(){const n=Date.now();if(n-CaptchaGuard._lastCheck<300)return;CaptchaGuard._lastCheck=n;CaptchaGuard.check();},
isRealCaptcha(el){
 if(!el)return false;
 if(el.tagName==='IFRAME'&&CAPTCHA_IGNORE_SRC.test(el.src||''))return false;
 const st=getComputedStyle(el);
 if(st.display==='none'||st.visibility==='hidden')return false;
 if(parseFloat(st.opacity||'1')<=0)return false;
 const r=el.getBoundingClientRect();
 return r.width>20&&r.height>20;},
findVisible(){
 if(!document.body)return false;
 for(const sel of CAPTCHA_SELECTORS){
  try{const n=document.body.querySelectorAll(sel);for(let i=0;i<n.length;i++)if(CaptchaGuard.isRealCaptcha(n[i]))return true;}catch(e){}}
 return false;},
check(){
 const host=Utils.getHost();
 if(SPA_WHITELIST.some(d=>host.includes(d))){if(CaptchaGuard.active){CaptchaGuard.active=false;StyleManager.applyStyle();}return;}
 if(/just a moment|attention required|cloudflare|please wait|checking your browser|verify you are human/.test((document.title||'').toLowerCase())){if(!CaptchaGuard.active){CaptchaGuard.active=true;StyleManager.removeStyle();}return;}
 if(CaptchaGuard.findVisible()){
  if(!CaptchaGuard.active&&!CaptchaGuard._enterTimer){
   CaptchaGuard._enterTimer=setTimeout(()=>{
    CaptchaGuard._enterTimer=null;
    if(!CaptchaGuard.active&&CaptchaGuard.findVisible()){CaptchaGuard.active=true;StyleManager.removeStyle();}},500);}
  return;}
 if(CaptchaGuard._enterTimer){clearTimeout(CaptchaGuard._enterTimer);CaptchaGuard._enterTimer=null;}
 if(CaptchaGuard.active){
  setTimeout(()=>{if(!CaptchaGuard.findVisible()&&CaptchaGuard.active){CaptchaGuard.active=false;StyleManager.applyStyle();}},1500);}}
};

const OverlayEnhancer={
_marked:new WeakSet(),_lastApplied:new WeakMap(),_keywordCache:new WeakMap(),_rafPending:false,_scanTimer:null,
isExcludedElement(el){
 if(!el||!el.nodeType)return false;
 const slot=el.getAttribute&&el.getAttribute('data-slot');
 if(slot&&slot.indexOf('sidebar')===0)return true;
 if(el.id==='goTopBottom'||el.id==='tbSettingsBtn'||el.id==='tbSettingsPanel')return true;
 const cl=el.classList;
 if(cl&&(cl.contains('tb-settings-btn')||cl.contains('tb-settings-panel')))return true;
 if(cl&&cl.contains('translate-ui'))return true;
 if(el.id==='tuPanel'||el.id==='tuBtn')return true;
 if(cl&&(cl.contains('GlobalNav')||cl.contains('UnderlineNav')||cl.contains('LocalNavigation')))return true;
 if(cl&&(cl.contains('apple-navbar')||cl.contains('segmented-control')))return true;
 if(cl&&cl.contains('mobile-bar'))return true;
 if(typeof el.className==='string'&&(el.className.includes('UnderlineNav')||el.className.includes('GlobalNav')))return true;
 try{if(el.matches&&el.matches(CAPTCHA_CSS_SELECTOR))return true;if(el.closest&&el.closest(CAPTCHA_CSS_SELECTOR))return true;}catch(e){}
 if(el.tagName==='IFRAME'){const s=el.src||'';if(s.includes('challenges.cloudflare.com')||s.includes('hcaptcha.com')||s.includes('recaptcha'))return true;}
 return false;},
isOverlayVisible(el,st){
 if(!el||!st)return false;
 if(st.display==='none'||st.visibility==='hidden')return false;
 if(parseFloat(st.opacity||'1')<=0)return false;
 const r=el.getBoundingClientRect();
 return r.width>2&&r.height>2;},
getZIndex(st){const z=parseInt(st.zIndex||'0',10);return Number.isFinite(z)?z:0;},
hasOverlayKeyword(el){
 if(OverlayEnhancer._keywordCache.has(el))return OverlayEnhancer._keywordCache.get(el);
 const txt=`${(el.className||'').toString().toLowerCase()} ${(el.id||'').toString().toLowerCase()}`;
 const role=(el.getAttribute&&el.getAttribute('role')||'').toLowerCase();
 const r=/overlay|backdrop|mask|modal|drawer|popup|dialog|sheet|menu|popover|sidebar|side-nav|side-panel|nav-panel|offcanvas|slide-panel|flyout|panel|typeahead|autocomplete|search-result|search-results/.test(txt)||['listbox','menu','dialog','tooltip','grid','alertdialog'].includes(role);
 OverlayEnhancer._keywordCache.set(el,r);return r;},
hasOverlayBg(st){const bg=st.backgroundColor||'';return bg.includes('rgb')||(st.backdropFilter&&st.backdropFilter!=='none')||(st.webkitBackdropFilter&&st.webkitBackdropFilter!=='none');},
htmlBodyLocked(){
 if(!document.body)return false;
 const hs=getComputedStyle(document.documentElement),bs=getComputedStyle(document.body);
 const hc=(document.documentElement.className||'').toLowerCase(),bc=(document.body.className||'').toLowerCase();
 return ['modal-open','drawer-open','overflow-hidden','no-scroll','popup-open','dialog-open'].some(k=>hc.includes(k)||bc.includes(k))||hs.overflow==='hidden'||hs.overflowY==='hidden'||bs.overflow==='hidden'||bs.overflowY==='hidden';},
isLightBg(bg){if(!bg||!bg.includes('rgb'))return false;const n=bg.match(/\d+(\.\d+)?/g);return n&&n.length>=3&&(parseFloat(n[0])+parseFloat(n[1])+parseFloat(n[2]))/3>180;},
findLikelyOverlays(){
 if(!document.body)return [];
 const floatEl=document.getElementById(FLOAT_ID),out=[],vw=innerWidth,vh=innerHeight;
 const all=document.body.getElementsByTagName('*');
 for(let i=0;i<all.length;i++){
  const el=all[i];
  if(floatEl&&(el===floatEl||floatEl.contains(el)))continue;
  if(OverlayEnhancer.isExcludedElement(el))continue;
  const st=getComputedStyle(el),pos=st.position;
  if(pos!=='fixed'&&pos!=='absolute')continue;
  if(!OverlayEnhancer.isOverlayVisible(el,st))continue;
  const r=el.getBoundingClientRect();
  if(r.width<30||r.height<30)continue;
  const z=OverlayEnhancer.getZIndex(st);
  let matched=false;
  if(OverlayEnhancer.hasOverlayKeyword(el)&&(pos==='fixed'||pos==='absolute')){if(r.width>40&&r.height>20)matched=true;}
  if(!matched&&pos==='fixed'&&z>=1){if(r.width>=vw*.12&&r.height>=vh*.25)matched=true;}
  if(!matched&&pos==='absolute'&&z>=20&&OverlayEnhancer.hasOverlayBg(st)){if(r.width>=vw*.15&&r.height>=vh*.15)matched=true;}
  if(matched)out.push({el,useWhite:OverlayEnhancer.isLightBg(st.backgroundColor||''),pointerNone:st.pointerEvents==='none'});}
 return OverlayEnhancer.dedupe(out);},
dedupe(arr){const out=[];for(const it of arr){let skip=false;for(const k of out){if(k.el.contains(it.el)){skip=true;break;}}if(!skip)out.push(it);}return out;},
write(item,blur,alpha){
 const el=item.el,gf=`blur(${blur}px) saturate(105%)`;
 el.style.setProperty('backdrop-filter',gf,'important');
 el.style.setProperty('-webkit-backdrop-filter',gf,'important');
 el.style.setProperty('background-color',item.useWhite?`rgba(255,255,255,${alpha})`:`rgba(0,0,0,${alpha})`,'important');
 el.style.setProperty('box-shadow',item.useWhite?'inset 0 1px 1px rgba(255,255,255,0.65), 0 8px 32px rgba(0,0,0,0.15)':'inset 0 1px 1px rgba(255,255,255,0.14), 0 8px 32px rgba(0,0,0,0.45)','important');
 if(item.pointerNone)el.style.setProperty('pointer-events','auto','important');
 OverlayEnhancer._marked.add(el);
 OverlayEnhancer._lastApplied.set(el,{blur,alpha});},
_run(force){
 if(!document.body||CaptchaGuard.active)return;
 if(!Config.merge(Utils.getHost()).enabled)return;
 const {blur,alpha}=Config.getEffectiveOverlayValues();
 if(!force&&blur<=0&&alpha<=0)return;
 const list=OverlayEnhancer.findLikelyOverlays();
 if(!force&&!list.length&&!OverlayEnhancer.htmlBodyLocked())return;
 const fe=FloatPanel.node||document.getElementById(FLOAT_ID);
 for(const it of list){
  if(fe&&(it.el===fe||fe.contains(it.el)))continue;
  if(!force){const p=OverlayEnhancer._lastApplied.get(it.el)||{};if(p.blur===blur&&p.alpha===alpha)continue;}
  OverlayEnhancer.write(it,blur,alpha);}},
apply(){OverlayEnhancer._run(false);},
force(){OverlayEnhancer._run(true);},
request(){
 if(OverlayEnhancer._rafPending||CaptchaGuard.active)return;
 OverlayEnhancer._rafPending=true;
 requestAnimationFrame(()=>{OverlayEnhancer._rafPending=false;OverlayEnhancer.apply();});},
stopScanTimer(){if(OverlayEnhancer._scanTimer){clearInterval(OverlayEnhancer._scanTimer);OverlayEnhancer._scanTimer=null;}},
startScanTimer(){
 OverlayEnhancer.stopScanTimer();
 if(document.hidden)return;
 OverlayEnhancer._scanTimer=setInterval(()=>{
  CaptchaGuard.throttledCheck();
  SiteAdapters.stripXHeaderBlur();
  const cfg=Config.merge(Utils.getHost()),ov=Config.getEffectiveOverlayValues();
  if(cfg.enabled&&!CaptchaGuard.active&&(ov.blur>0||ov.alpha>0))OverlayEnhancer.apply();},1500);}
};

const ImageTools={
compress(dataUrl,target,cb){
 const img=new Image();
 img.onload=function(){
  let w=img.width,h=img.height;
  if(w>MAX_IMAGE_WIDTH||h>MAX_IMAGE_HEIGHT){const r=Math.min(MAX_IMAGE_WIDTH/w,MAX_IMAGE_HEIGHT/h);w=Math.round(w*r);h=Math.round(h*r);}
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);
  let q=.9,res=dataUrl,att=0;
  const tryC=()=>{res=c.toDataURL('image/jpeg',q);att++;if(res.length>target&&q>.2&&att<10){q-=.05;setTimeout(tryC,10);}else cb(res);};
  tryC();};
 img.onerror=function(){cb(null);};
 img.src=dataUrl;},
pickLocal(cb){
 const input=document.createElement('input');input.type='file';input.accept='image/*';
 input.addEventListener('change',()=>{
  const file=input.files&&input.files[0];if(!file)return;
  if(file.size>MAX_FILE_SIZE){alert('图片过大（最大 15MB）');return;}
  const name=file.name,reader=new FileReader();
  reader.onload=async function(){
   const res=String(reader.result||'');
   if(!res.startsWith('data:image/')){alert('读取失败');return;}
   const isWebP=file.type==='image/webp'||res.startsWith('data:image/webp');
   let data=res;
   if(!isWebP&&res.length>COMPRESS_THRESHOLD){
    const c=await new Promise(r=>ImageTools.compress(res,COMPRESS_TARGET,r));
    if(c){alert(`已压缩：${Math.round(res.length/1024)}KB → ${Math.round(c.length/1024)}KB`);data=c;}}
   const ck=await ImageStore.store(data,null,name);
   if(ck)cb(ImageStore.buildCacheKeyUrl(ck),file,ck);else alert('图片存储失败');};
  reader.readAsDataURL(file);});
 input.click();},
_fetchFallback(url,resolve,reject){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:ctrl.signal}).then(resp=>{
  clearTimeout(timer);
  if(!resp.ok)throw new Error('HTTP '+resp.status);
  return resp.arrayBuffer().then(ab=>{
   const ct=resp.headers.get('content-type')||'',ext=ct.split(';')[0].trim().split('/').pop()||'jpeg';
   resolve({data:new Uint8Array(ab),ext});});
 }).catch(e=>{clearTimeout(timer);reject(new Error('下载失败: '+(e.message||e)));});},
fetchAsUint8(url){
 url=Utils.toAbsoluteUrl(url);
 return new Promise((resolve,reject)=>{
  if(typeof GM_xmlhttpRequest!=='function'){ImageTools._fetchFallback(url,resolve,reject);return;}
  let settled=false;
  const timer=setTimeout(()=>{if(!settled){settled=true;ImageTools._fetchFallback(url,resolve,reject);}},15000);
  const fb=()=>{if(!settled){clearTimeout(timer);settled=true;ImageTools._fetchFallback(url,resolve,reject);}};
  try{
   GM_xmlhttpRequest({
    method:'GET',url,responseType:'arraybuffer',timeout:30000,headers:{'Referer':''},anonymous:true,
    onload(res){
     if(settled)return;clearTimeout(timer);settled=true;
     if(res.status>=200&&res.status<300){
      try{
       const rd=res.response;
       if(rd instanceof ArrayBuffer){
        const hdr=String(res.responseHeaders||''),mm=hdr.match(/content-type:\s*([^\r\n;]+)/i),mime=mm?mm[1].trim():'image/jpeg';
        resolve({data:new Uint8Array(rd),ext:mime.split('/').pop().replace('jpeg','jpg')});
       }else ImageTools._fetchFallback(url,resolve,reject);
      }catch(e){ImageTools._fetchFallback(url,resolve,reject);}
     }else reject(new Error('HTTP '+res.status));},
    onerror:fb,ontimeout:fb});
  }catch(e){fb();}});}
};

const Zip=(function(){
const TBL=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);TBL[i]=c>>>0;}
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=TBL[(c^u[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
async function pipe(stream,data){
 const w=stream.writable.getWriter();w.write(data);w.close();
 const r=stream.readable.getReader(),chunks=[];
 while(true){const{value,done}=await r.read();if(done)break;chunks.push(value);}
 let tl=0;chunks.forEach(c=>tl+=c.length);
 const out=new Uint8Array(tl);let off=0;
 chunks.forEach(c=>{out.set(c,off);off+=c.length;});
 return out;}
const deflateRaw=d=>d.length?pipe(new CompressionStream('deflate-raw'),d):Promise.resolve(new Uint8Array(0));
const inflateRaw=d=>pipe(new DecompressionStream('deflate-raw'),d);
async function compressSmart(d){
 if(d.length<128)return{compressed:d,method:0};
 try{const x=await deflateRaw(d);return x.length<d.length?{compressed:x,method:8}:{compressed:d,method:0};}
 catch(e){return{compressed:d,method:0};}}
const wU16=(v,o,n)=>v.setUint16(o,n,true),wU32=(v,o,n)=>v.setUint32(o,n,true);
async function build(entries){
 const ps=[];
 for(const e of entries){
  const nb=new TextEncoder().encode(e.name),crc=crc32(e.data);
  const{compressed,method}=await compressSmart(e.data);
  ps.push({nb,os:e.data.length,cs:compressed.length,compressed,crc,method});}
 let ts=0;ps.forEach(p=>ts+=30+p.nb.length+p.cs);
 const cds=ts;ps.forEach(p=>ts+=46+p.nb.length);
 const cdSz=ts-cds;ts+=22;
 const buf=new ArrayBuffer(ts),vw=new DataView(buf),u8=new Uint8Array(buf);
 let off=0;const lo=[];
 for(const p of ps){
  lo.push(off);
  wU32(vw,off,0x04034b50);wU16(vw,off+4,20);wU16(vw,off+6,0);wU16(vw,off+8,p.method);
  wU16(vw,off+10,0);wU16(vw,off+12,0);wU32(vw,off+14,p.crc);wU32(vw,off+18,p.cs);
  wU32(vw,off+22,p.os);wU16(vw,off+26,p.nb.length);wU16(vw,off+28,0);
  u8.set(p.nb,off+30);u8.set(p.compressed,off+30+p.nb.length);
  off+=30+p.nb.length+p.cs;}
 for(let i=0;i<ps.length;i++){
  const p=ps[i];
  wU32(vw,off,0x02014b50);wU16(vw,off+4,20);wU16(vw,off+6,20);wU16(vw,off+8,0);
  wU16(vw,off+10,p.method);wU16(vw,off+12,0);wU16(vw,off+14,0);wU32(vw,off+16,p.crc);
  wU32(vw,off+20,p.cs);wU32(vw,off+24,p.os);wU16(vw,off+28,p.nb.length);wU16(vw,off+30,0);
  wU16(vw,off+32,0);wU16(vw,off+34,0);wU16(vw,off+36,0);wU32(vw,off+38,0);wU32(vw,off+42,lo[i]);
  u8.set(p.nb,off+46);
  off+=46+p.nb.length;}
 wU32(vw,off,0x06054b50);wU16(vw,off+4,0);wU16(vw,off+6,0);
 wU16(vw,off+8,ps.length);wU16(vw,off+10,ps.length);
 wU32(vw,off+12,cdSz);wU32(vw,off+16,cds);wU16(vw,off+20,0);
 return new Uint8Array(buf);}
async function parse(zip){
 const vw=new DataView(zip.buffer,zip.byteOffset,zip.byteLength),out={};
 let pos=0;
 while(pos+30<=zip.length){
  if(vw.getUint32(pos,true)!==0x04034b50)break;
  const method=vw.getUint16(pos+8,true),cs=vw.getUint32(pos+18,true),nl=vw.getUint16(pos+26,true),el=vw.getUint16(pos+28,true);
  const name=new TextDecoder().decode(zip.slice(pos+30,pos+30+nl));
  const ds=pos+30+nl+el,cd=zip.slice(ds,ds+cs);
  if(name.endsWith('/')){pos=ds+cs;continue;}
  let fd;
  try{fd=method===0?cd:method===8?await inflateRaw(cd):null;}catch(e){fd=null;}
  if(fd)out[name]=fd;
  pos=ds+cs;}
 return out;}
return{build,parse};
})();

const ImportExport={
async exportZip(){
 try{
  const scm=JSON.parse(JSON.stringify(Config.getSiteMap())),gUrl=Store.get(KEYS.url,DEFAULTS.url);
  let gFile='',gData=null,gRemote='';
  if(ImageStore.isCacheKey(gUrl)){
   const ck=ImageStore.extractCacheKey(gUrl),o=ImageStore.getOriginalFilename(ck);
   gFile='global_local.'+(o?Utils.getExtFromFilename(o):'jpg');
   gData=await ImageStore.readBytes(ck);
  }else if(Utils.isDataImageUrl(gUrl)){
   gFile='global_local.'+Utils.guessExt(gUrl);gData=Utils.dataUrlToUint8Array(gUrl);
  }else if(gUrl){
   gRemote=Utils.toAbsoluteUrl(gUrl);
   try{const{data,ext}=await ImageTools.fetchAsUint8(gRemote);gFile='global_remote.'+ext;gData=data;}
   catch(e){alert('⚠️ 全局远程图片下载失败：'+e.message);}}
  const entries=[];
  if(gData&&gFile)entries.push({name:'images/'+gFile,data:gData});
  let frc=0,flc=0;const fru=[],fls=[];
  for(const h in scm){
   const url=scm[h].url;if(!url)continue;
   let fn=null;
   if(ImageStore.isCacheKey(url)){
    const ck=ImageStore.extractCacheKey(url),o=ImageStore.getOriginalFilename(ck);
    fn='site_'+Utils.simpleHash(h)+'_local.'+(o?Utils.getExtFromFilename(o):'jpg');
    const id=await ImageStore.readBytes(ck);
    if(id)entries.push({name:'images/'+fn,data:id});else{flc++;fls.push(h);}
   }else if(Utils.isDataImageUrl(url)){
    fn='site_'+Utils.simpleHash(h)+'_local.'+Utils.guessExt(url);
    entries.push({name:'images/'+fn,data:Utils.dataUrlToUint8Array(url)});
   }else{
    const au=Utils.toAbsoluteUrl(url);scm[h].remoteUrl=au;
    try{const{data,ext}=await ImageTools.fetchAsUint8(au);fn='site_'+Utils.simpleHash(h)+'_remote.'+ext;entries.push({name:'images/'+fn,data});}
    catch(e){frc++;fru.push(au);}}
   scm[h].url=fn||'';}
  const cfg={version:CONFIG_VERSION,exportedAt:new Date().toISOString(),
   global:{url:gFile||'',remoteUrl:gRemote,
    theme:Store.get(KEYS.theme,DEFAULTS.theme),opacity:Store.get(KEYS.opacity,DEFAULTS.opacity),
    blur:Store.get(KEYS.blur,DEFAULTS.blur),enabled:Store.get(KEYS.enabled,DEFAULTS.enabled),
    floatVisible:Store.get(KEYS.floatVisible,DEFAULTS.floatVisible),listMode:Store.get(KEYS.listMode,DEFAULTS.listMode),
    floatPos:Utils.safeJSONParse(Store.get(KEYS.floatPos,JSON.stringify(DEFAULTS.floatPos)),DEFAULTS.floatPos),
    nativeElementBlur:Store.get(KEYS.nativeElementBlur,DEFAULTS.nativeElementBlur),
    overlayBlur:Store.get(KEYS.overlayBlur,DEFAULTS.overlayBlur),
    overlayAlpha:Store.get(KEYS.overlayAlpha,DEFAULTS.overlayAlpha)},
   siteList:Config.getList(),siteConfigMap:scm};
  entries.push({name:'config.json',data:new TextEncoder().encode(JSON.stringify(cfg,null,2))});
  const zipped=await Zip.build(entries),bu=URL.createObjectURL(new Blob([zipped],{type:'application/zip'}));
  const a=document.createElement('a');a.href=bu;a.download='浏览器背景_'+new Date().toISOString().slice(0,10)+'.zip';a.style.display='none';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{try{a.remove();}catch(e){}URL.revokeObjectURL(bu);},1000);
  if(frc>0||flc>0){
   let msg='⚠️ 导出完成，但有问题：\n\n';
   if(frc>0){msg+=`【${frc} 张远程图下载失败】\n`;fru.forEach(u=>msg+=`- ${u}\n`);}
   if(flc>0){msg+=`【${flc} 个本地图读取失败】\n`;fls.forEach(h=>msg+=`- ${h}\n`);}
   alert(msg);}
 }catch(e){alert('导出失败：'+e.message);}},
async importZip(){
 const input=document.createElement('input');input.type='file';input.accept='.zip,application/zip';
 input.addEventListener('change',async()=>{
  const file=input.files&&input.files[0];if(!file)return;
  try{
   const uz=await Zip.parse(new Uint8Array(await file.arrayBuffer()));
   if(!uz['config.json'])throw new Error('缺少 config.json');
   const cd=JSON.parse(new TextDecoder().decode(uz['config.json'])),ik={};
   const MM={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'};
   for(const p in uz){
    if(p.startsWith('images/')&&p!=='images/'){
     const fn=p.replace('images/',''),ext=fn.split('.').pop().toLowerCase();
     const k=await ImageStore.store(Utils.uint8ArrayToDataUrl(uz[p],MM[ext]||'image/jpeg'),null,fn);
     if(k)ik[fn]=ImageStore.buildCacheKeyUrl(k);}}
   const gr=(cd.global&&cd.global.remoteUrl)||'',gl=cd.global.url,gc=(gl&&ik[gl])?ik[gl]:'';
   cd.global.url=gr?gr:(gc?gc:DEFAULTS.url);
   if(cd.siteConfigMap){
    for(const h in cd.siteConfigMap){
     const sc=cd.siteConfigMap[h],sr=sc.remoteUrl||'',sl=sc.url||'',sk=(sl&&ik[sl])?ik[sl]:'';
     if(sr)sc.url=sr;else if(sk)sc.url=sk;else delete sc.url;
     delete sc.remoteUrl;}}
   ImportExport.applyImported(cd);alert('导入成功：'+file.name);
  }catch(e){alert('导入失败：'+e.message);}});
 input.click();},
applyImported(data){
 Config.invalidate();
 const M={url:KEYS.url,theme:KEYS.theme,opacity:KEYS.opacity,blur:KEYS.blur,enabled:KEYS.enabled,floatVisible:KEYS.floatVisible,listMode:KEYS.listMode,floatPos:KEYS.floatPos,nativeElementBlur:KEYS.nativeElementBlur,overlayBlur:KEYS.overlayBlur,overlayAlpha:KEYS.overlayAlpha};
 if(data.global)Object.keys(M).forEach(k=>{if(k in data.global)Store.set(M[k],k==='floatPos'?JSON.stringify(data.global[k]):data.global[k]);});
 if(Array.isArray(data.siteList))Config.setList(data.siteList);
 if(data.siteConfigMap&&typeof data.siteConfigMap==='object')Config.setSiteMap(data.siteConfigMap);
 LivePreview.clear();Config.invalidate();StyleManager.applyAgain();}
};

const SHADOW_CSS=`*{box-sizing:border-box;margin:0;padding:0;}
#toggle{width:46px;height:46px;line-height:46px;text-align:center;border-radius:50%;background:rgba(0,0,0,.68);color:#fff;font-size:14px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.35);font-family:sans-serif;user-select:none;}
#panel{position:absolute;bottom:54px;right:0;width:280px;padding:12px;border-radius:12px;background-color:rgba(0,0,0,.88);color:#f0f0f0;font-size:12px;font-family:sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5);display:none;max-height:70vh;overflow-y:auto;overflow-x:hidden;}
#panel .row{margin-bottom:8px;}
#panel .lab{font-size:11px;margin-bottom:3px;color:#ccc;}
#panel input[type="range"]{width:100%;-webkit-appearance:none;appearance:none;height:6px;background:linear-gradient(to right,#98DD98 var(--rp,0%),rgba(255,255,255,.18) var(--rp,0%));outline:none;opacity:.9;border-radius:3px;}
#panel input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;background:#7DD87D;cursor:pointer;border-radius:50%;border:2px solid #222;}
#panel input[type="text"]{width:100%;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,.12);color:#f0f0f0;font-size:11px;border:1px solid rgba(255,255,255,.15);outline:none;}
#panel input[type="text"]:focus{border-color:rgba(155,219,155,.5);}
.btns{display:flex;gap:6px;margin-top:8px;}
.btns button{flex:1;border:0;border-radius:6px;padding:7px 8px;background:rgba(255,255,255,.15);color:#f0f0f0;cursor:pointer;font-size:11px;transition:background .2s;white-space:nowrap;}
.btns button:hover{background:rgba(255,255,255,.25);}
.btn-primary button{background:rgba(155,219,155,.35);font-weight:bold;}
.btn-primary button:hover{background:rgba(155,219,155,.55);}
.btn-danger button{background:rgba(255,100,100,.35);}
.btn-danger button:hover{background:rgba(255,100,100,.55);}
.btn-export button{background:rgba(100,180,255,.35);}
.btn-export button:hover{background:rgba(100,180,255,.55);}
.divider{border:none;border-top:1px solid rgba(255,255,255,.1);margin:10px 0 8px;}
.stitle{font-size:10px;color:rgba(255,255,255,.45);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;}
.theme-btns{display:flex;gap:4px;margin-top:3px;}
.theme-btns button{flex:1;padding:5px 2px;font-size:11px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(255,255,255,.1);color:#f0f0f0;cursor:pointer;transition:all .2s;text-align:center;white-space:nowrap;}
.theme-btns button:hover{background:rgba(255,255,255,.2);}
.theme-btns button.active{border-color:rgba(155,219,155,.6);background:rgba(155,219,155,.2);}
.theme-txt{font-size:10px;color:rgba(255,255,255,.55);}
#panel::-webkit-scrollbar{width:4px;}
#panel::-webkit-scrollbar-track{background:transparent;}
#panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px;}`;

const FloatPanel={
node:null,shouldExist:false,closePanel:null,
create(){
 const host=Utils.getHost(),cfg=Config.merge(host);
 if(!cfg.floatVisible){FloatPanel.shouldExist=false;return;}
 const ex=FloatPanel.node||document.getElementById(FLOAT_ID);
 if(ex&&(document.documentElement.contains(ex)||(document.body&&document.body.contains(ex)))){
  FloatPanel.shouldExist=true;FloatPanel.node=ex;FloatPanel.fixPosition(ex);return;}
 if(ex){try{ex.remove();}catch(e){}}
 const pos=Utils.safePos(cfg.floatPos),box=document.createElement('div');
 box.id=FLOAT_ID;
 box.style.cssText=['position:fixed','z-index:2147483647','width:46px','height:auto','display:block','visibility:visible','pointer-events:auto','font-family:sans-serif','user-select:none','right:'+pos.right+'px','bottom:'+pos.bottom+'px'].join('!important;')+'!important';
 const shadow=box.attachShadow({mode:'closed'});
 const st=document.createElement('style');st.textContent=SHADOW_CSS;shadow.appendChild(st);
 const toggle=document.createElement('div');
 toggle.id='toggle';toggle.textContent='𖣐';toggle.title='点击展开/收起；拖动移动';
 shadow.appendChild(toggle);
 const panel=document.createElement('div');panel.id='panel';
 const siteCfg=Config.getSite(host);
 const siteTheme=siteCfg&&isValidTheme(siteCfg.theme)?siteCfg.theme:null;
 const themeLabel=siteTheme!==null?THEME_LABEL[siteTheme]:'跟随全局('+THEME_LABEL_SHORT[cfg.theme]+')';
 panel.innerHTML=`<div class="btns" style="margin-bottom:8px"><button id="advBtn">⚙️ 高级设置 ▼</button></div>
<div id="advPanel" style="display:none">
<hr class="divider"><div class="stitle">保存配置</div>
<div class="btns btn-primary"><button id="saveG">💾 存全局</button><button id="saveS">💾 存本站</button></div>
<hr class="divider"><div class="stitle">本地图片</div>
<div class="btns"><button id="pickG">🖼️ 全局本地图</button><button id="pickS">🖼️ 本站本地图</button></div>
<hr class="divider"><div class="stitle">导入导出</div>
<div class="btns btn-export"><button id="expBtn">📦 导出压缩包</button><button id="impBtn">📂 导入压缩包</button></div>
<hr class="divider"><div class="stitle">重置设置</div>
<div class="btns btn-danger"><button id="resetG">🔄 全局默认</button><button id="resetS">🗑️ 清本站</button></div>
</div>
<hr class="divider"><div class="stitle">背景图片</div>
<div class="row"><div class="lab">全局背景图 URL</div><input id="gUrl" type="text" placeholder="输入网络图片链接"></div>
<div class="row"><div class="lab">当前站点背景图 URL</div><input id="sUrl" type="text" placeholder="留空则使用全局图片"></div>
<div class="row"><div class="lab">当前站点文字色调 <span class="theme-txt" id="themeTxt">${themeLabel}</span></div>
<div class="theme-btns">
<button data-t="1"${siteTheme===1?' class="active"':''}>🌙 ${THEME_LABEL_SHORT[1]}</button>
<button data-t="2"${siteTheme===2?' class="active"':''}>☀️ ${THEME_LABEL_SHORT[2]}</button>
<button data-t="0"${siteTheme===null?' class="active"':''}>↩ 默认</button>
</div></div>
<div class="row"><div class="lab">透明度 <span id="opTxt">${Math.round(cfg.opacity*100)}%</span></div><input id="opR" type="range" min="10" max="100" step="1" value="${Math.round(cfg.opacity*100)}"></div>
<div class="row"><div class="lab">背景模糊 <span id="blTxt">${cfg.blur}px</span></div><input id="blR" type="range" min="0" max="50" step="1" value="${cfg.blur}"></div>
<div class="row"><div class="lab">弹层模糊 <span id="nbTxt">${cfg.nativeElementBlur}px</span></div><input id="nbR" type="range" min="0" max="20" step="1" value="${cfg.nativeElementBlur}"></div>
<hr class="divider"><div class="stitle">自动弹层增强</div>
<div class="row"><div class="lab">自动弹层模糊 <span id="obTxt">${cfg.overlayBlur}px</span></div><input id="obR" type="range" min="0" max="40" step="1" value="${cfg.overlayBlur}"></div>
<div class="row"><div class="lab">自动弹层透明 <span id="oaTxt">${cfg.overlayAlpha.toFixed(2)}</span></div><input id="oaR" type="range" min="0" max="80" step="1" value="${Math.round(cfg.overlayAlpha*100)}"></div>`;
 shadow.appendChild(panel);
 (document.body||document.documentElement).appendChild(box);
 FloatPanel.node=box;FloatPanel.shouldExist=true;
 const $=id=>shadow.getElementById(id);
 const advBtn=$('advBtn'),advPanel=$('advPanel'),gUrlEl=$('gUrl'),sUrlEl=$('sUrl');
 const opR=$('opR'),blR=$('blR'),nbR=$('nbR'),obR=$('obR'),oaR=$('oaR');
 const opTxt=$('opTxt'),blTxt=$('blTxt'),nbTxt=$('nbTxt'),obTxt=$('obTxt'),oaTxt=$('oaTxt');
 const tBtns=shadow.querySelectorAll('.theme-btns button'),themeTxt=$('themeTxt');
 const cGU=Config.getGlobal().url,cSU=(Config.getSite(host)||{}).url||'';
 gUrlEl.value=(ImageStore.isCacheKey(cGU)||Utils.isDataImageUrl(cGU))?'':cGU;
 sUrlEl.value=(ImageStore.isCacheKey(cSU)||Utils.isDataImageUrl(cSU))?'':cSU;
 let panelTheme=siteTheme;
 const track=el=>{const mn=Number(el.min)||0,mx=Number(el.max)||100;el.style.setProperty('--rp',((Number(el.value)-mn)/(mx-mn))*100+'%');};
 const updateThemeTxt=()=>{
  const et=panelTheme!==null?panelTheme:Config.merge(Utils.getHost()).theme;
  themeTxt.textContent=panelTheme!==null?THEME_LABEL[panelTheme]:'跟随全局('+THEME_LABEL_SHORT[et]+')';};
 const getLive=()=>({
  gUrl:gUrlEl.value.trim(),sUrl:sUrlEl.value.trim(),
  opacity:Utils.clamp(Number(opR.value)/100,.1,1),blur:Utils.clamp(Number(blR.value),0,50),
  nb:Utils.clamp(Number(nbR.value),0,20),ob:Utils.clamp(Number(obR.value),0,40),oa:Utils.clamp(Number(oaR.value)/100,0,.8),
  theme:panelTheme!==null?panelTheme:Config.merge(Utils.getHost()).theme,themeOv:panelTheme!==null});
 const updateTxt=()=>{const v=getLive();opTxt.textContent=Math.round(v.opacity*100)+'%';blTxt.textContent=v.blur+'px';nbTxt.textContent=v.nb+'px';obTxt.textContent=v.ob+'px';oaTxt.textContent=v.oa.toFixed(2);};
 let lpRaf=null;
 const livePreview=()=>{
  if(lpRaf)return;
  lpRaf=requestAnimationFrame(()=>{
   lpRaf=null;
   const m=Config.merge(Utils.getHost()),v=getLive(),pc=Object.assign({},m);
   if(v.sUrl)pc.url=v.sUrl;else if(v.gUrl)pc.url=v.gUrl;
   pc.opacity=v.opacity;pc.blur=v.blur;pc.nativeElementBlur=v.nb;pc.enabled=true;pc.theme=v.theme;
   let fu=pc.url;if(ImageStore.isCacheKey(fu))fu=BackgroundImage.url||'';
   LivePreview.config=pc;
   const css=StyleBuilder.buildAll(pc,fu),sn=StyleManager.ensureStyleNode();
   if(sn.textContent!==css)sn.textContent=css;
   StyleManager.applyNativeBlur(v.nb,pc.theme);
   SiteAdapters.stripXHeaderBlur();
   LivePreview.overlayBlur=v.ob;LivePreview.overlayAlpha=v.oa;OverlayEnhancer.force();});};
 [opR,blR,nbR,obR,oaR].forEach(track);
 [gUrlEl,sUrlEl,opR,blR,nbR,obR,oaR].forEach(el=>el.addEventListener('input',()=>{if(el.type==='range')track(el);updateTxt();livePreview();}));
 tBtns.forEach(btn=>btn.addEventListener('click',e=>{
  e.stopPropagation();const t=parseInt(btn.dataset.t);
  panelTheme=t===0?null:t;
  tBtns.forEach(b=>b.classList.toggle('active',panelTheme===null?b.dataset.t==='0':parseInt(b.dataset.t)===panelTheme));
  updateThemeTxt();livePreview();}));
 let protectTimer=null;
 const collapse=()=>{
  panel.style.display='none';advPanel.style.display='none';advBtn.textContent='⚙️ 高级设置 ▼';
  if(protectTimer)clearTimeout(protectTimer);panel.style.pointerEvents='';panel.style.opacity='';};
 FloatPanel.closePanel=collapse;
 toggle.addEventListener('click',e=>{
  e.stopPropagation();e.preventDefault();if(toggle.__dragging)return;
  if(getComputedStyle(panel).display==='none'){
   panel.style.display='block';advPanel.style.display='none';advBtn.textContent='⚙️ 高级设置 ▼';
   panel.style.pointerEvents='none';panel.style.opacity='0.85';
   if(protectTimer)clearTimeout(protectTimer);
   protectTimer=setTimeout(()=>{panel.style.pointerEvents='';panel.style.opacity='';},400);
  }else collapse();});
 advBtn.addEventListener('click',e=>{
  e.stopPropagation();const h=advPanel.style.display==='none';
  advPanel.style.display=h?'block':'none';panel.style.display='block';
  advBtn.textContent=h?'⚙️ 高级设置 ▲':'⚙️ 高级设置 ▼';});
 $('saveG').addEventListener('click',e=>{
  e.stopPropagation();const v=getLive();Config.invalidate();
  if(v.gUrl)Store.set(KEYS.url,v.gUrl);
  Store.set(KEYS.opacity,v.opacity);Store.set(KEYS.blur,v.blur);Store.set(KEYS.nativeElementBlur,v.nb);
  Store.set(KEYS.overlayBlur,v.ob);Store.set(KEYS.overlayAlpha,v.oa);Store.set(KEYS.theme,v.theme);
  LivePreview.clear();StyleManager.applyAgain();alert('已保存到全局配置');});
 $('saveS').addEventListener('click',e=>{
  e.stopPropagation();const v=getLive(),h=Utils.getHost();Config.invalidate();
  const ec=Config.getSite(h)||{};
  const p={url:v.sUrl||ec.url,opacity:v.opacity,blur:v.blur,nativeElementBlur:v.nb,overlayBlur:v.ob,overlayAlpha:v.oa};
  if(v.themeOv)p.theme=v.theme;else delete ec.theme;
  Config.setSite(h,Object.assign({},ec,p));
  LivePreview.clear();StyleManager.applyAgain();alert('已保存到本站配置');});
 $('pickG').addEventListener('click',e=>{
  e.stopPropagation();
  ImageTools.pickLocal((u,f)=>{Store.set(KEYS.url,u);Config.invalidate();gUrlEl.value='';sUrlEl.value='';LivePreview.clear();StyleManager.applyAgain();alert('已设置全局本地图片：'+f.name);});});
 $('pickS').addEventListener('click',e=>{
  e.stopPropagation();
  ImageTools.pickLocal((u,f)=>{const h=Utils.getHost();Config.setSite(h,Object.assign({},Config.getSite(h)||{},{url:u}));Config.invalidate();sUrlEl.value='';gUrlEl.value='';LivePreview.clear();StyleManager.applyAgain();alert('已设置本站本地图片：'+f.name);});});
 $('expBtn').addEventListener('click',e=>{e.stopPropagation();ImportExport.exportZip();});
 $('impBtn').addEventListener('click',e=>{e.stopPropagation();ImportExport.importZip();});
 $('resetG').addEventListener('click',e=>{
  e.stopPropagation();if(!confirm('确定恢复全局默认设置？'))return;
  Store.set(KEYS.url,DEFAULTS.url);Store.set(KEYS.opacity,DEFAULTS.opacity);Store.set(KEYS.blur,DEFAULTS.blur);
  Store.set(KEYS.nativeElementBlur,DEFAULTS.nativeElementBlur);Store.set(KEYS.overlayBlur,DEFAULTS.overlayBlur);Store.set(KEYS.overlayAlpha,DEFAULTS.overlayAlpha);
  Store.set(KEYS.theme,DEFAULTS.theme);
  gUrlEl.value=DEFAULTS.url;opR.value=Math.round(DEFAULTS.opacity*100);blR.value=DEFAULTS.blur;
  nbR.value=DEFAULTS.nativeElementBlur;obR.value=DEFAULTS.overlayBlur;oaR.value=Math.round(DEFAULTS.overlayAlpha*100);
  sUrlEl.value='';panelTheme=null;
  tBtns.forEach(b=>b.classList.toggle('active',b.dataset.t==='0'));
  updateThemeTxt();[opR,blR,nbR,obR,oaR].forEach(track);
  updateTxt();LivePreview.clear();StyleManager.applyAgain();alert('已恢复全局默认值');});
 $('resetS').addEventListener('click',e=>{
  e.stopPropagation();if(!confirm('确定清空当前站点的所有单独配置？'))return;
  Config.invalidate();Config.removeSite(Utils.getHost());sUrlEl.value='';
  panelTheme=null;tBtns.forEach(b=>b.classList.toggle('active',b.dataset.t==='0'));
  const rc=Config.merge(Utils.getHost());
  opR.value=Math.round(rc.opacity*100);blR.value=rc.blur;nbR.value=rc.nativeElementBlur;
  obR.value=rc.overlayBlur;oaR.value=Math.round(rc.overlayAlpha*100);
  updateThemeTxt();[opR,blR,nbR,obR,oaR].forEach(track);
  updateTxt();LivePreview.clear();StyleManager.applyAgain();alert('已清除当前站点配置');});
 (function(){
  let sx=0,sy=0,sr=0,sb=0;
  function dn(e){
   const ev=e.touches?e.touches[0]:e,r=box.getBoundingClientRect();
   sx=ev.clientX;sy=ev.clientY;sr=innerWidth-r.right;sb=innerHeight-r.bottom;toggle.__dragging=false;
   document.addEventListener('mousemove',mv,true);document.addEventListener('mouseup',up,true);
   document.addEventListener('touchmove',mv,{passive:false});document.addEventListener('touchend',up,true);}
  function mv(e){
   const ev=e.touches?e.touches[0]:e,dx=ev.clientX-sx,dy=ev.clientY-sy;
   if(Math.abs(dx)>3||Math.abs(dy)>3)toggle.__dragging=true;
   box.style.right=Utils.clamp(sr-dx,0,Math.max(0,innerWidth-46))+'px';
   box.style.bottom=Utils.clamp(sb-dy,0,Math.max(0,innerHeight-46))+'px';
   if(e.cancelable)e.preventDefault();}
  function up(){
   document.removeEventListener('mousemove',mv,true);document.removeEventListener('mouseup',up,true);
   document.removeEventListener('touchmove',mv,{passive:false});document.removeEventListener('touchend',up,true);
   if(toggle.__dragging){
    const r=box.getBoundingClientRect();
    const fp=Utils.safePos({right:innerWidth-r.right,bottom:innerHeight-r.bottom});
    box.style.right=fp.right+'px';box.style.bottom=fp.bottom+'px';
    Store.set(KEYS.floatPos,JSON.stringify(fp));Config.invalidate();}}
  toggle.addEventListener('mousedown',dn);toggle.addEventListener('touchstart',dn,{passive:true});
 })();},
fixPosition(el){
 if(!el)return;
 const r=el.getBoundingClientRect();
 const fp=Utils.safePos({right:innerWidth-r.right,bottom:innerHeight-r.bottom});
 if(parseInt(el.style.right)!==fp.right||parseInt(el.style.bottom)!==fp.bottom){el.style.right=fp.right+'px';el.style.bottom=fp.bottom+'px';}},
ensureAlive(){
 if(!FloatPanel.shouldExist)return;
 if(!Config.merge(Utils.getHost()).floatVisible)return;
 const el=FloatPanel.node||document.getElementById(FLOAT_ID);
 if(!el||!((document.body&&document.body.contains(el))||document.documentElement.contains(el))){FloatPanel.node=null;FloatPanel.create();}
 else{FloatPanel.node=el;FloatPanel.fixPosition(el);}}
};

const Menus={
register(){
 const host=Utils.getHost(),g=Config.getGlobal(),s=Config.getSite(host);
 GM_registerMenuCommand(g.enabled?'❌ 关闭背景（全局）':'✅ 开启背景（全局）',()=>Config.setGlobalValue(KEYS.enabled,!g.enabled));
 GM_registerMenuCommand(g.listMode==='blacklist'?'⚪ 切换白名单':'⚫ 切换黑名单',()=>Config.setGlobalValue(KEYS.listMode,g.listMode==='blacklist'?'whitelist':'blacklist'));
 GM_registerMenuCommand(Config.inSiteList(host)?'📌 移出站点列表':'📌 加入站点列表',()=>Config.toggleCurrentSiteInList());
 GM_registerMenuCommand('🌙 '+THEME_LABEL[1]+'（本站）',()=>Config.updateCurrentSite({theme:1}));
 GM_registerMenuCommand('☀️ '+THEME_LABEL[2]+'（本站）',()=>Config.updateCurrentSite({theme:2}));
 GM_registerMenuCommand('🎨 恢复默认文字色调（本站）',()=>{const h=Utils.getHost(),c=Config.getSite(h);if(c){delete c.theme;Config.setSite(h,c);}Config.invalidate();StyleManager.applyAgain();});
 GM_registerMenuCommand(s&&s.enabled===false?'🟢 单独启用':'🔴 单独禁用',()=>Config.updateCurrentSite({enabled:(Config.getSite(host)||{}).enabled===false}));}
};

const Bootstrap={
_listenersBound:false,_mutationTimer:null,
bindGlobalListeners(){
 if(Bootstrap._listenersBound)return;
 Bootstrap._listenersBound=true;
 document.addEventListener('click',e=>{
  const box=FloatPanel.node;
  if(!box)return;
  if(e.target!==box&&!box.contains(e.target)&&FloatPanel.closePanel)FloatPanel.closePanel();},true);
 document.addEventListener('click',()=>{setTimeout(()=>OverlayEnhancer.request(),100);},true);
 document.addEventListener('keydown',()=>{setTimeout(()=>OverlayEnhancer.request(),150);},true);},
observe(){
 new MutationObserver(()=>{
  CaptchaGuard.throttledCheck();
  if(Bootstrap._mutationTimer)clearTimeout(Bootstrap._mutationTimer);
  Bootstrap._mutationTimer=setTimeout(()=>{
   const cfg=Config.merge(Utils.getHost());
   if(cfg.enabled&&!CaptchaGuard.active&&!document.getElementById(STYLE_ID)){StyleManager.styleNode=null;StyleManager.applyStyle();}
   const ov=Config.getEffectiveOverlayValues();
   if(cfg.enabled&&!CaptchaGuard.active&&(ov.blur>0||ov.alpha>0))OverlayEnhancer.request();
   SiteAdapters.stripXHeaderBlur();
   FloatPanel.ensureAlive();},150);
 }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','aria-hidden']});},
init(){
 document.addEventListener('visibilitychange',()=>{if(document.hidden)OverlayEnhancer.stopScanTimer();else OverlayEnhancer.startScanTimer();});
 FloatPanel.shouldExist=Config.getGlobal().floatVisible;
 StyleManager.applySkeletonStyle();
 StyleManager.applyStyleFull();
 Bootstrap.bindGlobalListeners();
 Bootstrap.observe();
 document.addEventListener('DOMContentLoaded',()=>{CaptchaGuard.throttledCheck();StyleManager.applyAgain();FloatPanel.create();OverlayEnhancer.startScanTimer();});
 addEventListener('load',()=>{
  CaptchaGuard.throttledCheck();StyleManager.applyAgain();FloatPanel.create();
  setTimeout(()=>{FloatPanel.ensureAlive();StyleManager.applyStyleFull();},500);
  setTimeout(()=>{FloatPanel.ensureAlive();StyleManager.applyStyleFull();},2000);});
 Menus.register();}
};

Bootstrap.init();
})();
