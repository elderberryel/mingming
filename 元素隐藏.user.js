// ==UserScript==
// @name         元素隐藏
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  隐藏页面中的特定元素
// @author       MiMo
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const hideSelectors = [
        // ===== 原有选择器 =====
        '#components-layout-demo-top > div.fixedSecondaryHeader:nth-child(2) > span > div > div',
        '#mainContent > span > div.ant-row.notfont:last-child > div.ant-col-23:last-child',
        '.notfont.ant-row',
        '[data-v-736ced16].ant-col-1 .anticon-setting',
        '[data-v-736ced16].ant-col-23[style*="text-align: right"]',
        '[data-v-736ced16].ant-col-1:has(.anticon-setting)',
        '[data-v-736ced16].ant-col-23:has(a[href="https://zi.tools/"])',
        'div:has(> div > div > #button_Close)',
        'div:has(button#button_Close)',
        'div:has(a[href*="wailian2.cn"])',
        'div[style*="border-radius: 15px"][style*="box-shadow"]:has(button)',
        'div:has(> div > img[src*="wework.qpic.cn"])',
        '#button_Close',

        // ===== 新增：屏蔽右下角 "SPS免费托管" 悬浮条 =====
        'div:has(> a[href*="Sys_Index.aspx"][href*="ft=ad"])',
        'div:has(a[href*="Sys_Index.aspx?ft=ad"])',
        'div[style*="position: fixed"][style*="bottom: 0"][style*="right: 0"][style*="z-index: 9999"][style*="border-top-left-radius"]',
    ];

    // 注入 CSS
    const cssRules = hideSelectors
        .map(selector => `${selector} { display: none !important; }`)
        .join('\n');

    GM_addStyle(cssRules);

    // JS 备用方案
    const hideElements = () => {
        hideSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                });
            } catch (e) {
                console.warn(`[元素隐藏] 选择器无效: ${selector}`, e);
            }
        });
    };

    // ========== 防抖函数 ==========
    const debounce = (fn, delay = 100) => {
        let timer = null;
        return function (...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    const debouncedHide = debounce(hideElements, 100);

    // 首次执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideElements);
    } else {
        hideElements();
    }

    // MutationObserver 使用防抖版本
    const observer = new MutationObserver(() => debouncedHide());

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

})();
