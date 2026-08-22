// ==UserScript==
// @name         浏览器背景 v3.0
// @namespace    https://viayoo.com/
// @version      3.0
// @description  浏览器背景
// @author       明明
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    const earlyTitle = (document.title || '').toLowerCase();
    const isEarlyCfPage = /just a moment|attention required|cloudflare|please wait|checking your browser|verify you are human|one more step/.test(earlyTitle) || /\/cdn-cgi\//.test(window.location.pathname);
    if (isEarlyCfPage) { return; }

    const CACHE_AVAILABLE = typeof caches !== 'undefined' && typeof caches.open === 'function';

    const KEYS = {
        url: 'Vie背景图片',
        theme: 'Vie背景',
        opacity: 'Vie背景透明度',
        blur: 'Vie背景模糊',
        enabled: 'Vie背景启用',
        floatVisible: 'Vie背景悬浮按钮显示',
        listMode: 'Vie背景列表模式',
        floatPos: 'Vie背景悬浮位置',
        nativeElementBlur: 'Vie背景原生弹层模糊',
        overlayBlur: 'Vie背景动态弹层模糊',
        overlayAlpha: 'Vie背景动态弹层透明度',
        siteList: 'Vie背景站点列表',
        siteConfigMap: 'Vie背景站点配置'
    };

    const DEFAULTS = { url: 'https://8upload.com/image/96dff2c694b65855/2026_01_16.jpg', theme: 1, opacity: 0.69, blur: 0, enabled: true, floatVisible: true, listMode: 'blacklist', floatPos: { right: 10, bottom: 90 }, nativeElementBlur: 10, overlayBlur: 10, overlayAlpha: 0.10 };
    const STYLE_ID = 'vie-browser-bg-style-v89', FLOAT_ID = 'vie-browser-bg-float-v89', NATIVE_BLUR_STYLE_ID = 'vie-browser-bg-native-blur-style-v89';
    const CACHE_NAME = 'vie-browser-bg-images-v1', CACHE_PREFIX = '[cache:local]', GM_BACKUP_PREFIX = 'Vie背景图片备份_', GM_FILENAME_MAP = 'Vie背景图片文件名映射';
    const COMPRESS_THRESHOLD = 1000 * 1024, COMPRESS_TARGET = 1000 * 1024, MAX_IMAGE_WIDTH = 1600, MAX_IMAGE_HEIGHT = 2560, MAX_FILE_SIZE = 15 * 1024 * 1024;

    let cachedStyleNode = null, cachedFloatNode = null, cachedNativeBlurStyle = null;
    const overlayMarked = new WeakSet(), overlayLastApplied = new WeakMap();
    let overlayRafPending = false, overlayScanTimer = null, _liveOverlayBlur = null, _liveOverlayAlpha = null, floatShouldExist = false;
    let captchaActive = false;

    const CAPTCHA_SELECTORS = ['iframe[src*="challenges.cloudflare.com"]', 'iframe[src*="hcaptcha.com"]', 'iframe[src*="recaptcha.net"]', 'iframe[src*="recaptcha"]', '.cf-turnstile', '.h-captcha', '.g-recaptcha'];
    const CAPTCHA_CSS_SELECTOR = CAPTCHA_SELECTORS.join(',');
    const SPA_WHITELIST = ['pixiv.net', 'twitter.com', 'x.com', 'fanbox.cc'];

    let configCache = null, configCacheTime = 0; const CONFIG_CACHE_TTL = 500;
    let _currentImageUrl = null, _currentObjectUrl = null, _imageReady = false, _imageReadyCallbacks = [];

    function invalidateConfig() { configCache = null; configCacheTime = 0; }

    function setCurrentImageUrl(url) {
        if (_currentObjectUrl && _currentObjectUrl !== url) {
            try { URL.revokeObjectURL(_currentObjectUrl); } catch (e) {}
            _currentObjectUrl = null;
        }
        _currentImageUrl = url || null;
        if (typeof url === 'string' && url.startsWith('blob:')) _currentObjectUrl = url;
    }

    function onImageReady(cb) { if (_imageReady) { cb(); return; } _imageReadyCallbacks.push(cb); }
    function notifyImageReady() { _imageReady = true; _imageReadyCallbacks.forEach(cb => { try { cb(); } catch (e) {} }); _imageReadyCallbacks = []; }

    function getFilenameMap() { return safeJSONParse(getValue(GM_FILENAME_MAP, '{}'), {}); }
    function setFilenameMap(map) { setValue(GM_FILENAME_MAP, JSON.stringify(map)); }
    function saveOriginalFilename(key, filename) { if (!key || !filename) return; const map = getFilenameMap(); map[key] = filename; setFilenameMap(map); }
    function getOriginalFilename(key) { if (!key) return null; const map = getFilenameMap(); return map[key] || null; }
    function deleteFilenameRecord(key) { if (!key) return; const map = getFilenameMap(); delete map[key]; setFilenameMap(map); }
    function generateCacheKey() { return `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`; }
    function isCacheKey(url) { return typeof url === 'string' && url.startsWith(CACHE_PREFIX); }
    function isDataImageUrl(url) { return typeof url === 'string' && /^data:image\//i.test(url.trim()); }
    function extractCacheKey(url) { return isCacheKey(url) ? url.replace(CACHE_PREFIX, '') : null; }
    function buildCacheKeyUrl(key) { return CACHE_PREFIX + key; }

    async function storeImage(imageDataUrl, key, originalFilename) {
        const cacheKey = key || generateCacheKey();
        if (CACHE_AVAILABLE) { try { const cache = await caches.open(CACHE_NAME); const blob = dataUrlToBlob(imageDataUrl); await cache.put(new Request('/' + cacheKey), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })); } catch (e) {} }
        saveGMBackup(cacheKey, imageDataUrl); if (originalFilename) saveOriginalFilename(cacheKey, originalFilename); return cacheKey;
    }
    function saveGMBackup(key, dataUrl) { try { setValue(GM_BACKUP_PREFIX + key, dataUrl); } catch (e) {} }
    async function getImage(key) {
        if (CACHE_AVAILABLE) { try { const cache = await caches.open(CACHE_NAME); const response = await cache.match(new Request('/' + key)); if (response) return URL.createObjectURL(await response.blob()); } catch (e) {} }
        const backup = getValue(GM_BACKUP_PREFIX + key, ''); return (backup && backup.startsWith('data:image/')) ? backup : null;
    }
    async function deleteImage(key) {
        if (CACHE_AVAILABLE) { try { await caches.open(CACHE_NAME).then(c => c.delete(new Request('/' + key))); } catch (e) {} }
        try { GM_deleteValue(GM_BACKUP_PREFIX + key); } catch (e) {} deleteFilenameRecord(key);
    }
    function dataUrlToBlob(dataUrl) { const [header, base64] = dataUrl.split(','); const mime = header.match(/:(.*?);/)[1]; const binary = atob(base64); const array = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i); return new Blob([array], { type: mime }); }
    function dataUrlToUint8Array(dataUrl) { const base64 = dataUrl.split(',')[1]; if (!base64) return new Uint8Array(0); const binary = atob(base64); const array = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i); return array; }

    function uint8ArrayToDataUrl(uint8, mime) {
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK));
        }
        return 'data:' + mime + ';base64,' + btoa(binary);
    }

    function clamp(num, min, max) { return Math.min(max, Math.max(min, num)); }
    function safePos(pos) { const vw = window.innerWidth || 360, vh = window.innerHeight || 640; return { right: clamp(Number(pos && pos.right) || 10, 0, Math.max(0, vw - 46)), bottom: clamp(Number(pos && pos.bottom) || 90, 0, Math.max(0, vh - 46)) }; }
    function getHost() { return location.hostname || ''; }
    function getValue(key, def) { return GM_getValue(key, def); }
    function setValue(key, val) { GM_setValue(key, val); }
    function safeJSONParse(str, def) { try { return JSON.parse(str); } catch (e) { return def; } }
    function getList() { return safeJSONParse(getValue(KEYS.siteList, '[]'), []); }
    function setList(arr) { setValue(KEYS.siteList, JSON.stringify(arr)); }
    function normalizeHost(h) { return String(h || '').trim().toLowerCase(); }
    function hostMatch(rule, host) { rule = normalizeHost(rule); host = normalizeHost(host); if (!rule || !host) return false; if (host === rule || host.endsWith('.' + rule)) return true; const rP = rule.split('.'), hP = host.split('.'); if (rP.length === 2) return hP.length >= 2 && hP.slice(-2).join('.') === rule; if (rP.length > 2 && hP.length >= rP.length) return hP.slice(-rP.length).join('.') === rule; return false; }
    function getTopDomain(host) { host = normalizeHost(host); if (!host) return ''; if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host; const parts = host.split('.'); if (parts.length <= 2) return host; const sld = ['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'ne', 'or', 'go']; if (sld.includes(parts[parts.length - 2]) && parts[parts.length - 1].length <= 3) return parts.slice(-3).join('.'); return parts.slice(-2).join('.'); }
    function inSiteList(host) { const td = getTopDomain(host); if (!td) return false; return getList().some(item => getTopDomain(item) === td || hostMatch(item, host)); }
    function getSiteConfigMap() { return safeJSONParse(getValue(KEYS.siteConfigMap, '{}'), {}); }
    function setSiteConfigMap(map) { setValue(KEYS.siteConfigMap, JSON.stringify(map)); }
    function getSiteConfig(host) { return getSiteConfigMap()[host] || null; }
    function setSiteConfig(host, cfg) { const map = getSiteConfigMap(); map[host] = cfg; setSiteConfigMap(map); }
    function removeSiteConfig(host) { const map = getSiteConfigMap(); delete map[host]; setSiteConfigMap(map); }

    function getGlobalConfig() {
        return {
            url: getValue(KEYS.url, DEFAULTS.url),
            theme: Number(getValue(KEYS.theme, DEFAULTS.theme)),
            opacity: clamp(Number(getValue(KEYS.opacity, DEFAULTS.opacity)), 0.1, 1),
            blur: clamp(Number(getValue(KEYS.blur, DEFAULTS.blur)), 0, 50),
            enabled: getValue(KEYS.enabled, DEFAULTS.enabled),
            floatVisible: getValue(KEYS.floatVisible, DEFAULTS.floatVisible),
            listMode: getValue(KEYS.listMode, DEFAULTS.listMode),
            floatPos: safeJSONParse(getValue(KEYS.floatPos, JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos),
            nativeElementBlur: clamp(Number(getValue(KEYS.nativeElementBlur, DEFAULTS.nativeElementBlur)), 0, 20),
            overlayBlur: clamp(Number(getValue(KEYS.overlayBlur, DEFAULTS.overlayBlur)), 0, 40),
            overlayAlpha: clamp(Number(getValue(KEYS.overlayAlpha, DEFAULTS.overlayAlpha)), 0, 0.8)
        };
    }
    function shouldApply(host, globalCfg) { if (!globalCfg.enabled) return false; const siteCfg = getSiteConfig(host); if (siteCfg && siteCfg.enabled === false) return false; if (siteCfg && siteCfg.enabled === true) return true; if (globalCfg.listMode === 'whitelist') return inSiteList(host); return !inSiteList(host); }
    function mergeConfig(host) {
        const now = Date.now();
        if (configCache && configCache._host === host && (now - configCacheTime) < CONFIG_CACHE_TTL) return configCache;
        const g = getGlobalConfig(), s = getSiteConfig(host);
        const result = {
            url: s && typeof s.url === 'string' ? s.url : g.url,
            theme: s && (s.theme === 1 || s.theme === 2) ? s.theme : g.theme,
            opacity: s && typeof s.opacity === 'number' ? clamp(s.opacity, 0.1, 1) : g.opacity,
            blur: s && typeof s.blur === 'number' ? clamp(s.blur, 0, 50) : g.blur,
            enabled: shouldApply(host, g),
            floatVisible: g.floatVisible,
            listMode: g.listMode,
            floatPos: g.floatPos,
            nativeElementBlur: s && typeof s.nativeElementBlur === 'number' ? clamp(s.nativeElementBlur, 0, 20) : g.nativeElementBlur,
            overlayBlur: s && typeof s.overlayBlur === 'number' ? clamp(s.overlayBlur, 0, 40) : g.overlayBlur,
            overlayAlpha: s && typeof s.overlayAlpha === 'number' ? clamp(s.overlayAlpha, 0, 0.8) : g.overlayAlpha,
            _host: host
        };
        configCache = result; configCacheTime = now; return result;
    }
    function getEffectiveOverlayValues() { const cfg = mergeConfig(getHost()); return { blur: _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur, alpha: _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha }; }

    function getBackgroundCSS(cfg, finalUrl) {
        const darkMask = clamp(1 - cfg.opacity, 0, 0.9);
        const imgUrl = finalUrl || '';
        let bgCss = imgUrl
            ? `html::before{content:""!important;position:fixed!important;inset:0!important;z-index:-2147483647!important;pointer-events:none!important;background-image:linear-gradient(rgba(0,0,0,${darkMask}),rgba(0,0,0,${darkMask})),url("${imgUrl}")!important;background-repeat:no-repeat!important;background-position:center!important;background-size:100% 100%,cover!important;opacity:1!important;filter:blur(${cfg.blur}px)!important;transform:translateZ(0)!important;}`
            : `html::before{content:""!important;position:fixed!important;inset:0!important;z-index:-2147483647!important;pointer-events:none!important;background:transparent!important;opacity:0!important;}`;
        return `html,body{background:transparent!important;background-color:transparent!important;background-image:none!important;}
#bgCanvas{display:none!important;}
${bgCss}
body::before{content:""!important;position:fixed!important;inset:0!important;z-index:-2147483646!important;pointer-events:none!important;background:transparent!important;}
*:not(img):not(svg):not(video):not(canvas):not(.translate-ui):not(.translate-ui *):not(.cf-turnstile):not(.h-captcha):not(.g-recaptcha):not(input):not(select):not(textarea):not([id^="typeaheadDropdown"]):not(.search-suggest):not(.sug-list):not(.s-sug):not([class*="suggest"]):not([class*="dropdown"]):not([class*="autocomplete"]):not([role="listbox"]):not([role="menu"]){background-color:transparent!important;}
[id^="_r_"],[id^="_r_"] *{background-color:transparent!important;background:transparent!important;background-image:none!important;box-shadow:none!important;}
#container,#header,#logo,#wrapper,#page,#main,.container,.wrapper,header,footer,nav,.navbar,.top-bar,.row1,.header,.logo,#top,.top,#site-header,.site-header{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;}
#additional-info,.user-content,#script-info,.width-constraint,#install-area,.good-bad,.discussion-list,article,.post-body,.entry-content,.markdown-body,.topic-body,.post-content,#readme,.Box-body{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;--bg-color:transparent!important;--color-canvas-default:transparent!important;}
.ippure-wrapper,.ippure-container{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;}
.translate-ui .tu-btn{background:#1e1e2f!important;}.translate-ui .tu-btn.active{background:#1f5a3a!important;}.translate-ui .tu-panel{background:rgba(20,22,27,0.96)!important;}
${CAPTCHA_CSS_SELECTOR}, ${CAPTCHA_SELECTORS.map(s => s + ' *').join(',')} { background-color: initial !important; background: initial !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; filter: none !important; opacity: 1 !important; pointer-events: auto !important; mix-blend-mode: normal !important; }
:root{--color-canvas-default:transparent!important;--color-canvas-subtle:transparent!important;--color-canvas-inset:transparent!important;--color-page-header-bg:transparent!important;--color-header-bg:rgba(0,0,0,0.18)!important;}
[class*="bg"],[class*="Bg"],[class*="color-bg"],[class*="ColorBg"],[class*="bgColor"],.Box,.Box-body,.Box-header,.file-navigation,.repository-content,.AppHeader,.Layout-sidebar,.Layout-main,.UnderlineNav,.BorderGrid,.flash,.modal,.modal-dialog,.modal-body,.drawer,.drawer-body,.diff-table,.diff-header,.blob-code,.blob-num,.file,.file-header,.commit,.timeline-comment,.review-comment,.inline-comment-form,.select-menu,.dropdown,.Popover,.overlay,.signed-commit,.blankslate,.paginate-container,.pagination,.State,.Label,.Counter,.TimelineItem,.commit-ref,.sha,.IssueLabel{background:transparent!important;background-color:transparent!important;box-shadow:none!important;border-color:transparent!important;}
td,th,thead,tbody,tfoot,.rounded-top-2,.rounded-bottom-2,.rounded-2{background:transparent!important;background-color:transparent!important;}
.GlobalNav,.UnderlineNav,.LocalNavigation,[class*="UnderlineNav"],[class*="GlobalNav"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}`;
    }

    function getThemeCSS(theme) {
        if (theme === 1) return `input:not(.translate-ui input),div,font,h1,h2,h3,h4,h5,h6,p,li,span:not(.tu-bi),label,strong,em{color:#ddd!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#fff!important;}`;
        return `input:not(.translate-ui input),div,h1,h2,h3,h4,h5,h6,p,li,span:not(.tu-bi),label,strong,em{color:#222!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#000!important;}`;
    }

    function getNativeBlurCSS(blurAmount, theme) {
        if (blurAmount <= 0) return '';
        const isDark = theme === 1;
        const xDropdownBg = isDark ? 'rgba(15,20,25,0.00)' : 'rgba(255,255,255,0.00)';
        const xDropdownBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        const xHoverBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        return `
.modal,.dialog,.popup,.dropdown,.menu,.popover,.tooltip,[role="dialog"],[role="menu"],[role="tooltip"],[role="listbox"],[role="grid"],.layer,.fancybox,.swal-modal,.ant-modal,.el-dialog,.el-popper,.notification,.Toastify__toast-container,.position-fixed,.z-50{backdrop-filter:blur(${blurAmount}px)!important;-webkit-backdrop-filter:blur(${blurAmount}px)!important;}
[id^="typeaheadDropdown"],.search-suggest,.sug-list,.s-sug,[class*="suggest"],[class*="dropdown"],[class*="autocomplete"],[role="listbox"],[role="menu"]{backdrop-filter:blur(${blurAmount}px)!important;-webkit-backdrop-filter:blur(${blurAmount}px)!important;background-color:${xDropdownBg}!important;border:1px solid ${xDropdownBorder}!important;box-shadow:0 4px 12px rgba(0,0,0,0.2)!important;transform:translateZ(0)!important;isolation:isolate!important;}
[id^="typeaheadDropdown"] *:not(img),.search-suggest *:not(img),.sug-list *:not(img),.s-sug *:not(img),[class*="suggest"] *:not(img),[role="listbox"] *:not(img),[role="menu"] *:not(img){background-color:transparent!important;box-shadow:none!important;}
input:not(.translate-ui input),textarea,select,[type="text"],[type="search"],[type="email"],[type="password"],[type="url"],[type="number"],[contenteditable="true"]{
  background-color:transparent!important;
  background:transparent!important;
  background-image:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  box-shadow:none!important;
  border-color:${xDropdownBorder}!important;
}
button:hover,[role="option"]:hover,div[class*="suggest"] li:hover,div[class*="suggest"] div:hover{background-color:${xHoverBg}!important;}`;
    }

    // X（Twitter）主列顶部标签栏 sticky 头部：去掉毛玻璃 backdrop-filter 和背景    
    function getXSpecificCSS() {
        return `
[data-testid="primaryColumn"] div:has(nav[aria-live="polite"][role="navigation"]),
[data-testid="primaryColumn"] div:has(> div > div > nav[aria-live="polite"][role="navigation"]),
[data-testid="primaryColumn"] > div:first-child,
[data-testid="primaryColumn"] > div:first-child > div,
[data-testid="primaryColumn"] > div:first-child > div > div{background-color:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}
[data-testid="primaryColumn"] .r-1e5uvyk{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}
nav[aria-live="polite"][role="navigation"],
nav[aria-live="polite"][role="navigation"] > div,
nav[aria-live="polite"][role="navigation"] div[role="tablist"],
nav[aria-live="polite"][role="navigation"] div[role="presentation"],
nav[aria-live="polite"][role="navigation"] div[role="tab"]{background-color:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}`;
    }

    function isXSite() { const h = getHost(); return /(^|\.)x\.com$/.test(h) || /(^|\.)twitter\.com$/.test(h); }

    function stripXHeaderBlur() {
        if (!isXSite() || captchaActive) return;
        const cfg = mergeConfig(getHost());
        if (!cfg.enabled) return;
        const navs = document.querySelectorAll('nav[aria-live="polite"][role="navigation"]');
        navs.forEach(nav => {
            let el = nav;
            for (let i = 0; i < 6 && el && el !== document.body; i++) {
                const st = getComputedStyle(el);
                const bf = st.backdropFilter || st.webkitBackdropFilter || '';
                if ((bf && bf !== 'none') || st.position === 'sticky' || st.position === 'fixed') {
                    el.style.setProperty('backdrop-filter', 'none', 'important');
                    el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
                    el.style.setProperty('background-color', 'transparent', 'important');
                }
                el = el.parentElement;
            }
            nav.style.setProperty('background-color', 'transparent', 'important');
            nav.style.setProperty('backdrop-filter', 'none', 'important');
            nav.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        });
    }

    function buildCSS(cfg, finalUrl) {
        let css = getBackgroundCSS(cfg, finalUrl) + getThemeCSS(cfg.theme)
            + `.search_ipt,.search_ipt_wr{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:transparent!important;}`
            + `input:not(.translate-ui input),textarea,select,[contenteditable="true"]{background-color:transparent!important;background:transparent!important;background-image:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;outline:none!important;}`
            + `nav.segmented-control.shadow-sm,nav.apple-navbar,nav.apple-navbar .container-fluid{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}`
            + `.btn-close{box-sizing:content-box!important;width:1em!important;height:1em!important;padding:.25em!important;background:transparent url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e") center/1em auto no-repeat!important;border:0!important;border-radius:.375rem!important;opacity:.7!important;}`
            + `.btn-close-white{filter:invert(1) grayscale(100%) brightness(200%)!important;}`;
        if (isXSite()) css += getXSpecificCSS();
        return css;
    }

    function isExcludedElement(el) {
        if (!el || !el.nodeType) return false;
        if (el.id === 'goTopBottom' || el.id === 'tbSettingsBtn' || el.id === 'tbSettingsPanel') return true;
        if (el.classList && (el.classList.contains('tb-settings-btn') || el.classList.contains('tb-settings-panel'))) return true;
        if (el.classList && el.classList.contains('translate-ui')) return true;
        if (el.id === 'tuPanel' || el.id === 'tuBtn') return true;
        if (el.classList && (el.classList.contains('GlobalNav') || el.classList.contains('UnderlineNav') || el.classList.contains('LocalNavigation'))) return true;
        if (el.classList && (el.classList.contains('apple-navbar') || el.classList.contains('segmented-control'))) return true;
        if (typeof el.className === 'string' && (el.className.includes('UnderlineNav') || el.className.includes('GlobalNav'))) return true;
        try { if (el.matches && el.matches(CAPTCHA_CSS_SELECTOR)) return true; if (el.closest && el.closest(CAPTCHA_CSS_SELECTOR)) return true; } catch (e) {}
        if (el.tagName === 'IFRAME') { const src = el.src || ''; if (src.includes('challenges.cloudflare.com') || src.includes('hcaptcha.com') || src.includes('recaptcha')) return true; }
        return false;
    }

    function applyNativeBlur(blurAmount, theme) {
        const old = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID);
        if (old) { old.remove(); cachedNativeBlurStyle = null; }
        if (blurAmount <= 0) return;
        let s = document.createElement('style'); s.id = NATIVE_BLUR_STYLE_ID; s.textContent = getNativeBlurCSS(blurAmount, theme);
        (document.head || document.documentElement).appendChild(s); cachedNativeBlurStyle = s;
    }

    function ensureStyleNode() { if (cachedStyleNode && document.contains(cachedStyleNode)) return cachedStyleNode; let s = document.getElementById(STYLE_ID); if (!s) { s = document.createElement('style'); s.id = STYLE_ID; (document.head || document.documentElement).appendChild(s); } cachedStyleNode = s; return s; }
    function removeStyle() { const s = cachedStyleNode || document.getElementById(STYLE_ID); if (s) { s.remove(); cachedStyleNode = null; } const nb = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID); if (nb) { nb.remove(); cachedNativeBlurStyle = null; } }

    async function preloadImage() {
        const cfg = mergeConfig(getHost());
        if (!cfg.enabled) { _imageReady = true; setCurrentImageUrl(null); notifyImageReady(); return; }
        if (isCacheKey(cfg.url)) {
            const imgUrl = await getImage(extractCacheKey(cfg.url));
            setCurrentImageUrl(imgUrl || null);
        } else if (isDataImageUrl(cfg.url)) {
            const cacheKey = await storeImage(cfg.url, null, 'migrated_image.jpg');
            if (cacheKey) {
                const newUrl = buildCacheKeyUrl(cacheKey);
                if (getSiteConfig(getHost()) && getSiteConfig(getHost()).url === cfg.url) setSiteConfig(getHost(), Object.assign({}, getSiteConfig(getHost()), { url: newUrl }));
                else setValue(KEYS.url, newUrl);
                invalidateConfig();
                setCurrentImageUrl(cfg.url);
            }
        } else {
            setCurrentImageUrl(cfg.url);
        }
        _imageReady = true; notifyImageReady();
    }
    function applyStyle() { if (captchaActive) return; const host = getHost(), cfg = mergeConfig(host); if (!cfg.enabled) { removeStyle(); setCurrentImageUrl(null); return; } const s = ensureStyleNode(); s.textContent = buildCSS(cfg, _currentImageUrl || ''); applyNativeBlur(cfg.nativeElementBlur, cfg.theme); stripXHeaderBlur(); }
    async function applyStyleFull() { if (!_imageReady) await preloadImage(); applyStyle(); }
    function applyAgain() { invalidateConfig(); _imageReady = false; applyStyleFull(); requestOverlayApply(); setTimeout(applyStyleFull, 100); setTimeout(applyStyleFull, 500); }
    function setGlobal(key, value) { invalidateConfig(); setValue(key, value); applyAgain(); }
    function updateCurrentSiteConfig(patch) { invalidateConfig(); setSiteConfig(getHost(), Object.assign({}, getSiteConfig(getHost()) || {}, patch)); applyAgain(); }
    function toggleCurrentSiteInList() {
        const host = getHost(); if (!host) return;
        const td = getTopDomain(host); let list = getList();
        const siteCfg = getSiteConfig(host); if (siteCfg && 'enabled' in siteCfg) { delete siteCfg.enabled; setSiteConfig(host, siteCfg); }
        const topCfg = getSiteConfig(td); if (topCfg && 'enabled' in topCfg) { delete topCfg.enabled; setSiteConfig(td, topCfg); }
        const existsIndex = list.findIndex(item => getTopDomain(item) === td || hostMatch(item, host));
        const modeText = getGlobalConfig().listMode === 'whitelist' ? '白名单' : '黑名单';
        if (existsIndex > -1) { list.splice(existsIndex, 1); alert(`✅ 已从站点列表移除：${td}\n\n当前模式：${modeText}\n当前状态：${getGlobalConfig().listMode === 'whitelist' ? '未命中，背景已关闭' : '未命中，背景已开启'}`); }
        else { list.push(td); alert(`✅ 已加入站点列表：${td}\n\n当前模式：${modeText}\n当前状态：${getGlobalConfig().listMode === 'whitelist' ? '已命中，背景已开启' : '已命中，背景已关闭'}`); }
        setList(list); applyAgain();
    }

    let _lastCaptchaCheck = 0;
    function throttledCaptchaCheck() { const now = Date.now(); if (now - _lastCaptchaCheck < 300) return; _lastCaptchaCheck = now; checkCaptchaStatus(); }

    function checkCaptchaStatus() {
        const host = getHost();
        if (SPA_WHITELIST.some(domain => host.includes(domain))) { if (captchaActive) { captchaActive = false; applyStyle(); } return; }
        const title = (document.title || '').toLowerCase();
        if (/just a moment|attention required|cloudflare|please wait|checking your browser|verify you are human/.test(title)) { if (!captchaActive) { captchaActive = true; removeStyle(); } return; }
        let found = false;
        if (document.body) { for (const sel of CAPTCHA_SELECTORS) { try { if (document.body.querySelector(sel)) { found = true; break; } } catch (e) {} } }
        if (found && !captchaActive) { captchaActive = true; removeStyle(); }
        else if (!found && captchaActive) { setTimeout(() => { let sf = false; if (document.body) { for (const sel of CAPTCHA_SELECTORS) { try { if (document.body.querySelector(sel)) { sf = true; break; } } catch (e) {} } } if (!sf && captchaActive) { captchaActive = false; applyStyle(); } }, 1500); }
    }

    const overlayKeywordCache = new WeakMap();
    function isOverlayVisible(el, style) { if (!el || !style) return false; if (style.display === 'none' || style.visibility === 'hidden') return false; if (parseFloat(style.opacity || '1') <= 0) return false; const rect = el.getBoundingClientRect(); return rect.width > 2 && rect.height > 2; }
    function getZIndex(style) { const z = parseInt(style.zIndex || '0', 10); return Number.isFinite(z) ? z : 0; }
    function hasOverlayKeyword(el) { if (overlayKeywordCache.has(el)) return overlayKeywordCache.get(el); const txt = `${(el.className || '').toString().toLowerCase()} ${(el.id || '').toString().toLowerCase()}`; const role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase(); const result = /overlay|backdrop|mask|modal|drawer|popup|dialog|sheet|menu|popover|sidebar|side-nav|side-panel|nav-panel|offcanvas|slide-panel|flyout|panel|typeahead|autocomplete/.test(txt) || ['listbox', 'menu', 'dialog', 'tooltip', 'grid', 'alertdialog'].includes(role); overlayKeywordCache.set(el, result); return result; }
    function hasOverlayBg(style) { const bg = style.backgroundColor || ''; return bg.includes('rgb') || (style.backdropFilter && style.backdropFilter !== 'none') || (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none'); }
    function htmlBodyLocked() { if (!document.body) return false; const hs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body); const hc = (document.documentElement.className || '').toLowerCase(), bc = (document.body.className || '').toLowerCase(); return ['modal-open', 'drawer-open', 'overflow-hidden', 'no-scroll', 'popup-open', 'dialog-open'].some(k => hc.includes(k) || bc.includes(k)) || hs.overflow === 'hidden' || hs.overflowY === 'hidden' || bs.overflow === 'hidden' || bs.overflowY === 'hidden'; }
    function isLightBg(bg) { if (!bg || !bg.includes('rgb')) return false; const nums = bg.match(/\d+(\.\d+)?/g); return nums && nums.length >= 3 && (parseFloat(nums[0]) + parseFloat(nums[1]) + parseFloat(nums[2])) / 3 > 180; }

    function findLikelyOverlays() {
        if (!document.body) return [];
        const floatEl = document.getElementById(FLOAT_ID);
        const overlays = [];
        const vw = window.innerWidth, vh = window.innerHeight;
        const allElements = document.body.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            if (floatEl && (el === floatEl || floatEl.contains(el))) continue;
            if (isExcludedElement(el)) continue;
            const style = getComputedStyle(el);
            const pos = style.position;
            if (pos !== 'fixed' && pos !== 'absolute') continue;       
            if (!isOverlayVisible(el, style)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width < 30 || rect.height < 30) continue;
            const z = getZIndex(style);
            const keyword = hasOverlayKeyword(el);
            let matched = false;
            if (keyword && (pos === 'fixed' || pos === 'absolute')) { if (rect.width > 40 && rect.height > 20) matched = true; }
            if (!matched && pos === 'fixed' && z >= 1) { if (rect.width >= vw * 0.12 && rect.height >= vh * 0.25) matched = true; }
            if (!matched && pos === 'absolute' && z >= 20 && hasOverlayBg(style)) { if (rect.width >= vw * 0.15 && rect.height >= vh * 0.15) matched = true; }
            if (matched) overlays.push({ el, useWhite: isLightBg(style.backgroundColor || ''), pointerNone: style.pointerEvents === 'none' });
        }
        return dedupeOverlays(overlays);
    }
    function dedupeOverlays(arr) { const out = []; for (const item of arr) { let skip = false; for (const kept of out) { if (kept.el.contains(item.el)) { skip = true; break; } } if (!skip) out.push(item); } return out; }

    function writeOverlay(item, blur, alpha) {
        const el = item.el;
        el.style.setProperty('backdrop-filter', `blur(${blur}px)`, 'important');
        el.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important');
        el.style.setProperty('background-color', item.useWhite ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`, 'important');
        if (item.pointerNone) el.style.setProperty('pointer-events', 'auto', 'important');
        overlayMarked.add(el);
        overlayLastApplied.set(el, { blur, alpha });
    }
    function applyOverlayEnhance() {
        if (!document.body || captchaActive) return;
        const cfg = mergeConfig(getHost()); if (!cfg.enabled) return;
        const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur;
        const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha;
        if (blur <= 0 && alpha <= 0) return;
        const overlays = findLikelyOverlays();
        if (!overlays.length && !htmlBodyLocked()) return;
        const floatEl = cachedFloatNode || document.getElementById(FLOAT_ID);
        for (const item of overlays) {
            if (floatEl && (item.el === floatEl || floatEl.contains(item.el))) continue;
            const prev = overlayLastApplied.get(item.el) || {};
            if (prev.blur === blur && prev.alpha === alpha) continue;
            writeOverlay(item, blur, alpha);
        }
    }
    function forceOverlayApply() {
        if (!document.body || captchaActive) return;
        const cfg = mergeConfig(getHost()); if (!cfg.enabled) return;
        const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur;
        const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha;
        const floatEl = cachedFloatNode || document.getElementById(FLOAT_ID);
        const overlays = findLikelyOverlays();
        for (const item of overlays) {
            if (floatEl && (item.el === floatEl || floatEl.contains(item.el))) continue;
            writeOverlay(item, blur, alpha);
        }
    }
    function requestOverlayApply() { if (overlayRafPending || captchaActive) return; overlayRafPending = true; requestAnimationFrame(() => { overlayRafPending = false; applyOverlayEnhance(); }); }

    function stopOverlayScanTimer() { if (overlayScanTimer) { clearInterval(overlayScanTimer); overlayScanTimer = null; } }
    function startOverlayScanTimer() {
        stopOverlayScanTimer();
        if (document.hidden) return;
        overlayScanTimer = setInterval(() => {
            throttledCaptchaCheck();
            stripXHeaderBlur();
            const cfg = mergeConfig(getHost());
            const ov = getEffectiveOverlayValues();
            if (cfg.enabled && !captchaActive && (ov.blur > 0 || ov.alpha > 0)) applyOverlayEnhance();
        }, 1500);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopOverlayScanTimer(); else startOverlayScanTimer(); });

    function compressImage(dataUrl, targetSize, callback) { const img = new Image(); img.onload = function () { let w = img.width, h = img.height; if (w > MAX_IMAGE_WIDTH || h > MAX_IMAGE_HEIGHT) { const r = Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h); w = Math.round(w * r); h = Math.round(h * r); } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); let q = 0.9, result = dataUrl, att = 0; const tryC = () => { result = c.toDataURL('image/jpeg', q); att++; if (result.length > targetSize && q > 0.2 && att < 10) { q -= 0.05; setTimeout(tryC, 10); } else callback(result); }; tryC(); }; img.onerror = function () { callback(null); }; img.src = dataUrl; }
    function pickLocalImage(callback) { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.addEventListener('change', () => { const file = input.files && input.files[0]; if (!file) return; if (file.size > MAX_FILE_SIZE) { alert('图片过大（最大 15MB）'); return; } const origName = file.name, reader = new FileReader(); reader.onload = async function () { const result = String(reader.result || ''); if (!result.startsWith('data:image/')) { alert('读取失败'); return; } const isWebP = file.type === 'image/webp' || result.startsWith('data:image/webp'); let data = result; if (!isWebP && result.length > COMPRESS_THRESHOLD) { const compressed = await new Promise(resolve => compressImage(result, COMPRESS_TARGET, resolve)); if (compressed) { alert(`已压缩：${Math.round(result.length / 1024)}KB → ${Math.round(compressed.length / 1024)}KB`); data = compressed; } } const ck = await storeImage(data, null, origName); if (ck) callback(buildCacheKeyUrl(ck), file, ck); else alert('图片存储失败'); }; reader.readAsDataURL(file); }); input.click(); }

    function toAbsoluteUrl(url) { if (!url) return ''; if (/^(data|blob|https?):/.test(url)) return url; if (url.startsWith('//')) return location.protocol + url; try { return new URL(url, location.href).href; } catch (e) { return url; } }
    function fetchFallback(url, resolve, reject) { const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000); fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal }).then(resp => { clearTimeout(timer); if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.arrayBuffer().then(ab => { const ct = resp.headers.get('content-type') || '', ext = ct.split(';')[0].trim().split('/').pop() || 'jpeg'; resolve({ data: new Uint8Array(ab), ext }); }); }).catch(err => { clearTimeout(timer); reject(new Error('下载失败: ' + (err.message || err))); }); }
    function fetchImageAsUint8(url) { url = toAbsoluteUrl(url); return new Promise((resolve, reject) => { if (typeof GM_xmlhttpRequest === 'function') { let settled = false; const timer = setTimeout(() => { if (!settled) { settled = true; fetchFallback(url, resolve, reject); } }, 15000); try { GM_xmlhttpRequest({ method: 'GET', url, responseType: 'arraybuffer', timeout: 30000, headers: { 'Referer': '' }, anonymous: true, onload(res) { if (settled) return; clearTimeout(timer); settled = true; if (res.status >= 200 && res.status < 300) { try { const rd = res.response; if (rd instanceof ArrayBuffer) { const hdr = String(res.responseHeaders || ''), mm = hdr.match(/content-type:\s*([^\r\n;]+)/i), mime = mm ? mm[1].trim() : 'image/jpeg', ext = mime.split('/').pop().replace('jpeg', 'jpg'); resolve({ data: new Uint8Array(rd), ext }); } else fetchFallback(url, resolve, reject); } catch (e) { fetchFallback(url, resolve, reject); } } else reject(new Error('HTTP ' + res.status)); }, onerror() { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } }, ontimeout() { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } } }); } catch (e) { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } } } else fetchFallback(url, resolve, reject); }); }

    const CRC32_TABLE = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC32_TABLE[i] = c >>> 0; }
    function crc32(u8) { let crc = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) crc = CRC32_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
    async function deflateRaw(data) { if (!data.length) return new Uint8Array(0); const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(data); w.close(); const r = cs.readable.getReader(), chunks = []; while (true) { const { value, done } = await r.read(); if (done) break; chunks.push(value); } let tl = 0; chunks.forEach(c => tl += c.length); const result = new Uint8Array(tl); let off = 0; chunks.forEach(c => { result.set(c, off); off += c.length; }); return result; }
    async function compressSmart(data) { if (data.length < 128) return { compressed: data, method: 0 }; try { const d = await deflateRaw(data); return d.length < data.length ? { compressed: d, method: 8 } : { compressed: data, method: 0 }; } catch (e) { return { compressed: data, method: 0 }; } }
    function wU16(v, o, n) { v.setUint16(o, n, true); } function wU32(v, o, n) { v.setUint32(o, n, true); }
    async function buildZip(entries) { const processed = []; for (const entry of entries) { const nb = new TextEncoder().encode(entry.name), crc = crc32(entry.data); const { compressed, method } = await compressSmart(entry.data); processed.push({ nb, os: entry.data.length, cs: compressed.length, compressed, crc, method }); } let ts = 0; processed.forEach(p => ts += 30 + p.nb.length + p.cs); const cds = ts; processed.forEach(p => ts += 46 + p.nb.length); const cdSz = ts - cds; ts += 22; const buf = new ArrayBuffer(ts), vw = new DataView(buf), u8 = new Uint8Array(buf); let off = 0; const lo = []; for (const p of processed) { lo.push(off); wU32(vw, off, 0x04034b50); wU16(vw, off + 4, 20); wU16(vw, off + 6, 0); wU16(vw, off + 8, p.method); wU16(vw, off + 10, 0); wU16(vw, off + 12, 0); wU32(vw, off + 14, p.crc); wU32(vw, off + 18, p.cs); wU32(vw, off + 22, p.os); wU16(vw, off + 26, p.nb.length); wU16(vw, off + 28, 0); u8.set(p.nb, off + 30); u8.set(p.compressed, off + 30 + p.nb.length); off += 30 + p.nb.length + p.cs; } for (let i = 0; i < processed.length; i++) { const p = processed[i]; wU32(vw, off, 0x02014b50); wU16(vw, off + 4, 20); wU16(vw, off + 6, 20); wU16(vw, off + 8, 0); wU16(vw, off + 10, p.method); wU16(vw, off + 12, 0); wU16(vw, off + 14, 0); wU32(vw, off + 16, p.crc); wU32(vw, off + 20, p.cs); wU32(vw, off + 24, p.os); wU16(vw, off + 28, p.nb.length); wU16(vw, off + 30, 0); wU16(vw, off + 32, 0); wU16(vw, off + 34, 0); wU16(vw, off + 36, 0); wU32(vw, off + 38, 0); wU32(vw, off + 42, lo[i]); u8.set(p.nb, off + 46); off += 46 + p.nb.length; } wU32(vw, off, 0x06054b50); wU16(vw, off + 4, 0); wU16(vw, off + 6, 0); wU16(vw, off + 8, processed.length); wU16(vw, off + 10, processed.length); wU32(vw, off + 12, cdSz); wU32(vw, off + 16, cds); wU16(vw, off + 20, 0); return new Uint8Array(buf); }
    async function parseZipForImport(zipData) { async function inflateRaw(data) { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(data); w.close(); const r = ds.readable.getReader(), chunks = []; while (true) { const { value, done } = await r.read(); if (done) break; chunks.push(value); } let tl = 0; chunks.forEach(c => tl += c.length); const result = new Uint8Array(tl); let off = 0; chunks.forEach(c => { result.set(c, off); off += c.length; }); return result; } const vw = new DataView(zipData.buffer, zipData.byteOffset, zipData.byteLength), result = {}; let pos = 0; while (pos + 30 <= zipData.length) { const sig = vw.getUint32(pos, true); if (sig !== 0x04034b50) break; const method = vw.getUint16(pos + 8, true), cs = vw.getUint32(pos + 18, true), nl = vw.getUint16(pos + 26, true), el = vw.getUint16(pos + 28, true); const name = new TextDecoder().decode(zipData.slice(pos + 30, pos + 30 + nl)); const ds = pos + 30 + nl + el, cd = zipData.slice(ds, ds + cs); if (name.endsWith('/')) { pos = ds + cs; continue; } let fd; try { fd = method === 0 ? cd : method === 8 ? await inflateRaw(cd) : null; } catch (e) { fd = null; } if (fd) result[name] = fd; pos = ds + cs; } return result; }
    function simpleHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }
    function guessExt(url) { if (isDataImageUrl(url)) { const m = url.match(/^data:image\/(\w+)/); return m ? m[1].replace('jpeg', 'jpg') : 'png'; } const m = url.match(/\.(\w{3,4})(?:\?|$)/); return m ? m[1].toLowerCase() : 'jpg'; }
    function getExtFromFilename(fn) { if (!fn) return 'jpg'; const p = fn.split('.'); return p.length < 2 ? 'jpg' : p.pop().toLowerCase().replace('jpeg', 'jpg'); }

    async function exportAllConfigZip() {
        try {
            const scm = JSON.parse(JSON.stringify(getSiteConfigMap())), gUrl = getValue(KEYS.url, DEFAULTS.url);
            let gFile = '', gData = null, gRemote = '';
            if (isCacheKey(gUrl)) { const ck = extractCacheKey(gUrl), orig = getOriginalFilename(ck), ext = orig ? getExtFromFilename(orig) : 'jpg'; gFile = 'global_local.' + ext; if (CACHE_AVAILABLE) { try { const c = await caches.open(CACHE_NAME), r = await c.match(new Request('/' + ck)); if (r) gData = new Uint8Array(await r.arrayBuffer()); } catch (e) {} } if (!gData) { const b = getValue(GM_BACKUP_PREFIX + ck, ''); if (b && b.startsWith('data:image/')) gData = dataUrlToUint8Array(b); } }
            else if (isDataImageUrl(gUrl)) { gFile = 'global_local.' + guessExt(gUrl); gData = dataUrlToUint8Array(gUrl); }
            else if (gUrl) { gRemote = toAbsoluteUrl(gUrl); try { const { data, ext } = await fetchImageAsUint8(gRemote); gFile = 'global_remote.' + ext; gData = data; } catch (e) { alert('⚠️ 全局远程图片下载失败：' + e.message); } }
            const imgEntries = []; if (gData && gFile) imgEntries.push({ name: 'images/' + gFile, data: gData });
            let frc = 0, flc = 0; const fru = [], fls = [];
            for (const h in scm) { const url = scm[h].url; if (!url) continue; let fn = null; if (isCacheKey(url)) { const ck = extractCacheKey(url), orig = getOriginalFilename(ck), ext = orig ? getExtFromFilename(orig) : 'jpg'; fn = 'site_' + simpleHash(h) + '_local.' + ext; let id = null; if (CACHE_AVAILABLE) { try { const c = await caches.open(CACHE_NAME), r = await c.match(new Request('/' + ck)); if (r) id = new Uint8Array(await r.arrayBuffer()); } catch (e) {} } if (!id) { const b = getValue(GM_BACKUP_PREFIX + ck, ''); if (b && b.startsWith('data:image/')) id = dataUrlToUint8Array(b); } if (id) imgEntries.push({ name: 'images/' + fn, data: id }); else { flc++; fls.push(h); } } else if (isDataImageUrl(url)) { fn = 'site_' + simpleHash(h) + '_local.' + guessExt(url); imgEntries.push({ name: 'images/' + fn, data: dataUrlToUint8Array(url) }); } else { const au = toAbsoluteUrl(url); scm[h].remoteUrl = au; try { const { data, ext } = await fetchImageAsUint8(au); fn = 'site_' + simpleHash(h) + '_remote.' + ext; imgEntries.push({ name: 'images/' + fn, data }); } catch (e) { frc++; fru.push(au); } } scm[h].url = fn || ''; }
            const cfg = { version: '3.5', exportedAt: new Date().toISOString(), global: { url: gFile || '', remoteUrl: gRemote, theme: getValue(KEYS.theme, DEFAULTS.theme), opacity: getValue(KEYS.opacity, DEFAULTS.opacity), blur: getValue(KEYS.blur, DEFAULTS.blur), enabled: getValue(KEYS.enabled, DEFAULTS.enabled), floatVisible: getValue(KEYS.floatVisible, DEFAULTS.floatVisible), listMode: getValue(KEYS.listMode, DEFAULTS.listMode), floatPos: safeJSONParse(getValue(KEYS.floatPos, JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos), nativeElementBlur: getValue(KEYS.nativeElementBlur, DEFAULTS.nativeElementBlur), overlayBlur: getValue(KEYS.overlayBlur, DEFAULTS.overlayBlur), overlayAlpha: getValue(KEYS.overlayAlpha, DEFAULTS.overlayAlpha) }, siteList: getList(), siteConfigMap: scm };
            imgEntries.push({ name: 'config.json', data: new TextEncoder().encode(JSON.stringify(cfg, null, 2)) });
            const zipped = await buildZip(imgEntries), blob = new Blob([zipped], { type: 'application/zip' }), bu = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = bu; a.download = '浏览器背景_' + new Date().toISOString().slice(0, 10) + '.zip'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { try { a.remove(); } catch (e) {} URL.revokeObjectURL(bu); }, 1000);
            if (frc > 0 || flc > 0) { let msg = '⚠️ 导出完成，但有问题：\n\n'; if (frc > 0) { msg += `【${frc} 张远程图下载失败】\n`; fru.forEach(u => msg += `- ${u}\n`); } if (flc > 0) { msg += `【${flc} 个本地图读取失败】\n`; fls.forEach(h => msg += `- ${h}\n`); } alert(msg); }
        } catch (e) { alert('导出失败：' + e.message); }
    }

    async function importAllConfigZip() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.zip,application/zip';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0]; if (!file) return;
            try {
                const unzipped = await parseZipForImport(new Uint8Array(await file.arrayBuffer()));
                if (!unzipped['config.json']) throw new Error('缺少 config.json');
                const cd = JSON.parse(new TextDecoder().decode(unzipped['config.json'])), ik = {};
                for (const p in unzipped) { if (p.startsWith('images/') && p !== 'images/') { const fn = p.replace('images/', ''), ext = fn.split('.').pop().toLowerCase(), mm = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }; const du = uint8ArrayToDataUrl(unzipped[p], mm[ext] || 'image/jpeg'); const k = await storeImage(du, null, fn); if (k) ik[fn] = buildCacheKeyUrl(k); } }
                const gr = (cd.global && cd.global.remoteUrl) || '', gl = cd.global.url, gc = (gl && ik[gl]) ? ik[gl] : '';
                if (gr) cd.global.url = gr; else if (gc) cd.global.url = gc; else cd.global.url = DEFAULTS.url;
                if (cd.siteConfigMap) { for (const h in cd.siteConfigMap) { const sc = cd.siteConfigMap[h], sr = sc.remoteUrl || '', sl = sc.url || '', sk = (sl && ik[sl]) ? ik[sl] : ''; if (sr) sc.url = sr; else if (sk) sc.url = sk; else delete sc.url; delete sc.remoteUrl; } }
                applyImportedConfig(cd); alert('导入成功：' + file.name);
            } catch (e) { alert('导入失败：' + e.message); }
        }); input.click();
    }

    function applyImportedConfig(data) {
        invalidateConfig();
        
        const globalKeyMap = { url: KEYS.url, theme: KEYS.theme, opacity: KEYS.opacity, blur: KEYS.blur, enabled: KEYS.enabled, floatVisible: KEYS.floatVisible, listMode: KEYS.listMode, floatPos: KEYS.floatPos, nativeElementBlur: KEYS.nativeElementBlur, overlayBlur: KEYS.overlayBlur, overlayAlpha: KEYS.overlayAlpha };
        if (data.global) {
            Object.keys(globalKeyMap).forEach(k => {
                if (k in data.global) setValue(globalKeyMap[k], k === 'floatPos' ? JSON.stringify(data.global[k]) : data.global[k]);
            });
        }
        if (Array.isArray(data.siteList)) setList(data.siteList);
        if (data.siteConfigMap && typeof data.siteConfigMap === 'object') setSiteConfigMap(data.siteConfigMap);
        _liveOverlayBlur = null; _liveOverlayAlpha = null; invalidateConfig(); applyAgain();
    }

    function registerMenus() {
        const host = getHost(), globalCfg = getGlobalConfig(), siteCfg = getSiteConfig(host);
        GM_registerMenuCommand(globalCfg.enabled ? '❌ 关闭背景（全局）' : '✅ 开启背景（全局）', () => setGlobal(KEYS.enabled, !globalCfg.enabled));
        GM_registerMenuCommand(globalCfg.listMode === 'blacklist' ? '⚪ 切换白名单' : '⚫ 切换黑名单', () => setGlobal(KEYS.listMode, globalCfg.listMode === 'blacklist' ? 'whitelist' : 'blacklist'));
        const inList = inSiteList(host);
        GM_registerMenuCommand(inList ? '📌 移出站点列表' : '📌 加入站点列表', () => toggleCurrentSiteInList());
        GM_registerMenuCommand('☀️ 亮色调（本站）', () => updateCurrentSiteConfig({ theme: 1 }));
        GM_registerMenuCommand('🌙 暗色调（本站）', () => updateCurrentSiteConfig({ theme: 2 }));
        GM_registerMenuCommand('🎨 恢复默认色调（本站）', () => { const cfg = getSiteConfig(getHost()); if (cfg) { delete cfg.theme; setSiteConfig(getHost(), cfg); } invalidateConfig(); applyAgain(); });
        GM_registerMenuCommand(siteCfg && siteCfg.enabled === false ? '🟢 单独启用' : '🔴 单独禁用', () => updateCurrentSiteConfig({ enabled: (getSiteConfig(host) || {}).enabled === false }));
    }

    function getFloatShadowCSS() {
        return `
*{box-sizing:border-box;margin:0;padding:0;}

#toggle{width:46px;height:46px;line-height:46px;text-align:center;border-radius:50%;
  background:rgba(0,0,0,0.68);color:#fff;font-size:14px;cursor:pointer;
  box-shadow:0 2px 12px rgba(0,0,0,0.35);font-family:sans-serif;user-select:none;}

#panel{position:absolute;bottom:54px;right:0;width:280px;padding:12px;border-radius:12px;
  background-color:rgba(0,0,0,0.88);color:#f0f0f0;font-size:12px;font-family:sans-serif;
  box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none;max-height:70vh;
  overflow-y:auto;overflow-x:hidden;}
#panel .row{margin-bottom:8px;}
#panel .lab{font-size:11px;margin-bottom:3px;color:#ccc;}
#panel input[type="range"]{width:100%;-webkit-appearance:none;appearance:none;height:6px;
  background:linear-gradient(to right,#98DD98 var(--rp,0%),rgba(255,255,255,0.18) var(--rp,0%));
  outline:none;opacity:0.9;border-radius:3px;}
#panel input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;
  background:#7DD87D;cursor:pointer;border-radius:50%;border:2px solid #222;}
#panel input[type="text"]{width:100%;padding:4px 6px;border-radius:4px;
  background:rgba(255,255,255,0.12);color:#f0f0f0;font-size:11px;
  border:1px solid rgba(255,255,255,0.15);outline:none;}
#panel input[type="text"]:focus{border-color:rgba(155,219,155,0.5);}
.btns{display:flex;gap:6px;margin-top:8px;}
.btns button{flex:1;border:0;border-radius:6px;padding:7px 8px;
  background:rgba(255,255,255,0.15);color:#f0f0f0;cursor:pointer;
  font-size:11px;transition:background 0.2s;white-space:nowrap;}
.btns button:hover{background:rgba(255,255,255,0.25);}
.btn-primary button{background:rgba(155,219,155,0.35);font-weight:bold;}
.btn-primary button:hover{background:rgba(155,219,155,0.55);}
.btn-danger button{background:rgba(255,100,100,0.35);}
.btn-danger button:hover{background:rgba(255,100,100,0.55);}
.btn-export button{background:rgba(100,180,255,0.35);}
.btn-export button:hover{background:rgba(100,180,255,0.55);}
.divider{border:none;border-top:1px solid rgba(255,255,255,0.1);margin:10px 0 8px;}
.stitle{font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:6px;
  text-transform:uppercase;letter-spacing:1px;}
.theme-btns{display:flex;gap:4px;margin-top:3px;}
.theme-btns button{flex:1;padding:5px 2px;font-size:11px;
  border:1px solid rgba(255,255,255,0.15);border-radius:6px;
  background:rgba(255,255,255,0.1);color:#f0f0f0;cursor:pointer;
  transition:all 0.2s;text-align:center;white-space:nowrap;}
.theme-btns button:hover{background:rgba(255,255,255,0.2);}
.theme-btns button.active{border-color:rgba(155,219,155,0.6);background:rgba(155,219,155,0.2);}
.theme-txt{font-size:10px;color:rgba(255,255,255,0.55);}
#panel::-webkit-scrollbar{width:4px;}
#panel::-webkit-scrollbar-track{background:transparent;}
#panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:2px;}
`;
    }


    let _closeFloatPanel = null;

    function resetLivePreview() {
        if (_liveOverlayBlur !== null || _liveOverlayAlpha !== null) {
            _liveOverlayBlur = null; _liveOverlayAlpha = null;
        }

        applyStyle();
        requestOverlayApply();
    }

    function createFloat() {
        const host = getHost(), cfg = mergeConfig(host);
        if (!cfg.floatVisible) { floatShouldExist = false; return; }

        const existing = cachedFloatNode || document.getElementById(FLOAT_ID);
        if (existing && (document.documentElement.contains(existing) || document.body.contains(existing))) {
            floatShouldExist = true; cachedFloatNode = existing; fixFloatPosition(existing); return;
        }
        if (existing) { try { existing.remove(); } catch (e) {} }

        const pos = safePos(cfg.floatPos);
        const box = document.createElement('div');
        box.id = FLOAT_ID;
        box.style.cssText = [
            'position:fixed', 'z-index:2147483647', 'width:46px', 'height:auto',
            'display:block', 'visibility:visible', 'pointer-events:auto',
            'font-family:sans-serif', 'user-select:none',
            'right:' + pos.right + 'px', 'bottom:' + pos.bottom + 'px'
        ].join('!important;') + '!important';

        const shadow = box.attachShadow({ mode: 'closed' });

        const styleEl = document.createElement('style');
        styleEl.textContent = getFloatShadowCSS();
        shadow.appendChild(styleEl);

        const toggle = document.createElement('div');
        toggle.id = 'toggle';
        toggle.textContent = '𖣐';
        toggle.title = '点击展开/收起；拖动移动';
        shadow.appendChild(toggle);

        const panel = document.createElement('div');
        panel.id = 'panel';

        const siteCfg = getSiteConfig(host);
        const siteTheme = siteCfg && (siteCfg.theme === 1 || siteCfg.theme === 2) ? siteCfg.theme : null;
        const themeLabel = siteTheme === 1 ? '亮色调' : siteTheme === 2 ? '暗色调' : '跟随全局(' + (cfg.theme === 1 ? '亮色' : '暗色') + ')';

        panel.innerHTML = `
<div class="btns" style="margin-bottom:8px"><button id="advBtn">⚙️ 高级设置 ▼</button></div>
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
<div class="row"><div class="lab">当前站点色调 <span class="theme-txt" id="themeTxt">${themeLabel}</span></div>
<div class="theme-btns">
  <button data-t="1"${siteTheme===1?' class="active"':''}>☀️ 亮色</button>
  <button data-t="2"${siteTheme===2?' class="active"':''}>🌙 暗色</button>
  <button data-t="0"${siteTheme===null?' class="active"':''}>↩ 默认</button>
</div></div>
<div class="row"><div class="lab">透明度 <span id="opTxt">${Math.round(cfg.opacity*100)}%</span></div><input id="opR" type="range" min="10" max="100" step="1" value="${Math.round(cfg.opacity*100)}"></div>
<div class="row"><div class="lab">背景模糊 <span id="blTxt">${cfg.blur}px</span></div><input id="blR" type="range" min="0" max="50" step="1" value="${cfg.blur}"></div>
<div class="row"><div class="lab">弹层模糊 <span id="nbTxt">${cfg.nativeElementBlur}px</span></div><input id="nbR" type="range" min="0" max="20" step="1" value="${cfg.nativeElementBlur}"></div>`;

        const s3 = document.createElement('div');
        s3.innerHTML = `<hr class="divider"><div class="stitle">自动弹层增强</div>
<div class="row"><div class="lab">自动弹层模糊 <span id="obTxt">${cfg.overlayBlur}px</span></div><input id="obR" type="range" min="0" max="40" step="1" value="${cfg.overlayBlur}"></div>
<div class="row"><div class="lab">自动弹层透明 <span id="oaTxt">${cfg.overlayAlpha.toFixed(2)}</span></div><input id="oaR" type="range" min="0" max="80" step="1" value="${Math.round(cfg.overlayAlpha*100)}"></div>`;
        panel.appendChild(s3);
        shadow.appendChild(panel);
        (document.body || document.documentElement).appendChild(box);
        cachedFloatNode = box; floatShouldExist = true;

        const advBtn = shadow.getElementById('advBtn'), advPanel = shadow.getElementById('advPanel');
        const gUrlEl = shadow.getElementById('gUrl'), sUrlEl = shadow.getElementById('sUrl');
        const opR = shadow.getElementById('opR'), blR = shadow.getElementById('blR'), nbR = shadow.getElementById('nbR');
        const obR = shadow.getElementById('obR'), oaR = shadow.getElementById('oaR');
        const opTxt = shadow.getElementById('opTxt'), blTxt = shadow.getElementById('blTxt'), nbTxt = shadow.getElementById('nbTxt');
        const obTxt = shadow.getElementById('obTxt'), oaTxt = shadow.getElementById('oaTxt');
        const tBtns = shadow.querySelectorAll('.theme-btns button'), themeTxt = shadow.getElementById('themeTxt');

        const cGU = getGlobalConfig().url, cSU = (getSiteConfig(host) || {}).url || '';
        gUrlEl.value = (isCacheKey(cGU) || isDataImageUrl(cGU)) ? '' : cGU;
        sUrlEl.value = (isCacheKey(cSU) || isDataImageUrl(cSU)) ? '' : cSU;

        let panelTheme = siteTheme;

        function updateSliderTrack(el) { const mn = Number(el.min)||0, mx = Number(el.max)||100; el.style.setProperty('--rp', ((Number(el.value)-mn)/(mx-mn))*100+'%'); }
        function updateThemeTxt() { const et = panelTheme !== null ? panelTheme : mergeConfig(getHost()).theme; themeTxt.textContent = panelTheme !== null ? (panelTheme===1?'亮色调':'暗色调') : '跟随全局('+(et===1?'亮色':'暗色')+')'; }
        function getLive() { return { gUrl: gUrlEl.value.trim(), sUrl: sUrlEl.value.trim(), opacity: clamp(Number(opR.value)/100,0.1,1), blur: clamp(Number(blR.value),0,50), nb: clamp(Number(nbR.value),0,20), ob: clamp(Number(obR.value),0,40), oa: clamp(Number(oaR.value)/100,0,0.8), theme: panelTheme!==null?panelTheme:mergeConfig(getHost()).theme, themeOv: panelTheme!==null }; }
        function updateTxt() { const v=getLive(); opTxt.textContent=Math.round(v.opacity*100)+'%'; blTxt.textContent=v.blur+'px'; nbTxt.textContent=v.nb+'px'; obTxt.textContent=v.ob+'px'; oaTxt.textContent=v.oa.toFixed(2); }

        let lpRaf = null;
        function livePreview() {
            if (lpRaf) return; lpRaf = requestAnimationFrame(() => {
                lpRaf = null; const m = mergeConfig(getHost()), v = getLive(), pc = Object.assign({}, m);
                if (v.sUrl) pc.url = v.sUrl; else if (v.gUrl) pc.url = v.gUrl;
                pc.opacity = v.opacity; pc.blur = v.blur; pc.nativeElementBlur = v.nb; pc.enabled = true;
                pc.theme = v.theme;
                let fu = pc.url; if (isCacheKey(fu)) fu = _currentImageUrl || '';
                ensureStyleNode().textContent = buildCSS(pc, fu);
                applyNativeBlur(v.nb, pc.theme);
                stripXHeaderBlur();
                _liveOverlayBlur = v.ob; _liveOverlayAlpha = v.oa; forceOverlayApply();
            });
        }

        [opR, blR, nbR, obR, oaR].forEach(updateSliderTrack);
        [gUrlEl, sUrlEl, opR, blR, nbR, obR, oaR].forEach(el => {
            el.addEventListener('input', () => { if(el.type==='range') updateSliderTrack(el); updateTxt(); livePreview(); });
        });
        tBtns.forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation(); const t = parseInt(btn.dataset.t);
                panelTheme = t===0 ? null : t;
                tBtns.forEach(b => b.classList.toggle('active', panelTheme===null ? b.dataset.t==='0' : parseInt(b.dataset.t)===panelTheme));
                updateThemeTxt(); livePreview();
            });
        });

        let protectTimer = null;

        function collapsePanel() {
            panel.style.display = 'none'; advPanel.style.display = 'none'; advBtn.textContent = '⚙️ 高级设置 ▼';
            if (protectTimer) clearTimeout(protectTimer); panel.style.pointerEvents = ''; panel.style.opacity = '';
            resetLivePreview();
        }

        _closeFloatPanel = collapsePanel;

        toggle.addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault(); if (toggle.__dragging) return;
            const hidden = getComputedStyle(panel).display === 'none';
            if (hidden) {
                panel.style.display = 'block'; advPanel.style.display = 'none'; advBtn.textContent = '⚙️ 高级设置 ▼';
                panel.style.pointerEvents = 'none'; panel.style.opacity = '0.85';
                if (protectTimer) clearTimeout(protectTimer);
                protectTimer = setTimeout(() => { panel.style.pointerEvents=''; panel.style.opacity=''; }, 400);
            } else {
                collapsePanel();
            }
        });

        advBtn.addEventListener('click', e => { e.stopPropagation(); const h = advPanel.style.display==='none'; advPanel.style.display = h?'block':'none'; panel.style.display = 'block'; advBtn.textContent = h?'⚙️ 高级设置 ▲':'⚙️ 高级设置 ▼'; });

        shadow.getElementById('saveG').addEventListener('click', e => {
            e.stopPropagation(); const v=getLive(); invalidateConfig();
            if(v.gUrl) setValue(KEYS.url,v.gUrl);
            setValue(KEYS.opacity,v.opacity); setValue(KEYS.blur,v.blur); setValue(KEYS.nativeElementBlur,v.nb);
            setValue(KEYS.overlayBlur,v.ob); setValue(KEYS.overlayAlpha,v.oa);
            setValue(KEYS.theme,v.theme);
            _liveOverlayBlur=null; _liveOverlayAlpha=null; applyAgain(); alert('已保存到全局配置');
        });

        shadow.getElementById('saveS').addEventListener('click', e => {
            e.stopPropagation(); const v=getLive(), h=getHost(); invalidateConfig();
            const ec = getSiteConfig(h)||{};
            const p = { url:v.sUrl||ec.url, opacity:v.opacity, blur:v.blur, nativeElementBlur:v.nb, overlayBlur:v.ob, overlayAlpha:v.oa };
            if(v.themeOv) p.theme=v.theme; else delete ec.theme;
            setSiteConfig(h, Object.assign({},ec,p));
            _liveOverlayBlur=null; _liveOverlayAlpha=null; applyAgain(); alert('已保存到本站配置');
        });

        shadow.getElementById('pickG').addEventListener('click', e => { e.stopPropagation(); pickLocalImage((u,f)=>{ setValue(KEYS.url,u); invalidateConfig(); gUrlEl.value=''; sUrlEl.value=''; applyAgain(); alert('已设置全局本地图片：'+f.name); }); });
        shadow.getElementById('pickS').addEventListener('click', e => { e.stopPropagation(); pickLocalImage((u,f)=>{ setSiteConfig(getHost(),Object.assign({},getSiteConfig(getHost())||{}, {url:u})); invalidateConfig(); sUrlEl.value=''; gUrlEl.value=''; applyAgain(); alert('已设置本站本地图片：'+f.name); }); });
        shadow.getElementById('expBtn').addEventListener('click', e => { e.stopPropagation(); exportAllConfigZip(); });
        shadow.getElementById('impBtn').addEventListener('click', e => { e.stopPropagation(); importAllConfigZip(); });

        shadow.getElementById('resetG').addEventListener('click', e => {
            e.stopPropagation(); if(!confirm('确定恢复全局默认设置？')) return;
            setValue(KEYS.url,DEFAULTS.url); setValue(KEYS.opacity,DEFAULTS.opacity); setValue(KEYS.blur,DEFAULTS.blur);
            setValue(KEYS.nativeElementBlur,DEFAULTS.nativeElementBlur); setValue(KEYS.overlayBlur,DEFAULTS.overlayBlur); setValue(KEYS.overlayAlpha,DEFAULTS.overlayAlpha);
            setValue(KEYS.theme,DEFAULTS.theme);
            gUrlEl.value=DEFAULTS.url; opR.value=Math.round(DEFAULTS.opacity*100); blR.value=DEFAULTS.blur;
            nbR.value=DEFAULTS.nativeElementBlur; obR.value=DEFAULTS.overlayBlur; oaR.value=Math.round(DEFAULTS.overlayAlpha*100);
            sUrlEl.value=''; panelTheme=null;
            tBtns.forEach(b=>b.classList.toggle('active',b.dataset.t==='0'));
            updateThemeTxt(); [opR,blR,nbR,obR,oaR].forEach(updateSliderTrack);
            updateTxt(); _liveOverlayBlur=null; _liveOverlayAlpha=null; applyAgain(); alert('已恢复全局默认值');
        });

        shadow.getElementById('resetS').addEventListener('click', e => {
            e.stopPropagation(); if(!confirm('确定清空当前站点的所有单独配置？')) return;
            invalidateConfig(); removeSiteConfig(getHost()); sUrlEl.value='';
            panelTheme=null; tBtns.forEach(b=>b.classList.toggle('active',b.dataset.t==='0'));
            const rc=mergeConfig(getHost());
            opR.value=Math.round(rc.opacity*100); blR.value=rc.blur; nbR.value=rc.nativeElementBlur;
            obR.value=rc.overlayBlur; oaR.value=Math.round(rc.overlayAlpha*100);
            updateThemeTxt(); [opR,blR,nbR,obR,oaR].forEach(updateSliderTrack);
            updateTxt(); _liveOverlayBlur=null; _liveOverlayAlpha=null; applyAgain(); alert('已清除当前站点配置');
        });

        (function () {
            let sx=0, sy=0, sr=0, sb=0;
            function dn(e) { const ev=e.touches?e.touches[0]:e; const r=box.getBoundingClientRect(); sx=ev.clientX; sy=ev.clientY; sr=window.innerWidth-r.right; sb=window.innerHeight-r.bottom; toggle.__dragging=false; document.addEventListener('mousemove',mv,true); document.addEventListener('mouseup',up,true); document.addEventListener('touchmove',mv,{passive:false}); document.addEventListener('touchend',up,true); }
            function mv(e) { const ev=e.touches?e.touches[0]:e; const dx=ev.clientX-sx, dy=ev.clientY-sy; if(Math.abs(dx)>3||Math.abs(dy)>3) toggle.__dragging=true; box.style.right=clamp(sr-dx,0,Math.max(0,window.innerWidth-46))+'px'; box.style.bottom=clamp(sb-dy,0,Math.max(0,window.innerHeight-46))+'px'; if(e.cancelable) e.preventDefault(); }
            function up() { document.removeEventListener('mousemove',mv,true); document.removeEventListener('mouseup',up,true); document.removeEventListener('touchmove',mv,{passive:false}); document.removeEventListener('touchend',up,true); if(toggle.__dragging){ const r=box.getBoundingClientRect(); const fp=safePos({right:window.innerWidth-r.right,bottom:window.innerHeight-r.bottom}); box.style.right=fp.right+'px'; box.style.bottom=fp.bottom+'px'; setValue(KEYS.floatPos,JSON.stringify(fp)); invalidateConfig(); } }
            toggle.addEventListener('mousedown',dn); toggle.addEventListener('touchstart',dn,{passive:true});
        })();
    }

    function fixFloatPosition(el) { if(!el) return; const r=el.getBoundingClientRect(); const fp=safePos({right:window.innerWidth-r.right,bottom:window.innerHeight-r.bottom}); if(parseInt(el.style.right)!==fp.right||parseInt(el.style.bottom)!==fp.bottom){ el.style.right=fp.right+'px'; el.style.bottom=fp.bottom+'px'; } }
    function ensureFloatAlive() { if(!floatShouldExist) return; const cfg=mergeConfig(getHost()); if(!cfg.floatVisible) return; const el=cachedFloatNode||document.getElementById(FLOAT_ID); if(!el||!(document.body.contains(el)||document.documentElement.contains(el))){ cachedFloatNode=null; createFloat(); } else { cachedFloatNode=el; fixFloatPosition(el); } }

    let _globalListenersBound = false;
    function bindGlobalListeners() {
        if (_globalListenersBound) return;
        _globalListenersBound = true;
        // 点击浮层外部收起面板
        document.addEventListener('click', e => {
            const box = cachedFloatNode;
            if (!box) return;
            if (e.target !== box && !box.contains(e.target)) { if (_closeFloatPanel) _closeFloatPanel(); }
        }, true);

        document.addEventListener('click', () => { setTimeout(requestOverlayApply, 100); }, true);
        document.addEventListener('keydown', () => { setTimeout(requestOverlayApply, 150); }, true);
    }

    floatShouldExist = getGlobalConfig().floatVisible;
    applyStyleFull();
    bindGlobalListeners();

    let mutationDebounceTimer = null;
    const observer = new MutationObserver(() => {
        throttledCaptchaCheck();
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(() => {
            const cfg = mergeConfig(getHost());
            if (cfg.enabled && !captchaActive && !document.getElementById(STYLE_ID)) { cachedStyleNode = null; applyStyle(); }
            const ov = getEffectiveOverlayValues();
            if (cfg.enabled && !captchaActive && (ov.blur > 0 || ov.alpha > 0)) requestOverlayApply();
            stripXHeaderBlur();
            ensureFloatAlive();
        }, 150);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'aria-hidden'] });

    document.addEventListener('DOMContentLoaded', () => { throttledCaptchaCheck(); applyAgain(); createFloat(); startOverlayScanTimer(); });
    window.addEventListener('load', () => { throttledCaptchaCheck(); applyAgain(); createFloat(); setTimeout(() => { ensureFloatAlive(); applyStyleFull(); }, 500); setTimeout(() => { ensureFloatAlive(); applyStyleFull(); }, 2000); });
    registerMenus();
})();