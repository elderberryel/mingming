// ==UserScript==
// @name         推特 t.co 转直接链接
// @namespace    明明
// @version      2.0
// @description  : 把推特的 t.co 中转跳转链接改为直接跳转
// @author       明明
// @website      https://github.com/elderberryel/mingming
// @match        *://*twitter.com/*
// @match        *://*x.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/elderberryel/mingming/main/%E6%8E%A8%E7%89%B9-t.co-%E8%BD%AC%E7%9B%B4%E6%8E%A5%E9%93%BE%E6%8E%A5.user.js
// @updateURL    https://raw.githubusercontent.com/elderberryel/mingming/main/%E6%8E%A8%E7%89%B9-t.co-%E8%BD%AC%E7%9B%B4%E6%8E%A5%E9%93%BE%E6%8E%A5.user.js
// ==/UserScript==

"use strict";
(() => {
  // 判断文本是否可能是一个网址
  function isProbablyUrl(text) {
    // 去掉末尾的省略号
    if (text.endsWith("…")) text = text.slice(0, -1);
    text = text.trim();
    // 以 http:// 或 https:// 开头
    if (/^https?:\/\//i.test(text)) return true;
    // 看起来像域名：包含点，没有空格，且不以 / 开头
    if (/^[^\s\/]+\.[^\s\/]+/.test(text) && !/\s/.test(text)) return true;
    return false;
  }

  function modifyLink(link) {
    if (link.href.includes("t.co")) {
      let urlText = link.innerText.trim();
      if (urlText.endsWith("…")) urlText = urlText.slice(0, -1);
      if (!isProbablyUrl(urlText)) return;   // 不是网址就跳过
      if (urlText.startsWith("http")) {
        link.href = urlText;
      } else if (!urlText.startsWith("/")) {
        link.href = `https://${urlText}`;
      }
    }
  }

  function observeDOM() {
    try {
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                if (node instanceof HTMLAnchorElement)
                  modifyLink(node);
                else
                  node.querySelectorAll("a").forEach(modifyLink);
              }
            });
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      console.log(e);
    }
  }

  document.querySelectorAll("a").forEach(modifyLink);
  observeDOM();
})();
