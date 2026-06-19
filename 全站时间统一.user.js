// ==UserScript==
// @name         全站时间统一 v9.0
// @namespace    https://h3110w0r1d.com/
// @version      9.0.0
// @description  修复评论区内容被覆盖问题，精确匹配时间叶子节点
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    let ENABLED = true;
    let USE_UTC = false;

    const isYande = location.hostname.includes('yande');
    const isYouTube = location.hostname.includes('youtube.com');

    const pad = n => String(n).padStart(2, '0');

    function format(date) {
        return USE_UTC
            ? `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
            : `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function parseRelative(text) {
        const now = Date.now();
        let m;

        // 中文
        if (m = text.match(/(\d+)\s*秒前/))   return new Date(now - m[1] * 1000);
        if (m = text.match(/(\d+)\s*分钟前/))  return new Date(now - m[1] * 60000);
        if (m = text.match(/(\d+)\s*小时前/))  return new Date(now - m[1] * 3600000);
        if (m = text.match(/(\d+)\s*天前/))    return new Date(now - m[1] * 86400000);
        if (m = text.match(/(\d+)\s*周前/))    return new Date(now - m[1] * 604800000);
        if (m = text.match(/(\d+)\s*个月前/))  return new Date(now - m[1] * 2592000000);
        if (m = text.match(/(\d+)\s*年前/))    return new Date(now - m[1] * 31536000000);

        // 英文
        if (m = text.match(/(\d+)\s*seconds?\s*ago/i))  return new Date(now - m[1] * 1000);
        if (m = text.match(/(\d+)\s*minutes?\s*ago/i))  return new Date(now - m[1] * 60000);
        if (m = text.match(/(\d+)\s*hours?\s*ago/i))    return new Date(now - m[1] * 3600000);
        if (m = text.match(/(\d+)\s*days?\s*ago/i))     return new Date(now - m[1] * 86400000);
        if (m = text.match(/(\d+)\s*weeks?\s*ago/i))    return new Date(now - m[1] * 604800000);
        if (m = text.match(/(\d+)\s*months?\s*ago/i))   return new Date(now - m[1] * 2592000000);
        if (m = text.match(/(\d+)\s*years?\s*ago/i))    return new Date(now - m[1] * 31536000000);

        if (/刚刚|just now/i.test(text)) return new Date();

        return null;
    }

    function parse(el) {
        let date = null;

        const dt = el.getAttribute?.('datetime');
        if (dt) date = new Date(dt);

        if ((!date || isNaN(date)) && el.getAttribute) {
            const t = el.getAttribute('title');
            if (t && /\d{4}/.test(t)) date = new Date(t);
        }

        if ((!date || isNaN(date)) && el.tagName === 'A') {
            const href = el.getAttribute('href') || '';
            const m = href.match(/date(?:%3A|:)(\d{4}-\d{2}-\d{2})/i);
            if (m) date = new Date(m[1] + 'T00:00:00');
        }

        if (!date || isNaN(date)) {
            date = parseRelative(el.textContent.trim());
        }

        return (date && !isNaN(date)) ? date : null;
    }

    function shouldProcess(el) {
        if (!el || !el.textContent) return false;

        // ⭐ 关键：只处理叶子元素（内部没有其他元素）
        if (el.children.length > 0) return false;

        const txt = el.textContent.trim();

        // ★ 长度严格限制在 30 字符以内（时间文本不会太长）
        if (txt.length > 30) return false;

        // 跳过已经是标准格式的非链接
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(txt) && el.tagName !== 'A') return false;

        return (
            /\d{4}/.test(txt) ||
            /ago|前|just|秒|分钟|小时|天|周|月|年/i.test(txt) ||
            (el.tagName === 'A' && el.href.includes('date')) ||
            el.tagName === 'TIME' ||
            el.tagName === 'RELATIVE-TIME'
        );
    }

    function replaceNode(el, text) {
        const span = document.createElement('span');
        span.textContent = text;
        span.style.font = 'inherit';
        span.style.color = 'inherit';
        if (el.title) span.title = el.title;
        el.replaceWith(span);
    }

    function process(el) {
        if (!ENABLED) return;

        if (isYande) {
            if (shouldProcess(el)) {
                const date = parse(el);
                if (date) {
                    const text = format(date);
                    if (el.textContent !== text) el.textContent = text;
                }
            }
            return;
        }

        if (el.dataset.done === '1') return;
        if (!shouldProcess(el)) return;

        const date = parse(el);
        if (!date) return;

        const text = format(date);
        const tag = el.tagName;

        // 对于已经是叶子节点，直接替换文本是安全的，但统一用 replaceNode 更干净
        if (tag === 'TIME' || tag === 'RELATIVE-TIME') {
            if (el.textContent !== text) replaceNode(el, text);
        } else {
            if (el.textContent !== text) {
                // 叶子节点直接修改 textContent 也行，但以防万一，用 replaceNode
                replaceNode(el, text);
                el.dataset.done = '1'; // 注意：replaceNode 后原 el 已不在 DOM 中，这个标记可忽略
            }
        }
    }

    // ── 递归扫描 Shadow DOM ──
    function scanTree(root) {
        if (!root) return;
        // 更精准的选择器：YouTube 下添加类名匹配
        let selectors = 'time, relative-time, a, span, div';
        if (isYouTube) {
            selectors += ', yt-formatted-string, ytm-formatted-string, .published-time-text, [class*="published"]';
        }
        root.querySelectorAll(selectors).forEach(process);
        // 深入 shadow root
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) scanTree(el.shadowRoot);
        });
    }

    function scan(root = document) {
        if (!document.body) return;
        scanTree(root);
    }

    // 启动
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        scan();
    } else {
        document.addEventListener('DOMContentLoaded', () => scan());
    }

    // MutationObserver
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes.forEach(n => {
                if (n.nodeType === 1) {
                    process(n);
                    scanTree(n);
                    if (n.shadowRoot) scanTree(n.shadowRoot);
                }
            });
            if (m.type === 'attributes') process(m.target);
            if (m.type === 'characterData') process(m.target.parentElement);
        }
    });

    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
                attributeFilter: ['datetime', 'title', 'class']
            });
        } else {
            requestAnimationFrame(startObserver);
        }
    };
    startObserver();

    // 轮询
    setInterval(() => scan(), isYande ? 400 : 600);

})();