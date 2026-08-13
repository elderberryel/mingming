// ==UserScript==
// @name         浏览器背景 v3.0
// @namespace    https://viayoo.com/
// @version      3.0
// @description  浏览器背景 (修复部分传统网站骨架容器不透明问题)
// @author       ChatGPT & MiMo
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
    if (isEarlyCfPage) { console.log('[VieBg] Cloudflare Challenge page detected. Script disabled.'); return; }

    const CACHE_AVAILABLE = typeof caches !== 'undefined' && typeof caches.open === 'function';
    const DEFAULTS = { url: 'https://8upload.com/image/96dff2c694b65855/2026_01_16.jpg', theme: 1, opacity: 0.69, mode: 'cover', blur: 0, enabled: true, floatVisible: true, listMode: 'blacklist', floatPos: { right: 10, bottom: 90 }, nativeElementBlur: 10, overlayBlur: 10, overlayAlpha: 0.10 };
    const STYLE_ID = 'vie-browser-bg-style-v89', FLOAT_ID = 'vie-browser-bg-float-v89', FLOAT_STYLE_ID = 'vie-browser-bg-float-style-v89', NATIVE_BLUR_STYLE_ID = 'vie-browser-bg-native-blur-style-v89';
    const CACHE_NAME = 'vie-browser-bg-images-v1', CACHE_PREFIX = '[cache:local]', GM_BACKUP_PREFIX = 'Vie背景图片备份_', GM_FILENAME_MAP = 'Vie背景图片文件名映射';
    const COMPRESS_THRESHOLD = 1000 * 1024, COMPRESS_TARGET = 1000 * 1024, MAX_IMAGE_WIDTH = 1600, MAX_IMAGE_HEIGHT = 2560, MAX_FILE_SIZE = 15 * 1024 * 1024;

    let cachedStyleNode = null, cachedFloatNode = null, cachedFloatStyleNode = null, cachedNativeBlurStyle = null;
    const overlayMarked = new WeakSet(), overlayLastApplied = new WeakMap();
    let overlayRafPending = false, overlayScanTimer = null, _liveOverlayBlur = null, _liveOverlayAlpha = null, floatShouldExist = false;
    let captchaActive = false; 
    
    // ★ 核心修复：极度精准的选择器，彻底抛弃 [id^="cf-"] 等毒瘤前缀，只认 iframe src 和官方 class，绝不误判
    const CAPTCHA_SELECTORS = [
        'iframe[src*="challenges.cloudflare.com"]', 
        'iframe[src*="hcaptcha.com"]', 
        'iframe[src*="recaptcha.net"]', 
        'iframe[src*="recaptcha"]',
        '.cf-turnstile', 
        '.h-captcha', 
        '.g-recaptcha'
    ];
    const CAPTCHA_CSS_SELECTOR = CAPTCHA_SELECTORS.join(',');
    
    // ★ 核心修复：重度 SPA 白名单，这些站点 DOM 太复杂，直接跳过 DOM 检测，从物理层面杜绝误判
    const SPA_WHITELIST = ['pixiv.net', 'twitter.com', 'x.com', 'fanbox.cc'];

    let configCache = null, configCacheTime = 0; const CONFIG_CACHE_TTL = 500;
    let _currentImageUrl = null, _imageReady = false, _imageReadyCallbacks = [];
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
    
    function saveGMBackup(key, dataUrl) { 
        try { 
            setValue(GM_BACKUP_PREFIX + key, dataUrl); 
            const check = getValue(GM_BACKUP_PREFIX + key, '');
            if (!check || check.length < dataUrl.length * 0.9) {
                console.warn('[VieBg] GM storage save failed or truncated (image too large?) for key:', key);
            }
        } catch (e) { 
            console.error('[VieBg] GM storage save error:', e);
        } 
    }
    
    async function getImage(key) {
        if (CACHE_AVAILABLE) { try { const cache = await caches.open(CACHE_NAME); const response = await cache.match(new Request('/' + key)); if (response) return URL.createObjectURL(await response.blob()); } catch (e) {} }
        const backup = getValue(GM_BACKUP_PREFIX + key, ''); return (backup && backup.startsWith('data:image/')) ? backup : null;
    }
    async function deleteImage(key) {
        if (CACHE_AVAILABLE) { try { await caches.open(CACHE_NAME).then(c => c.delete(new Request('/' + key))); } catch (e) {} }
        try { GM_deleteValue(GM_BACKUP_PREFIX + key); } catch (e) {} deleteFilenameRecord(key);
    }
    function dataUrlToBlob(dataUrl) { const [header, base64] = dataUrl.split(','); const mime = header.match(/:(.*?);/)[1]; const binary = atob(base64); const array = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i); return new Blob([array], { type: mime }); }
    
    function dataUrlToUint8Array(dataUrl) { 
        const base64 = dataUrl.split(',')[1];
        if (!base64) return new Uint8Array(0);
        const binary = atob(base64); 
        const array = new Uint8Array(binary.length); 
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i); 
        return array; 
    }
    
    function uint8ArrayToDataUrl(uint8, mime) { let binary = ''; for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]); return 'data:' + mime + ';base64,' + btoa(binary); }

    function clamp(num, min, max) { return Math.min(max, Math.max(min, num)); }
    function safePos(pos) { const vw = window.innerWidth || 360, vh = window.innerHeight || 640; return { right: clamp(Number(pos && pos.right) || 10, 0, Math.max(0, vw - 46)), bottom: clamp(Number(pos && pos.bottom) || 90, 0, Math.max(0, vh - 46)) }; }
    function getHost() { return location.hostname || ''; }
    function getValue(key, def) { return GM_getValue(key, def); }
    function setValue(key, val) { GM_setValue(key, val); }
    function safeJSONParse(str, def) { try { const v = JSON.parse(str); return v ?? def; } catch (e) { return def; } }
    function getList() { return safeJSONParse(getValue('Vie背景站点列表', '[]'), []); }
    function setList(arr) { setValue('Vie背景站点列表', JSON.stringify(arr)); }
    function normalizeHost(h) { return String(h || '').trim().toLowerCase(); }
    function hostMatch(rule, host) { rule = normalizeHost(rule); host = normalizeHost(host); if (!rule || !host) return false; if (host === rule || host.endsWith('.' + rule)) return true; const rP = rule.split('.'), hP = host.split('.'); if (rP.length === 2) return hP.length >= 2 && hP.slice(-2).join('.') === rule; if (rP.length > 2 && hP.length >= rP.length) return hP.slice(-rP.length).join('.') === rule; return false; }
    function getTopDomain(host) { host = normalizeHost(host); if (!host) return ''; if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host; const parts = host.split('.'); if (parts.length <= 2) return host; const secondLevelDomains = ['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'ne', 'or', 'go']; const secondLastPart = parts[parts.length - 2]; const lastPart = parts[parts.length - 1]; if (secondLevelDomains.includes(secondLastPart) && lastPart.length <= 3) { return parts.slice(-3).join('.'); } return parts.slice(-2).join('.'); }
    function inSiteList(host) { const currentTopDomain = getTopDomain(host); if (!currentTopDomain) return false; const list = getList(); return list.some(item => { const itemTop = getTopDomain(item); return itemTop === currentTopDomain || hostMatch(item, host); }); }
    function getSiteConfigMap() { return safeJSONParse(getValue('Vie背景站点配置', '{}'), {}); }
    function setSiteConfigMap(map) { setValue('Vie背景站点配置', JSON.stringify(map)); }
    function getSiteConfig(host) { return getSiteConfigMap()[host] || null; }
    function setSiteConfig(host, cfg) { const map = getSiteConfigMap(); map[host] = cfg; setSiteConfigMap(map); }
    function removeSiteConfig(host) { const map = getSiteConfigMap(); delete map[host]; setSiteConfigMap(map); }

    function getGlobalConfig() { return { url: getValue('Vie背景图片', DEFAULTS.url), theme: Number(getValue('Vie背景', DEFAULTS.theme)), opacity: clamp(Number(getValue('Vie背景透明度', DEFAULTS.opacity)), 0.1, 1), mode: getValue('Vie背景模式', DEFAULTS.mode), blur: clamp(Number(getValue('Vie背景模糊', DEFAULTS.blur)), 0, 50), enabled: getValue('Vie背景启用', DEFAULTS.enabled), floatVisible: getValue('Vie背景悬浮按钮显示', DEFAULTS.floatVisible), listMode: getValue('Vie背景列表模式', DEFAULTS.listMode), floatPos: safeJSONParse(getValue('Vie背景悬浮位置', JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos), nativeElementBlur: clamp(Number(getValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur)), 0, 20), overlayBlur: clamp(Number(getValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur)), 0, 40), overlayAlpha: clamp(Number(getValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha)), 0, 0.8) }; }
    function shouldApply(host, globalCfg) { if (!globalCfg.enabled) return false; const siteCfg = getSiteConfig(host); if (siteCfg && siteCfg.enabled === false) return false; if (siteCfg && siteCfg.enabled === true) return true; if (globalCfg.listMode === 'whitelist') return inSiteList(host); return !inSiteList(host); }
    function mergeConfig(host) { const now = Date.now(); if (configCache && configCache._host === host && (now - configCacheTime) < CONFIG_CACHE_TTL) return configCache; const g = getGlobalConfig(), s = getSiteConfig(host); const result = { url: s && typeof s.url === 'string' ? s.url : g.url, theme: s && (s.theme === 1 || s.theme === 2) ? s.theme : g.theme, opacity: s && typeof s.opacity === 'number' ? clamp(s.opacity, 0.1, 1) : g.opacity, mode: s && typeof s.mode === 'string' ? s.mode : g.mode, blur: s && typeof s.blur === 'number' ? clamp(s.blur, 0, 50) : g.blur, enabled: shouldApply(host, g), floatVisible: g.floatVisible, listMode: g.listMode, floatPos: g.floatPos, nativeElementBlur: s && typeof s.nativeElementBlur === 'number' ? clamp(s.nativeElementBlur, 0, 20) : g.nativeElementBlur, overlayBlur: s && typeof s.overlayBlur === 'number' ? clamp(s.overlayBlur, 0, 40) : g.overlayBlur, overlayAlpha: s && typeof s.overlayAlpha === 'number' ? clamp(s.overlayAlpha, 0, 0.8) : g.overlayAlpha, _host: host }; configCache = result; configCacheTime = now; return result; }
    function getEffectiveOverlayValues() { const cfg = mergeConfig(getHost()); return { blur: _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur, alpha: _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha }; }

    function getBackgroundCSS(cfg, finalUrl) {
        let bgSize = 'cover', bgRepeat = 'no-repeat';
        const darkMask = clamp(1 - cfg.opacity, 0, 0.9);
        const imgUrl = finalUrl || '';
        if (cfg.mode === 'contain') bgSize = 'contain';
        else if (cfg.mode === 'auto') bgSize = 'auto';
        else if (cfg.mode === '100% 100%') bgSize = '100% 100%';
        else if (cfg.mode === 'repeat') { bgSize = 'auto'; bgRepeat = 'repeat'; }

        let bgCss = '';
        if (imgUrl) {
            bgCss = `html::before { content:""!important; position:fixed!important; inset:0!important; z-index:-2147483647!important; pointer-events:none!important; background-image:linear-gradient(rgba(0,0,0,${darkMask}),rgba(0,0,0,${darkMask})),url("${imgUrl}")!important; background-repeat:no-repeat,${bgRepeat}!important; background-position:center!important; background-size:100% 100%,${bgSize}!important; opacity:1!important; filter:blur(${cfg.blur}px)!important; transform:translateZ(0)!important; }`;
        } else {
            bgCss = `html::before { content:""!important; position:fixed!important; inset:0!important; z-index:-2147483647!important; pointer-events:none!important; background:transparent!important; opacity:0!important; }`;
        }

        return `html,body{background:transparent!important;background-color:transparent!important;background-image:none!important;}
#bgCanvas{display:none!important;}
${bgCss}
body::before{content:""!important;position:fixed!important;inset:0!important;z-index:-2147483646!important;pointer-events:none!important;background:transparent!important;}
*:not(img):not(svg):not(video):not(canvas):not(.translate-ui):not(.translate-ui *):not(.cf-turnstile):not(.h-captcha):not(.g-recaptcha){background-color:transparent!important;}
#container,#header,#logo,#wrapper,#page,#main,.container,.wrapper,header,footer,nav,.navbar,.top-bar,.row1,.header,.logo,#top,.top,#site-header,.site-header{background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;}
#tbSettingsBtn{background:#2c3e50!important;}
#tbSettingsBtn:hover{background:#000!important;}
#tbSettingsPanel{background:#1e1e1e!important;}
#tbSettingsPanel button{background:#3a3a3a!important;}
#tbSettingsPanel button:hover{background:#555!important;}
#tbSettingsPanel #closePanelBtn{background:#c0392b!important;}
#tbSettingsPanel #closePanelBtn:hover{background:#e74c3c!important;}
.translate-ui .tu-btn{background:#1e1e2f!important;}
.translate-ui .tu-btn.active{background:#1f5a3a!important;}
.translate-ui .tu-panel{background:rgba(20,22,27,0.96)!important;}
.translate-ui .tu-ai-config{background:#1e2532!important;}
.translate-ui .tu-ai-config input{background:#262d3c!important;}
.translate-ui .tu-status{background:#1a1e26!important;}
.translate-ui .tu-modes{background:#232833!important;}
.translate-ui .tu-modes button.on{background:#3a4a6e!important;}
.translate-ui .tu-modes button:hover:not(.on){background:#2f3648!important;}
.translate-ui .tu-row .tu-restore{background:#2a2f3c!important;}
.translate-ui .tu-row .tu-restore:hover{background:#353c4c!important;}
.translate-ui .tu-row .tu-go{background:#2c5a7c!important;}
.translate-ui .tu-row .tu-go:hover{background:#3671a0!important;}
.translate-ui .tu-row .tu-exclude{background:#6b2e3a!important;}
.translate-ui .tu-row .tu-exclude:hover{background:#8a3a48!important;}
.translate-ui .tu-row .tu-io{background:#3a3e52!important;}
.translate-ui .tu-row .tu-io:hover{background:#4e546c!important;}
.translate-ui select{background:#2a2e3a!important;}
.translate-ui input{background:#2a2e3a!important;}

/* CAPTCHA 绝对保护区，防止残留样式干扰 */
${CAPTCHA_CSS_SELECTOR}, ${CAPTCHA_SELECTORS.map(s => s + ' *').join(',')} { background-color: initial !important; background: initial !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; filter: none !important; opacity: 1 !important; pointer-events: auto !important; mix-blend-mode: normal !important; }
iframe[src*="challenges.cloudflare.com"], iframe[src*="hcaptcha.com"], iframe[src*="recaptcha.net"] { background: transparent !important; opacity: 1 !important; visibility: visible !important; }

:root{--color-canvas-default:transparent!important;--color-canvas-subtle:transparent!important;--color-canvas-inset:transparent!important;--color-page-header-bg:transparent!important;--color-header-bg:rgba(0,0,0,0.18)!important;}
.user-content,#additional-info{background:transparent!important;background-color:transparent!important;box-shadow:none!important;border:none!important;}
[class*="bg"],[class*="Bg"],[class*="color-bg"],[class*="ColorBg"],[class*="bgColor"],.Box,.Box-body,.Box-header,.file-navigation,.repository-content,.AppHeader,.Layout-sidebar,.Layout-main,.UnderlineNav,.BorderGrid,.flash,.modal,.modal-dialog,.modal-body,.drawer,.drawer-body,.diff-table,.diff-header,.blob-code,.blob-num,.file,.file-header,.commit,.timeline-comment,.review-comment,.inline-comment-form,.select-menu,.dropdown,.Popover,.overlay,.signed-commit,.blankslate,.paginate-container,.pagination,.State,.Label,.Counter,.TimelineItem,.commit-ref,.sha,.IssueLabel{background:transparent!important;background-color:transparent!important;box-shadow:none!important;border-color:transparent!important;}
td,th,thead,tbody,tfoot,.rounded-top-2,.rounded-bottom-2,.rounded-2{background:transparent!important;background-color:transparent!important;}`;
    }

    function getThemeCSS(theme) { if (theme === 1) return `input:not(.translate-ui input),div,h1,h2,h3,h4,h5,h6,p,li,span:not(.tu-bi),label,strong,em{color:#ddd!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#fff!important;}`; return `input:not(.translate-ui input),div,h1,h2,h3,h4,h5,h6,p,li,span:not(.tu-bi),label,strong,em{color:#222!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#000!important;}`; }
    function getNativeBlurCSS(blurAmount) { if (blurAmount <= 0) return ''; return `.modal,.dialog,.popup,.dropdown,.menu,.popover,.tooltip,[role="dialog"],[role="menu"],[role="tooltip"],.layer,.fancybox,.swal-modal,.ant-modal,.el-dialog,.el-popper,.notification,.Toastify__toast-container,.position-fixed,.z-50{backdrop-filter:blur(${blurAmount}px)!important;-webkit-backdrop-filter:blur(${blurAmount}px)!important;}`; }
    function buildCSS(cfg, finalUrl) { return getBackgroundCSS(cfg, finalUrl) + getThemeCSS(cfg.theme); }

    function isExcludedElement(el) { 
        if (!el || !el.nodeType) return false; 
        if (el.id === 'goTopBottom' || el.id === 'tbSettingsBtn' || el.id === 'tbSettingsPanel') return true; 
        if (el.classList && (el.classList.contains('tb-settings-btn') || el.classList.contains('tb-settings-panel'))) return true; 
        if (el.classList && el.classList.contains('translate-ui')) return true; 
        if (el.id === 'tuPanel' || el.id === 'tuBtn') return true; 
        
        // 严格排除 CAPTCHA 容器及其内部元素
        try {
            if (el.matches && el.matches(CAPTCHA_CSS_SELECTOR)) return true;
            if (el.closest && el.closest(CAPTCHA_CSS_SELECTOR)) return true;
        } catch(e) {}

        if (el.tagName === 'IFRAME') { 
            const src = el.src || ''; 
            if (src.includes('challenges.cloudflare.com') || src.includes('hcaptcha.com') || src.includes('recaptcha')) return true; 
        } 
        return false; 
    }

    function applyNativeBlur(blurAmount) { if (document.body) { document.querySelectorAll('[data-vie-native-blur]').forEach(el => { try { el.style.removeProperty('backdrop-filter'); el.style.removeProperty('-webkit-backdrop-filter'); el.removeAttribute('data-vie-native-blur'); } catch(e) {} }); } const old = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID); if (old) { old.remove(); cachedNativeBlurStyle = null; } if (blurAmount <= 0 || !document.body) return; let s = document.createElement('style'); s.id = NATIVE_BLUR_STYLE_ID; s.textContent = getNativeBlurCSS(blurAmount); (document.head || document.documentElement).appendChild(s); cachedNativeBlurStyle = s; const floatEl = cachedFloatNode || document.getElementById(FLOAT_ID); const allElements = document.body.getElementsByTagName('*'); for (let i = 0; i < allElements.length; i++) { const el = allElements[i]; if (floatEl && (el === floatEl || floatEl.contains(el))) continue; if (isExcludedElement(el)) continue; try { const style = getComputedStyle(el); if (style.position !== 'fixed') continue; if (style.display === 'none' || style.visibility === 'hidden') continue; const rect = el.getBoundingClientRect(); if (rect.width < 20 || rect.height < 20) continue; el.style.setProperty('backdrop-filter', `blur(${blurAmount}px)`, 'important'); el.style.setProperty('-webkit-backdrop-filter', `blur(${blurAmount}px)`, 'important'); el.setAttribute('data-vie-native-blur', '1'); } catch(e) {} } }
    function ensureStyleNode() { if (cachedStyleNode && document.contains(cachedStyleNode)) return cachedStyleNode; let s = document.getElementById(STYLE_ID); if (!s) { s = document.createElement('style'); s.id = STYLE_ID; (document.head || document.documentElement).appendChild(s); } cachedStyleNode = s; return s; }
    function removeStyle() { const s = cachedStyleNode || document.getElementById(STYLE_ID); if (s) { s.remove(); cachedStyleNode = null; } const nb = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID); if (nb) { nb.remove(); cachedNativeBlurStyle = null; } if (document.body) { document.querySelectorAll('[data-vie-native-blur]').forEach(el => { try { el.style.removeProperty('backdrop-filter'); el.style.removeProperty('-webkit-backdrop-filter'); el.removeAttribute('data-vie-native-blur'); } catch(e) {} }); } }

    async function preloadImage() { const cfg = mergeConfig(getHost()); if (!cfg.enabled) { _imageReady = true; _currentImageUrl = null; notifyImageReady(); return; } if (isCacheKey(cfg.url)) { const imgUrl = await getImage(extractCacheKey(cfg.url)); _currentImageUrl = imgUrl || null; } else if (isDataImageUrl(cfg.url)) { const cacheKey = await storeImage(cfg.url, null, 'migrated_image.jpg'); if (cacheKey) { const newUrl = buildCacheKeyUrl(cacheKey); if (getSiteConfig(getHost()) && getSiteConfig(getHost()).url === cfg.url) setSiteConfig(getHost(), Object.assign({}, getSiteConfig(getHost()), { url: newUrl })); else setValue('Vie背景图片', newUrl); configCache = null; _currentImageUrl = cfg.url; } } else { _currentImageUrl = cfg.url; } _imageReady = true; notifyImageReady(); }
    function applyStyle() { if (captchaActive) return; const host = getHost(), cfg = mergeConfig(host); if (!cfg.enabled) { removeStyle(); _currentImageUrl = null; return; } const s = ensureStyleNode(); s.textContent = buildCSS(cfg, _currentImageUrl || ''); applyNativeBlur(cfg.nativeElementBlur); }
    async function applyStyleFull() { if (!_imageReady) await preloadImage(); applyStyle(); }
    function applyAgain() { configCache = null; _imageReady = false; applyStyleFull(); requestOverlayApply(); setTimeout(applyStyleFull, 100); setTimeout(applyStyleFull, 500); }
    function setGlobal(key, value) { configCache = null; setValue(key, value); applyAgain(); }
    function updateCurrentSiteConfig(patch) { configCache = null; setSiteConfig(getHost(), Object.assign({}, getSiteConfig(getHost()) || {}, patch)); applyAgain(); }
    function clearCurrentSiteConfig() { configCache = null; removeSiteConfig(getHost()); applyAgain(); }
    function toggleCurrentSiteInList() { const host = getHost(); if (!host) return; const currentTopDomain = getTopDomain(host); let list = getList(); const siteCfg = getSiteConfig(host); if (siteCfg && 'enabled' in siteCfg) { delete siteCfg.enabled; setSiteConfig(host, siteCfg); } const topCfg = getSiteConfig(currentTopDomain); if (topCfg && 'enabled' in topCfg) { delete topCfg.enabled; setSiteConfig(currentTopDomain, topCfg); } const existsIndex = list.findIndex(item => getTopDomain(item) === currentTopDomain || hostMatch(item, host)); const modeText = getGlobalConfig().listMode === 'whitelist' ? '白名单' : '黑名单'; if (existsIndex > -1) { list.splice(existsIndex, 1); const statusText = getGlobalConfig().listMode === 'whitelist' ? '未命中，背景已关闭' : '未命中，背景已开启'; alert(`✅ 已从站点列表移除：${currentTopDomain}\n\n当前模式：${modeText}\n当前状态：${statusText}`); } else { list.push(currentTopDomain); const statusText = getGlobalConfig().listMode === 'whitelist' ? '已命中，背景已开启' : '已命中，背景已关闭'; alert(`✅ 已加入站点列表：${currentTopDomain}\n\n当前模式：${modeText}\n当前状态：${statusText}`); } setList(list); applyAgain(); }
    
    // ★ 核心修复：精准检测 + 状态锁定 + 延迟恢复，防误判防闪烁
    function checkCaptchaStatus() { 
        const host = getHost();
        
        // 1. 绝对白名单：Pixiv 等复杂 SPA 直接跳过 DOM 检测，防止任何误判
        if (SPA_WHITELIST.some(domain => host.includes(domain))) {
            if (captchaActive) {
                captchaActive = false;
                applyStyle();
            }
            return;
        }

        const title = (document.title || '').toLowerCase();
        if (/just a moment|attention required|cloudflare|please wait|checking your browser|verify you are human/.test(title)) {
            if (!captchaActive) {
                captchaActive = true;
                removeStyle();
            }
            return;
        }

        // 2. 精准检测：只查 body，只认最核心的 iframe src 和官方 class
        let found = false;
        if (document.body) {
            for (const sel of CAPTCHA_SELECTORS) {
                try {
                    if (document.body.querySelector(sel)) {
                        found = true;
                        break;
                    }
                } catch(e) {}
            }
        }
        
        // 3. 状态机控制
        if (found && !captchaActive) { 
            captchaActive = true; 
            removeStyle(); // 遇到验证码，立刻拔除背景
        } else if (!found && captchaActive) { 
            // 验证码消失后，延迟 1.5 秒再恢复，防止 DOM 闪烁触发风控
            setTimeout(() => {
                let stillFound = false;
                if (document.body) {
                    for (const sel of CAPTCHA_SELECTORS) {
                        try { if (document.body.querySelector(sel)) { stillFound = true; break; } } catch(e) {}
                    }
                }
                if (!stillFound && captchaActive) {
                    captchaActive = false; 
                    applyStyle(); 
                }
            }, 1500);
        } 
    }

    const overlayKeywordCache = new WeakMap();
    function isOverlayVisible(el, style) { if (!el || !style) return false; if (style.display === 'none' || style.visibility === 'hidden') return false; if (parseFloat(style.opacity || '1') <= 0) return false; const rect = el.getBoundingClientRect(); return rect.width > 2 && rect.height > 2; }
    function getZIndex(style) { const z = parseInt(style.zIndex || '0', 10); return Number.isFinite(z) ? z : 0; }
    function hasOverlayKeyword(el) { if (overlayKeywordCache.has(el)) return overlayKeywordCache.get(el); const txt = `${(el.className || '').toString().toLowerCase()} ${(el.id || '').toString().toLowerCase()}`; const result = /overlay|backdrop|mask|modal|drawer|popup|dialog|sheet|menu|popover|sidebar|side-nav|side-panel|nav-panel|offcanvas|slide-panel|flyout|panel/.test(txt); overlayKeywordCache.set(el, result); return result; }
    function hasOverlayBg(style) { const bg = style.backgroundColor || ''; return bg.includes('rgb') || (style.backdropFilter && style.backdropFilter !== 'none') || (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none'); }
    function htmlBodyLocked() { if (!document.body) return false; const hs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body); const hc = (document.documentElement.className || '').toString().toLowerCase(), bc = (document.body.className || '').toString().toLowerCase(); return ['modal-open', 'drawer-open', 'overflow-hidden', 'no-scroll', 'popup-open', 'dialog-open'].some(k => hc.includes(k) || bc.includes(k)) || hs.overflow === 'hidden' || hs.overflowY === 'hidden' || bs.overflow === 'hidden' || bs.overflowY === 'hidden'; }
    function isLightBg(bg) { if (!bg || !bg.includes('rgb')) return false; const nums = bg.match(/\d+(\.\d+)?/g); return nums && nums.length >= 3 && (parseFloat(nums[0]) + parseFloat(nums[1]) + parseFloat(nums[2])) / 3 > 180; }
    function findLikelyOverlays() { if (!document.body) return []; const floatEl = document.getElementById(FLOAT_ID); const overlays = []; const vw = window.innerWidth, vh = window.innerHeight; const allElements = document.body.getElementsByTagName('*'); for (let i = 0; i < allElements.length; i++) { const el = allElements[i]; if (floatEl && (el === floatEl || floatEl.contains(el))) continue; if (isExcludedElement(el)) continue; const style = getComputedStyle(el); if (!isOverlayVisible(el, style)) continue; const pos = style.position; if (pos !== 'fixed' && pos !== 'absolute') continue; const rect = el.getBoundingClientRect(); if (rect.width < 30 || rect.height < 30) continue; const z = getZIndex(style); const keyword = hasOverlayKeyword(el); if (keyword && pos === 'fixed') { overlays.push(el); continue; } if (pos === 'fixed' && z >= 1) { if (rect.width >= vw * 0.12 && rect.height >= vh * 0.25) { overlays.push(el); continue; } } if (pos === 'absolute' && z >= 20 && hasOverlayBg(style)) { if (rect.width >= vw * 0.15 && rect.height >= vh * 0.15) { overlays.push(el); continue; } } } return dedupeOverlays(overlays); }
    function dedupeOverlays(arr) { const out = []; for (const el of arr) { let skip = false; for (const kept of out) { if (kept.contains(el)) { skip = true; break; } } if (!skip) out.push(el); } return out; }
    function applyOverlayEnhance() { if (!document.body || captchaActive) return; const cfg = mergeConfig(getHost()); if (!cfg.enabled) return; const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur; const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha; if (blur <= 0 && alpha <= 0) return; const overlays = findLikelyOverlays(); if (!overlays.length && !htmlBodyLocked()) return; const floatEl = cachedFloatNode || document.getElementById(FLOAT_ID); overlays.forEach(el => { if (floatEl && (el === floatEl || floatEl.contains(el))) return; const prev = overlayLastApplied.get(el) || {}; if (prev.blur === blur && prev.alpha === alpha) return; const style = getComputedStyle(el); const useWhite = isLightBg(style.backgroundColor || ''); el.style.setProperty('backdrop-filter', `blur(${blur}px)`, 'important'); el.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important'); el.style.setProperty('background-color', useWhite ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`, 'important'); if (style.pointerEvents === 'none') el.style.setProperty('pointer-events', 'auto', 'important'); overlayMarked.add(el); overlayLastApplied.set(el, { blur, alpha }); }); }
    function forceOverlayApply() { if (!document.body || captchaActive) return; const cfg = mergeConfig(getHost()); if (!cfg.enabled) return; const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur; const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha; const floatEl = cachedFloatNode || document.getElementById(FLOAT_ID); findLikelyOverlays().forEach(el => { if (floatEl && (el === floatEl || floatEl.contains(el))) return; const style = getComputedStyle(el); const useWhite = isLightBg(style.backgroundColor || ''); el.style.setProperty('backdrop-filter', `blur(${blur}px)`, 'important'); el.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important'); el.style.setProperty('background-color', useWhite ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`, 'important'); if (style.pointerEvents === 'none') el.style.setProperty('pointer-events', 'auto', 'important'); overlayMarked.add(el); overlayLastApplied.set(el, { blur, alpha }); }); }
    function requestOverlayApply() { if (overlayRafPending || captchaActive) return; overlayRafPending = true; requestAnimationFrame(() => { overlayRafPending = false; applyOverlayEnhance(); }); }
    function startOverlayScanTimer() { if (overlayScanTimer) clearInterval(overlayScanTimer); overlayScanTimer = setInterval(() => { checkCaptchaStatus(); const cfg = mergeConfig(getHost()); if (cfg.enabled && !captchaActive && ((_liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur) > 0 || (_liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha) > 0)) applyOverlayEnhance(); }, 1500); }

    function compressImage(dataUrl, targetSize, callback) { const img = new Image(); img.onload = function () { let width = img.width, height = img.height; if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) { const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height); width = Math.round(width * ratio); height = Math.round(height * ratio); } const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height); let quality = 0.9, result = dataUrl, attempts = 0; const tryCompress = () => { result = canvas.toDataURL('image/jpeg', quality); attempts++; if (result.length > targetSize && quality > 0.2 && attempts < 10) { quality -= 0.05; setTimeout(tryCompress, 10); } else callback(result); }; tryCompress(); }; img.onerror = function () { callback(null); }; img.src = dataUrl; }
    function pickLocalImage(callback) { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.addEventListener('change', () => { const file = input.files && input.files[0]; if (!file) return; if (file.size > MAX_FILE_SIZE) { alert('图片过大（最大支持 15MB）'); return; } const originalFilename = file.name, reader = new FileReader(); reader.onload = async function () { const result = String(reader.result || ''); if (!result.startsWith('data:image/')) { alert('读取失败'); return; } const isWebP = file.type === 'image/webp' || result.startsWith('data:image/webp'); let dataToStore = result; if (!isWebP && result.length > COMPRESS_THRESHOLD) { const compressed = await new Promise(resolve => compressImage(result, COMPRESS_TARGET, resolve)); if (compressed) { alert(`图片已自动压缩：${Math.round(result.length / 1024)}KB → ${Math.round(compressed.length / 1024)}KB`); dataToStore = compressed; } } const cacheKey = await storeImage(dataToStore, null, originalFilename); if (cacheKey) callback(buildCacheKeyUrl(cacheKey), file, cacheKey); else alert('图片存储失败'); }; reader.readAsDataURL(file); }); input.click(); }
    const CRC32_TABLE = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC32_TABLE[i] = c >>> 0; }
    function crc32(u8) { let crc = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) crc = CRC32_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
    async function deflateRaw(data) { if (data.length === 0) return new Uint8Array(0); const cs = new CompressionStream('deflate-raw'), writer = cs.writable.getWriter(); writer.write(data); writer.close(); const reader = cs.readable.getReader(), chunks = []; while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); } let totalLen = 0; chunks.forEach(c => totalLen += c.length); const result = new Uint8Array(totalLen); let offset = 0; chunks.forEach(c => { result.set(c, offset); offset += c.length; }); return result; }
    async function compressSmart(data) { if (data.length < 128) return { compressed: data, method: 0 }; try { const deflated = await deflateRaw(data); if (deflated.length < data.length) return { compressed: deflated, method: 8 }; return { compressed: data, method: 0 }; } catch (e) { return { compressed: data, method: 0 }; } }
    function writeU16(view, offset, val) { view.setUint16(offset, val, true); } function writeU32(view, offset, val) { view.setUint32(offset, val, true); }
    async function buildZip(entries) { const processed = []; for (const entry of entries) { const nameBytes = new TextEncoder().encode(entry.name), crc = crc32(entry.data); const { compressed, method } = await compressSmart(entry.data); processed.push({ nameBytes, originalSize: entry.data.length, compressedSize: compressed.length, compressed, crc, method }); } let totalSize = 0; processed.forEach(p => { totalSize += 30 + p.nameBytes.length + p.compressedSize; }); const centralDirStart = totalSize; processed.forEach(p => { totalSize += 46 + p.nameBytes.length; }); const centralDirSize = totalSize - centralDirStart; totalSize += 22; const buf = new ArrayBuffer(totalSize), view = new DataView(buf), u8 = new Uint8Array(buf); let offset = 0; const localOffsets = []; for (const p of processed) { localOffsets.push(offset); writeU32(view, offset, 0x04034b50); writeU16(view, offset + 4, 20); writeU16(view, offset + 6, 0); writeU16(view, offset + 8, p.method); writeU16(view, offset + 10, 0); writeU16(view, offset + 12, 0); writeU32(view, offset + 14, p.crc); writeU32(view, offset + 18, p.compressedSize); writeU32(view, offset + 22, p.originalSize); writeU16(view, offset + 26, p.nameBytes.length); writeU16(view, offset + 28, 0); u8.set(p.nameBytes, offset + 30); u8.set(p.compressed, offset + 30 + p.nameBytes.length); offset += 30 + p.nameBytes.length + p.compressedSize; } for (let i = 0; i < processed.length; i++) { const p = processed[i]; writeU32(view, offset, 0x02014b50); writeU16(view, offset + 4, 20); writeU16(view, offset + 6, 20); writeU16(view, offset + 8, 0); writeU16(view, offset + 10, p.method); writeU16(view, offset + 12, 0); writeU16(view, offset + 14, 0); writeU32(view, offset + 16, p.crc); writeU32(view, offset + 20, p.compressedSize); writeU32(view, offset + 24, p.originalSize); writeU16(view, offset + 28, p.nameBytes.length); writeU16(view, offset + 30, 0); writeU16(view, offset + 32, 0); writeU16(view, offset + 34, 0); writeU16(view, offset + 36, 0); writeU32(view, offset + 38, 0); writeU32(view, offset + 42, localOffsets[i]); u8.set(p.nameBytes, offset + 46); offset += 46 + p.nameBytes.length; } writeU32(view, offset, 0x06054b50); writeU16(view, offset + 4, 0); writeU16(view, offset + 6, 0); writeU16(view, offset + 8, processed.length); writeU16(view, offset + 10, processed.length); writeU32(view, offset + 12, centralDirSize); writeU32(view, offset + 16, centralDirStart); writeU16(view, offset + 20, 0); return new Uint8Array(buf); }
    async function parseZipForImport(zipData) { async function inflateRaw(data) { const ds = new DecompressionStream('deflate-raw'), writer = ds.writable.getWriter(); writer.write(data); writer.close(); const reader = ds.readable.getReader(), chunks = []; while (true) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); } let totalLen = 0; chunks.forEach(c => totalLen += c.length); const result = new Uint8Array(totalLen); let offset = 0; chunks.forEach(c => { result.set(c, offset); offset += c.length; }); return result; } const view = new DataView(zipData.buffer, zipData.byteOffset, zipData.byteLength), result = {}; let pos = 0; while (pos + 30 <= zipData.length) { const sig = view.getUint32(pos, true); if (sig !== 0x04034b50) break; const method = view.getUint16(pos + 8, true), compSize = view.getUint32(pos + 18, true), nameLen = view.getUint16(pos + 26, true), extraLen = view.getUint16(pos + 28, true); const nameBytes = zipData.slice(pos + 30, pos + 30 + nameLen), name = new TextDecoder().decode(nameBytes); const dataStart = pos + 30 + nameLen + extraLen, compData = zipData.slice(dataStart, dataStart + compSize); if (name.endsWith('/')) { pos = dataStart + compSize; continue; } let fileData; try { if (method === 0) fileData = compData; else if (method === 8) fileData = await inflateRaw(compData); else { pos = dataStart + compSize; continue; } } catch (e) { pos = dataStart + compSize; continue; } result[name] = fileData; pos = dataStart + compSize; } return result; }
    function simpleHash(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; } return Math.abs(hash).toString(36); }
    function guessExt(url) { if (isDataImageUrl(url)) { const m = url.match(/^data:image\/(\w+)/); return m ? m[1].replace('jpeg', 'jpg') : 'png'; } const m = url.match(/\.(\w{3,4})(?:\?|$)/); return m ? m[1].toLowerCase() : 'jpg'; }
    function getExtFromFilename(filename) { if (!filename) return 'jpg'; const parts = filename.split('.'); return parts.length < 2 ? 'jpg' : parts.pop().toLowerCase().replace('jpeg', 'jpg'); }
    
    function toAbsoluteUrl(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('//')) return location.protocol + url;
        try { return new URL(url, location.href).href; } catch (e) { return url; }
    }

    function fetchFallback(url, resolve, reject) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
        fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal }).then(resp => {
            clearTimeout(timer); if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.arrayBuffer().then(ab => { const contentType = resp.headers.get('content-type') || '', ext = contentType.split(';')[0].trim().split('/').pop() || 'jpeg'; resolve({ data: new Uint8Array(ab), ext }); });
        }).catch(err => { clearTimeout(timer); reject(new Error('下载图片失败: ' + (err.message || err))); });
    }

    function fetchImageAsUint8(url) {
        url = toAbsoluteUrl(url);
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                let settled = false;
                const timer = setTimeout(() => { if (!settled) { settled = true; fetchFallback(url, resolve, reject); } }, 15000);
                try {
                    GM_xmlhttpRequest({
                        method: 'GET', url: url, responseType: 'arraybuffer', timeout: 30000,
                        headers: { 'Referer': '' },
                        anonymous: true,
                        onload(res) {
                            if (settled) return; clearTimeout(timer); settled = true;
                            if (res.status >= 200 && res.status < 300) {
                                try {
                                    const respData = res.response;
                                    if (respData instanceof ArrayBuffer) {
                                        const headerStr = String(res.responseHeaders || ''), mimeMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);
                                        const mime = mimeMatch ? mimeMatch[1].trim() : 'image/jpeg', ext = mime.split('/').pop().replace('jpeg', 'jpg');
                                        resolve({ data: new Uint8Array(respData), ext });
                                    } else fetchFallback(url, resolve, reject);
                                } catch (e) { fetchFallback(url, resolve, reject); }
                            } else reject(new Error('HTTP ' + res.status + ' (可能被防盗链拦截)'));
                        },
                        onerror() { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } },
                        ontimeout() { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } }
                    });
                } catch (e) { if (!settled) { clearTimeout(timer); settled = true; fetchFallback(url, resolve, reject); } }
            } else fetchFallback(url, resolve, reject);
        });
    }
    
    async function exportAllConfigZip() { 
        try { 
            const siteConfigMap = JSON.parse(JSON.stringify(getSiteConfigMap())), globalUrl = getValue('Vie背景图片', DEFAULTS.url); 
            let globalImageFile = '', globalRemoteData = null, globalRemoteUrl = ''; 
            
            if (isCacheKey(globalUrl)) { 
                const cacheKey = extractCacheKey(globalUrl), originalName = getOriginalFilename(cacheKey), ext = originalName ? getExtFromFilename(originalName) : 'jpg'; 
                globalImageFile = 'global_local.' + ext; 
                if (CACHE_AVAILABLE) { 
                    try { 
                        const cache = await caches.open(CACHE_NAME);
                        const response = await cache.match(new Request('/' + cacheKey)); 
                        if (response) globalRemoteData = new Uint8Array(await response.arrayBuffer()); 
                    } catch (e) { console.error('[VieBg] Cache API read error (global):', e); } 
                } 
                if (!globalRemoteData) { 
                    const backup = getValue(GM_BACKUP_PREFIX + cacheKey, ''); 
                    if (backup && backup.startsWith('data:image/')) globalRemoteData = dataUrlToUint8Array(backup); 
                } 
            } else if (isDataImageUrl(globalUrl)) { 
                globalImageFile = 'global_local.' + guessExt(globalUrl); 
                globalRemoteData = dataUrlToUint8Array(globalUrl); 
            } else if (globalUrl) { 
                globalRemoteUrl = toAbsoluteUrl(globalUrl); 
                try { 
                    const { data, ext } = await fetchImageAsUint8(globalRemoteUrl); 
                    globalImageFile = 'global_remote.' + ext; 
                    globalRemoteData = data; 
                } catch (e) { 
                    alert('⚠️ 全局远程图片下载失败：' + e.message + '\nURL: ' + globalRemoteUrl); 
                } 
            } 
            
            const imageEntries = []; 
            if (globalRemoteData && globalImageFile) imageEntries.push({ name: 'images/' + globalImageFile, data: globalRemoteData }); 
            
            let failedRemoteCount = 0;
            let failedLocalCount = 0;
            const failedUrls = [];
            const failedLocalSites = [];
            
            for (const host in siteConfigMap) { 
                const url = siteConfigMap[host].url; 
                if (!url) continue; 
                let filename = null; 
                
                if (isCacheKey(url)) { 
                    const ck = extractCacheKey(url), originalName = getOriginalFilename(ck), ext = originalName ? getExtFromFilename(originalName) : 'jpg'; 
                    filename = 'site_' + simpleHash(host) + '_local.' + ext; 
                    let imgData = null; 
                    
                    if (CACHE_AVAILABLE) { 
                        try { 
                            const cache = await caches.open(CACHE_NAME);
                            const response = await cache.match(new Request('/' + ck)); 
                            if (response) imgData = new Uint8Array(await response.arrayBuffer()); 
                        } catch (e) { console.error('[VieBg] Cache API read error (site):', e); } 
                    } 
                    
                    if (!imgData) { 
                        const backup = getValue(GM_BACKUP_PREFIX + ck, ''); 
                        if (backup && backup.startsWith('data:image/')) imgData = dataUrlToUint8Array(backup); 
                    } 
                    
                    if (imgData) {
                        imageEntries.push({ name: 'images/' + filename, data: imgData }); 
                    } else {
                        failedLocalCount++;
                        failedLocalSites.push(host);
                    }
                } else if (isDataImageUrl(url)) { 
                    filename = 'site_' + simpleHash(host) + '_local.' + guessExt(url); 
                    imageEntries.push({ name: 'images/' + filename, data: dataUrlToUint8Array(url) }); 
                } else { 
                    const absUrl = toAbsoluteUrl(url);
                    siteConfigMap[host].remoteUrl = absUrl; 
                    try { 
                        const { data, ext } = await fetchImageAsUint8(absUrl); 
                        filename = 'site_' + simpleHash(host) + '_remote.' + ext; 
                        imageEntries.push({ name: 'images/' + filename, data: data }); 
                    } catch (e) { 
                        failedRemoteCount++; 
                        failedUrls.push(absUrl); 
                    } 
                } 
                siteConfigMap[host].url = filename || ''; 
            } 
            
            const configData = { version: '3.1-compatible', exportedAt: new Date().toISOString(), cacheApiAvailable: CACHE_AVAILABLE, global: { url: globalImageFile || '', remoteUrl: globalRemoteUrl, theme: getValue('Vie背景', DEFAULTS.theme), opacity: getValue('Vie背景透明度', DEFAULTS.opacity), mode: getValue('Vie背景模式', DEFAULTS.mode), blur: getValue('Vie背景模糊', DEFAULTS.blur), enabled: getValue('Vie背景启用', DEFAULTS.enabled), floatVisible: getValue('Vie背景悬浮按钮显示', DEFAULTS.floatVisible), listMode: getValue('Vie背景列表模式', DEFAULTS.listMode), floatPos: safeJSONParse(getValue('Vie背景悬浮位置', JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos), nativeElementBlur: getValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur), overlayBlur: getValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur), overlayAlpha: getValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha) }, siteList: getList(), siteConfigMap }; 
            imageEntries.push({ name: 'config.json', data: new TextEncoder().encode(JSON.stringify(configData, null, 2)) }); 
            const zipped = await buildZip(imageEntries), blob = new Blob([zipped], { type: 'application/zip' }), blobUrl = URL.createObjectURL(blob); 
            const a = document.createElement('a'); a.href = blobUrl; a.download = '浏览器背景_' + new Date().toISOString().slice(0, 10) + '.zip'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { try { a.remove(); } catch (e) {} URL.revokeObjectURL(blobUrl); }, 1000); 
            
            if (failedRemoteCount > 0 || failedLocalCount > 0) {
                let msg = '⚠️ 导出完成，但存在以下问题：\n\n';
                if (failedRemoteCount > 0) {
                    msg += `【${failedRemoteCount} 张远程图片下载失败】（可能受限于 CORS 或防盗链）：\n`;
                    failedUrls.forEach(u => msg += `- ${u}\n`);
                    msg += '\n';
                }
                if (failedLocalCount > 0) {
                    msg += `【${failedLocalCount} 个站点的本地图读取失败】（可能因浏览器清理了缓存或图片过大超出油猴存储限制）：\n`;
                    failedLocalSites.forEach(h => msg += `- ${h}\n`);
                }
                alert(msg);
            }
        } catch (e) { 
            alert('导出失败：' + e.message); 
        } 
    }
    
    async function importAllConfigZip() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.zip,application/zip'; input.addEventListener('change', async () => { const file = input.files && input.files[0]; if (!file) return; try { const unzipped = await parseZipForImport(new Uint8Array(await file.arrayBuffer())); if (!unzipped['config.json']) throw new Error('压缩包内缺少 config.json'); const configData = JSON.parse(new TextDecoder().decode(unzipped['config.json'])), imgCacheKeys = {}; for (const path in unzipped) { if (path.startsWith('images/') && path !== 'images/') { const fname = path.replace('images/', ''), ext = fname.split('.').pop().toLowerCase(); const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }; const dataUrl = uint8ArrayToDataUrl(unzipped[path], mimeMap[ext] || 'image/jpeg'); const key = await storeImage(dataUrl, null, fname); if (key) imgCacheKeys[fname] = buildCacheKeyUrl(key); } } const gRemoteUrl = (configData.global && configData.global.remoteUrl) || '', gLocalFile = configData.global.url; const gCacheKeyUrl = (gLocalFile && imgCacheKeys[gLocalFile]) ? imgCacheKeys[gLocalFile] : ''; if (gRemoteUrl) configData.global.url = gRemoteUrl; else if (gCacheKeyUrl) configData.global.url = gCacheKeyUrl; else configData.global.url = DEFAULTS.url; if (configData.siteConfigMap) { for (const host in configData.siteConfigMap) { const sc = configData.siteConfigMap[host], sRemoteUrl = sc.remoteUrl || '', sLocalFile = sc.url || ''; const sCacheKeyUrl = (sLocalFile && imgCacheKeys[sLocalFile]) ? imgCacheKeys[sLocalFile] : ''; if (sRemoteUrl) sc.url = sRemoteUrl; else if (sCacheKeyUrl) sc.url = sCacheKeyUrl; else delete sc.url; delete sc.remoteUrl; } } applyImportedConfig(configData); alert('压缩包导入成功：' + file.name); } catch (e) { alert('导入失败：' + e.message); } }); input.click(); }
    function applyImportedConfig(data) { configCache = null; if (data.global) { if ('url' in data.global) setValue('Vie背景图片', data.global.url); if ('theme' in data.global) setValue('Vie背景', data.global.theme); if ('opacity' in data.global) setValue('Vie背景透明度', data.global.opacity); if ('mode' in data.global) setValue('Vie背景模式', data.global.mode); if ('blur' in data.global) setValue('Vie背景模糊', data.global.blur); if ('enabled' in data.global) setValue('Vie背景启用', data.global.enabled); if ('floatVisible' in data.global) setValue('Vie背景悬浮按钮显示', data.global.floatVisible); if ('listMode' in data.global) setValue('Vie背景列表模式', data.global.listMode); if ('floatPos' in data.global) setValue('Vie背景悬浮位置', JSON.stringify(data.global.floatPos)); if ('nativeElementBlur' in data.global) setValue('Vie背景原生弹层模糊', data.global.nativeElementBlur); if ('overlayBlur' in data.global) setValue('Vie背景动态弹层模糊', data.global.overlayBlur); if ('overlayAlpha' in data.global) setValue('Vie背景动态弹层透明度', data.global.overlayAlpha); } if (Array.isArray(data.siteList)) setList(data.siteList); if (data.siteConfigMap && typeof data.siteConfigMap === 'object') setSiteConfigMap(data.siteConfigMap); _liveOverlayBlur = null; _liveOverlayAlpha = null; configCache = null; applyAgain(); }
    function registerMenus() { const host = getHost(), globalCfg = getGlobalConfig(), siteCfg = getSiteConfig(host); GM_registerMenuCommand(globalCfg.enabled ? '❌ 关闭背景功能（全局）' : '✅ 开启背景功能（全局）', () => setGlobal('Vie背景启用', !getGlobalConfig().enabled)); GM_registerMenuCommand(globalCfg.listMode === 'blacklist' ? '⚪ 切换为白名单模式' : '⚫ 切换为黑名单模式', () => setGlobal('Vie背景列表模式', getGlobalConfig().listMode === 'blacklist' ? 'whitelist' : 'blacklist')); const inList = inSiteList(host); GM_registerMenuCommand(inList ? '📌 当前站点：移出站点列表' : '📌 当前站点：加入站点列表', () => toggleCurrentSiteInList()); GM_registerMenuCommand('☀️ 亮色调（全局）', () => setGlobal('Vie背景', 1)); GM_registerMenuCommand('🌙 暗色调（全局）', () => setGlobal('Vie背景', 2)); GM_registerMenuCommand(siteCfg && siteCfg.enabled === false ? '🟢 当前站点：单独启用' : '🔴 当前站点：单独禁用', () => updateCurrentSiteConfig({ enabled: (getSiteConfig(host) || {}).enabled === false })); }

    function ensureFloatStyle() { if (cachedFloatStyleNode && document.contains(cachedFloatStyleNode)) return; if (document.getElementById(FLOAT_STYLE_ID)) { cachedFloatStyleNode = document.getElementById(FLOAT_STYLE_ID); return; } const style = document.createElement('style'); style.id = FLOAT_STYLE_ID; style.textContent = `#${FLOAT_ID}{position:fixed!important;z-index:2147483647!important;font-family:sans-serif!important;user-select:none!important;display:block!important;visibility:visible!important;width:46px!important;height:46px!important;}#${FLOAT_ID} *{box-sizing:border-box!important;}#vie-bg-toggle-v89{width:46px!important;height:46px!important;line-height:46px!important;text-align:center!important;border-radius:50%!important;background:rgba(0,0,0,0.68)!important;color:#fff!important;font-size:14px!important;cursor:pointer!important;box-shadow:0 2px 12px rgba(0,0,0,0.35)!important;}#vie-bg-panel-v89{position:absolute!important;bottom:54px!important;right:0!important;width:260px!important;padding:12px!important;border-radius:12px!important;background:rgba(0,0,0,0.85)!important;color:#f0f0f0!important;font-size:12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.5)!important;display:none;max-height:70vh!important;overflow-y:auto!important;transition:opacity 0.2s ease!important;}#vie-bg-panel-v89 .row{margin-bottom:8px!important;}#vie-bg-panel-v89 .lab{font-size:11px!important;margin-bottom:3px!important;color:#ccc!important;}#vie-bg-panel-v89 input[type="range"]{width:100%!important;-webkit-appearance:none!important;appearance:none!important;height:6px!important;background:linear-gradient(to right,#98DD98 var(--range-progress,0%),rgba(255,255,255,0.18) var(--range-progress,0%))!important;outline:none!important;opacity:0.9!important;border-radius:3px!important;}#vie-bg-panel-v89 input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none!important;width:16px!important;height:16px!important;background:#7DD87D!important;cursor:pointer!important;border-radius:50%!important;border:2px solid #222!important;}#vie-bg-panel-v89 input[type="text"]{width:100%!important;padding:4px 6px!important;border-radius:4px!important;background:rgba(255,255,255,0.12)!important;color:#f0f0f0!important;font-size:11px!important;border:1px solid rgba(255,255,255,0.15)!important;outline:none!important;}#vie-bg-panel-v89 input[type="text"]:focus{border-color:rgba(155,219,155,0.5)!important;}#vie-bg-panel-v89 .btns{display:flex!important;gap:6px!important;margin-top:8px!important;}#vie-bg-panel-v89 button{flex:1!important;border:0!important;border-radius:6px!important;padding:7px 8px!important;background:rgba(255,255,255,0.15)!important;color:#f0f0f0!important;cursor:pointer!important;font-size:11px!important;transition:background 0.2s!important;white-space:nowrap!important;}#vie-bg-panel-v89 button:hover{background:rgba(255,255,255,0.25)!important;}#vie-bg-panel-v89 .btn-primary button{background:rgba(155,219,155,0.35)!important;font-weight:bold!important;}#vie-bg-panel-v89 .btn-primary button:hover{background:rgba(155,219,155,0.55)!important;}#vie-bg-panel-v89 .btn-danger button{background:rgba(255,100,100,0.35)!important;}#vie-bg-panel-v89 .btn-danger button:hover{background:rgba(255,100,100,0.55)!important;}#vie-bg-panel-v89 .btn-export button{background:rgba(100,180,255,0.35)!important;}#vie-bg-panel-v89 .btn-export button:hover{background:rgba(100,180,255,0.55)!important;}#vie-bg-panel-v89 .section-divider{border:none!important;border-top:1px solid rgba(255,255,255,0.1)!important;margin:10px 0 8px!important;}#vie-bg-panel-v89 .section-title{font-size:10px!important;color:rgba(255,255,255,0.45)!important;margin-bottom:6px!important;text-transform:uppercase!important;letter-spacing:1px!important;}#vie-bg-panel-v89::-webkit-scrollbar{width:4px!important;}#vie-bg-panel-v89::-webkit-scrollbar-track{background:transparent!important;}#vie-bg-panel-v89::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2)!important;border-radius:2px!important;}`; document.documentElement.appendChild(style); cachedFloatStyleNode = style; }
    
    function createFloat() { const host = getHost(), cfg = mergeConfig(host); if (!cfg.floatVisible) { floatShouldExist = false; return; } const existing = cachedFloatNode || document.getElementById(FLOAT_ID); if (existing && (document.documentElement.contains(existing) || document.body.contains(existing))) { floatShouldExist = true; cachedFloatNode = existing; fixFloatPosition(existing); return; } if (existing) { try { existing.remove(); } catch (e) {} } ensureFloatStyle(); const pos = safePos(cfg.floatPos), box = document.createElement('div'); box.id = FLOAT_ID; box.style.right = pos.right + 'px'; box.style.bottom = pos.bottom + 'px'; box.style.display = 'block'; box.style.visibility = 'visible'; const panelEl = document.createElement('div'); panelEl.id = 'vie-bg-panel-v89'; box.innerHTML = '<div id="vie-bg-toggle-v89" title="点击展开/收起；拖动移动">𖣐</div>'; panelEl.innerHTML = `<div class="btns" style="margin-bottom:8px!important;"><button id="vie-v89-advanced">⚙️ 高级设置 ▼</button></div><div id="vie-v89-advanced-panel" style="display:none;"><hr class="section-divider"><div class="section-title">保存配置</div><div class="btns btn-primary"><button id="vie-v89-save-global">💾 存全局</button><button id="vie-v89-save-site">💾 存本站</button></div><hr class="section-divider"><div class="section-title">本地图片</div><div class="btns"><button id="vie-v89-pick-global">🖼️ 全局本地图</button><button id="vie-v89-pick-site">🖼️ 本站本地图</button></div><hr class="section-divider"><div class="section-title">导入导出</div><div class="btns btn-export"><button id="vie-v89-export">📦 导出压缩包</button><button id="vie-v89-import">📂 导入压缩包</button></div><hr class="section-divider"><div class="section-title">重置设置</div><div class="btns btn-danger"><button id="vie-v89-reset-global">🔄 全局默认</button><button id="vie-v89-reset-site">🗑️ 清本站</button></div></div><hr class="section-divider"><div class="section-title">背景图片</div><div class="row"><div class="lab">全局背景图 URL</div><input id="vie-v89-global-image-url" type="text" placeholder="输入网络图片链接"></div><div class="row"><div class="lab">当前站点背景图 URL</div><input id="vie-v89-site-image-url" type="text" placeholder="留空则使用全局图片"></div><div class="row"><div class="lab">透明度 <span id="vie-v89-opacity-txt">${Math.round(cfg.opacity * 100)}%</span></div><input id="vie-v89-opacity" type="range" min="10" max="100" step="1" value="${Math.round(cfg.opacity * 100)}"></div><div class="row"><div class="lab">背景模糊 <span id="vie-v89-blur-txt">${cfg.blur}px</span></div><input id="vie-v89-blur" type="range" min="0" max="50" step="1" value="${cfg.blur}"></div><div class="row"><div class="lab">弹层模糊 <span id="vie-v89-native-blur-txt">${cfg.nativeElementBlur}px</span></div><input id="vie-v89-native-blur" type="range" min="0" max="20" step="1" value="${cfg.nativeElementBlur}"></div>`; const section3 = document.createElement('div'); section3.innerHTML = `<hr class="section-divider"><div class="section-title">自动弹层增强</div><div class="row"><div class="lab">自动弹层模糊 <span id="vie-v89-overlay-blur-txt">${cfg.overlayBlur}px</span></div><input id="vie-v89-overlay-blur" type="range" min="0" max="40" step="1" value="${cfg.overlayBlur}"></div><div class="row"><div class="lab">自动弹层透明 <span id="vie-v89-overlay-alpha-txt">${cfg.overlayAlpha.toFixed(2)}</span></div><input id="vie-v89-overlay-alpha" type="range" min="0" max="80" step="1" value="${Math.round(cfg.overlayAlpha * 100)}"></div>`; panelEl.appendChild(section3); box.appendChild(panelEl); try { if (document.body) document.body.appendChild(box); else document.documentElement.appendChild(box); } catch(e) {} cachedFloatNode = box; floatShouldExist = true; const toggle = box.querySelector('#vie-bg-toggle-v89'), advancedBtn = box.querySelector('#vie-v89-advanced'), advPanelEl = box.querySelector('#vie-v89-advanced-panel'); const globalImageUrlInput = box.querySelector('#vie-v89-global-image-url'), siteImageUrlInput = box.querySelector('#vie-v89-site-image-url'); const opacityEl = box.querySelector('#vie-v89-opacity'), blurEl = box.querySelector('#vie-v89-blur'), nativeBlurEl = box.querySelector('#vie-v89-native-blur'); const overlayBlurEl = box.querySelector('#vie-v89-overlay-blur'), overlayAlphaEl = box.querySelector('#vie-v89-overlay-alpha'); const opacityTxt = box.querySelector('#vie-v89-opacity-txt'), blurTxt = box.querySelector('#vie-v89-blur-txt'), nativeBlurTxt = box.querySelector('#vie-v89-native-blur-txt'); const overlayBlurTxt = box.querySelector('#vie-v89-overlay-blur-txt'), overlayAlphaTxt = box.querySelector('#vie-v89-overlay-alpha-txt'); const currentGlobalUrl = getGlobalConfig().url, currentSiteUrl = (getSiteConfig(host) || {}).url || ''; globalImageUrlInput.value = (isCacheKey(currentGlobalUrl) || isDataImageUrl(currentGlobalUrl)) ? '' : currentGlobalUrl; siteImageUrlInput.value = (isCacheKey(currentSiteUrl) || isDataImageUrl(currentSiteUrl)) ? '' : currentSiteUrl; let panelProtectTimer = null; toggle.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); if (toggle.__dragging) return; const isHidden = panelEl.style.display === 'none'; panelEl.style.display = isHidden ? 'block' : 'none'; advPanelEl.style.display = 'none'; advancedBtn.textContent = '⚙️ 高级设置 ▼'; if (isHidden) { panelEl.style.pointerEvents = 'none'; panelEl.style.opacity = '0.7'; if (panelProtectTimer) clearTimeout(panelProtectTimer); panelProtectTimer = setTimeout(() => { panelEl.style.pointerEvents = ''; panelEl.style.opacity = ''; }, 500); } else { if (panelProtectTimer) clearTimeout(panelProtectTimer); panelEl.style.pointerEvents = ''; panelEl.style.opacity = ''; } }); function updateSliderTrack(el) { const min = Number(el.min) || 0, max = Number(el.max) || 100; el.style.setProperty('--range-progress', ((Number(el.value) - min) / (max - min)) * 100 + '%'); } function getLiveValues() { return { globalImageUrl: globalImageUrlInput.value.trim(), siteImageUrl: siteImageUrlInput.value.trim(), opacity: clamp(Number(opacityEl.value) / 100, 0.1, 1), blur: clamp(Number(blurEl.value), 0, 50), nativeElementBlur: clamp(Number(nativeBlurEl.value), 0, 20), overlayBlur: clamp(Number(overlayBlurEl.value), 0, 40), overlayAlpha: clamp(Number(overlayAlphaEl.value) / 100, 0, 0.8) }; } function updateLiveText() { const v = getLiveValues(); opacityTxt.textContent = Math.round(v.opacity * 100) + '%'; blurTxt.textContent = v.blur + 'px'; nativeBlurTxt.textContent = v.nativeElementBlur + 'px'; overlayBlurTxt.textContent = v.overlayBlur + 'px'; overlayAlphaTxt.textContent = v.overlayAlpha.toFixed(2); } let livePreviewRaf = null; function applyLivePreview() { if (livePreviewRaf) return; livePreviewRaf = requestAnimationFrame(() => { livePreviewRaf = null; const merged = mergeConfig(getHost()), live = getLiveValues(); const previewCfg = Object.assign({}, merged); if (live.siteImageUrl) previewCfg.url = live.siteImageUrl; else if (live.globalImageUrl) previewCfg.url = live.globalImageUrl; previewCfg.opacity = live.opacity; previewCfg.blur = live.blur; previewCfg.nativeElementBlur = live.nativeElementBlur; previewCfg.enabled = true; let finalUrl = previewCfg.url; if (isCacheKey(finalUrl)) finalUrl = _currentImageUrl || ''; ensureStyleNode().textContent = buildCSS(previewCfg, finalUrl); applyNativeBlur(live.nativeElementBlur); _liveOverlayBlur = live.overlayBlur; _liveOverlayAlpha = live.overlayAlpha; forceOverlayApply(); }); } [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack); [globalImageUrlInput, siteImageUrlInput, opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(el => { el.addEventListener('input', () => { if (el.type === 'range') updateSliderTrack(el); updateLiveText(); applyLivePreview(); }); }); advancedBtn.addEventListener('click', (e) => { e.stopPropagation(); const isHidden = advPanelEl.style.display === 'none'; advPanelEl.style.display = isHidden ? 'block' : 'none'; panelEl.style.display = 'block'; advancedBtn.textContent = isHidden ? '⚙️ 高级设置 ▲' : '⚙️ 高级设置 ▼'; }); box.querySelector('#vie-v89-save-global').addEventListener('click', (e) => { e.stopPropagation(); const v = getLiveValues(); configCache = null; if (v.globalImageUrl) setValue('Vie背景图片', v.globalImageUrl); setValue('Vie背景透明度', v.opacity); setValue('Vie背景模糊', v.blur); setValue('Vie背景原生弹层模糊', v.nativeElementBlur); setValue('Vie背景动态弹层模糊', v.overlayBlur); setValue('Vie背景动态弹层透明度', v.overlayAlpha); _liveOverlayBlur = null; _liveOverlayAlpha = null; applyAgain(); alert('已保存到全局配置'); }); box.querySelector('#vie-v89-save-site').addEventListener('click', (e) => { e.stopPropagation(); const v = getLiveValues(), h = getHost(); configCache = null; setSiteConfig(h, Object.assign({}, getSiteConfig(h) || {}, { url: v.siteImageUrl || (getSiteConfig(h) || {}).url, opacity: v.opacity, blur: v.blur, nativeElementBlur: v.nativeElementBlur, overlayBlur: v.overlayBlur, overlayAlpha: v.overlayAlpha })); _liveOverlayBlur = null; _liveOverlayAlpha = null; applyAgain(); alert('已保存到当前站点：' + h); }); box.querySelector('#vie-v89-pick-global').addEventListener('click', (e) => { e.stopPropagation(); pickLocalImage((cacheKeyUrl, file) => { setValue('Vie背景图片', cacheKeyUrl); configCache = null; globalImageUrlInput.value = ''; siteImageUrlInput.value = ''; applyAgain(); alert('已设置全局本地图片：' + file.name); }); }); box.querySelector('#vie-v89-pick-site').addEventListener('click', (e) => { e.stopPropagation(); pickLocalImage((cacheKeyUrl, file) => { const h = getHost(); setSiteConfig(h, Object.assign({}, getSiteConfig(h) || {}, { url: cacheKeyUrl })); configCache = null; siteImageUrlInput.value = ''; globalImageUrlInput.value = ''; applyAgain(); alert('已设置本站本地图片：' + file.name); }); }); box.querySelector('#vie-v89-export').addEventListener('click', (e) => { e.stopPropagation(); exportAllConfigZip(); }); box.querySelector('#vie-v89-import').addEventListener('click', (e) => { e.stopPropagation(); importAllConfigZip(); }); box.querySelector('#vie-v89-reset-global').addEventListener('click', (e) => { e.stopPropagation(); configCache = null; setValue('Vie背景图片', DEFAULTS.url); setValue('Vie背景透明度', DEFAULTS.opacity); setValue('Vie背景模糊', DEFAULTS.blur); setValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur); setValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur); setValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha); globalImageUrlInput.value = DEFAULTS.url; opacityEl.value = Math.round(DEFAULTS.opacity * 100); blurEl.value = DEFAULTS.blur; nativeBlurEl.value = DEFAULTS.nativeElementBlur; overlayBlurEl.value = DEFAULTS.overlayBlur; overlayAlphaEl.value = Math.round(DEFAULTS.overlayAlpha * 100); siteImageUrlInput.value = ''; [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack); updateLiveText(); _liveOverlayBlur = null; _liveOverlayAlpha = null; applyAgain(); alert('已恢复全局默认值'); }); box.querySelector('#vie-v89-reset-site').addEventListener('click', (e) => { e.stopPropagation(); if (!confirm('确定清空当前站点的所有单独配置？')) return; configCache = null; removeSiteConfig(getHost()); siteImageUrlInput.value = ''; const refreshed = mergeConfig(getHost()); opacityEl.value = Math.round(refreshed.opacity * 100); blurEl.value = refreshed.blur; nativeBlurEl.value = refreshed.nativeElementBlur; overlayBlurEl.value = refreshed.overlayBlur; overlayAlphaEl.value = Math.round(refreshed.overlayAlpha * 100); [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack); updateLiveText(); _liveOverlayBlur = null; _liveOverlayAlpha = null; applyAgain(); alert('已清除当前站点配置'); }); document.addEventListener('click', (e) => { if (!box.contains(e.target)) { panelEl.style.display = 'none'; advPanelEl.style.display = 'none'; advancedBtn.textContent = '⚙️ 高级设置 ▼'; if (panelProtectTimer) clearTimeout(panelProtectTimer); panelEl.style.pointerEvents = ''; panelEl.style.opacity = ''; } }); (function enableDrag() { let startX = 0, startY = 0, startRight = 0, startBottom = 0; function onDown(e) { const evt = e.touches ? e.touches[0] : e; const rect = box.getBoundingClientRect(); startX = evt.clientX; startY = evt.clientY; startRight = window.innerWidth - rect.right; startBottom = window.innerHeight - rect.bottom; toggle.__dragging = false; document.addEventListener('mousemove', onMove, true); document.addEventListener('mouseup', onUp, true); document.addEventListener('touchmove', onMove, { passive: false, capture: true }); document.addEventListener('touchend', onUp, true); } function onMove(e) { const evt = e.touches ? e.touches[0] : e; const dx = evt.clientX - startX, dy = evt.clientY - startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) toggle.__dragging = true; box.style.right = clamp(startRight - dx, 0, Math.max(0, window.innerWidth - 46)) + 'px'; box.style.bottom = clamp(startBottom - dy, 0, Math.max(0, window.innerHeight - 46)) + 'px'; if (e.cancelable) e.preventDefault(); } function onUp(e) { document.removeEventListener('mousemove', onMove, true); document.removeEventListener('mouseup', onUp, true); document.removeEventListener('touchmove', onMove, true); document.removeEventListener('touchend', onUp, true); const saved = safePos({ right: parseInt(box.style.right, 10), bottom: parseInt(box.style.bottom, 10) }); box.style.right = saved.right + 'px'; box.style.bottom = saved.bottom + 'px'; setValue('Vie背景悬浮位置', JSON.stringify(saved)); setTimeout(() => { toggle.__dragging = false; }, 80); } toggle.addEventListener('mousedown', onDown); toggle.addEventListener('touchstart', onDown, { passive: true }); })(); window.addEventListener('resize', () => { fixFloatPosition(box); }); }
    function fixFloatPosition(box) { if (!box) return; const currentRight = parseInt(box.style.right, 10), currentBottom = parseInt(box.style.bottom, 10); const fixed = safePos({ right: currentRight, bottom: currentBottom }); if (currentRight !== fixed.right || currentBottom !== fixed.bottom) { box.style.right = fixed.right + 'px'; box.style.bottom = fixed.bottom + 'px'; } }
    function ensureFloatAlive() { if (!floatShouldExist) return; const cfg = mergeConfig(getHost()); if (!cfg.floatVisible) return; const el = cachedFloatNode || document.getElementById(FLOAT_ID); if (!el || !(document.body.contains(el) || document.documentElement.contains(el))) { cachedFloatNode = null; createFloat(); } else { cachedFloatNode = el; fixFloatPosition(el); } }

    floatShouldExist = getGlobalConfig().floatVisible;
    applyStyleFull();

    let mutationDebounceTimer = null;
    const observer = new MutationObserver(() => {
        checkCaptchaStatus(); 
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(() => {
            const cfg = mergeConfig(getHost());
            if (cfg.enabled && !captchaActive && !document.getElementById(STYLE_ID)) { cachedStyleNode = null; applyStyle(); }
            const ov = getEffectiveOverlayValues();
            if (cfg.enabled && !captchaActive && (ov.blur > 0 || ov.alpha > 0)) requestOverlayApply();
            ensureFloatAlive();
            if (!document.getElementById(FLOAT_STYLE_ID)) { cachedFloatStyleNode = null; ensureFloatStyle(); }
        }, 150);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'aria-hidden'] });

    document.addEventListener('DOMContentLoaded', () => { checkCaptchaStatus(); applyAgain(); createFloat(); startOverlayScanTimer(); document.addEventListener('click', () => { setTimeout(requestOverlayApply, 100); }, true); document.addEventListener('keydown', () => { setTimeout(requestOverlayApply, 150); }, true); });
    window.addEventListener('load', () => { checkCaptchaStatus(); applyAgain(); createFloat(); setTimeout(() => { ensureFloatAlive(); applyStyleFull(); }, 500); setTimeout(() => { ensureFloatAlive(); applyStyleFull(); }, 2000); });
    registerMenus();
})();
