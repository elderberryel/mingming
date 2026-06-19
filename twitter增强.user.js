// ==UserScript==
// @name         Twitter增强
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  移除广告 + 推广推文 + Grok按钮
// @match        *://twitter.com/*
// @match        *://x.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function hideAd(node) {
        if (
            !node ||
            node.nodeName !== "DIV" ||
            node.getAttribute("data-testid") !== "cellInnerDiv"
        ) return;

        const adArticle = node.querySelector("div[data-testid='placementTracking'] > article");
        if (adArticle) {
            node.style.display = "none";
        }
    }

    function removePromotedTweets(root = document) {
        const tweets = root.querySelectorAll('article[data-testid="tweet"]');

        tweets.forEach(tweet => {
            const spans = tweet.querySelectorAll('span');
            spans.forEach(span => {
                const text = span.textContent;
                if (text === 'Promoted' || text === 'Ad' || text === '推广') {
                    tweet.remove();
                }
            });
        });
    }

    function removeSidebarAd() {
        const aside = document.querySelector('aside');
        if (aside) aside.style.display = 'none';
    }

    function hideGrok() {
        const btns = document.querySelectorAll('button[aria-label="Grok actions"]');
        btns.forEach(btn => btn.remove());
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    hideAd(node);
                    removePromotedTweets(node);
                }
            });
        });

        removeSidebarAd();
        hideGrok();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始执行
    document.querySelectorAll("div[data-testid='cellInnerDiv']").forEach(hideAd);
    removePromotedTweets();
    removeSidebarAd();
    hideGrok();

})();