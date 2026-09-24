// ==UserScript==
// @name         返回顶部和底部
// @version      3.0
// @description  在网页生成返回顶部和底部按钮
// @author       明明
// @license      MIT
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @exclude      *://*.chatgpt.com/*
// @grant        GM_getValue
// @namespace    https://github.com/elderberryel/mingming
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/elderberryel/mingming/main/%E8%BF%94%E5%9B%9E%E9%A1%B6%E9%83%A8%E5%92%8C%E5%BA%95%E9%83%A8.user.js
// @downloadURL  https://raw.githubusercontent.com/elderberryel/mingming/main/%E8%BF%94%E5%9B%9E%E9%A1%B6%E9%83%A8%E5%92%8C%E5%BA%95%E9%83%A8.user.js
// ==/UserScript==
(function () {
    'use strict';
    let tbTTPolicy = null;
    try {
        if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
            tbTTPolicy = window.trustedTypes.createPolicy('tb-icon-policy', {
                createHTML: s => s
            });
        }
    } catch (e) { /* 站点 CSP 不允许该名字时静默降级 */ }
    function setHTML(el, html) {
        if (!el) return;
        html = String(html == null ? '' : html);
        if (tbTTPolicy) {
            try { el.innerHTML = tbTTPolicy.createHTML(html); return; } catch (e) {}
        }
        try { el.innerHTML = html; }
        catch (e) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                while (el.firstChild) el.removeChild(el.firstChild);
                while (doc.body.firstChild) el.appendChild(doc.body.firstChild);
            } catch (e2) { console.warn('[TB] setHTML fallback failed:', e2); }
        }
    }    
    // ===== 立体玻璃箭头 SVG =====
    const svgTop = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><defs><radialGradient id="tg" cx="32%" cy="24%" r="82%"><stop offset="0%" stop-color="#f2fff2"/><stop offset="38%" stop-color="#bce9bc"/><stop offset="72%" stop-color="#98DD98"/><stop offset="100%" stop-color="#3b823b"/></radialGradient><radialGradient id="th" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M25 13.5 C26.8 13.5 28.2 14.6 29.6 16.4 L39.4 28 C40.9 29.9 40.1 31.5 37.8 31.5 L31 31.5 L31 38.5 C31 40.7 29.7 41.5 27.8 41.5 L22.2 41.5 C20.3 41.5 19 40.7 19 38.5 L19 31.5 L12.2 31.5 C9.9 31.5 9.1 29.9 10.6 28 L20.4 16.4 C21.8 14.6 23.2 13.5 25 13.5 Z" fill="#2c5c2c" opacity="0.4"/><path d="M25 12 C26.8 12 28.2 13.1 29.6 14.9 L39.4 26.5 C40.9 28.4 40.1 30 37.8 30 L31 30 L31 37 C31 39.2 29.7 40 27.8 40 L22.2 40 C20.3 40 19 39.2 19 37 L19 30 L12.2 30 C9.9 30 9.1 28.4 10.6 26.5 L20.4 14.9 C21.8 13.1 23.2 12 25 12 Z" fill="url(#tg)" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.9" stroke-linejoin="round"/><ellipse cx="19.5" cy="19" rx="5.5" ry="3.2" fill="url(#th)" opacity="0.8" transform="rotate(-38 19.5 19)"/></svg>`;
    const svgBottom = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><defs><radialGradient id="bg" cx="32%" cy="76%" r="82%"><stop offset="0%" stop-color="#f2fff2"/><stop offset="38%" stop-color="#bce9bc"/><stop offset="72%" stop-color="#98DD98"/><stop offset="100%" stop-color="#3b823b"/></radialGradient><radialGradient id="bh" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="M25 36.5 C23.2 36.5 21.8 35.4 20.4 33.6 L10.6 22 C9.1 20.1 9.9 18.5 12.2 18.5 L19 18.5 L19 11.5 C19 9.3 20.3 8.5 22.2 8.5 L27.8 8.5 C29.7 8.5 31 9.3 31 11.5 L31 18.5 L37.8 18.5 C40.1 18.5 40.9 20.1 39.4 22 L29.6 33.6 C28.2 35.4 26.8 36.5 25 36.5 Z" fill="#2c5c2c" opacity="0.4"/><path d="M25 38 C23.2 38 21.8 36.9 20.4 35.1 L10.6 23.5 C9.1 21.6 9.9 20 12.2 20 L19 20 L19 13 C19 10.8 20.3 10 22.2 10 L27.8 10 C29.7 10 31 10.8 31 13 L31 20 L37.8 20 C40.1 20 40.9 21.6 39.4 23.5 L29.6 35.1 C28.2 36.9 26.8 38 25 38 Z" fill="url(#bg)" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.9" stroke-linejoin="round"/><ellipse cx="19.5" cy="31" rx="5.5" ry="3.2" fill="url(#bh)" opacity="0.8" transform="rotate(38 19.5 31)"/></svg>`;
    function svgToDataUri(svg) {
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    const DEFAULT_TOP_ICON = svgToDataUri(svgTop);
    const DEFAULT_BOTTOM_ICON = svgToDataUri(svgBottom);

    // 存储 key
    const STORAGE_TOP_KEY = 'TB_customTopIcon_Global';
    const STORAGE_BOTTOM_KEY = 'TB_customBottomIcon_Global';
    const GLOBAL_BTN_VISIBLE_KEY = 'TB_SettingsBtnVisible_Global';

    let topBtnElement = null;
    let bottomBtnElement = null;
    let settingsPanelElement = null;
    let settingsBtnElement = null;
    let goTopBottomElement = null;

    function getRoot() {
        return document.body || document.documentElement;
    }

    function buildHTML() {
        ['goTopBottom', 'tbSettingsBtn', 'tbSettingsPanel'].forEach(id => {
            let el;
            while ((el = document.getElementById(id))) {
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        });

        const mainHtml = `
            <div id="goTopBottom">
                <div class="gotop"><a class="toplink" title="返回顶部">Top</a></div>
                <div class="gobottom"><a class="bottomlink" title="返回底部">Bottom</a></div>
            </div>
            <div id="tbSettingsBtn" class="tb-settings-btn" title="自定义图标">⚙️</div>
            <div id="tbSettingsPanel" class="tb-settings-panel" style="display:none;">
                <div class="tb-panel-title">图标设置</div>
                <button id="setTopIconBtn">📷 设置顶部图标</button>
                <button id="setBottomIconBtn">📷 设置底部图标</button>
                <button id="resetTopIconBtn">↺ 恢复顶部默认</button>
                <button id="resetBottomIconBtn">↺ 恢复底部默认</button>
                <button id="closePanelBtn">关闭</button>
            </div>
        `;
        const tmp = document.createElement('div');
        setHTML(tmp, mainHtml);
        const root = getRoot();
        while (tmp.firstChild) {
            root.appendChild(tmp.firstChild);
        }

        topBtnElement = document.querySelector("#goTopBottom .toplink");
        bottomBtnElement = document.querySelector("#goTopBottom .bottomlink");
        settingsBtnElement = document.getElementById("tbSettingsBtn");
        settingsPanelElement = document.getElementById("tbSettingsPanel");
        goTopBottomElement = document.getElementById("goTopBottom");
    }

    function addStyles() {
        const fadeSpeed = 100;

        const glassCircle = `
            border-radius: 50%;
            box-sizing: border-box;
            background-color: rgba(152, 221, 152, 0.22);
            border: 1px solid rgba(152, 221, 152, 0.55);
            backdrop-filter: blur(10px) saturate(160%);
            -webkit-backdrop-filter: blur(10px) saturate(160%);
            box-shadow:
                inset 1.5px -1.5px 1px -1px rgba(255, 255, 255, 0.9),
                inset -1.5px 1.5px 1px -1px rgba(255, 255, 255, 0.85),
                inset 0 0 4px rgba(60, 120, 60, 0.25),
                0 8px 24px rgba(60, 120, 60, 0.22);
            transition: transform 0.15s ease, background-color 0.2s ease;
        `;

        const glassBtn = `
            box-sizing: border-box;
            background-color: rgba(152, 221, 152, 0.22);
            border: 1px solid rgba(152, 221, 152, 0.55);
            backdrop-filter: blur(10px) saturate(160%);
            -webkit-backdrop-filter: blur(10px) saturate(160%);
            box-shadow:
                inset 1.5px -1.5px 1px -1px rgba(255, 255, 255, 0.9),
                inset -1.5px 1.5px 1px -1px rgba(255, 255, 255, 0.85),
                inset 0 0 4px rgba(60, 120, 60, 0.25),
                0 8px 24px rgba(60, 120, 60, 0.22);
        `;

        const glassPanel = `
            box-sizing: border-box;
            background-color: rgba(152, 221, 152, 0.22);
            border: 1px solid rgba(152, 221, 152, 0.55);
            backdrop-filter: blur(14px) saturate(160%);
            -webkit-backdrop-filter: blur(14px) saturate(160%);
            box-shadow:
                inset 1.5px -1.5px 1px -1px rgba(255, 255, 255, 0.9),
                inset -1.5px 1.5px 1px -1px rgba(255, 255, 255, 0.85),
                inset 0 0 6px rgba(60, 120, 60, 0.25),
                0 12px 32px rgba(60, 120, 60, 0.28);
        `;

        const glassPill = `
            box-sizing: border-box;
            background-color: rgba(255, 255, 255, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(6px) saturate(160%);
            -webkit-backdrop-filter: blur(6px) saturate(160%);
            box-shadow:
                inset 1px -1px 1px -1px rgba(255, 255, 255, 0.9),
                inset -1px 1px 1px -1px rgba(255, 255, 255, 0.8),
                0 4px 10px rgba(60, 120, 60, 0.15);
        `;

        const style = `
            #goTopBottom {
                position: fixed !important;
                bottom: 30px;
                right: 399px;
                z-index: 2147483647 !important;
                transform: none !important;
                filter: none !important;
                pointer-events: auto !important;
            }
            #goTopBottom .gotop {
                opacity: 0;
                visibility: hidden;
                transition: opacity ${fadeSpeed}ms ease-in-out;
                margin-bottom: 8px;
            }
            #goTopBottom .gobottom {
                opacity: 0;
                visibility: hidden;
                transition: opacity ${fadeSpeed}ms ease-in-out;
            }
            #goTopBottom .toplink,
            #goTopBottom .bottomlink {
                display: block;
                width: 50px;
                height: 50px;
                cursor: pointer;
                overflow: hidden;
                text-indent: -999em;
                background-repeat: no-repeat;
                background-position: center;
                background-size: 44px 44px;
                ${glassCircle}
            }
            #goTopBottom .toplink:hover,
            #goTopBottom .bottomlink:hover {
                transform: scale(1.08);
                background-color: rgba(152, 221, 152, 0.4);
            }

            #goTopBottom .toplink.tb-custom-icon,
            #goTopBottom .bottomlink.tb-custom-icon {
                background-color: transparent;
                border-color: transparent;
                box-shadow: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                background-size: 50px 50px;
            }
            #goTopBottom .toplink.tb-custom-icon:hover,
            #goTopBottom .bottomlink.tb-custom-icon:hover {
                background-color: transparent;
            }

            .tb-settings-btn {
                position: fixed !important;
                bottom: 30px;
                right: 30px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                color: #0f172a;
                text-align: center;
                line-height: 44px;
                font-size: 22px;
                cursor: pointer;
                z-index: 2147483647 !important;
                user-select: none;
                transform: none !important;
                filter: none !important;
                pointer-events: auto !important;
                transition: transform 0.2s ease, background-color 0.2s ease;
                ${glassBtn}
            }
            .tb-settings-btn:hover {
                transform: rotate(30deg) !important;
                background-color: rgba(152, 221, 152, 0.42);
            }

            .tb-settings-panel {
                position: fixed !important;
                bottom: 90px;
                right: 30px;
                width: 230px;
                color: #0f172a;
                border-radius: 18px;
                padding: 14px;
                z-index: 2147483647 !important;
                font-family: system-ui, sans-serif;
                text-align: center;
                transform: none !important;
                filter: none !important;
                pointer-events: auto !important;
                ${glassPanel}
            }
            .tb-settings-panel .tb-panel-title {
                font-weight: 700;
                margin-bottom: 10px;
                color: #0f172a;
            }
            .tb-settings-panel button {
                display: block;
                width: 100%;
                margin: 8px 0;
                padding: 9px 10px;
                border-radius: 14px;
                color: #0f172a;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s ease, transform 0.15s ease;
                ${glassPill}
            }
            .tb-settings-panel button:hover {
                background-color: rgba(255, 255, 255, 0.55);
                transform: translateY(-1px);
            }
            .tb-settings-panel button:active {
                transform: translateY(0);
                background-color: rgba(255, 255, 255, 0.4);
            }
            #closePanelBtn {
                background-color: rgba(231, 76, 60, 0.22);
                border: 1px solid rgba(231, 76, 60, 0.55);
                color: #7a1c12;
            }
            #closePanelBtn:hover {
                background-color: rgba(231, 76, 60, 0.38);
            }
        `;
        GM_addStyle(style);
    }

    function updateTopIcon(iconDataUrl) {
        if (!topBtnElement) return;
        if (iconDataUrl && iconDataUrl !== 'null') {
            topBtnElement.style.backgroundImage = `url(${iconDataUrl})`;
            topBtnElement.classList.add('tb-custom-icon');
        } else {
            topBtnElement.style.backgroundImage = `url(${DEFAULT_TOP_ICON})`;
            topBtnElement.classList.remove('tb-custom-icon');
        }
    }

    function updateBottomIcon(iconDataUrl) {
        if (!bottomBtnElement) return;
        if (iconDataUrl && iconDataUrl !== 'null') {
            bottomBtnElement.style.backgroundImage = `url(${iconDataUrl})`;
            bottomBtnElement.classList.add('tb-custom-icon');
        } else {
            bottomBtnElement.style.backgroundImage = `url(${DEFAULT_BOTTOM_ICON})`;
            bottomBtnElement.classList.remove('tb-custom-icon');
        }
    }

    function loadSavedIcons() {
        let savedTop, savedBottom;
        if (typeof GM_getValue !== 'undefined') {
            savedTop = GM_getValue(STORAGE_TOP_KEY, null);
            savedBottom = GM_getValue(STORAGE_BOTTOM_KEY, null);
        } else {
            savedTop = localStorage.getItem(STORAGE_TOP_KEY);
            savedBottom = localStorage.getItem(STORAGE_BOTTOM_KEY);
        }
        updateTopIcon(savedTop);
        updateBottomIcon(savedBottom);
    }

    function saveTopIcon(dataUrl) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(STORAGE_TOP_KEY, dataUrl);
        } else {
            localStorage.setItem(STORAGE_TOP_KEY, dataUrl);
        }
        updateTopIcon(dataUrl);
    }

    function saveBottomIcon(dataUrl) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(STORAGE_BOTTOM_KEY, dataUrl);
        } else {
            localStorage.setItem(STORAGE_BOTTOM_KEY, dataUrl);
        }
        updateBottomIcon(dataUrl);
    }

    function selectLocalImage(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        getRoot().appendChild(input);
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = function (ev) {
                    callback(ev.target.result);
                    if (input.parentNode) input.parentNode.removeChild(input);
                };
                reader.onerror = function () {
                    alert('读取图片失败');
                    if (input.parentNode) input.parentNode.removeChild(input);
                };
                reader.readAsDataURL(file);
            } else {
                if (input.parentNode) input.parentNode.removeChild(input);
            }
        });
        input.click();
    }

    let cachedScroller = null;
    let cachedScrollerTime = 0;

    function isScrollableEl(el) {
        if (!el || el.nodeType !== 1) return false;
        try {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const oy = cs.overflowY;
            if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
            return el.scrollHeight > el.clientHeight + 20;
        } catch (_) { return false; }
    }

    function findBestScroller() {
        const now = Date.now();
        if (cachedScroller && now - cachedScrollerTime < 500) {
            const { el, win } = cachedScroller;
            if (win) return cachedScroller;
            if (el && document.contains(el) && isScrollableEl(el)) return cachedScroller;
        }

        const se = document.scrollingElement || document.documentElement;
        let best = null;
        let bestOver = 0;

        const winOver = se.scrollHeight - window.innerHeight;
        if (winOver > 20) {
            best = { el: se, win: true };
            bestOver = winOver;
        }

        let all;
        try {
            all = document.querySelectorAll('div, main, section, article, ul, ol, [role="main"]');
        } catch (_) {
            all = [];
        }
        for (const el of all) {
            if (el === se) continue;
            if (!isScrollableEl(el)) continue;
            const over = el.scrollHeight - el.clientHeight;
            if (over > bestOver) {
                bestOver = over;
                best = { el, win: false };
            }
        }

        cachedScroller = best;
        cachedScrollerTime = now;
        return best;
    }

    function getMetrics() {
        const target = findBestScroller();
        if (!target) {
            const se = document.scrollingElement || document.documentElement;
            return {
                st: se.scrollTop || 0,
                winH: window.innerHeight,
                docH: se.scrollHeight,
                scroller: null
            };
        }
        const { el, win } = target;
        if (win) {
            return {
                st: el.scrollTop || window.pageYOffset || 0,
                winH: window.innerHeight,
                docH: el.scrollHeight,
                scroller: null
            };
        }
        return {
            st: el.scrollTop,
            winH: el.clientHeight,
            docH: el.scrollHeight,
            scroller: el
        };
    }

    function scrollPageTo(where) {
        const target = findBestScroller();
        const se = document.scrollingElement || document.documentElement;

        try {
            if (where === 'top') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const h = Math.max(
                    document.body ? document.body.scrollHeight : 0,
                    se.scrollHeight
                );
                window.scrollTo({ top: h, behavior: 'smooth' });
            }
        } catch (_) {
            if (where === 'top') {
                window.scrollTo(0, 0);
            } else {
                window.scrollTo(0, document.body.scrollHeight);
            }
        }

        if (target && !target.win && target.el) {
            const el = target.el;
            const top = where === 'top' ? 0 : el.scrollHeight;
            try {
                el.scrollTo({ top, behavior: 'smooth' });
            } catch (_) {
                el.scrollTop = top;
            }
        }
    }

    function initScrollBehavior() {
        const upperLimit = 100;
        const fadeSpeed = 100;
        const topDiv = goTopBottomElement.querySelector(".gotop");
        const bottomDiv = goTopBottomElement.querySelector(".gobottom");

        const checkPosition = () => {
            const { st, winH, docH } = getMetrics();

            if (st > upperLimit) {
                topDiv.style.visibility = 'visible';
                topDiv.style.opacity = '1';
            } else {
                topDiv.style.opacity = '0';
                setTimeout(() => {
                    if (topDiv.style.opacity === '0') topDiv.style.visibility = 'hidden';
                }, fadeSpeed);
            }

            if (st + winH < docH - upperLimit) {
                bottomDiv.style.visibility = 'visible';
                bottomDiv.style.opacity = '1';
            } else {
                bottomDiv.style.opacity = '0';
                setTimeout(() => {
                    if (bottomDiv.style.opacity === '0') bottomDiv.style.visibility = 'hidden';
                }, fadeSpeed);
            }
        };

        document.addEventListener('scroll', checkPosition, { capture: true, passive: true });
        window.addEventListener('scroll', checkPosition, { passive: true });
        window.addEventListener('resize', checkPosition);
        setInterval(checkPosition, 1000);
        checkPosition();

        topBtnElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollPageTo('top');
        });

        bottomBtnElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollPageTo('bottom');
        });
    }

    function initSettingsPanel() {
        if (!settingsBtnElement || !settingsPanelElement) return;

        settingsBtnElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = settingsPanelElement.style.display === 'block';
            settingsPanelElement.style.display = isVisible ? 'none' : 'block';
        });

        const btnTop = settingsPanelElement.querySelector('#setTopIconBtn');
        const btnBottom = settingsPanelElement.querySelector('#setBottomIconBtn');
        const btnResetTop = settingsPanelElement.querySelector('#resetTopIconBtn');
        const btnResetBottom = settingsPanelElement.querySelector('#resetBottomIconBtn');
        const btnClose = settingsPanelElement.querySelector('#closePanelBtn');

        btnTop && btnTop.addEventListener('click', (e) => {
            e.stopPropagation();
            selectLocalImage((dataUrl) => {
                saveTopIcon(dataUrl);
                alert('顶部图标已更新');
            });
        });

        btnBottom && btnBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            selectLocalImage((dataUrl) => {
                saveBottomIcon(dataUrl);
                alert('底部图标已更新');
            });
        });

        btnResetTop && btnResetTop.addEventListener('click', (e) => {
            e.stopPropagation();
            saveTopIcon(null);
            alert('顶部图标已恢复默认');
        });

        btnResetBottom && btnResetBottom.addEventListener('click', (e) => {
            e.stopPropagation();
            saveBottomIcon(null);
            alert('底部图标已恢复默认');
        });

        btnClose && btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanelElement.style.display = 'none';
        });

        settingsPanelElement.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => e.stopPropagation());
        });

        document.addEventListener('click', function (e) {
            if (settingsPanelElement.style.display === 'block' &&
                !settingsPanelElement.contains(e.target) &&
                e.target !== settingsBtnElement) {
                settingsPanelElement.style.display = 'none';
            }
        });
    }

    function getBtnVisibleState() {
        if (typeof GM_getValue !== 'undefined') {
            return GM_getValue(GLOBAL_BTN_VISIBLE_KEY, true);
        } else {
            const val = localStorage.getItem(GLOBAL_BTN_VISIBLE_KEY);
            return val === null ? true : val === 'true';
        }
    }

    function setBtnVisibleState(visible) {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(GLOBAL_BTN_VISIBLE_KEY, visible);
        } else {
            localStorage.setItem(GLOBAL_BTN_VISIBLE_KEY, String(visible));
        }
        if (settingsBtnElement) {
            settingsBtnElement.style.display = visible ? '' : 'none';
        }
    }

    function toggleSettingsBtnVisibility() {
        const newState = !getBtnVisibleState();
        setBtnVisibleState(newState);
        if (window.via && typeof window.via.toast === 'function') {
            window.via.toast(newState ? '悬浮球已显示' : '悬浮球已隐藏');
        } else {
            alert(newState ? '悬浮球已显示' : '悬浮球已隐藏');
        }
    }

    function registerMenu() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('⚙️ 显示/隐藏悬浮球（全局）', toggleSettingsBtnVisibility);
        }
    }

    let mbGuardObserver = null;
    let mountTimer = null;

    function ensureMounted() {
        const root = getRoot();
        if (!root) return;
        [goTopBottomElement, settingsBtnElement, settingsPanelElement].forEach(el => {
            if (el && !root.contains(el)) {
                root.appendChild(el);
            }
        });
    }

    function startGuard() {
        try {
            mbGuardObserver = new MutationObserver(() => {
                if (mountTimer) return;
                mountTimer = setTimeout(() => {
                    mountTimer = null;
                    ensureMounted();
                }, 200);
            });
            mbGuardObserver.observe(document.documentElement, { childList: true, subtree: true });
        } catch (_) {}
        window.addEventListener('load', ensureMounted);
    }
    function init() {
        buildHTML();
        addStyles();
        loadSavedIcons();
        initScrollBehavior();
        initSettingsPanel();
        setBtnVisibleState(getBtnVisibleState());
        registerMenu();
        startGuard();
    }

    init();
})();
