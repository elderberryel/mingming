// ==UserScript==
// @name         zi.tools 元素隐藏
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  隐藏 zi.tools 页面中的特定元素
// @author       MiMo
// @match        https://zi.tools/*
// @match        http://zi.tools/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const hideSelectors = [
        // 规则1: 固定二级头部中的特定子元素
        '#components-layout-demo-top > div.fixedSecondaryHeader:nth-child(2) > span > div > div',

        // 规则2: 主内容区最后一行的最后一列
        '#mainContent > span > div.ant-row.notfont:last-child > div.ant-col-23:last-child',

        // 规则3: 所有同时具有 .notfont 和 .ant-row 类的元素
        '.notfont.ant-row',

        // 规则4: 页脚设置图标按钮（齿轮图标）
        '[data-v-736ced16].ant-col-1 .anticon-setting',

        // 规则5: 页脚链接区域（版权、Telegram、QQ、外部链接等）
        '[data-v-736ced16].ant-col-23[style*="text-align: right"]',

        // 规则6: 页脚整个容器（如果上面两个不够，直接隐藏整行）
        '[data-v-736ced16].ant-col-1:has(.anticon-setting)',
        '[data-v-736ced16].ant-col-23:has(a[href="https://zi.tools/"])'
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
                console.warn(`[zi.tools隐藏] 选择器无效: ${selector}`, e);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideElements);
    } else {
        hideElements();
    }

    const observer = new MutationObserver(() => hideElements());

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

})();