// ==UserScript==
// @name         元素隐藏
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description   元素隐藏
// @author       MiMo
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const hideSelectors = [
        // ===== 1. 字统网 (zi.tools) 首页区块精准隐藏 =====
        '.top-bars .flip-card',
        '.top-bars div:has(> .ant-divider-vertical)',
        '.top-bars div:has(> div[style*="font-size: 20px"])',
        '.func-buttons',
        'div.func-buttons',
        '.func-buttons *',
        'button.ant-btn.ant-btn-default[style*="font-size: 16px"]',
        'div:has(> span.linkspan)',
        'div[style*="margin: 0px 10px"][style*="text-align: center"]',


        // ===== 2. 底部页脚 (Footer) 精准隐藏 (无视 data-v 变化) =====
        // 原理：直接匹配该页脚独有的灰色、12px字号、10px内边距的内联样式组合
        'div.ant-row[style*="color: rgb(102, 102, 102)"][style*="font-size: 12px"]',
        
        // 兜底方案：匹配包含设置图标或右侧版权内容的 ant-row
        'div.ant-row:has(> .ant-col-1 .anticon-setting)',
        'div.ant-row:has(> .ant-col-23[style*="text-align: right"])',


        // ===== 3. 通用广告/弹窗隐藏 (限制层级，防止误杀 #app) =====
        '#button_Close',
        'div:has(> #button_Close)', 
        'a[href*="wailian2.cn"]',
        'div:has(> a[href*="wailian2.cn"])',
        'img[src*="wework.qpic.cn"]',
        'div:has(> div > img[src*="wework.qpic.cn"])',
        'div[style*="border-radius: 15px"][style*="box-shadow"]:has(> button)',


        // ===== 4. 屏蔽右下角 "SPS免费托管" 悬浮条 =====
        'a[href*="Sys_Index.aspx"][href*="ft=ad"]',
        'div:has(> a[href*="Sys_Index.aspx?ft=ad"])',
        'div[style*="position: fixed"][style*="bottom: 0"][style*="right: 0"][style*="z-index: 9999"][style*="border-top-left-radius"]',

        // ===== 5. 新增指定层级元素隐藏 =====
        'div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3)',
        'div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > font',
        'div:nth-of-type(3) > img.logo:nth-of-type(1)',
    ];

    // 注入 CSS 
    const cssRules = hideSelectors
        .map(selector => `${selector} { display: none !important; }`)
        .join('\n');

    GM_addStyle(cssRules);

    // ===== 6. 针对“清風翻書”按钮的 JS 终极兜底方案 =====
    const hideLuckyButton = () => {
        document.querySelectorAll('button').forEach(btn => {
            if (btn.innerText && btn.innerText.includes('清風翻書')) {
                btn.style.setProperty('display', 'none', 'important');
                let parent = btn.parentElement;
                for (let i = 0; i < 2 && parent; i++) {
                    parent.style.setProperty('display', 'none', 'important');
                    parent = parent.parentElement;
                }
            }
        });
    };
    setTimeout(hideLuckyButton, 800);

})();