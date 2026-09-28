// ==UserScript==
// @name         全站时间统一 v9.0
// @namespace    https://github.com/elderberryel/mingming
// @version      9.0
// @match        *://*/*
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

        // yande 模糊写法：over 1 year 前 / over 2 months 前 ...
        if (m = text.match(/over\s+(\d+)\s*years?\s*前/i))  return new Date(now - m[1] * 31536000000);
        if (m = text.match(/over\s+(\d+)\s*months?\s*前/i)) return new Date(now - m[1] * 2592000000);
        if (m = text.match(/over\s+(\d+)\s*weeks?\s*前/i))  return new Date(now - m[1] * 604800000);
        if (m = text.match(/over\s+(\d+)\s*days?\s*前/i))   return new Date(now - m[1] * 86400000);
        if (m = text.match(/over\s+(\d+)\s*hours?\s*前/i))  return new Date(now - m[1] * 3600000);
        if (m = text.match(/over\s+(\d+)\s*minutes?\s*前/i))return new Date(now - m[1] * 60000);

        if (/刚刚|just now/i.test(text)) return new Date();

        return null;
    }

    function parseTitle(t) {
        if (!t) return null;
        const cleaned = t.replace(/^posted\s+at\s*/i, '').trim();
        let d = new Date(cleaned);
        if (d && !isNaN(d)) return d;
        d = new Date(t);
        if (d && !isNaN(d)) return d;
        return null;
    }

    function parse(el) {
        let date = null;

        const dt = el.getAttribute?.('datetime');
        if (dt) date = new Date(dt);

        if (!date || isNaN(date)) {
            let node = el;
            for (let i = 0; i < 4 && node; i++) {
                const t = node.getAttribute?.('title');
                if (t && /\d{4}/.test(t)) {
                    const d = parseTitle(t);
                    if (d && !isNaN(d)) { date = d; break; }
                }
                node = node.parentElement;
            }
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

        if (el.children.length > 0) return false;

        const txt = el.textContent.trim();

        if (txt.length > 40) return false;

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

        if (tag === 'TIME' || tag === 'RELATIVE-TIME') {
            if (el.textContent !== text) replaceNode(el, text);
        } else {
            if (el.textContent !== text) {
                replaceNode(el, text);
                el.dataset.done = '1';
            }
        }
    }

    function scanTree(root) {
        if (!root) return;
        let selectors = 'time, relative-time, a, span, div';
        if (isYouTube) {
            selectors += ', yt-formatted-string, ytm-formatted-string, .published-time-text, [class*="published"]';
        }
        root.querySelectorAll(selectors).forEach(process);
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) scanTree(el.shadowRoot);
        });
    }

    function scan(root = document) {
        if (!document.body) return;
        scanTree(root);
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        scan();
    } else {
        document.addEventListener('DOMContentLoaded', () => scan());
    }
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
    setInterval(() => scan(), isYande ? 400 : 600);

})();
