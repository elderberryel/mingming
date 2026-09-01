// ==UserScript==
// @name         元素隐藏
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  元素隐藏
// @author       明明
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
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
        '#app > div > div:nth-of-type(5)',
        'footer.bg-white.dark\\:bg-gray-900.mt-4.mx-auto.max-w-\\[600px\\]:nth-of-type(1)',
        'div.container.mx-auto.mt-3.mb-3.px-2:nth-of-type(2) > section.mt-6.px-2:nth-of-type(1) > p.text-xs.text-gray-500.dark\\:text-gray-400.leading-relaxed',
        'div.container.mx-auto.mt-3.mb-3.px-2:nth-of-type(2) > div.mt-3:nth-of-type(8) > section.mx-auto.mb-4.max-w-\\[800px\\].px-2 > h2.mb-2.text-sm.font-bold.text-gray-700:nth-of-type(1)',
        'div.container.mx-auto.mt-3.mb-3.px-2:nth-of-type(2) > div.mt-3:nth-of-type(8) > section.mx-auto.mb-4.max-w-\\[800px\\].px-2',
        'footer.bg-white.dark\\:bg-gray-900.mt-4.mx-auto.max-w-\\[600px\\]:nth-of-type(1) > div.max-w-2xl.mx-auto.px-2.py-8:nth-of-type(3) > div.rounded-lg.p-4.mb-8.border-gray-200.dark\\:border-gray-700',
        'div.wp-site-blocks:nth-of-type(2) > header.wp-block-template-part:nth-of-type(1) > div.wp-block-spacer:nth-of-type(2)',
        '.n2EyapLU_video_content_wrapper',
        'div[class*="video_content_wrapper"]',
        'div[class*="video_content_wrapper"] > video',
        '.progress_exo_wrapper',
        '.exo-native-widget-item-image',
        'div:has(> .exo-native-widget-item-image)',
        'div[class*="exo-native-widget"]',
        'div[style*="bkcdn.net"]',
        '.centbtd',
        'ins.eas6a97888e2',
        'ins[data-zoneid="5781030"]',
        'ins[data-processed="true"]',
        '.wb-contai',
        '.is-layout-flow.wp-block-group:has(> .wb-contai)',
        'div[data-uid]',
        'div[class*="_main_outstream"]',
        'ins.eas6a97888e37',
        'ins[data-zoneid="5970770"]',
        'div:nth-of-type(8) > div.grecaptcha-badge:nth-of-type(1) > div.grecaptcha-logo:nth-of-type(1) > iframe',
        '.grecaptcha-badge',

        'ins.adsbygoogle',
        '.adsbygoogle',
        '.footer[role="contentinfo"]',
        '.ains',
        '[class*="google-anno"]',
        '[id*="google-anno"]',
        'div[style*="position: fixed"][style*="z-index: 1000"]',

        '#clickCanvas',

        '.ad-incontent-rectangle',
        '.ad-blank.ad-blank--fullwidth',
        'div:has(> .ad-blanks-wrapper)'
    ];

    const domainHideSelectors = {
        'zi.tools': [
            'footer',
            '#sidebar'
        ],
        'yxssp.com': [
            'div.td-scroll-up + div.td-menu-background',
            '.td-menu-background'
        ]
    };

    const removeSelectors = [
        'div[class*="video_content_wrapper"] video',
        '.n2EyapLU_video_content_wrapper video'
    ];

    // 追踪像素域名正则
    const trackingRegex = /quantserve\.com|quantcount\.com|pixel\.quantserve\.com|hm\.baidu\.com/i;

    const TRACKING_TAGS = 'img,iframe,script,link,object,embed';

    function isGitHub() {
        const h = location.hostname.toLowerCase();
        return h === 'github.com' || h.endsWith('.github.com');
    }

    function killGitHubBanners(root = document) {
        if (!isGitHub()) return;
        let nodes;
        try {
            nodes = root.querySelectorAll('[class*="Banner"]');
        } catch (_) {
            return;
        }
        nodes.forEach(el => el.remove());
    }

    function currentHost() {
        let h = location.hostname.toLowerCase();
        if (h.startsWith('www.')) h = h.slice(4);
        return h;
    }

    function domainMatchesHost(host, ruleDomain) {
        return host === ruleDomain || host.endsWith(`.${ruleDomain}`);
    }

    (function injectHideCss() {
        const selectors = hideSelectors.slice();
        const host = currentHost();
        for (const [domain, sels] of Object.entries(domainHideSelectors)) {
            if (domainMatchesHost(host, domain)) {
                selectors.push(...sels);
            }
        }
        GM_addStyle(selectors.map(sel => `${sel} { display: none !important; }`).join('\n'));
    })();

    function removeNodes(root = document) {
        // 删除广告 video
        for (const sel of removeSelectors) {
            let nodes;
            try {
                nodes = root.querySelectorAll(sel);
            } catch (_) {
                continue;
            }
            nodes.forEach(el => el.remove());
        }
    }


    function checkTrackingElement(el) {
        if (!el || el.nodeType !== 1) return;
        const tag = el.tagName;
        if (!tag) return;
        if (!/^(IMG|IFRAME|SCRIPT|LINK|OBJECT|EMBED)$/.test(tag)) return;
        const src = el.src || el.href || el.data || '';
        if (src && trackingRegex.test(src)) el.remove();
    }

    function removeTrackingPixelsInitial(root = document) {
        let nodes;
        try {
            nodes = root.querySelectorAll(TRACKING_TAGS);
        } catch (_) {
            return;
        }
        nodes.forEach(checkTrackingElement);
    }

    function processAddedNodes(nodes) {
        nodes.forEach(node => {
            if (node.nodeType !== 1) return;
            checkTrackingElement(node);

            if (node.querySelectorAll) {
                try {
                    node.querySelectorAll(TRACKING_TAGS).forEach(checkTrackingElement);
                } catch (_) {}
            }
        });
    }

    function hideLuckyButton(root = document) {

        let buttons;
        try {
            buttons = root.querySelectorAll('button:not([data-lucky-checked])');
        } catch (_) {
            return;
        }
        buttons.forEach(btn => {
            btn.setAttribute('data-lucky-checked', '1');
            const txt = btn.textContent;
            if (txt && txt.includes('清風翻書')) {
                btn.style.setProperty('display', 'none', 'important');
                let parent = btn.parentElement;
                for (let i = 0; i < 2 && parent; i++) {
                    parent.style.setProperty('display', 'none', 'important');
                    parent = parent.parentElement;
                }
            }
        });
    }

    function runDynamicTasks() {
        removeNodes();
        hideLuckyButton();
        killGitHubBanners();   
        
    }

    const DEFAULTS = {
        hideAiOverview: true,
        blockAiElements: true,
        cacheHours: 24,
    };

    const LISTS = [
        {
            label: 'laylavish',
            category: 'ai-repository',
            mode: 'ublock',
            url: 'https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/list.txt',
        },
        {
            label: 'Stevoisiak',
            category: 'ai-platform',
            mode: 'ublock',
            url: 'https://raw.githubusercontent.com/Stevoisiak/Stevos-AI-Blocklist/main/GenAI-Blocklist.txt',
        },
        {
            label: 'Iz-zzzzz',
            category: 'ai-repository',
            mode: 'ublock',
            url: 'https://raw.githubusercontent.com/Iz-zzzzz/Block-AI-FilterList-for-uBlockOrigin/main/list_for_uBlock_Origin',
        },
        {
            label: 'alvi-se',
            category: 'ai-farm',
            mode: 'ublock',
            url: 'https://raw.githubusercontent.com/alvi-se/ai-ublock-blacklist/master/list.txt',
        },
        {
            label: 'outerspacee',
            category: 'ai-service',
            mode: 'links',
            url: 'https://raw.githubusercontent.com/OuterSpacee/awesome-ai-tools/refs/heads/main/README.md',
        },
    ];

    const CACHE_KEY = 'cleanSearch_ruleCache_v1';
    const SETTINGS_KEY = 'cleanSearch_settings_v1';

    let settings = loadSettings();
    let rules = { domains: [], cssRules: [] };
    let applying = false;
    let applyTimer = null;

    function loadSettings() {
        const saved = GM_getValue(SETTINGS_KEY, {});
        return Object.assign({}, DEFAULTS, saved || {});
    }

    function saveSettings(patch) {
        settings = Object.assign({}, settings, patch);
        GM_setValue(SETTINGS_KEY, settings);
    }

    function hostname(url = location.href) {
        try {
            let h = new URL(url).hostname.toLowerCase();
            if (h.startsWith('www.')) h = h.slice(4);
            return h;
        } catch (_) {
            return '';
        }
    }

    function path(url = location.href) {
        try {
            return new URL(url).pathname || '/';
        } catch (_) {
            return '/';
        }
    }

    function isGoogleSearch() {
        const h = location.hostname.toLowerCase();
        return (h === 'google.com' || h.endsWith('.google.com')) && location.pathname.startsWith('/search');
    }

    function request(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                timeout: 20000,
                onload: r => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText);
                    } else {
                        reject(new Error(`HTTP ${r.status}`));
                    }
                },
                ontimeout: () => reject(new Error('timeout')),
                onerror: () => reject(new Error('network error')),
            });
        });
    }

    function parseAdblockLine(line, category, label) {
        let s = line.trim();
        if (!s || s.startsWith('!') || s.startsWith('#') || s.startsWith('[')) return null;

        const idx = s.indexOf('##');
        if (idx >= 0) {
            const left = s.slice(0, idx).trim();
            const selector = s.slice(idx + 2).trim();
            if (!selector || selector.startsWith('+js') || selector.startsWith('^')) return null;

            if (!left) {
                return { cssRules: [{ domain: '*', selector, category, listName: label }] };
            }
            const domains = left.split(',').map(x => x.trim().toLowerCase().replace(/^www\./, ''))
                .filter(x => x && x.includes('.') && !x.includes(' '));
            return {
                domains: domains.map(domain => ({ domain, category, listName: label })),
                cssRules: [],
            };
        }

        const hostTokens = s.split(/\s+/).filter(Boolean);
        if (/^(?:0\.0\.0\.0|127\.0\.0\.1|::1|localhost)$/.test(hostTokens[0] || '')) {
            hostTokens.shift();
        }
        const hosts = hostTokens.filter(x => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x))
            .map(x => x.replace(/\.+$/, '').toLowerCase().replace(/^www\./, ''));
        if (hosts.length) {
            return { domains: hosts.map(domain => ({ domain, category, listName: label })) };
        }

        if (s.startsWith('||')) {
            let x = s.slice(2).split('$')[0];
            const cut = x.search(/[\\^\/*]/);
            if (cut >= 0) x = x.slice(0, cut);
            x = x.replace(/^\*\./, '').replace(/^\./, '').replace(/\.+$/, '').toLowerCase();
            if (x.includes('.') && /^[a-z0-9.-]+$/i.test(x)) {
                return { domains: [{ domain: x, category, listName: label }] };
            }
        }

        if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) {
            return { domains: [{ domain: s.toLowerCase().replace(/^www\./, ''), category, listName: label }] };
        }

        return null;
    }

    function parseUblock(text, category, label) {
        const domains = [];
        const cssRules = [];
        const seenD = new Set();
        const seenC = new Set();

        for (const raw of text.split(/\r?\n/)) {
            const r = parseAdblockLine(raw, category, label);
            if (!r) continue;

            for (const d of (r.domains || [])) {
                const key = `${d.domain}|${d.category}`;
                if (!seenD.has(key)) {
                    seenD.add(key);
                    domains.push(d);
                }
            }
            for (const c of (r.cssRules || [])) {
                const key = `${c.domain}|${c.selector}|${c.category}`;
                if (!seenC.has(key)) {
                    seenC.add(key);
                    cssRules.push(c);
                }
            }
        }
        return { domains, cssRules };
    }

    function parseLinks(text, category) {
        const domains = [];
        const seen = new Set();
        const re = /\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
        let m;
        while ((m = re.exec(text))) {
            try {
                const u = new URL(m[1]);
                const d = u.hostname.toLowerCase().replace(/^www\./, '');
                if (!d || !d.includes('.') || d === 'github.com' || d.endsWith('.github.com') || seen.has(d)) continue;
                seen.add(d);
                domains.push({
                    domain: d,
                    category,
                    listName: 'outerspacee',
                    path: u.pathname !== '/' ? u.pathname : undefined,
                });
            } catch (_) {}
        }
        return { domains, cssRules: [] };
    }

    function dedupeRules(data) {
        const d = new Map();
        const c = new Map();
        for (const x of data.domains || []) {
            const key = `${x.domain}|${x.category}|${x.path || ''}`;
            if (!d.has(key)) d.set(key, x);
        }
        for (const x of data.cssRules || []) {
            const key = `${x.domain}|${x.selector}|${x.category}`;
            if (!c.has(key)) c.set(key, x);
        }
        return {
            domains: [...d.values()],
            cssRules: [...c.values()],
        };
    }

    async function refreshRules(force = false) {
        const cached = GM_getValue(CACHE_KEY, null);
        const freshEnough = cached && cached.time && (Date.now() - cached.time < settings.cacheHours * 3600e3);
        if (!force && freshEnough && cached.data) {
            rules = cached.data;
            return rules;
        }

        const results = [];
        for (const list of LISTS) {
            try {
                const text = await request(list.url);
                results.push(
                    list.mode === 'links'
                        ? parseLinks(text, list.category)
                        : parseUblock(text, list.category, list.label)
                );
            } catch (e) {
                console.warn('[Clean Search] 规则下载失败:', list.label, e);
            }
        }

        rules = dedupeRules({
            domains: results.flatMap(x => x.domains || []),
            cssRules: results.flatMap(x => x.cssRules || []),
        });

        GM_setValue(CACHE_KEY, { time: Date.now(), data: rules });
        return rules;
    }

    function domainMatches(host, ruleDomain) {
        return host === ruleDomain || host.endsWith(`.${ruleDomain}`);
    }

    function googleCleanSearch() {
        if (!settings.hideAiOverview || !isGoogleSearch()) return;

        const ORIGINAL_SELECTORS = [
            '#eKIzJc',
            '[role="navigation"] [role="list"] > [data-hveid][role="listitem"]:first-child'
        ];

        function hideAI() {
            for (const selector of ORIGINAL_SELECTORS) {
                let elements;
                try {
                    elements = document.querySelectorAll(selector);
                } catch (_) {
                    continue;
                }
                elements.forEach(el => {
                    el.style.setProperty('display', 'none', 'important');
                });
            }
        }

        hideAI();
        const observer = new MutationObserver(() => hideAI());
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function scheduleApply() {
        clearTimeout(applyTimer);
        applyTimer = setTimeout(applyRules, 120);
    }

    function applyRules() {
        if (applying || !settings.blockAiElements || !document.documentElement) return;
        applying = true;

        try {
            const matched = matchDomain();
            if (!matched) {
                applying = false;
                return;
            }

            const domain = hostname();
            const applicable = rules.cssRules.filter(r =>
                r.domain === '*' || r.domain === domain || domainMatches(domain, r.domain)
            );

            const seen = new WeakSet();
            for (const r of applicable) {
                let nodes = [];
                try {
                    nodes = document.querySelectorAll(r.selector);
                } catch (_) {
                    continue;
                }
                nodes.forEach(el => {
                    if (seen.has(el)) return;
                    seen.add(el);
                    el.style.setProperty('display', 'none', 'important');
                });
            }
        } finally {
            applying = false;
        }
    }

    function matchDomain() {
        const h = hostname();
        const p = path();

        let best = null;
        let score = -1;

        for (const item of rules.domains) {
            if (!domainMatches(h, item.domain)) continue;
            if (item.path && !p.startsWith(item.path)) continue;
            const s = item.domain.split('.').length * 10 + (item.path ? item.path.split('/').length : 0);
            if (s > score) {
                score = s;
                best = item;
            }
        }

        if (!best) {
            const exact = rules.domains.filter(x => x.domain === h);
            const hasPath = exact.some(x => x.path);
            const noPath = exact.some(x => !x.path);
            if (hasPath && !noPath) {
                return { category: 'ai-platform', matchedBy: null, listName: null };
            }
        }
        return best || null;
    }

    function registerMenus() {
        GM_registerMenuCommand(
            `${settings.hideAiOverview ? '✅' : '⬜'} 隐藏 Google AI Overview / AI Mode`,
            () => {
                saveSettings({ hideAiOverview: !settings.hideAiOverview });
                location.reload();
            }
        );

        GM_registerMenuCommand(
            `${settings.blockAiElements ? '✅' : '⬜'} 屏蔽 AI 相关网页元素`,
            () => {
                saveSettings({ blockAiElements: !settings.blockAiElements });
                location.reload();
            }
        );

        GM_registerMenuCommand(
            '🔄 强制更新 AI 规则列表',
            async () => {
                await refreshRules(true);
                alert(`AI 规则已更新：${rules.domains.length} 个域名，${rules.cssRules.length} 条 CSS 规则。`);
                location.reload();
            }
        );

        GM_registerMenuCommand(
            '⚙️ 查看 AI 配置',
            () => {
                alert([
                    `隐藏 Google AI：${settings.hideAiOverview ? '开启' : '关闭'}`,
                    `屏蔽 AI 元素：${settings.blockAiElements ? '开启' : '关闭'}`,
                    `缓存：${settings.cacheHours} 小时`,
                    `规则：${rules.domains.length} 个域名 / ${rules.cssRules.length} 条 CSS`,
                ].join('\n'));
            }
        );
    }

    function watchSpa() {
        let lastUrl = location.href;
        const check = () => {
            if (location.href === lastUrl) return;
            lastUrl = location.href;
            setTimeout(() => {
                if (isGoogleSearch()) googleCleanSearch();
                scheduleApply();
                runDynamicTasks();
            }, 250);
        };

        const push = history.pushState;
        history.pushState = function(...args) {
            const r = push.apply(this, args);
            check();
            return r;
        };

        const replace = history.replaceState;
        history.replaceState = function(...args) {
            const r = replace.apply(this, args);
            check();
            return r;
        };

        window.addEventListener('popstate', check);
    }

    async function init() {
        registerMenus();
        googleCleanSearch();
        watchSpa();

        killGitHubBanners();

        try {
            await refreshRules(false);
        } catch (_) {}

        const start = () => {
            // 初始跑一次
            applyRules();
            removeTrackingPixelsInitial(); // 追踪像素只在启动时全量扫一次
            runDynamicTasks();

            if (window._observer) window._observer.disconnect();
            window._observer = new MutationObserver(mutations => {

                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length) {
                        processAddedNodes(m.addedNodes);
                    }
                }
                clearTimeout(window._hideDebounce);
                window._hideDebounce = setTimeout(runDynamicTasks, 200);
            });

            if (document.body) {
                window._observer.observe(document.body, { childList: true, subtree: true });
            }
        };

        if (document.body) {
            start();
        } else {
            const bodyObserver = new MutationObserver((_, mo) => {
                if (document.body) {
                    mo.disconnect();
                    start();
                }
            });
            bodyObserver.observe(document.documentElement, { childList: true });
        }
    }

    init();

})();
