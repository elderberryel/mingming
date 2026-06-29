// ==UserScript==
// @name         浏览器背景 v2.0
// @namespace    https://viayoo.com/
// @version      2.0
// @description  浏览器背景
// @author        ChatGPT & MiMo
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULTS = {
        url: 'https://8upload.com/image/96dff2c694b65855/2026_01_16.jpg',
        theme: 1,
        opacity: 0.69,
        mode: 'cover',
        blur: 0,
        enabled: true,
        floatVisible: true,
        listMode: 'blacklist',
        floatPos: { right: 10, bottom: 90 },
        nativeElementBlur: 10,
        overlayBlur: 10,
        overlayAlpha: 0.10
    };

    const STYLE_ID = 'vie-browser-bg-style-v73';
    const FLOAT_ID = 'vie-browser-bg-float-v73';
    const FLOAT_STYLE_ID = 'vie-browser-bg-float-style-v73';
    const IMG_LAYER_ID = 'vie-browser-bg-img-layer-v73';
    const CSP_META_ID = 'vie-browser-bg-csp-meta-v73';
    const NATIVE_BLUR_STYLE_ID = 'vie-browser-bg-native-blur-style-v73';

    // ========== 图片压缩配置 ==========
    const COMPRESS_THRESHOLD = 1000 * 1024;  // 超过 1000KB (1MB) 才压缩
    const COMPRESS_TARGET = 1000 * 1024;     // 压缩目标 1000KB
    const MAX_IMAGE_WIDTH = 1600;            // 最大宽度 1600px
    const MAX_IMAGE_HEIGHT = 2560;           // 最大高度 2560px
    const MAX_FILE_SIZE = 15 * 1024 * 1024;  // 最大文件 15MB

    // ========== 性能优化：缓存 DOM 节点引用 ==========
    let cachedStyleNode = null;
    let cachedFloatNode = null;
    let cachedFloatStyleNode = null;
    let cachedImgLayer = null;
    let cachedCspMeta = null;
    let cachedNativeBlurStyle = null;

    // ========== 性能优化：相关变量 ==========
    const overlayMarked = new WeakSet();
    const overlayLastApplied = new WeakMap();
    let overlayRafPending = false;
    let overlayScanTimer = null;
    let _liveOverlayBlur = null;
    let _liveOverlayAlpha = null;
    let floatShouldExist = false;

    // ========== 性能优化：配置缓存 ==========
    let configCache = null;
    let configCacheTime = 0;
    const CONFIG_CACHE_TTL = 500;

    function clamp(num, min, max) { return Math.min(max, Math.max(min, num)); }

    function safePos(pos) {
        const vw = window.innerWidth || 360;
        const vh = window.innerHeight || 640;
        return {
            right: clamp(Number(pos && pos.right) || 10, 0, Math.max(0, vw - 46)),
            bottom: clamp(Number(pos && pos.bottom) || 90, 0, Math.max(0, vh - 46))
        };
    }

    function getHost() { return location.hostname || ''; }
    function getValue(key, def) { return GM_getValue(key, def); }
    function setValue(key, val) { GM_setValue(key, val); }

    function safeJSONParse(str, def) {
        try { const v = JSON.parse(str); return v ?? def; } catch (e) { return def; }
    }

    function getList() { return safeJSONParse(getValue('Vie背景站点列表', '[]'), []); }
    function setList(arr) { setValue('Vie背景站点列表', JSON.stringify(arr)); }

    function normalizeHost(h) { return String(h || '').trim().toLowerCase(); }

    function hostMatch(rule, host) {
        rule = normalizeHost(rule);
        host = normalizeHost(host);
        if (!rule || !host) return false;
        if (host === rule) return true;
        if (host.endsWith('.' + rule)) return true;
        const ruleParts = rule.split('.');
        const hostParts = host.split('.');
        if (ruleParts.length === 2) {
            return hostParts.length >= 2 && hostParts.slice(-2).join('.') === rule;
        }
        if (ruleParts.length > 2) {
            if (hostParts.length >= ruleParts.length) {
                return hostParts.slice(-ruleParts.length).join('.') === rule;
            }
        }
        return false;
    }

    function getTopDomain(host) {
        host = normalizeHost(host);
        const parts = host.split('.');
        if (parts.length >= 2) return parts.slice(-2).join('.');
        return host;
    }

    function inSiteList(host) {
        return getList().some(item => hostMatch(item, host));
    }

    function getSiteConfigMap() { return safeJSONParse(getValue('Vie背景站点配置', '{}'), {}); }
    function setSiteConfigMap(map) { setValue('Vie背景站点配置', JSON.stringify(map)); }
    function getSiteConfig(host) { return getSiteConfigMap()[host] || null; }

    function setSiteConfig(host, cfg) {
        const map = getSiteConfigMap();
        map[host] = cfg;
        setSiteConfigMap(map);
    }

    function removeSiteConfig(host) {
        const map = getSiteConfigMap();
        delete map[host];
        setSiteConfigMap(map);
    }

    function getGlobalConfig() {
        return {
            url: getValue('Vie背景图片', DEFAULTS.url),
            theme: Number(getValue('Vie背景', DEFAULTS.theme)),
            opacity: clamp(Number(getValue('Vie背景透明度', DEFAULTS.opacity)), 0.1, 1),
            mode: getValue('Vie背景模式', DEFAULTS.mode),
            blur: clamp(Number(getValue('Vie背景模糊', DEFAULTS.blur)), 0, 50),
            enabled: getValue('Vie背景启用', DEFAULTS.enabled),
            floatVisible: getValue('Vie背景悬浮按钮显示', DEFAULTS.floatVisible),
            listMode: getValue('Vie背景列表模式', DEFAULTS.listMode),
            floatPos: safeJSONParse(getValue('Vie背景悬浮位置', JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos),
            nativeElementBlur: clamp(Number(getValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur)), 0, 20),
            overlayBlur: clamp(Number(getValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur)), 0, 40),
            overlayAlpha: clamp(Number(getValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha)), 0, 0.8)
        };
    }

    function shouldApply(host, globalCfg) {
        if (!globalCfg.enabled) return false;
        const siteCfg = getSiteConfig(host);
        if (siteCfg && siteCfg.enabled === false) return false;
        if (siteCfg && siteCfg.enabled === true) return true;
        if (globalCfg.listMode === 'whitelist') return inSiteList(host);
        return !inSiteList(host);
    }

    function mergeConfig(host) {
        const now = Date.now();
        if (configCache && configCache._host === host && (now - configCacheTime) < CONFIG_CACHE_TTL) {
            return configCache;
        }
        const g = getGlobalConfig();
        const s = getSiteConfig(host);
        const result = {
            url: s && typeof s.url === 'string' ? s.url : g.url,
            theme: s && (s.theme === 1 || s.theme === 2) ? s.theme : g.theme,
            opacity: s && typeof s.opacity === 'number' ? clamp(s.opacity, 0.1, 1) : g.opacity,
            mode: s && typeof s.mode === 'string' ? s.mode : g.mode,
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
        configCache = result;
        configCacheTime = now;
        return result;
    }

    function getEffectiveOverlayValues() {
        const cfg = mergeConfig(getHost());
        return {
            blur: _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur,
            alpha: _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha
        };
    }

    function isDataImageUrl(url) { return typeof url === 'string' && /^data:image\//i.test(url.trim()); }

    function injectCSPMeta() {
        try {
            if (cachedCspMeta && document.contains(cachedCspMeta)) return;
            cachedCspMeta = document.getElementById(CSP_META_ID);
            if (cachedCspMeta) return;
            document.querySelectorAll('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="content-security-policy"]').forEach(m => { try { m.remove(); } catch (e) {} });
            const meta = document.createElement('meta');
            meta.id = CSP_META_ID;
            meta.setAttribute('http-equiv', 'Content-Security-Policy');
            meta.setAttribute('content', "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob: 'unsafe-inline'; style-src * 'unsafe-inline' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
            (document.head || document.documentElement).appendChild(meta);
            cachedCspMeta = meta;
        } catch (e) {}
    }

    function getBackgroundCSS(cfg) {
        let bgSize = 'cover', bgRepeat = 'no-repeat';
        const darkMask = clamp(1 - cfg.opacity, 0, 0.9);
        if (cfg.mode === 'contain') bgSize = 'contain';
        else if (cfg.mode === 'auto') bgSize = 'auto';
        else if (cfg.mode === '100% 100%') bgSize = '100% 100%';
        else if (cfg.mode === 'repeat') { bgSize = 'auto'; bgRepeat = 'repeat'; }

        const remoteBgCss = !isDataImageUrl(cfg.url) ? `
html::before { content:""!important; position:fixed!important; inset:0!important; z-index:-2147483647!important; pointer-events:none!important; background-image:linear-gradient(rgba(0,0,0,${darkMask}),rgba(0,0,0,${darkMask})),url("${cfg.url}")!important; background-repeat:no-repeat,${bgRepeat}!important; background-position:center!important; background-size:100% 100%,${bgSize}!important; opacity:1!important; filter:blur(${cfg.blur}px)!important; transform:translateZ(0)!important; }
` : `html::before { content:""!important; position:fixed!important; inset:0!important; z-index:-2147483647!important; pointer-events:none!important; background:transparent!important; opacity:0!important; }`;

        return `html,body{background:transparent!important;background-color:transparent!important;background-image:none!important;} ${remoteBgCss} body::before{content:""!important;position:fixed!important;inset:0!important;z-index:-2147483646!important;pointer-events:none!important;background:transparent!important;} *:not(img):not(svg):not(video):not(canvas){background-color:transparent!important;} :root{--color-canvas-default:transparent!important;--color-canvas-subtle:transparent!important;--color-canvas-inset:transparent!important;--color-page-header-bg:transparent!important;--color-header-bg:rgba(0,0,0,0.18)!important;} #${IMG_LAYER_ID}{position:fixed!important;inset:0!important;z-index:-2147483647!important;pointer-events:none!important;overflow:hidden!important;background:rgba(0,0,0,${darkMask})!important;} #${IMG_LAYER_ID} img{width:100%!important;height:100%!important;display:block!important;object-fit:${cfg.mode==='contain'?'contain':cfg.mode==='100% 100%'?'fill':cfg.mode==='auto'?'none':'cover'}!important;object-position:center!important;opacity:1!important;filter:brightness(${cfg.opacity}) blur(${cfg.blur}px)!important;transform:translateZ(0)!important;}`;
    }

    function getThemeCSS(theme) {
        if (theme === 1) return `input,div,h1,h2,h3,h4,h5,h6,p,li,span,label,strong,em{color:#ddd!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#fff!important;}`;
        return `input,div,h1,h2,h3,h4,h5,h6,p,li,span,label,strong,em{color:#222!important;} a:not([style]){color:#98DD98!important;} textarea,pre,code{color:#000!important;}`;
    }

    function getNativeBlurCSS(blurAmount) {
        if (blurAmount <= 0) return '';
        return `.modal,.dialog,.popup,.dropdown,.menu,.popover,.tooltip,[role="dialog"],[role="menu"],[role="tooltip"],.layer,.fancybox,.swal-modal,.ant-modal,.el-dialog,.el-popper,.notification,.Toastify__toast-container,.position-fixed,.z-50{backdrop-filter:blur(${blurAmount}px)!important;-webkit-backdrop-filter:blur(${blurAmount}px)!important;}`;
    }

    function buildCSS(cfg) { return getBackgroundCSS(cfg) + getThemeCSS(cfg.theme); }

    function applyNativeBlur(blurAmount) {
        const old = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID);
        if (old) {
            if (blurAmount <= 0) { old.remove(); cachedNativeBlurStyle = null; return; }
        }
        if (blurAmount > 0) {
            let s = old;
            if (!s || !document.contains(s)) {
                s = document.createElement('style');
                s.id = NATIVE_BLUR_STYLE_ID;
                (document.head || document.documentElement).appendChild(s);
            }
            s.textContent = getNativeBlurCSS(blurAmount);
            cachedNativeBlurStyle = s;
        }
    }

    function ensureStyleNode() {
        if (cachedStyleNode && document.contains(cachedStyleNode)) return cachedStyleNode;
        let s = document.getElementById(STYLE_ID);
        if (!s) {
            s = document.createElement('style');
            s.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(s);
        }
        cachedStyleNode = s;
        return s;
    }

    function removeStyle() {
        const s = cachedStyleNode || document.getElementById(STYLE_ID);
        if (s) { s.remove(); cachedStyleNode = null; }
        const nb = cachedNativeBlurStyle || document.getElementById(NATIVE_BLUR_STYLE_ID);
        if (nb) { nb.remove(); cachedNativeBlurStyle = null; }
    }

    function ensureImgLayer() {
        if (cachedImgLayer && document.contains(cachedImgLayer)) return cachedImgLayer;
        let l = document.getElementById(IMG_LAYER_ID);
        if (!l) {
            l = document.createElement('div');
            l.id = IMG_LAYER_ID;
            const img = document.createElement('img');
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            l.appendChild(img);
            document.documentElement.appendChild(l);
        }
        cachedImgLayer = l;
        return l;
    }

    function removeImgLayer() {
        const l = cachedImgLayer || document.getElementById(IMG_LAYER_ID);
        if (l) { l.remove(); cachedImgLayer = null; }
    }

    function applyImgLayer(cfg) {
        if (!isDataImageUrl(cfg.url)) { removeImgLayer(); return; }
        const l = ensureImgLayer();
        const img = l.querySelector('img');
        if (img && img.src !== cfg.url) {
            img.src = cfg.url;
        }
    }

    function applyStyle() {
        const host = getHost();
        const cfg = mergeConfig(host);
        if (!cfg.enabled) { removeStyle(); removeImgLayer(); return; }
        injectCSPMeta();
        const s = ensureStyleNode();
        s.textContent = buildCSS(cfg);
        applyImgLayer(cfg);
        applyNativeBlur(cfg.nativeElementBlur);
    }

    function applyAgain() {
        configCache = null;
        applyStyle();
        requestOverlayApply();
        setTimeout(applyStyle, 100);
        setTimeout(applyStyle, 500);
    }

    function setGlobal(key, value) {
        configCache = null;
        setValue(key, value);
        applyAgain();
    }

    function updateCurrentSiteConfig(patch) {
        const host = getHost();
        configCache = null;
        setSiteConfig(host, Object.assign({}, getSiteConfig(host) || {}, patch));
        applyAgain();
    }

    function clearCurrentSiteConfig() {
        configCache = null;
        removeSiteConfig(getHost());
        applyAgain();
    }

    function toggleCurrentSiteInList() {
        const host = getHost();
        const topDomain = getTopDomain(host);
        let list = getList();
        const exists = list.some(item => hostMatch(item, topDomain));
        if (exists) {
            list = list.filter(item => !hostMatch(item, topDomain));
            setList(list);
            alert('已从站点列表移除顶级域名：' + topDomain + '\n（包括所有子域名）');
        } else {
            list.push(topDomain);
            setList(list);
            alert('已加入站点列表顶级域名：' + topDomain + '\n（包括所有子域名）');
        }
        applyAgain();
    }

    /* ========== 弹层增强 ========== */

    const overlayKeywordCache = new WeakMap();

    function isOverlayVisible(el, style) {
        if (!el || !style) return false;
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (parseFloat(style.opacity || '1') <= 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 2 && rect.height > 2;
    }

    function getZIndex(style) {
        const z = parseInt(style.zIndex || '0', 10);
        return Number.isFinite(z) ? z : 0;
    }

    function hasOverlayKeyword(el) {
        if (overlayKeywordCache.has(el)) return overlayKeywordCache.get(el);
        const txt = `${(el.className || '').toString().toLowerCase()} ${(el.id || '').toString().toLowerCase()}`;
        const result = /overlay|backdrop|mask|modal|drawer|popup|dialog|sheet|menu|popover|sidebar|side-nav|side-panel|nav-panel|offcanvas|slide-panel|flyout|panel/.test(txt);
        overlayKeywordCache.set(el, result);
        return result;
    }

    function hasOverlayBg(style) {
        const bg = style.backgroundColor || '';
        return bg.includes('rgb') || (style.backdropFilter && style.backdropFilter !== 'none') || (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none');
    }

    function htmlBodyLocked() {
        if (!document.body) return false;
        const hs = getComputedStyle(document.documentElement);
        const bs = getComputedStyle(document.body);
        const hc = (document.documentElement.className || '').toString().toLowerCase();
        const bc = (document.body.className || '').toString().toLowerCase();
        const lockKeywords = ['modal-open', 'drawer-open', 'overflow-hidden', 'no-scroll', 'popup-open', 'dialog-open'];
        return lockKeywords.some(k => hc.includes(k) || bc.includes(k)) || hs.overflow === 'hidden' || hs.overflowY === 'hidden' || bs.overflow === 'hidden' || bs.overflowY === 'hidden';
    }

    function isLightBg(bg) {
        if (!bg || !bg.includes('rgb')) return false;
        const nums = bg.match(/\d+(\.\d+)?/g);
        return nums && nums.length >= 3 && (parseFloat(nums[0]) + parseFloat(nums[1]) + parseFloat(nums[2])) / 3 > 180;
    }

    function findLikelyOverlays() {
        if (!document.body) return [];
        const floatEl = document.getElementById(FLOAT_ID);
        const overlays = [];
        const vw = window.innerWidth, vh = window.innerHeight;
        
        const allElements = document.body.getElementsByTagName('*');
        
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            
            if (floatEl && (el === floatEl || floatEl.contains(el))) continue;
            
            const style = getComputedStyle(el);
            
            if (!isOverlayVisible(el, style)) continue;
            
            const pos = style.position;
            if (pos !== 'fixed' && pos !== 'absolute') continue;
            
            const rect = el.getBoundingClientRect();
            const z = getZIndex(style);
            const keyword = hasOverlayKeyword(el);
            
            if (keyword) {
                const overlayBg = hasOverlayBg(style);
                const isFixed = pos === 'fixed';
                const isAbsolute = pos === 'absolute';
                const highZ = z >= 40;
                const mediumZ = z >= 10;
                const bigEnough = rect.width >= vw * 0.65 && rect.height >= vh * 0.65;
                const mediumLarge = rect.width >= vw * 0.35 && rect.height >= vh * 0.35;
                const smallLarge = rect.width >= vw * 0.2 && rect.height >= vh * 0.5;

                if ((isFixed && highZ && bigEnough && (overlayBg || keyword)) ||
                    ((isFixed || isAbsolute) && highZ && mediumLarge) ||
                    (isFixed && highZ && rect.width >= vw * 0.5 && rect.height >= vh * 0.5)) {
                    overlays.push(el);
                    continue;
                }

                if ((isFixed || isAbsolute) && mediumZ && smallLarge) {
                    overlays.push(el);
                    continue;
                }
            }
            
            if (z >= 40) {
                const overlayBg = hasOverlayBg(style);
                if (overlayBg && rect.width >= vw * 0.35 && rect.height >= vh * 0.35) {
                    overlays.push(el);
                }
            }
        }
        
        return dedupeOverlays(overlays);
    }

    function dedupeOverlays(arr) {
        const out = [];
        for (const el of arr) {
            let skip = false;
            for (const kept of out) { if (kept.contains(el)) { skip = true; break; } }
            if (!skip) out.push(el);
        }
        return out;
    }

    function applyOverlayEnhance() {
        if (!document.body) return;
        const cfg = mergeConfig(getHost());
        if (!cfg.enabled) return;
        const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur;
        const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha;
        if (blur <= 0 && alpha <= 0) return;

        const overlays = findLikelyOverlays();
        if (!overlays.length && !htmlBodyLocked()) return;

        overlays.forEach(el => {
            const prev = overlayLastApplied.get(el) || {};
            if (prev.blur === blur && prev.alpha === alpha) return;

            const style = getComputedStyle(el);
            const useWhite = isLightBg(style.backgroundColor || '');

            el.style.setProperty('backdrop-filter', `blur(${blur}px)`, 'important');
            el.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important');
            el.style.setProperty('background-color', useWhite ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`, 'important');
            if (style.pointerEvents === 'none') el.style.setProperty('pointer-events', 'auto', 'important');

            overlayMarked.add(el);
            overlayLastApplied.set(el, { blur, alpha });
        });
    }

    function forceOverlayApply() {
        if (!document.body) return;
        const cfg = mergeConfig(getHost());
        if (!cfg.enabled) return;
        const blur = _liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur;
        const alpha = _liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha;

        findLikelyOverlays().forEach(el => {
            const style = getComputedStyle(el);
            const useWhite = isLightBg(style.backgroundColor || '');
            el.style.setProperty('backdrop-filter', `blur(${blur}px)`, 'important');
            el.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important');
            el.style.setProperty('background-color', useWhite ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`, 'important');
            if (style.pointerEvents === 'none') el.style.setProperty('pointer-events', 'auto', 'important');
            overlayMarked.add(el);
            overlayLastApplied.set(el, { blur, alpha });
        });
    }

    function requestOverlayApply() {
        if (overlayRafPending) return;
        overlayRafPending = true;
        requestAnimationFrame(() => {
            overlayRafPending = false;
            applyOverlayEnhance();
        });
    }

    function startOverlayScanTimer() {
        if (overlayScanTimer) clearInterval(overlayScanTimer);
        overlayScanTimer = setInterval(() => {
            const cfg = mergeConfig(getHost());
            if (cfg.enabled && ((_liveOverlayBlur !== null ? _liveOverlayBlur : cfg.overlayBlur) > 0 || (_liveOverlayAlpha !== null ? _liveOverlayAlpha : cfg.overlayAlpha) > 0)) {
                applyOverlayEnhance();
            }
        }, 2500);
    }

    /* ========== 图片压缩功能 ========== */

    function compressImage(dataUrl, targetSize, callback) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
                const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            let quality = 0.9;
            let result = dataUrl;
            let attempts = 0;
            const maxAttempts = 10;
            
            const tryCompress = () => {
                result = canvas.toDataURL('image/jpeg', quality);
                attempts++;
                
                if (result.length > targetSize && quality > 0.2 && attempts < maxAttempts) {
                    quality -= 0.05;
                    setTimeout(tryCompress, 10);
                } else {
                    if (result.length > targetSize * 1.2 && width > 800 && height > 800) {
                        const scaleRatio = Math.sqrt(targetSize / result.length) * 0.9;
                        width = Math.round(width * scaleRatio);
                        height = Math.round(height * scaleRatio);
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        quality = Math.max(0.6, quality);
                        result = canvas.toDataURL('image/jpeg', quality);
                    }
                    callback(result);
                }
            };
            
            tryCompress();
        };
        img.onerror = function() {
            callback(null);
        };
        img.src = dataUrl;
    }

    function pickLocalImage(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) return;
            
            if (file.size > MAX_FILE_SIZE) {
                alert('图片过大（最大支持 15MB），请选择更小的图片');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function () {
                const result = String(reader.result || '');
                if (!result.startsWith('data:image/')) { alert('读取失败'); return; }
                
                const originalSize = result.length;
                
                if (originalSize > COMPRESS_THRESHOLD) {
                    compressImage(result, COMPRESS_TARGET, (compressed) => {
                        if (compressed) {
                            const originalKB = Math.round(originalSize / 1024);
                            const compressedKB = Math.round(compressed.length / 1024);
                            const reduction = Math.round((1 - compressed.length / originalSize) * 100);
                            console.log(`[浏览器背景] 图片压缩: ${originalKB}KB → ${compressedKB}KB (减少 ${reduction}%)`);
                            alert(`图片已自动压缩：${originalKB}KB → ${compressedKB}KB (减少 ${reduction}%)`);
                            callback(compressed, file);
                        } else {
                            alert('图片压缩失败，将使用原图');
                            callback(result, file);
                        }
                    });
                } else {
                    callback(result, file);
                }
            };
            reader.onerror = function () { alert('读取图片失败'); };
            reader.readAsDataURL(file);
        });
        input.click();
    }

    /* ========== 压缩包导入导出 (使用 fflate) ========== */

    function loadFFlate() {
        return new Promise((resolve, reject) => {
            if (window.fflate) { resolve(window.fflate); return; }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
            script.onload = () => {
                if (window.fflate) resolve(window.fflate);
                else reject(new Error('fflate 加载后未找到全局对象'));
            };
            script.onerror = () => reject(new Error('加载 fflate 库失败'));
            document.head.appendChild(script);
        });
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
        return Math.abs(hash).toString(36);
    }

    function guessExt(url) {
        if (isDataImageUrl(url)) { const m = url.match(/^data:image\/(\w+)/); return m ? m[1].replace('jpeg', 'jpg') : 'png'; }
        const m = url.match(/\.(\w{3,4})(?:\?|$)/);
        return m ? m[1].toLowerCase() : 'jpg';
    }

    function dataUrlToUint8Array(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        return array;
    }

    function uint8ArrayToDataUrl(uint8, mime) {
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        return 'data:' + mime + ';base64,' + btoa(binary);
    }

    function fetchImageAsUint8(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url, responseType: 'arraybuffer', timeout: 30000,
                onload(res) {
                    if (res.status >= 200 && res.status < 300) {
                        const mime = (res.responseHeaders.match(/content-type:\s*([^\r\n;]+)/i) || [])[1] || 'image/jpeg';
                        resolve({ data: new Uint8Array(res.response), mime });
                    } else reject(new Error('HTTP ' + res.status));
                },
                onerror() { reject(new Error('网络错误')); },
                ontimeout() { reject(new Error('超时')); }
            });
        });
    }

    async function exportAllConfigZip() {
        try {
            const fflate = await loadFFlate();

            const siteConfigMap = JSON.parse(JSON.stringify(getSiteConfigMap()));
            const globalUrl = getValue('Vie背景图片', DEFAULTS.url);

            let globalImageFile = null;
            if (isDataImageUrl(globalUrl)) {
                globalImageFile = 'global_local.' + guessExt(globalUrl);
            } else if (globalUrl) {
                try {
                    const { data } = await fetchImageAsUint8(globalUrl);
                    globalImageFile = 'global_remote.' + guessExt(globalUrl);
                    siteConfigMap['__global_remote_image__'] = { _tempImageData: data, _tempFileName: globalImageFile };
                } catch (e) { console.warn('下载全局图片失败:', e); }
            }

            // 构建 fflate 文件对象
            const zipFiles = {};

            // 全局本地图
            if (isDataImageUrl(globalUrl)) {
                zipFiles['images/' + globalImageFile] = dataUrlToUint8Array(globalUrl);
            }

            // 全局远端图（临时存储在 siteConfigMap 里）
            if (siteConfigMap['__global_remote_image__']) {
                const tmp = siteConfigMap['__global_remote_image__'];
                zipFiles['images/' + tmp._tempFileName] = tmp._tempImageData;
                delete siteConfigMap['__global_remote_image__'];
            }

            // 站点图片
            for (const host in siteConfigMap) {
                const url = siteConfigMap[host].url;
                if (!url) continue;
                let filename = null;
                if (isDataImageUrl(url)) {
                    filename = 'site_' + simpleHash(host) + '_local.' + guessExt(url);
                    zipFiles['images/' + filename] = dataUrlToUint8Array(url);
                } else {
                    try {
                        const { data } = await fetchImageAsUint8(url);
                        filename = 'site_' + simpleHash(host) + '_remote.' + guessExt(url);
                        zipFiles['images/' + filename] = data;
                    } catch (e) { console.warn('下载站点图片失败:', e); }
                }
                siteConfigMap[host].url = filename || '';
            }

            const configData = {
                version: '2.2',
                exportedAt: new Date().toISOString(),
                global: {
                    url: globalImageFile || '',
                    theme: getValue('Vie背景', DEFAULTS.theme),
                    opacity: getValue('Vie背景透明度', DEFAULTS.opacity),
                    mode: getValue('Vie背景模式', DEFAULTS.mode),
                    blur: getValue('Vie背景模糊', DEFAULTS.blur),
                    enabled: getValue('Vie背景启用', DEFAULTS.enabled),
                    floatVisible: getValue('Vie背景悬浮按钮显示', DEFAULTS.floatVisible),
                    listMode: getValue('Vie背景列表模式', DEFAULTS.listMode),
                    floatPos: safeJSONParse(getValue('Vie背景悬浮位置', JSON.stringify(DEFAULTS.floatPos)), DEFAULTS.floatPos),
                    nativeElementBlur: getValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur),
                    overlayBlur: getValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur),
                    overlayAlpha: getValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha)
                },
                siteList: getList(),
                siteConfigMap
            };

            zipFiles['config.json'] = new TextEncoder().encode(JSON.stringify(configData, null, 2));

            // 使用 fflate 同步压缩（数据量通常不大）
            const zipped = fflate.zipSync(zipFiles, { level: 6 });

            const blob = new Blob([zipped], { type: 'application/zip' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = '浏览器背景_' + new Date().toISOString().slice(0, 10) + '.zip';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { a.remove(); } catch (e) {} URL.revokeObjectURL(blobUrl); }, 1000);
        } catch (e) {
            alert('导出失败：' + e.message);
            console.error(e);
        }
    }

    async function importAllConfigZip() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip,application/zip';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const fflate = await loadFFlate();

                const arrayBuffer = await file.arrayBuffer();
                const unzipped = fflate.unzipSync(new Uint8Array(arrayBuffer));

                // unzipped 是 { "path": Uint8Array } 的对象

                // 找到 config.json
                if (!unzipped['config.json']) throw new Error('压缩包内缺少 config.json');
                const configData = JSON.parse(new TextDecoder().decode(unzipped['config.json']));

                // 收集图片文件，转为 data URL
                const imgData = {};
                const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

                for (const path in unzipped) {
                    if (path.startsWith('images/') && path !== 'images/') {
                        const fname = path.replace('images/', '');
                        const ext = fname.split('.').pop().toLowerCase();
                        imgData[fname] = uint8ArrayToDataUrl(unzipped[path], mimeMap[ext] || 'image/jpeg');
                    }
                }

                const gUrl = configData.global.url;
                if (gUrl && imgData[gUrl]) configData.global.url = imgData[gUrl];
                else if (!gUrl) configData.global.url = DEFAULTS.url;

                if (configData.siteConfigMap) {
                    for (const host in configData.siteConfigMap) {
                        const sUrl = configData.siteConfigMap[host].url;
                        if (sUrl && imgData[sUrl]) configData.siteConfigMap[host].url = imgData[sUrl];
                        else if (!sUrl) delete configData.siteConfigMap[host].url;
                    }
                }

                applyImportedConfig(configData);
                alert('压缩包导入成功：' + file.name);
            } catch (e) {
                alert('导入失败：' + e.message);
                console.error(e);
            }
        });
        input.click();
    }

    function applyImportedConfig(data) {
        configCache = null;
        if (data.global) {
            if ('url' in data.global) setValue('Vie背景图片', data.global.url);
            if ('theme' in data.global) setValue('Vie背景', data.global.theme);
            if ('opacity' in data.global) setValue('Vie背景透明度', data.global.opacity);
            if ('mode' in data.global) setValue('Vie背景模式', data.global.mode);
            if ('blur' in data.global) setValue('Vie背景模糊', data.global.blur);
            if ('enabled' in data.global) setValue('Vie背景启用', data.global.enabled);
            if ('floatVisible' in data.global) setValue('Vie背景悬浮按钮显示', data.global.floatVisible);
            if ('listMode' in data.global) setValue('Vie背景列表模式', data.global.listMode);
            if ('floatPos' in data.global) setValue('Vie背景悬浮位置', JSON.stringify(data.global.floatPos));
            if ('nativeElementBlur' in data.global) setValue('Vie背景原生弹层模糊', data.global.nativeElementBlur);
            if ('overlayBlur' in data.global) setValue('Vie背景动态弹层模糊', data.global.overlayBlur);
            if ('overlayAlpha' in data.global) setValue('Vie背景动态弹层透明度', data.global.overlayAlpha);
        }
        if (Array.isArray(data.siteList)) setList(data.siteList);
        if (data.siteConfigMap && typeof data.siteConfigMap === 'object') setSiteConfigMap(data.siteConfigMap);
        _liveOverlayBlur = null;
        _liveOverlayAlpha = null;
        applyAgain();
    }

    function registerMenus() {
        const host = getHost();
        const topDomain = getTopDomain(host);
        const globalCfg = getGlobalConfig();
        const siteCfg = getSiteConfig(host);
        const currentCfg = mergeConfig(host);
        const inList = inSiteList(host);

        GM_registerMenuCommand(globalCfg.enabled ? '关闭背景功能（全局）' : '开启背景功能（全局）', () => {
            setGlobal('Vie背景启用', !getGlobalConfig().enabled);
            alert('全局背景功能已切换');
        });

        GM_registerMenuCommand(globalCfg.listMode === 'blacklist' ? '切换为白名单模式' : '切换为黑名单模式', () => {
            const next = getGlobalConfig().listMode === 'blacklist' ? 'whitelist' : 'blacklist';
            setGlobal('Vie背景列表模式', next);
            alert('已切换为：' + next);
        });

        GM_registerMenuCommand((inList ? '当前站点：移出站点列表' : '当前站点：加入站点列表'), () => {
            toggleCurrentSiteInList();
        });

        GM_registerMenuCommand('查看/编辑站点列表（顶级域名）', () => {
            const list = getList();
            const text = prompt('每行一个顶级域名（如jd.com）：\n注意：禁用顶级域名将禁用所有子域名', list.join('\n'));
            if (text === null) return;
            setList(text.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
            alert('站点列表已保存（顶级域名模式）');
            applyAgain();
        });

        GM_registerMenuCommand('亮色调（全局）', () => { setGlobal('Vie背景', 1); });
        GM_registerMenuCommand('暗色调（全局）', () => { setGlobal('Vie背景', 2); });

        GM_registerMenuCommand(currentCfg.floatVisible ? '隐藏悬浮按钮' : '显示悬浮按钮', () => {
            setGlobal('Vie背景悬浮按钮显示', !getGlobalConfig().floatVisible);
            const el = document.getElementById(FLOAT_ID);
            if (el) el.style.display = !getGlobalConfig().floatVisible ? 'block' : 'none';
        });

        GM_registerMenuCommand(siteCfg && siteCfg.enabled === false ? '当前站点：单独启用' : '当前站点：单独禁用', () => {
            updateCurrentSiteConfig({ enabled: (getSiteConfig(host) || {}).enabled === false ? true : false });
        });

        GM_registerMenuCommand('当前站点：清空全部单独配置', () => {
            if (!confirm('确定清空当前站点的所有单独配置？\n' + host)) return;
            clearCurrentSiteConfig();
        });

        GM_registerMenuCommand('显示当前顶级域名：' + topDomain, () => {
            alert('当前顶级域名：' + topDomain + '\n\n在站点列表中添加此域名将禁用所有子域名');
        });
    }

    function ensureFloatStyle() {
        if (cachedFloatStyleNode && document.contains(cachedFloatStyleNode)) return;
        if (document.getElementById(FLOAT_STYLE_ID)) {
            cachedFloatStyleNode = document.getElementById(FLOAT_STYLE_ID);
            return;
        }

        const style = document.createElement('style');
        style.id = FLOAT_STYLE_ID;
        style.textContent = `
#${FLOAT_ID}{
    position:fixed!important;
    z-index:2147483647!important;
    font-family:sans-serif!important;
    user-select:none!important;
    -webkit-user-select:none!important;
    -webkit-touch-callout:none!important;
}
#${FLOAT_ID} *{
    box-sizing:border-box!important;
}
#vie-bg-toggle-v73{
    width:46px!important;
    height:46px!important;
    line-height:46px!important;
    text-align:center!important;
    border-radius:50%!important;
    background:rgba(0,0,0,0.68)!important;
    color:#fff!important;
    font-size:14px!important;
    cursor:pointer!important;
    box-shadow:0 2px 12px rgba(0,0,0,0.35)!important;
}
#vie-bg-panel-v73{
    margin-top:8px!important;
    width:260px!important;
    padding:12px!important;
    border-radius:12px!important;
    background:rgba(0,0,0,0.85)!important;
    color:#f0f0f0!important;
    font-size:12px!important;
    box-shadow:0 4px 20px rgba(0,0,0,0.5)!important;
    display:none;
    max-height:70vh!important;
    overflow-y:auto!important;
    overflow-x:hidden!important;
}
#vie-bg-panel-v73 .row{
    margin-bottom:8px!important;
}
#vie-bg-panel-v73 .lab{
    font-size:11px!important;
    margin-bottom:3px!important;
    color:#ccc!important;
}
#vie-bg-panel-v73 input[type="range"]{
    width:100%!important;
    -webkit-appearance:none!important;
    appearance:none!important;
    height:6px!important;
    background:linear-gradient(to right,#98DD98 var(--range-progress,0%),rgba(255,255,255,0.18) var(--range-progress,0%))!important;
    outline:none!important;
    opacity:0.9!important;
    border-radius:3px!important;
}
#vie-bg-panel-v73 input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance:none!important;
    width:16px!important;
    height:16px!important;
    background:#7DD87D!important;
    cursor:pointer!important;
    border-radius:50%!important;
    border:2px solid #222!important;
    box-shadow:0 1px 3px rgba(0,0,0,0.5)!important;
}
#vie-bg-panel-v73 input[type="range"]::-moz-range-thumb {
    width:16px!important;
    height:16px!important;
    background:#7DD87D!important;
    cursor:pointer!important;
    border-radius:50%!important;
    border:2px solid #222!important;
}
#vie-bg-panel-v73 input[type="text"] {
    width:100%!important;
    padding:4px 6px!important;
    border-radius:4px!important;
    background:rgba(255,255,255,0.12)!important;
    color:#f0f0f0!important;
    font-size:11px!important;
    border:1px solid rgba(255,255,255,0.15)!important;
    outline:none!important;
}
#vie-bg-panel-v73 input[type="text"]:focus {
    border-color:rgba(155,219,155,0.5)!important;
}
#vie-bg-panel-v73 .btns{
    display:flex!important;
    gap:6px!important;
    margin-top:8px!important;
}
#vie-bg-panel-v73 button{
    flex:1!important;
    border:0!important;
    border-radius:6px!important;
    padding:7px 8px!important;
    background:rgba(255,255,255,0.15)!important;
    color:#f0f0f0!important;
    cursor:pointer!important;
    font-size:11px!important;
    transition:background 0.2s!important;
    white-space:nowrap!important;
}
#vie-bg-panel-v73 button:hover{
    background:rgba(255,255,255,0.25)!important;
}
#vie-bg-panel-v73 .btn-primary button {
    background:rgba(155,219,155,0.35)!important;
    font-weight:bold!important;
}
#vie-bg-panel-v73 .btn-primary button:hover {
    background:rgba(155,219,155,0.55)!important;
}
#vie-bg-panel-v73 .btn-danger button {
    background:rgba(255,100,100,0.35)!important;
}
#vie-bg-panel-v73 .btn-danger button:hover {
    background:rgba(255,100,100,0.55)!important;
}
#vie-bg-panel-v73 .btn-export button {
    background:rgba(100,180,255,0.35)!important;
}
#vie-bg-panel-v73 .btn-export button:hover {
    background:rgba(100,180,255,0.55)!important;
}
#vie-bg-panel-v73 .section-divider {
    border:none!important;
    border-top:1px solid rgba(255,255,255,0.1)!important;
    margin:10px 0 8px!important;
}
#vie-bg-panel-v73 .section-title {
    font-size:10px!important;
    color:rgba(255,255,255,0.45)!important;
    margin-bottom:6px!important;
    text-transform:uppercase!important;
    letter-spacing:1px!important;
}
#vie-bg-panel-v73::-webkit-scrollbar {
    width:4px!important;
}
#vie-bg-panel-v73::-webkit-scrollbar-track {
    background:transparent!important;
}
#vie-bg-panel-v73::-webkit-scrollbar-thumb {
    background:rgba(255,255,255,0.2)!important;
    border-radius:2px!important;
}
`;
        document.documentElement.appendChild(style);
        cachedFloatStyleNode = style;
    }

    function createFloat() {
        const host = getHost();
        const cfg = mergeConfig(host);
        if (!cfg.floatVisible) { floatShouldExist = false; return; }

        const existing = cachedFloatNode || document.getElementById(FLOAT_ID);
        if (existing && document.documentElement.contains(existing)) {
            floatShouldExist = true;
            cachedFloatNode = existing;
            fixFloatPosition(existing);
            return;
        }
        if (existing) { try { existing.remove(); } catch (e) {} }

        ensureFloatStyle();
        const pos = safePos(cfg.floatPos);

        const box = document.createElement('div');
        box.id = FLOAT_ID;
        box.style.right = pos.right + 'px';
        box.style.bottom = pos.bottom + 'px';

        box.innerHTML = `
<div id="vie-bg-toggle-v73" title="点击展开/收起；拖动移动">𖣐</div>
<div id="vie-bg-panel-v73">
    <div class="row">
        <div class="lab">全局背景图 URL</div>
        <input id="vie-v73-global-image-url" type="text" placeholder="输入网络图片链接">
    </div>
    <div class="row">
        <div class="lab">当前站点背景图 URL</div>
        <input id="vie-v73-site-image-url" type="text" placeholder="留空则使用全局图片">
    </div>
    <div class="row">
        <div class="lab">透明度 <span id="vie-v73-opacity-txt">${Math.round(cfg.opacity * 100)}%</span></div>
        <input id="vie-v73-opacity" type="range" min="10" max="100" step="1" value="${Math.round(cfg.opacity * 100)}">
    </div>
    <div class="row">
        <div class="lab">背景模糊 <span id="vie-v73-blur-txt">${cfg.blur}px</span></div>
        <input id="vie-v73-blur" type="range" min="0" max="50" step="1" value="${cfg.blur}">
    </div>
    <div class="row">
        <div class="lab">弹层模糊 <span id="vie-v73-native-blur-txt">${cfg.nativeElementBlur}px</span></div>
        <input id="vie-v73-native-blur" type="range" min="0" max="20" step="1" value="${cfg.nativeElementBlur}">
    </div>
    <hr class="section-divider">
    <div class="section-title">自动弹层增强</div>
    <div class="row">
        <div class="lab">自动弹层模糊 <span id="vie-v73-overlay-blur-txt">${cfg.overlayBlur}px</span></div>
        <input id="vie-v73-overlay-blur" type="range" min="0" max="40" step="1" value="${cfg.overlayBlur}">
    </div>
    <div class="row">
        <div class="lab">自动弹层透明 <span id="vie-v73-overlay-alpha-txt">${cfg.overlayAlpha.toFixed(2)}</span></div>
        <input id="vie-v73-overlay-alpha" type="range" min="0" max="80" step="1" value="${Math.round(cfg.overlayAlpha * 100)}">
    </div>
    <div class="btns btn-primary">
        <button id="vie-v73-save-global">💾 存全局</button>
        <button id="vie-v73-save-site">💾 存本站</button>
    </div>
    <div class="btns">
        <button id="vie-v73-pick-global">🖼️ 全局本地图</button>
        <button id="vie-v73-pick-site">🖼️ 本站本地图</button>
    </div>
    <div class="btns" style="margin-top:6px!important;">
        <button id="vie-v73-advanced">⚙️ 高级设置 ▼</button>
    </div>
    <div id="vie-v73-advanced-panel" style="display:none;">
        <hr class="section-divider">
        <div class="section-title">导入导出</div>
        <div class="btns btn-export">
            <button id="vie-v73-export">📦 导出压缩包</button>
            <button id="vie-v73-import">📂 导入压缩包</button>
        </div>
        <hr class="section-divider">
        <div class="section-title">重置设置</div>
        <div class="btns btn-danger">
            <button id="vie-v73-reset-global">🔄 全局默认</button>
            <button id="vie-v73-reset-site">🗑️ 清本站</button>
        </div>
    </div>
</div>
`;

        document.documentElement.appendChild(box);
        cachedFloatNode = box;
        floatShouldExist = true;

        const toggle = box.querySelector('#vie-bg-toggle-v73');
        const panelEl = box.querySelector('#vie-bg-panel-v73');
        const advancedBtn = box.querySelector('#vie-v73-advanced');
        const advancedPanel = box.querySelector('#vie-v73-advanced-panel');

        const globalImageUrlInput = box.querySelector('#vie-v73-global-image-url');
        const siteImageUrlInput = box.querySelector('#vie-v73-site-image-url');
        const opacityEl = box.querySelector('#vie-v73-opacity');
        const blurEl = box.querySelector('#vie-v73-blur');
        const nativeBlurEl = box.querySelector('#vie-v73-native-blur');
        const overlayBlurEl = box.querySelector('#vie-v73-overlay-blur');
        const overlayAlphaEl = box.querySelector('#vie-v73-overlay-alpha');

        const opacityTxt = box.querySelector('#vie-v73-opacity-txt');
        const blurTxt = box.querySelector('#vie-v73-blur-txt');
        const nativeBlurTxt = box.querySelector('#vie-v73-native-blur-txt');
        const overlayBlurTxt = box.querySelector('#vie-v73-overlay-blur-txt');
        const overlayAlphaTxt = box.querySelector('#vie-v73-overlay-alpha-txt');

        const currentGlobalUrl = getGlobalConfig().url;
        const currentSiteUrl = (getSiteConfig(host) || {}).url || '';
        globalImageUrlInput.value = isDataImageUrl(currentGlobalUrl) ? '' : currentGlobalUrl;
        siteImageUrlInput.value = isDataImageUrl(currentSiteUrl) ? '' : currentSiteUrl;

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (toggle.__dragging) return;
            panelEl.style.display = panelEl.style.display === 'none' ? 'block' : 'none';
            advancedPanel.style.display = 'none';
            advancedBtn.textContent = '⚙️ 高级设置 ▼';
        });

        function updateSliderTrack(el) {
            const min = Number(el.min) || 0, max = Number(el.max) || 100;
            el.style.setProperty('--range-progress', ((Number(el.value) - min) / (max - min)) * 100 + '%');
        }

        function getLiveValues() {
            return {
                globalImageUrl: globalImageUrlInput.value.trim(),
                siteImageUrl: siteImageUrlInput.value.trim(),
                opacity: clamp(Number(opacityEl.value) / 100, 0.1, 1),
                blur: clamp(Number(blurEl.value), 0, 50),
                nativeElementBlur: clamp(Number(nativeBlurEl.value), 0, 20),
                overlayBlur: clamp(Number(overlayBlurEl.value), 0, 40),
                overlayAlpha: clamp(Number(overlayAlphaEl.value) / 100, 0, 0.8)
            };
        }

        function updateLiveText() {
            const v = getLiveValues();
            opacityTxt.textContent = Math.round(v.opacity * 100) + '%';
            blurTxt.textContent = v.blur + 'px';
            nativeBlurTxt.textContent = v.nativeElementBlur + 'px';
            overlayBlurTxt.textContent = v.overlayBlur + 'px';
            overlayAlphaTxt.textContent = v.overlayAlpha.toFixed(2);
        }

        let livePreviewRaf = null;
        function applyLivePreview() {
            if (livePreviewRaf) return;
            livePreviewRaf = requestAnimationFrame(() => {
                livePreviewRaf = null;
                const h = getHost();
                const merged = mergeConfig(h);
                const live = getLiveValues();
                const previewCfg = Object.assign({}, merged);
                if (live.siteImageUrl) previewCfg.url = live.siteImageUrl;
                else if (live.globalImageUrl) previewCfg.url = live.globalImageUrl;
                previewCfg.opacity = live.opacity;
                previewCfg.blur = live.blur;
                previewCfg.nativeElementBlur = live.nativeElementBlur;
                previewCfg.enabled = true;
                injectCSPMeta();
                ensureStyleNode().textContent = buildCSS(previewCfg);
                if (isDataImageUrl(previewCfg.url)) applyImgLayer(previewCfg); else removeImgLayer();
                applyNativeBlur(live.nativeElementBlur);
                _liveOverlayBlur = live.overlayBlur;
                _liveOverlayAlpha = live.overlayAlpha;
                forceOverlayApply();
            });
        }

        [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack);

        [globalImageUrlInput, siteImageUrlInput, opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(el => {
            el.addEventListener('input', () => {
                if (el.type === 'range') updateSliderTrack(el);
                updateLiveText();
                applyLivePreview();
            });
        });

        advancedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = advancedPanel.style.display === 'none';
            advancedPanel.style.display = isHidden ? 'block' : 'none';
            panelEl.style.display = 'block';
            advancedBtn.textContent = isHidden ? '⚙️ 高级设置 ▲' : '⚙️ 高级设置 ▼';
        });

        box.querySelector('#vie-v73-save-global').addEventListener('click', (e) => {
            e.stopPropagation();
            const v = getLiveValues();
            configCache = null;
            if (v.globalImageUrl) setValue('Vie背景图片', v.globalImageUrl);
            setValue('Vie背景透明度', v.opacity);
            setValue('Vie背景模糊', v.blur);
            setValue('Vie背景原生弹层模糊', v.nativeElementBlur);
            setValue('Vie背景动态弹层模糊', v.overlayBlur);
            setValue('Vie背景动态弹层透明度', v.overlayAlpha);
            _liveOverlayBlur = null; _liveOverlayAlpha = null;
            applyAgain();
            alert('已保存到全局配置');
        });

        box.querySelector('#vie-v73-save-site').addEventListener('click', (e) => {
            e.stopPropagation();
            const v = getLiveValues();
            const h = getHost();
            configCache = null;
            setSiteConfig(h, Object.assign({}, getSiteConfig(h) || {}, {
                url: v.siteImageUrl || undefined, opacity: v.opacity, blur: v.blur,
                nativeElementBlur: v.nativeElementBlur, overlayBlur: v.overlayBlur, overlayAlpha: v.overlayAlpha
            }));
            _liveOverlayBlur = null; _liveOverlayAlpha = null;
            applyAgain();
            alert('已保存到当前站点：' + h);
        });

        box.querySelector('#vie-v73-pick-global').addEventListener('click', (e) => {
            e.stopPropagation();
            pickLocalImage((b64, file) => {
                setValue('Vie背景图片', b64);
                configCache = null;
                globalImageUrlInput.value = '';
                siteImageUrlInput.value = '';
                applyStyle();
                applyImgLayer(mergeConfig(getHost()));
                setTimeout(() => { applyStyle(); applyImgLayer(mergeConfig(getHost())); }, 50);
                setTimeout(() => { applyStyle(); applyImgLayer(mergeConfig(getHost())); }, 200);
                setTimeout(() => applyStyle(), 500);
                alert('已设置全局本地图片：' + file.name);
            });
        });

        box.querySelector('#vie-v73-pick-site').addEventListener('click', (e) => {
            e.stopPropagation();
            pickLocalImage((b64, file) => {
                const h = getHost();
                const siteCfg = Object.assign({}, getSiteConfig(h) || {}, { url: b64 });
                setSiteConfig(h, siteCfg);
                configCache = null;
                siteImageUrlInput.value = '';
                globalImageUrlInput.value = '';
                applyStyle();
                applyImgLayer(mergeConfig(getHost()));
                setTimeout(() => { applyStyle(); applyImgLayer(mergeConfig(getHost())); }, 50);
                setTimeout(() => { applyStyle(); applyImgLayer(mergeConfig(getHost())); }, 200);
                setTimeout(() => applyStyle(), 500);
                alert('已设置本站本地图片：' + file.name);
            });
        });

        box.querySelector('#vie-v73-export').addEventListener('click', (e) => { e.stopPropagation(); exportAllConfigZip(); });
        box.querySelector('#vie-v73-import').addEventListener('click', (e) => { e.stopPropagation(); importAllConfigZip(); });

        box.querySelector('#vie-v73-reset-global').addEventListener('click', (e) => {
            e.stopPropagation();
            configCache = null;
            setValue('Vie背景图片', DEFAULTS.url);
            setValue('Vie背景透明度', DEFAULTS.opacity);
            setValue('Vie背景模糊', DEFAULTS.blur);
            setValue('Vie背景原生弹层模糊', DEFAULTS.nativeElementBlur);
            setValue('Vie背景动态弹层模糊', DEFAULTS.overlayBlur);
            setValue('Vie背景动态弹层透明度', DEFAULTS.overlayAlpha);
            globalImageUrlInput.value = DEFAULTS.url;
            opacityEl.value = Math.round(DEFAULTS.opacity * 100);
            blurEl.value = DEFAULTS.blur;
            nativeBlurEl.value = DEFAULTS.nativeElementBlur;
            overlayBlurEl.value = DEFAULTS.overlayBlur;
            overlayAlphaEl.value = Math.round(DEFAULTS.overlayAlpha * 100);
            siteImageUrlInput.value = '';
            [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack);
            updateLiveText();
            _liveOverlayBlur = null; _liveOverlayAlpha = null;
            applyAgain();
            alert('已恢复全局默认值');
            advancedPanel.style.display = 'none';
            advancedBtn.textContent = '⚙️ 高级设置 ▼';
        });

        box.querySelector('#vie-v73-reset-site').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm('⚠️ 警告：此操作将清空当前站点的所有个性化配置，且无法撤销。\n\n确定继续？')) return;
            configCache = null;
            removeSiteConfig(getHost());
            siteImageUrlInput.value = '';
            const refreshed = mergeConfig(getHost());
            opacityEl.value = Math.round(refreshed.opacity * 100);
            blurEl.value = refreshed.blur;
            nativeBlurEl.value = refreshed.nativeElementBlur;
            overlayBlurEl.value = refreshed.overlayBlur;
            overlayAlphaEl.value = Math.round(refreshed.overlayAlpha * 100);
            [opacityEl, blurEl, nativeBlurEl, overlayBlurEl, overlayAlphaEl].forEach(updateSliderTrack);
            updateLiveText();
            _liveOverlayBlur = null; _liveOverlayAlpha = null;
            applyAgain();
            alert('已清除当前站点配置');
            advancedPanel.style.display = 'none';
            advancedBtn.textContent = '⚙️ 高级设置 ▼';
        });

        document.addEventListener('click', (e) => {
            if (!box.contains(e.target)) {
                panelEl.style.display = 'none';
                advancedPanel.style.display = 'none';
                advancedBtn.textContent = '⚙️ 高级设置 ▼';
            }
        });

        (function enableDrag() {
            let startX = 0, startY = 0, startRight = 0, startBottom = 0;
            function onDown(e) {
                const evt = e.touches ? e.touches[0] : e;
                const rect = box.getBoundingClientRect();
                startX = evt.clientX; startY = evt.clientY;
                startRight = window.innerWidth - rect.right;
                startBottom = window.innerHeight - rect.bottom;
                toggle.__dragging = false;
                document.addEventListener('mousemove', onMove, true);
                document.addEventListener('mouseup', onUp, true);
                document.addEventListener('touchmove', onMove, { passive: false, capture: true });
                document.addEventListener('touchend', onUp, true);
            }
            function onMove(e) {
                const evt = e.touches ? e.touches[0] : e;
                const dx = evt.clientX - startX, dy = evt.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) toggle.__dragging = true;
                box.style.right = clamp(startRight - dx, 0, Math.max(0, window.innerWidth - 46)) + 'px';
                box.style.bottom = clamp(startBottom - dy, 0, Math.max(0, window.innerHeight - 46)) + 'px';
                if (e.cancelable) e.preventDefault();
            }
            function onUp(e) {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup', onUp, true);
                document.removeEventListener('touchmove', onMove, true);
                document.removeEventListener('touchend', onUp, true);
                const saved = safePos({ right: parseInt(box.style.right, 10), bottom: parseInt(box.style.bottom, 10) });
                box.style.right = saved.right + 'px';
                box.style.bottom = saved.bottom + 'px';
                setValue('Vie背景悬浮位置', JSON.stringify(saved));
                if (e.type === 'touchend' && !toggle.__dragging) panelEl.style.display = panelEl.style.display === 'none' ? 'block' : 'none';
                setTimeout(() => { toggle.__dragging = false; }, 80);
            }
            toggle.addEventListener('mousedown', onDown);
            toggle.addEventListener('touchstart', onDown, { passive: true });
        })();

        window.addEventListener('resize', () => { fixFloatPosition(box); });
    }

    function fixFloatPosition(box) {
        if (!box) return;
        const currentRight = parseInt(box.style.right, 10);
        const currentBottom = parseInt(box.style.bottom, 10);
        const fixed = safePos({ right: currentRight, bottom: currentBottom });
        if (currentRight !== fixed.right || currentBottom !== fixed.bottom) {
            box.style.right = fixed.right + 'px';
            box.style.bottom = fixed.bottom + 'px';
        }
    }

    function ensureFloatAlive() {
        if (!floatShouldExist) return;
        const cfg = mergeConfig(getHost());
        if (!cfg.floatVisible) return;
        const el = cachedFloatNode || document.getElementById(FLOAT_ID);
        if (!el || !document.documentElement.contains(el)) {
            cachedFloatNode = null;
            createFloat();
        } else {
            cachedFloatNode = el;
            fixFloatPosition(el);
        }
    }

    /* ===== 初始化 ===== */

    floatShouldExist = getGlobalConfig().floatVisible;
    injectCSPMeta();
    applyStyle();

    let mutationDebounceTimer = null;
    const observer = new MutationObserver(() => {
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(() => {
            const cfg = mergeConfig(getHost());
            if (!document.getElementById(CSP_META_ID)) { cachedCspMeta = null; injectCSPMeta(); }
            if (cfg.enabled && !document.getElementById(STYLE_ID)) { cachedStyleNode = null; applyStyle(); }
            if (cfg.enabled && isDataImageUrl(cfg.url) && !document.getElementById(IMG_LAYER_ID)) { cachedImgLayer = null; applyImgLayer(cfg); }
            const ov = getEffectiveOverlayValues();
            if (cfg.enabled && (ov.blur > 0 || ov.alpha > 0)) requestOverlayApply();
            ensureFloatAlive();
            if (!document.getElementById(FLOAT_STYLE_ID)) { cachedFloatStyleNode = null; ensureFloatStyle(); }
        }, 150);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'open', 'aria-hidden']
    });

    document.addEventListener('DOMContentLoaded', () => {
        injectCSPMeta();
        applyAgain();
        createFloat();
        startOverlayScanTimer();
        document.addEventListener('click', () => { setTimeout(requestOverlayApply, 100); }, true);
        document.addEventListener('keydown', () => { setTimeout(requestOverlayApply, 150); }, true);
    });

    window.addEventListener('load', () => {
        injectCSPMeta();
        applyAgain();
        createFloat();
        setTimeout(() => { ensureFloatAlive(); applyStyle(); }, 500);
        setTimeout(() => { ensureFloatAlive(); applyStyle(); }, 2000);
    });

    registerMenus();
})();