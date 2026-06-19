// ==UserScript==
// @name         百度搜索隐藏顶部和底部搜索框
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在百度搜索结果页面隐藏顶部和底部的搜索框
// @author       You
// @match        *://www.baidu.com/s?*
// @match        *://m.baidu.com/s?*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 添加CSS样式来隐藏搜索框
    const style = document.createElement('style');
    style.textContent = `
        /* 隐藏顶部搜索框 */
        #head .s_form,
        #s_top_wrap,
        .s_form_wrapper {
            display: none !important;
        }

        /* 隐藏底部搜索框 */
        #bottom_form,
        .foot-form {
            display: none !important;
        }

        /* 移动端适配 */
        .se-form,
        .new-search-box {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    console.log('百度搜索框隐藏脚本已加载');
})();