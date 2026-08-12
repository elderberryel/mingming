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
        '.top-bars .flip-card',
        '.top-bars div:has(> .ant-divider-vertical)',
        '.top-bars div:has(> div[style*="font-size: 20px"])',
        '.func-buttons',
        'div.func-buttons',
        '.func-buttons *',
        'button.ant-btn.ant-btn-default[style*="font-size: 16px"]',
        'div:has(> span.linkspan)',
        'div[style*="margin: 0px 10px"][style*="text-align: center"]',
        'div.ant-row[style*="color: rgb(102, 102, 102)"][style*="font-size: 12px"]',
        'div.ant-row:has(> .ant-col-1 .anticon-setting)',
        'div.ant-row:has(> .ant-col-23[style*="text-align: right"])',
        '#button_Close',
        'div:has(> #button_Close)',
        'div:has(> div > #button_Close)',
        'div[id^="recommend_"]',
        'a[href*="wailian2.cn"]',
        'div:has(> a[href*="wailian2.cn"])',
        'div:has(> div > a[href*="wailian2.cn"])',
        'img[src*="wework.qpic.cn"]',
        'div:has(> div > img[src*="wework.qpic.cn"])',
        'div[style*="border-radius: 15px"][style*="box-shadow"]:has(> button)',
        'div[style*="z-index: 99999"][style*="position: fixed"][style*="100vw"]',
        'div[style*="z-index: 99999"][style*="backdrop-filter: blur"]',
        'a[href*="Sys_Index.aspx"][href*="ft=ad"]',
        'div:has(> a[href*="Sys_Index.aspx?ft=ad"])',
        'div[style*="position: fixed"][style*="bottom: 0"][style*="right: 0"][style*="z-index: 9999"][style*="border-top-left-radius"]',
        'div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3)',
        'div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > font',
        'div:nth-of-type(3) > img.logo:nth-of-type(1)',
        '#app > div > div.disc:nth-of-type(4) > p:nth-of-type(1)',
        '#app > div > div.disc:nth-of-type(4) > p:nth-of-type(2)',
        '#app > div > div:nth-of-type(7) > div:nth-of-type(2)',
        '#app > div > div.banner-title:nth-of-type(2)',
        '#app > div > div:nth-of-type(8)',
        '#app > div > div:nth-of-type(5)'
    ];

    const cssRules = hideSelectors
        .map(selector => `${selector} { display: none !important; }`)
        .join('\n');

    GM_addStyle(cssRules);

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

        document.querySelectorAll('div[id^="recommend_"]').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
    };
    
    setTimeout(hideLuckyButton, 800);
    setTimeout(hideLuckyButton, 2000); 

})();