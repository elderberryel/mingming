// ==UserScript==
// @name         返回顶部和底部
// @version      2.0
// @description  在网页生成返回顶部和底部按钮
// @author       Johnny Li (Adapted for Via)
// @license      MIT
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @namespace    https://www.chlung.com/
// ==/UserScript==

(function () {
    'use strict';

    // 默认图标（在线地址，可随意替换）
    const DEFAULT_TOP_ICON = 'https://i.postimg.cc/tC9hvj5W/shang.png';
    const DEFAULT_BOTTOM_ICON = 'https://i.postimg.cc/j5v1WXq3/xia.png';

    // 存储 key（本地图片仍然按域名独立保存，更合理）
    const STORAGE_TOP_KEY = 'customTopIcon';
    const STORAGE_BOTTOM_KEY = 'customBottomIcon';
    // 全局悬浮球显隐状态 key（跨所有网站）
    const GLOBAL_BTN_VISIBLE_KEY = 'TB_SettingsBtnVisible_Global';

    let topBtnElement = null;
    let bottomBtnElement = null;
    let settingsPanelElement = null;
    let settingsBtnElement = null;

    // --------------------------------------------------------------
    // 1. 基础 UI 构建（包含原顶底按钮 + 设置按钮 + 设置面板）
    // --------------------------------------------------------------
    function buildHTML() {
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
        document.body.insertAdjacentHTML('beforeend', mainHtml);

        topBtnElement = document.querySelector("#goTopBottom .toplink");
        bottomBtnElement = document.querySelector("#goTopBottom .bottomlink");
        settingsBtnElement = document.getElementById("tbSettingsBtn");
        settingsPanelElement = document.getElementById("tbSettingsPanel");
    }

    // --------------------------------------------------------------
    // 2. 样式（齿轮按钮 + 面板样式）- 黑色背景白色文字
    // --------------------------------------------------------------
    function addStyles() {
        const fadeSpeed = 100;
        const style = `
            /* 原有顶底按钮样式 */
            #goTopBottom {
                position: fixed;
                bottom: 30px;
                right: 399px;
                z-index: 999999;
            }
            #goTopBottom .gotop {
                opacity: 0;
                visibility: hidden;
                transition: opacity ${fadeSpeed}ms ease-in-out;
                margin-bottom: 0px;
            }
            #goTopBottom .gotop .toplink {
                display: block;
                width: 50px;
                height: 50px;
                cursor: pointer;
                overflow: hidden;
                text-indent: -999em;
                background-repeat: no-repeat;
                background-position: center;
                background-size: 50px 50px;
            }
            #goTopBottom .gobottom {
                opacity: 0;
                visibility: hidden;
                transition: opacity ${fadeSpeed}ms ease-in-out;
            }
            #goTopBottom .gobottom .bottomlink {
                display: block;
                width: 50px;
                height: 50px;
                cursor: pointer;
                overflow: hidden;
                text-indent: -999em;
                background-repeat: no-repeat;
                background-position: center;
                background-size: 50px 50px;
            }

            /* 设置齿轮按钮 */
            .tb-settings-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 40px;
                height: 40px;
                background: #2c3e50;
                color: white;
                border-radius: 50%;
                text-align: center;
                line-height: 40px;
                font-size: 22px;
                cursor: pointer;
                z-index: 1000000;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                user-select: none;
                transition: transform 0.2s;
            }
            .tb-settings-btn:hover {
                transform: rotate(30deg);
                background: #000000;
            }

            /* 设置面板 - 黑色背景，白色文字 */
            .tb-settings-panel {
                position: fixed;
                bottom: 90px;
                right: 30px;
                width: 220px;
                background: #1e1e1e;
                color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                padding: 12px;
                z-index: 1000001;
                font-family: system-ui, sans-serif;
                text-align: center;
                border: 1px solid #444;
            }
            .tb-settings-panel .tb-panel-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #ffffff;
            }
            .tb-settings-panel button {
                display: block;
                width: 100%;
                margin: 6px 0;
                padding: 8px;
                border: none;
                background: #3a3a3a;
                color: #ffffff;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .tb-settings-panel button:hover {
                background: #555;
            }
            #closePanelBtn {
                background: #c0392b;
                color: white;
            }
            #closePanelBtn:hover {
                background: #e74c3c;
            }
        `;
        GM_addStyle(style);
    }

    // --------------------------------------------------------------
    // 3. 图标更新函数（应用到 DOM）
    // --------------------------------------------------------------
    function updateTopIcon(iconDataUrl) {
        if (!topBtnElement) return;
        if (iconDataUrl && iconDataUrl !== 'null') {
            topBtnElement.style.backgroundImage = `url(${iconDataUrl})`;
        } else {
            topBtnElement.style.backgroundImage = `url(${DEFAULT_TOP_ICON})`;
        }
    }

    function updateBottomIcon(iconDataUrl) {
        if (!bottomBtnElement) return;
        if (iconDataUrl && iconDataUrl !== 'null') {
            bottomBtnElement.style.backgroundImage = `url(${iconDataUrl})`;
        } else {
            bottomBtnElement.style.backgroundImage = `url(${DEFAULT_BOTTOM_ICON})`;
        }
    }

    // 从 localStorage 加载保存的图标（按域名独立）
    function loadSavedIcons() {
        const savedTop = localStorage.getItem(STORAGE_TOP_KEY);
        const savedBottom = localStorage.getItem(STORAGE_BOTTOM_KEY);
        if (savedTop && savedTop !== 'null') {
            updateTopIcon(savedTop);
        } else {
            updateTopIcon(null);
        }
        if (savedBottom && savedBottom !== 'null') {
            updateBottomIcon(savedBottom);
        } else {
            updateBottomIcon(null);
        }
    }

    // 保存图标到 localStorage（按域名独立）
    function saveTopIcon(dataUrl) {
        if (dataUrl) {
            localStorage.setItem(STORAGE_TOP_KEY, dataUrl);
        } else {
            localStorage.setItem(STORAGE_TOP_KEY, 'null');
        }
        updateTopIcon(dataUrl);
    }

    function saveBottomIcon(dataUrl) {
        if (dataUrl) {
            localStorage.setItem(STORAGE_BOTTOM_KEY, dataUrl);
        } else {
            localStorage.setItem(STORAGE_BOTTOM_KEY, 'null');
        }
        updateBottomIcon(dataUrl);
    }

    // --------------------------------------------------------------
    // 4. 选择本地图片 (FileReader)
    // --------------------------------------------------------------
    function selectLocalImage(callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function (e) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = function (ev) {
                    callback(ev.target.result);
                    document.body.removeChild(input);
                };
                reader.onerror = function () {
                    alert('读取图片失败');
                    document.body.removeChild(input);
                };
                reader.readAsDataURL(file);
            } else {
                document.body.removeChild(input);
            }
        });
        input.click();
    }

    // --------------------------------------------------------------
    // 5. 滚动逻辑
    // --------------------------------------------------------------
    function initScrollBehavior() {
        const upperLimit = 100;
        const fadeSpeed = 100;
        const topDiv = document.querySelector("#goTopBottom .gotop");
        const bottomDiv = document.querySelector("#goTopBottom .gobottom");

        const getScrollTop = () => document.documentElement.scrollTop || document.body.scrollTop;

        const checkPosition = () => {
            const st = getScrollTop();
            const winH = window.innerHeight;
            const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

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

        window.addEventListener('scroll', checkPosition);
        checkPosition();

        document.querySelector("#goTopBottom .toplink").addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.querySelector("#goTopBottom .bottomlink").addEventListener('click', (e) => {
            e.preventDefault();
            const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            window.scrollTo({ top: docH, behavior: 'smooth' });
        });
    }

    // --------------------------------------------------------------
    // 6. 设置面板交互
    // --------------------------------------------------------------
    function initSettingsPanel() {
        if (!settingsBtnElement || !settingsPanelElement) return;

        settingsBtnElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = settingsPanelElement.style.display === 'block';
            settingsPanelElement.style.display = isVisible ? 'none' : 'block';
        });

        const panelButtons = settingsPanelElement.querySelectorAll('button');
        panelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => e.stopPropagation());
        });

        document.getElementById('setTopIconBtn').addEventListener('click', () => {
            selectLocalImage((dataUrl) => {
                saveTopIcon(dataUrl);
                alert('顶部图标已更新');
            });
        });

        document.getElementById('setBottomIconBtn').addEventListener('click', () => {
            selectLocalImage((dataUrl) => {
                saveBottomIcon(dataUrl);
                alert('底部图标已更新');
            });
        });

        document.getElementById('resetTopIconBtn').addEventListener('click', () => {
            saveTopIcon(null);
            alert('顶部图标已恢复默认');
        });

        document.getElementById('resetBottomIconBtn').addEventListener('click', () => {
            saveBottomIcon(null);
            alert('底部图标已恢复默认');
        });

        document.getElementById('closePanelBtn').addEventListener('click', () => {
            settingsPanelElement.style.display = 'none';
        });

        document.addEventListener('click', function (e) {
            if (settingsPanelElement.style.display === 'block' &&
                !settingsPanelElement.contains(e.target) &&
                e.target !== settingsBtnElement) {
                settingsPanelElement.style.display = 'none';
            }
        });
    }

    // --------------------------------------------------------------
    // 7. 悬浮球显隐控制（全局生效，使用 GM_getValue/GM_setValue）
    // --------------------------------------------------------------
    function getBtnVisibleState() {
        if (typeof GM_getValue !== 'undefined') {
            // 默认可见（true）
            return GM_getValue(GLOBAL_BTN_VISIBLE_KEY, true);
        } else {
            // 降级方案：使用 localStorage 的固定 key，但无法跨域，仅作为 fallback
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
        // 可选：显示toast提示
        if (window.via && typeof window.via.toast === 'function') {
            window.via.toast(newState ? '悬浮球已显示（全局）' : '悬浮球已隐藏（全局）');
        } else {
            alert(newState ? '悬浮球已显示（所有网站生效）' : '悬浮球已隐藏（所有网站生效）');
        }
    }

    // 注册油猴菜单命令
    function registerMenu() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('⚙️ 显示/隐藏悬浮球（全局）', toggleSettingsBtnVisibility);
        }
    }

    // --------------------------------------------------------------
    // 8. 初始化
    // --------------------------------------------------------------
    function init() {
        buildHTML();
        addStyles();
        loadSavedIcons();
        initScrollBehavior();
        initSettingsPanel();
        // 应用全局悬浮球显隐状态
        setBtnVisibleState(getBtnVisibleState());
        registerMenu();
    }

    init();
})();