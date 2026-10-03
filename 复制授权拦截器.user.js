// ==UserScript==
// @name         复制授权拦截器
// @namespace    https://viayoo.com/
// @version      5.1
// @description  复制必弹窗
// @author       明明
// @match        http://*/*
// @match        https://*/*
// @exclude      *://*.x.com/*
// @exclude      *://*.github.com/*
// @exclude      *://*.chatgpt.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @exclude      *://*.chatgpt.com/*
// @license      MIT
// ==/UserScript==

(function () {
    if (location.protocol === 'file:' || location.protocol === 'about:' ||
        location.protocol === 'data:' || location.protocol === 'blob:') return;

    const KEY = 'copyAuth:v4.9';
    if (window[KEY]) return;
    window[KEY] = true;

    // ==========================================
    // 配置读写小工具
    // ==========================================
    const gv = (k, d) => { try { return (typeof GM_getValue !== 'undefined') ? GM_getValue(k, d) : d; } catch (e) { return d; } };
    const sv = (k, v) => { try { if (typeof GM_setValue !== 'undefined') GM_setValue(k, v); } catch (e) {} };

    let denyCount = 0, allowCount = 0, enabled = true, freeCopyMode = false, isShowingModal = false;
    let blockCopy = false;                 // ✅ 当前网站永久禁止复制
    const MAX_DENY = 3, AUTO_FREE_AFTER_ALLOW = 2;
    let dot = null, hideTimer = null, shadowRoot = null, container = null;
    const UI_TYPES = ['DEFAULT', 'IOS', 'MIUI', 'EDGE'];
    let currentUI = (typeof GM_getValue !== 'undefined' ? GM_getValue('clipboard_ui_style', 'EDGE') : 'EDGE');
    let editAbortController = null;
    let inited = false, menuRegistered = false;
    let unlockActive = false, unlockEventsBound = false, unlockBaseStyle = null, unlockCleanupFns = [];

    const originalExec = document.execCommand ? document.execCommand.bind(document) : null;
    const origWriteText = navigator.clipboard?.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
    const origWrite = navigator.clipboard?.write ? navigator.clipboard.write.bind(navigator.clipboard) : null;

    const ensureShadow = () => {
        if (shadowRoot) return;
        container = document.createElement('div');
        container.id = 'copy-auth-interceptor';
        container.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;pointer-events:none;';
        document.documentElement.appendChild(container);
        shadowRoot = container.attachShadow({ mode: 'closed' });
    };

    // ==========================================
    // Toast 提示
    // ==========================================
    const showToast = (msg) => {
        if (window.via && typeof window.via.toast === 'function') {
            window.via.toast(msg);
            return;
        }
        ensureShadow();
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:white;padding:12px 20px;border-radius:8px;z-index:2147483647;font-size:14px;pointer-events:auto;';
        shadowRoot.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    };

    const hideAllModals = () => {
        if (!shadowRoot) return;
        shadowRoot.querySelectorAll('.auth-modal-bg').forEach(m => m.remove());
        isShowingModal = false;
    };

    // ==========================================
    // 复制 API 控制
    // ==========================================
    const disableAllCopyAPIs = () => {
        const emptyFunc = () => false;
        const emptyPromise = () => Promise.reject(new Error('复制功能已被永久禁用'));
        if (document.execCommand) document.execCommand = emptyFunc;
        if (navigator.clipboard) {
            try { navigator.clipboard.writeText = emptyPromise; } catch (e) {}
            try { if (navigator.clipboard.write) navigator.clipboard.write = emptyPromise; } catch (e) {}
        }
    };

    const restoreAllCopyAPIs = () => {
        if (originalExec) try { document.execCommand = originalExec; } catch (e) {}
        if (origWriteText) try { navigator.clipboard.writeText = origWriteText; } catch (e) {}
        if (origWrite) try { navigator.clipboard.write = origWrite; } catch (e) {}
    };

    // ==========================================
    // 确认弹窗（Shadow DOM 内，pointer-events:auto）
    // 被占用时返回 null（表示"忽略"，非"拒绝"）
    // ==========================================
    const showConfirm = (msg, txt = '') => {
        if (isShowingModal) return Promise.resolve(null);
        return new Promise(r => {
            isShowingModal = true;
            ensureShadow();

            const modal = document.createElement('div');
            modal.className = 'auth-modal-bg';
            const dialog = document.createElement('div');
            const title = document.createElement('h3');
            const pre = document.createElement('div');
            const btns = document.createElement('div');
            const allow = document.createElement('button');
            const deny = document.createElement('button');
            const safeTxt = String(txt || '').slice(0, 500);
            const scrollStyle = 'word-break:break-all;white-space:pre-wrap;overflow-y:auto;';
            const cs = document.createElement('style');

            // 所有弹窗元素都需要 pointer-events:auto，否则点不到
            const baseInteractive = 'pointer-events:auto;';

            if (currentUI === 'IOS') {
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;z-index:2147483647;' + baseInteractive;
                dialog.style.cssText = 'background:rgba(255,255,255,.85);border-radius:13px;width:270px;text-align:center;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.15);overflow:hidden;animation:ios-zoom .25s cubic-bezier(0.1,0.9,0.2,1);';
                const content = document.createElement('div');
                content.style.cssText = 'padding:20px 16px;';
                title.style.cssText = 'margin:0;font-size:17px;font-weight:600;color:#000;line-height:1.3;';
                pre.style.cssText = 'margin-top:6px;font-size:13px;color:#000;max-height:120px;display:' + (txt ? 'block' : 'none') + ';line-height:1.4;' + scrollStyle;
                btns.style.cssText = 'display:flex;border-top:0.5px solid rgba(0,0,0,.15);height:44px;';
                deny.style.cssText = 'flex:1;background:none;border:none;border-right:0.5px solid rgba(0,0,0,.15);color:#007AFF;font-size:17px;cursor:pointer;' + baseInteractive;
                allow.style.cssText = 'flex:1;background:none;border:none;color:#007AFF;font-size:17px;font-weight:600;cursor:pointer;' + baseInteractive;
                cs.textContent = '@keyframes ios-zoom{from{opacity:0;transform:scale(1.15)}to{opacity:1;transform:scale(1)}} @media(prefers-color-scheme:dark){.auth-modal-bg{background:rgba(0,0,0,.5)}.auth-modal-bg div:first-child{background:rgba(30,30,30,.85)!important}h3,.auth-modal-bg div div{color:#fff!important}.auth-modal-bg div div:last-child{border-top-color:rgba(255,255,255,.1)!important}button{color:#0A84FF!important;border-right-color:rgba(255,255,255,.1)!important}}';
                title.textContent = msg; pre.textContent = safeTxt;
                allow.textContent = '允许'; deny.textContent = '拒绝';
                content.append(title, pre); btns.append(deny, allow); dialog.append(content, btns);
            } else if (currentUI === 'MIUI') {
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;z-index:2147483647;padding:20px;box-sizing:border-box;' + baseInteractive;
                dialog.style.cssText = 'background:#fff;border-radius:28px;width:100%;max-width:400px;text-align:left;box-shadow:0 10px 30px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:12px;padding:24px;animation:miui-in .3s cubic-bezier(0.2,0.8,0.2,1);';
                title.style.cssText = 'margin:0;font-size:20px;font-weight:600;color:#1a1a1a;';
                pre.style.cssText = 'margin:4px 0;padding:12px;background:#f2f2f2;border-radius:16px;font-size:14px;color:#666;max-height:150px;display:' + (txt ? 'block' : 'none') + ';' + scrollStyle;
                btns.style.cssText = 'display:flex;gap:12px;margin-top:8px;';
                allow.style.cssText = 'flex:1;height:52px;border:none;border-radius:16px;background:#0078FF;color:#fff;font-size:16px;font-weight:600;cursor:pointer;' + baseInteractive;
                deny.style.cssText = 'flex:1;height:52px;border:none;border-radius:16px;background:#eee;color:#333;font-size:16px;font-weight:600;cursor:pointer;' + baseInteractive;
                cs.textContent = '@keyframes miui-in{from{transform:translateY(100%)}to{transform:translateY(0)}} @media(prefers-color-scheme:dark){.auth-modal-bg div:first-child{background:#222!important}h3{color:#eee!important}.auth-modal-bg div div:nth-child(2){background:#333!important;color:#bbb!important}button:last-child{background:#333!important;color:#aaa!important}}';
                title.textContent = msg; pre.textContent = safeTxt;
                allow.textContent = '允许'; deny.textContent = '拒绝';
                dialog.append(title, pre, btns); btns.append(allow, deny);
            } else if (currentUI === 'EDGE') {
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;z-index:2147483647;padding-bottom:40px;box-sizing:border-box;' + baseInteractive;
                dialog.style.cssText = 'background:#fff;border-radius:24px;width:92%;max-width:350px;padding:28px 24px;display:flex;flex-direction:column;gap:20px;box-shadow:0 12px 40px rgba(0,0,0,0.2);animation:edge-pop 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';
                title.style.cssText = 'margin:0;font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.4;text-align:left;';
                pre.style.cssText = 'margin:0;padding:14px;background:#f5f5f5;border-radius:10px;font-size:13px;color:#444;max-height:120px;display:' + (txt ? 'block' : 'none') + ';line-height:1.5;' + scrollStyle;
                btns.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
                allow.style.cssText = 'width:100%;height:52px;border:none;border-radius:14px;background:#2F78EE;color:#fff;font-size:16px;font-weight:600;cursor:pointer;' + baseInteractive;
                deny.style.cssText = 'width:100%;height:52px;border:none;background:none;color:#2F78EE;font-size:16px;font-weight:600;cursor:pointer;' + baseInteractive;
                cs.textContent = '@keyframes edge-pop{from{opacity:0;transform:translateY(30px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}} @media(prefers-color-scheme:dark){.auth-modal-bg div:first-child{background:#1c1c1c!important;border:1px solid #333}h3{color:#eee!important}.auth-modal-bg div div:nth-child(2){background:#2b2b2b!important;color:#bbb!important}}';
                title.textContent = msg; pre.textContent = safeTxt;
                allow.textContent = '允许复制'; deny.textContent = '拒绝复制';
                btns.append(allow, deny); dialog.append(title, pre, btns);
            } else {
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:16px;box-sizing:border-box;' + baseInteractive;
                dialog.style.cssText = 'background:rgba(255,255,255,.95);border-radius:18px;width:88vw;max-width:420px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:16px;border:1px solid rgba(0,0,0,.06);overflow:hidden;';
                title.style.cssText = 'margin:16px 0 0;padding:0 20px;font-size:18px;font-weight:700;color:#111;line-height:1.3;';
                pre.style.cssText = 'margin:0 20px;padding:14px;background:#f8f8f8;border-radius:12px;font-family:monospace;font-size:13px;color:#111;max-height:160px;display:' + (txt ? 'block' : 'none') + ';line-height:1.4;' + scrollStyle;
                btns.style.cssText = 'display:flex;gap:12px;margin:0 20px;padding-bottom:20px;';
                allow.style.cssText = 'flex:1;height:48px;border:none;border-radius:14px;background:#007AFF;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,122,255,.35);' + baseInteractive;
                deny.style.cssText = 'flex:1;height:48px;border:none;border-radius:14px;background:#FF3B30;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(255,59,48,.35);' + baseInteractive;
                cs.textContent = '@media(prefers-color-scheme:dark){.auth-modal-bg div:first-child{background:rgba(40,40,40,.95)!important;border-color:rgba(255,255,255,.1)!important}h3,.auth-modal-bg div div{color:#eee!important}.auth-modal-bg div div:nth-child(2){background:#222!important}}';
                title.textContent = msg; pre.textContent = safeTxt;
                allow.textContent = '允许'; deny.textContent = '拒绝';
                dialog.append(title, pre, btns); btns.append(deny, allow);
            }

            shadowRoot.appendChild(cs);

            const clean = () => { modal.remove(); cs.remove(); isShowingModal = false; };
            allow.onclick = () => { clean(); r(true); };
            deny.onclick = () => { clean(); r(false); };
            modal.onclick = e => { if (e.target === modal) deny.onclick(); };

            modal.appendChild(dialog);
            shadowRoot.appendChild(modal);
        });
    };

    // ==========================================
    // 状态指示点
    // ==========================================
    const updateDot = () => {
        if (!dot) return;
        dot.style.backgroundColor = freeCopyMode ? '#34C759' : (!enabled ? '#8E8E93' : '#FF3B30');
        clearTimeout(hideTimer);
        if (!freeCopyMode && enabled) {
            hideTimer = setTimeout(() => { if (dot && !freeCopyMode && enabled) { dot.remove(); dot = null; } }, 3000);
        }
    };

    const showDot = () => {
        if (blockCopy) return;                  // ✅ 永久禁止时不再提示
        if (dot) {
            clearTimeout(hideTimer);
            dot.style.opacity = '.8'; dot.style.transform = 'scale(1)';
            updateDot();
            return;
        }
        ensureShadow();
        dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;bottom:45%;right:10px;width:20px;height:20px;border-radius:10px;background:#FF3B30;z-index:2147483647;opacity:0;transform:scale(0);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:all .3s cubic-bezier(0.34,1.56,0.64,1);cursor:pointer;touch-action:none;will-change:transform,opacity;pointer-events:auto;';
        shadowRoot.appendChild(dot);
        requestAnimationFrame(() => { if (dot) { dot.style.opacity = '.8'; dot.style.transform = 'scale(1)'; } });
        updateDot();

        let taps = 0, timer = null;
        const handleTap = () => {
            taps++; clearTimeout(timer);
            timer = setTimeout(() => {
                if (taps === 1) {
                    if (enabled && !freeCopyMode) { freeCopyMode = true; }
                    else if (freeCopyMode) { freeCopyMode = false; }
                    else { enabled = true; denyCount = 0; restoreAllCopyAPIs(); hookAPI(); hookExec(); }
                } else if (taps === 2) {
                    freeCopyMode = true; enabled = true; denyCount = 0; restoreAllCopyAPIs(); hookAPI(); hookExec();
                }
                updateDot(); taps = 0;
            }, 300);
        };
        dot.onclick = handleTap;
        dot.ontouchstart = e => { e.preventDefault(); handleTap(); };
    };

    // ==========================================
    // 授权处理
    // 弹窗被占用返回 null → 本次失败但不计入拒绝
    // ✅ blockCopy 时直接拒绝，不弹窗
    // ==========================================
    const handleAuth = (txt, successCb, failCb) => {
        if (blockCopy) return failCb?.();                       // ✅ 本站永久禁止复制
        if (freeCopyMode) return successCb();
        if (!enabled || denyCount >= MAX_DENY) return failCb?.();
        showDot();
        showConfirm('允许复制内容？', txt).then(ok => {
            if (ok === null) { failCb?.(); updateDot(); return; } // 弹窗占用，忽略，不累加 denyCount
            if (ok) {
                successCb(); allowCount++;
                if (allowCount >= AUTO_FREE_AFTER_ALLOW) freeCopyMode = true;
            } else {
                denyCount++;
                if (denyCount >= MAX_DENY) { enabled = false; hideAllModals(); disableAllCopyAPIs(); }
                failCb?.();
            }
            updateDot();
        });
    };

    // ==========================================
    // ✅ 统一状态应用：永久禁止 > 忽略本站 > 正常监控
    // ==========================================
    const applyCopyState = () => {
        const ig = gv('clipboard_ignore_' + location.host, false);
        if (blockCopy) {
            enabled = false;
            freeCopyMode = false;
            hideAllModals();
            if (dot) { dot.remove(); dot = null; }
            hookAPI(); hookExec();               // 保证复制一定被拦截
        } else if (ig) {
            enabled = false;
            freeCopyMode = false;
            restoreAllCopyAPIs();
            hideAllModals();
            if (dot) { dot.remove(); dot = null; }
        } else {
            enabled = true;
            denyCount = 0;
            restoreAllCopyAPIs();
            hookAPI(); hookExec();
        }
    };

    // ==========================================
    // Hook 复制 API
    // ==========================================
    const hookAPI = () => {
        if (origWriteText && navigator.clipboard) {
            try {
                navigator.clipboard.writeText = txt => new Promise((res, rej) => {
                    handleAuth(txt, () => origWriteText(txt).then(res).catch(rej), () => rej(new Error('Rejected')));
                });
            } catch (e) {}
        }
        if (origWrite && navigator.clipboard) {
            try {
                navigator.clipboard.write = data => new Promise((res, rej) => {
                    let txt = '';
                    try { txt = data?.[0]?.type === 'text/plain' ? '[ClipboardItem]' : ''; } catch (e) {}
                    handleAuth(txt, () => origWrite(data).then(res).catch(rej), () => rej(new Error('Rejected')));
                });
            } catch (e) {}
        }
    };

    const hookExec = () => {
        if (!originalExec) return;
        try {
            document.execCommand = function (cmd, ui, val) {
                if (cmd === 'copy') {
                    const sel = window.getSelection ? window.getSelection().toString() : '';
                    if (!sel) return originalExec(cmd, ui, val);
                    handleAuth(sel, () => {
                        const ta = document.createElement('textarea');
                        ta.value = sel; ta.style.cssText = 'position:fixed;opacity:0;';
                        document.body.appendChild(ta); ta.select(); originalExec('copy'); ta.remove();
                    });
                    return false;
                }
                return originalExec(cmd, ui, val);
            };
        } catch (e) {}
    };

    // ==========================================
    // 编辑模式（点击定位光标；定位失败兜底到末尾）
    // ==========================================
    const enableContentEdit = () => {
        if (editAbortController) return;
        editAbortController = new AbortController();
        const { signal } = editAbortController;
        let t = null;
        const start = (e) => {
            const el = e.target;
            if (!el?.tagName || !['P','SPAN','DIV','H1','H2','H3','H4','H5','LI','B','FONT'].includes(el.tagName)) return;
            // 记录点击坐标（触摸/鼠标兼容）
            const point = e.touches?.[0] || e;
            const px = point.clientX, py = point.clientY;
            t = setTimeout(() => {
                const parent = el.parentNode;
                if (parent) Array.from(parent.children).forEach(s => { if (s.tagName === el.tagName) { s.style.userSelect = 'text'; s.style.webkitUserSelect = 'text'; } });
                el.setAttribute('contenteditable', 'true'); el.focus();
                const bg = el.style.backgroundColor; el.style.backgroundColor = 'rgba(255,255,0,0.15)';
                // 把光标放到点击位置，而不是全选
                const sel = window.getSelection();
                let caret = null;
                if (document.caretRangeFromPoint) caret = document.caretRangeFromPoint(px, py);
                else if (document.caretPositionFromPoint) {
                    const cp = document.caretPositionFromPoint(px, py);
                    if (cp) { caret = document.createRange(); caret.setStart(cp.offsetNode, cp.offset); caret.collapse(true); }
                }
                if (caret) { sel.removeAllRanges(); sel.addRange(caret); }
                else {
                    // 定位失败兜底：光标折叠到元素末尾，保证能进入编辑
                    try {
                        const r2 = document.createRange();
                        r2.selectNodeContents(el); r2.collapse(false);
                        sel.removeAllRanges(); sel.addRange(r2);
                    } catch (e) {}
                }
                el.addEventListener('blur', () => { el.removeAttribute('contenteditable'); el.style.backgroundColor = bg; }, { once: true });
            }, 800);
        };
        const stop = () => { if (t) clearTimeout(t); };
        document.addEventListener('mousedown', start, { capture: true, signal });
        document.addEventListener('mouseup', stop, { capture: true, signal });
        document.addEventListener('touchstart', start, { capture: true, signal, passive: true });
        document.addEventListener('touchend', stop, { capture: true, signal, passive: true });
    };
    const disableContentEdit = () => { if (editAbortController) { editAbortController.abort(); editAbortController = null; } };

    // ==========================================
    // ✅ 核心修复：toggleUnlock
    // 不再对 mousedown 做任何处理（用户需要正常点击页面按钮）
    // selectstart + CSS user-select 足以解决文本选择限制
    // ==========================================
    const toggleUnlock = (active) => {
        if (active === unlockActive) return;
        unlockActive = active;

        if (active) {
            // CSS 强制允许文本选择（这是对抗页面复制限制的主要手段）
            if (!unlockBaseStyle) {
                unlockBaseStyle = document.createElement('style');
                unlockBaseStyle.id = 'unlock-css-base';
                unlockBaseStyle.innerHTML = '*{user-select:text!important;-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;}';
                (document.head || document.documentElement).appendChild(unlockBaseStyle);
            }

            if (!unlockEventsBound) {
                // ✅ 完全不包含 mousedown → 所有点击正常工作
                const evs = ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart', 'beforecopy'];

                evs.forEach(n => {
                    const handler = (e) => {
                        // 只在解锁激活时阻断页面的事件拦截
                        if (!enabled && !freeCopyMode && !editAbortController) return;
                        e.stopImmediatePropagation();
                    };
                    document.addEventListener(n, handler, { capture: true, passive: false });
                    unlockCleanupFns.push(() => document.removeEventListener(n, handler, { capture: true }));
                    try {
                        Object.defineProperty(document, 'on' + n, { get: () => null, set: () => {}, configurable: true });
                    } catch (e) {}
                });

                unlockEventsBound = true;
            }
        } else {
            // 关闭解锁：移除 CSS + 清理事件监听
            if (unlockBaseStyle) { unlockBaseStyle.remove(); unlockBaseStyle = null; }
            unlockCleanupFns.forEach(fn => fn());
            unlockCleanupFns = [];
            unlockEventsBound = false;
        }
    };

    // ==========================================
    // iframe 支持
    // ==========================================
    const setupFrame = iframe => {
        try {
            const doc = iframe.contentDocument;
            const win = doc?.defaultView;
            const fe = doc?.execCommand ? doc.execCommand.bind(doc) : null;
            if (!doc || !win || !fe) return;
            doc.execCommand = function (cmd, ui, val) {
                if (cmd === 'copy') {
                    const sel = win.getSelection ? win.getSelection().toString() : '';
                    if (!sel) return fe(cmd, ui, val);
                    handleAuth(sel, () => {
                        const ta = doc.createElement('textarea');
                        ta.value = sel; ta.style.cssText = 'position:fixed;opacity:0;';
                        doc.body.appendChild(ta); ta.select(); fe('copy'); ta.remove();
                    });
                    return false;
                }
                return fe(cmd, ui, val);
            };
        } catch (e) {}
    };

    // 同时处理直接新增的 iframe 与嵌套在新增容器内的 iframe
    const obs = new MutationObserver(m => {
        for (const rec of m) for (const n of rec.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.tagName === 'IFRAME') setupFrame(n);
            else if (n.querySelectorAll) n.querySelectorAll('iframe').forEach(setupFrame);
        }
    });

    // ==========================================
    // ✅ 设置面板
    // ==========================================
    const registerMenu = () => {
        if (typeof GM_registerMenuCommand === 'undefined' || menuRegistered) return;
        menuRegistered = true;

        GM_registerMenuCommand('剪切板设定 🛠️', () => {
            if (shadowRoot?.querySelector('.asm')) return;
            ensureShadow();

            const isIgnored = gv('clipboard_ignore_' + location.host, false);
            const isBlocked = gv('clipboard_block_' + location.host, false);
            // 打开时取一次深色模式，后续复用
            const dk = window.matchMedia('(prefers-color-scheme:dark)').matches;

            const style = document.createElement('style');
            style.textContent = `
                .asm { position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.35);z-index:2147483646;display:flex;align-items:center;justify-content:center;pointer-events:auto;animation:asmIn .2s ease }
                .asp { background:#fff;border-radius:24px;box-shadow:0 20px 60px rgba(0,0,0,.2);padding:24px;display:flex;flex-direction:column;gap:10px;min-width:260px;font-family:system-ui,-apple-system,sans-serif;animation:aspIn .25s cubic-bezier(.16,1,.3,1) }
                .asp button { border:none;border-radius:14px;padding:14px 16px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between;transition:transform .1s;pointer-events:auto }
                .asp button:active { transform:scale(.96) }
                .asp .bu { background:#f5f5f5;color:#007AFF }
                .asp .bs { background:#f6ffed;color:#52c41a }
                .asp .bc { margin-top:4px;background:none;color:#888;font-size:13px;text-align:center;padding:12px }
                .asp .bc:hover { color:#333 }
                @media(prefers-color-scheme:dark){
                    .asm{background:rgba(0,0,0,.5)}
                    .asp{background:#1c1c1e}
                    .bu{background:#2c2c2e;color:#0A84FF}
                    .bs{background:#162312;color:#30d158}
                    .bc{color:#aaa}.bc:hover{color:#fff}
                }
                @keyframes asmIn{from{opacity:0}to{opacity:1}}
                @keyframes aspIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
            `;
            shadowRoot.appendChild(style);

            const mask = document.createElement('div');
            mask.className = 'asm';
            const panel = document.createElement('div');
            panel.className = 'asp';

            // --- 界面风格按钮 ---
            const btnUI = document.createElement('button');
            btnUI.className = 'bu';
            const refreshUI = () => { btnUI.innerHTML = `<span>界面风格</span><small style="opacity:.6;font-weight:400">${currentUI}</small>`; };
            refreshUI();
            btnUI.onclick = e => {
                e.stopPropagation();
                currentUI = UI_TYPES[(UI_TYPES.indexOf(currentUI)+1) % UI_TYPES.length];
                if (typeof GM_setValue !== 'undefined') GM_setValue('clipboard_ui_style', currentUI);
                refreshUI();
            };

            // --- 复制授权按钮 ---
            const btnStatus = document.createElement('button');
            btnStatus.className = 'bs';

            // --- ✅ 当前网站永久禁止复制按钮 ---
            const btnBlock = document.createElement('button');
            btnBlock.className = 'bs';

            const paintStatus = (ig) => {
                btnStatus.innerHTML = `<span>复制授权</span><small style="font-weight:700">${ig?'已禁用':'监控中'}</small>`;
                btnStatus.style.background = ig ? (dk?'#2c1515':'#fff1f0') : (dk?'#162312':'#f6ffed');
                btnStatus.style.color = ig ? (dk?'#ff6961':'#ff4d4f') : (dk?'#30d158':'#52c41a');
            };
            const paintBlock = (b) => {
                btnBlock.innerHTML = `<span>本站永久禁止复制</span><small style="font-weight:700">${b?'已禁止':'未禁止'}</small>`;
                btnBlock.style.background = b ? (dk?'#2c1515':'#fff1f0') : (dk?'#162312':'#f6ffed');
                btnBlock.style.color = b ? (dk?'#ff6961':'#ff4d4f') : (dk?'#30d158':'#52c41a');
            };

            paintStatus(isIgnored);
            paintBlock(isBlocked);

            btnStatus.onclick = e => {
                e.stopPropagation();
                const cur = !gv('clipboard_ignore_' + location.host, false);
                sv('clipboard_ignore_' + location.host, cur);
                // 开启“不监控”时，自动解除“永久禁止”，两者互斥
                if (cur && blockCopy) {
                    blockCopy = false;
                    sv('clipboard_block_' + location.host, false);
                    paintBlock(false);
                }
                paintStatus(cur);
                applyCopyState();
            };

            btnBlock.onclick = e => {
                e.stopPropagation();
                const nv = !gv('clipboard_block_' + location.host, false);
                blockCopy = nv;
                sv('clipboard_block_' + location.host, nv);
                // 开启“永久禁止”时，自动关闭“复制授权监控”
                if (nv) {
                    sv('clipboard_ignore_' + location.host, false);
                    paintStatus(false);
                }
                paintBlock(nv);
                applyCopyState();
            };

            // --- 解除复制限制按钮 ---
            const isUnlockAllowed = gv('clipboard_unlock_' + location.host, true);
            const btnUnlock = document.createElement('button');
            btnUnlock.className = 'bs';
            const refreshUnlock = (a) => {
                btnUnlock.innerHTML = `<span>解除复制限制</span><small style="font-weight:700">${a?'运行中':'已禁用'}</small>`;
                btnUnlock.style.background = a ? (dk?'#162312':'#f6ffed') : (dk?'#2c1515':'#fff1f0');
                btnUnlock.style.color = a ? (dk?'#30d158':'#52c41a') : (dk?'#ff6961':'#ff4d4f');
            };
            refreshUnlock(isUnlockAllowed);
            btnUnlock.onclick = e => {
                e.stopPropagation();
                const nv = !gv('clipboard_unlock_' + location.host, true);
                sv('clipboard_unlock_' + location.host, nv);
                refreshUnlock(nv);
                toggleUnlock(nv);
            };

            // --- 编辑模式按钮 ---
            const btnEdit = document.createElement('button');
            btnEdit.className = 'bu';
            const refreshEdit = () => {
                const on = editAbortController !== null;
                btnEdit.innerHTML = `<span>编辑模式</span><small style="opacity:.6;font-weight:400">${on?'开':'关'}</small>`;
                btnEdit.style.color = on ? '#FF9500' : (dk ? '#0A84FF' : '#007AFF');
            };
            refreshEdit();
            btnEdit.onclick = e => {
                e.stopPropagation();
                editAbortController !== null ? disableContentEdit() : enableContentEdit();
                refreshEdit();
            };

            // --- 关闭按钮 ---
            const btnClose = document.createElement('button');
            btnClose.className = 'bc';
            btnClose.textContent = '保存并关闭';
            btnClose.onclick = () => { mask.remove(); style.remove(); };
            mask.onclick = e => { if (e.target === mask) { mask.remove(); style.remove(); } };

            panel.append(btnUI, btnStatus, btnBlock, btnUnlock, btnEdit, btnClose);
            mask.appendChild(panel);
            shadowRoot.appendChild(mask);
        }, { id: 'ui_settings_main_v49' });
    };

    // ==========================================
    // 初始化
    // ==========================================
    const init = () => {
        if (inited) return;
        inited = true;

        // ✅ 永久禁止复制时，抢在 toggleUnlock 之前拦下原生 Ctrl+C / 右键复制
        document.addEventListener('copy', e => {
            if (!blockCopy) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, { capture: true, passive: false });

        blockCopy = gv('clipboard_block_' + location.host, false);

        const isUnlockAllowed = gv('clipboard_unlock_' + location.host, true);
        if (isUnlockAllowed) toggleUnlock(true);

        applyCopyState();
        registerMenu();

        try { obs.observe(document.documentElement, { childList: true, subtree: true }); document.querySelectorAll('iframe').forEach(setupFrame); } catch (e) {}
    };

    init();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
    else setTimeout(init, 0);

    // visibilitychange 替代 setInterval
    const checkHook = () => {
        if (!enabled && !freeCopyMode && !blockCopy) return;
        try { if (navigator.clipboard && origWriteText && navigator.clipboard.writeText === origWriteText) hookAPI(); } catch(e){}
        try { if (originalExec && document.execCommand === originalExec) hookExec(); } catch(e){}
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHook(); });
    window.addEventListener('focus', checkHook);
    window.addEventListener('beforeunload', () => { unlockCleanupFns.forEach(fn=>fn()); unlockCleanupFns=[]; }, { once: true });
})();
