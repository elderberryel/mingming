// ==UserScript==
// @name         自动关闭所有弹窗 v1.2
// @namespace    https://github.com/elderberryel/mingming
// @version      1.2
// @description  supxh.xin / 52pokemon.cc 上始终运行；其他网站只运行 3 秒后自动退出（菜单可手动添加始终运行站点）
// @author       明明
// @match        https://free.supxh.xin/*
// @match        *://*/*
// @match        https://supxh.xin/*
// @match        https://*.supxh.xin/*
// @match        https://web4.52pokemon.cc/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://elderberryel.github.io/mingming/自动关闭所有弹窗.user.js
// @downloadURL  https://elderberryel.github.io/mingming/自动关闭所有弹窗.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ============ 始终运行站点判断 ============
  // 内置始终运行站点（无法通过菜单移除）
  const BUILTIN_HOSTS = [
    /(^|\.)supxh\.xin$/i,
    /(^|\.)52pokemon\.cc$/i
  ];

  const STORAGE_KEY = 'autoclose_always_on_hosts';

  function loadCustomHosts() {
    try {
      let raw = '';
      if (typeof GM_getValue !== 'undefined') {
        raw = GM_getValue(STORAGE_KEY, '');
      } else {
        raw = localStorage.getItem(STORAGE_KEY) || '';
      }
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean);
      return String(raw).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    } catch (_) { return []; }
  }

  function saveCustomHosts(list) {
    const raw = list.join('\n');
    try {
      if (typeof GM_setValue !== 'undefined') GM_setValue(STORAGE_KEY, raw);
      else localStorage.setItem(STORAGE_KEY, raw);
    } catch (_) {}
  }

  function matchHost(patterns, host) {
    host = String(host || '').toLowerCase();
    return patterns.some(p => {
      if (p instanceof RegExp) return p.test(host);
      const s = String(p).toLowerCase().trim().replace(/^\*\./, '').replace(/^\./, '');
      if (!s) return false;
      return host === s || host.endsWith('.' + s);
    });
  }

  function isBuiltinHost(host) { return matchHost(BUILTIN_HOSTS, host); }

  function isAlwaysOnHost(host) {
    return isBuiltinHost(host) || matchHost(loadCustomHosts(), host);
  }

  // 当前站点是否始终运行（可被菜单动态修改）
  let alwaysOn = isAlwaysOnHost(location.hostname);

  // ============ 配置 ============
  const SCAN_MS = 250;
  const CLICK_COOLDOWN_MS = 300;
  const MAX_CLICKS_PER_ELEMENT = 2;
  const MAX_CLICKS_PER_DIALOG = 2;
  const MAX_CLICKS_PER_WINDOW = 15;
  const CLICK_WINDOW_MS = 6000;
  const RUN_TIME_MS = 3000; // 非白名单站点运行时长
  const SKIP_DIALOGS_WITH_FORMS = true;

  // ============ 选择器 / 词典 ============
  const DIALOG_SELECTOR = [
    '[data-slot="dialog-content"][data-state="open"]',
    '[data-slot="alert-dialog-content"][data-state="open"]',
    '[data-slot="sheet-content"][data-state="open"]',
    '[role="dialog"][data-state="open"]',
    '[role="alertdialog"][data-state="open"]',
    '[aria-modal="true"]',
    '.swal2-popup',
    '.layui-layer'
  ].join(',');

  const CLOSE_TEXT_RE = /^(?:×|✕|✖|⨯|x|关闭|關閉|close|got it|i know|知道了|我知道了|残忍拒绝|殘忍拒絕|残忍离开|狠心离开|放弃福利|放弃|不了|暂不|暫不|以后再说|以後再說|不再提示|取消|cancel|no thanks|not now|maybe later|later|skip|dismiss)$/i;

  // ============ 状态 ============
  const lastClickAt = new WeakMap();
  const clickCount = new WeakMap();
  const attemptMap = new WeakMap();
  const hiddenSet = new WeakSet();
  const clickTimes = [];

  let scanTimer = null;
  let mutationObserver = null;
  let shutdownTimer = null;
  let isRunning = true;

  function now() { return Date.now(); }

  function canClickNow() {
    const t = now();
    while (clickTimes.length && t - clickTimes[0] > CLICK_WINDOW_MS) clickTimes.shift();
    return clickTimes.length < MAX_CLICKS_PER_WINDOW;
  }
  function recordClick() { clickTimes.push(now()); }

  // ============ 工具 ============
  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' &&
        parseFloat(s.opacity || '1') > 0.05 && r.width > 0 && r.height > 0;
    } catch (_) { return false; }
  }

  function isClickable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled) return false;
    try {
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (_) { return false; }
  }

  function looksLikeCloseClass(cls) {
    if (!cls || typeof cls !== 'string') return false;
    const c = cls.toLowerCase();
    if (/(^|[\s_-])close([\s_-]|$)/.test(c)) return true;
    const compact = c.replace(/[\s_-]+/g, '');
    return compact === 'close' || compact.includes('closebtn') || compact.includes('btnclose') ||
      compact.includes('closebutton') || compact.includes('dialogclose') || compact.includes('closeicon');
  }

  function looksLikeCloseLabel(label) {
    if (!label) return false;
    return /(^|[\s\-_:])(close|关闭|關閉|schließen|fermer)([\s\-_:]|$)/i.test(label);
  }

  function isCloseText(el) {
    const t = (el.innerText || el.textContent || '').trim();
    return !!t && t.length <= 8 && CLOSE_TEXT_RE.test(t);
  }

  function fireClick(el) {
    const r = el.getBoundingClientRect();
    const base = {
      bubbles: true, cancelable: true, view: window,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0
    };
    const dispatch = (Ctor, type) => {
      try { el.dispatchEvent(new Ctor(type, base)); }
      catch (_) { try { el.dispatchEvent(new MouseEvent(type, base)); } catch (__) {} }
    };
    dispatch(window.PointerEvent || MouseEvent, 'pointerdown');
    dispatch(MouseEvent, 'mousedown');
    dispatch(window.PointerEvent || MouseEvent, 'pointerup');
    dispatch(MouseEvent, 'mouseup');
    dispatch(MouseEvent, 'click');
  }

  // ============ 隐藏兜底 ============
  function hideEl(el) {
    if (!el || el.getAttribute('data-supxh-hidden') === 'true') return;
    el.setAttribute('data-supxh-hidden', 'true');
  }

  function hideDialog(dialog) {
    if (hiddenSet.has(dialog)) return;
    hiddenSet.add(dialog);
    hideEl(dialog);
    const overlay = findPairedOverlay(dialog);
    if (overlay) hideEl(overlay);
    unlockPage();
    console.info('[autoclose] 兜底隐藏:', dialog);
  }

  function findPairedOverlay(dialog) {
    const parent = dialog.parentElement;
    if (!parent) return null;
    return parent.querySelector(
      ':scope > [data-slot$="-overlay"], :scope > [class*="backdrop"], :scope > [class*="overlay"], :scope > [class*="mask"], :scope > .modal-backdrop'
    );
  }

  function unlockPage() {
    try {
      [document.body, document.documentElement].forEach(el => {
        if (!el) return;
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
      });
      if (document.body && document.body.hasAttribute('data-scroll-locked')) {
        document.body.removeAttribute('data-scroll-locked');
      }
    } catch (_) {}
  }

  function hasVisibleForm(d) {
    return Array.from(d.querySelectorAll('input, textarea, select')).some(isVisible);
  }

  // ============ 第一遍：全局 × 清扫 ============
  function globalCloseClickPass() {
    const probes = new Set();

    document.querySelectorAll('[data-slot$="-close"]').forEach(el => probes.add(el));

    document.querySelectorAll('button, a, [role="button"], [class*="close" i], [aria-label], [title], svg').forEach(el => {
      if (el.getAttribute('data-slot') && el.getAttribute('data-slot').endsWith('-close')) { probes.add(el); return; }
      const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).trim();
      if (looksLikeCloseLabel(label) || looksLikeCloseClass(el.className) || isCloseText(el)) probes.add(el);
    });

    for (const el of probes) {
      if (!isClickable(el)) continue;
      const last = lastClickAt.get(el) || 0;
      if (now() - last < CLICK_COOLDOWN_MS) continue;
      const count = clickCount.get(el) || 0;
      if (count >= MAX_CLICKS_PER_ELEMENT) continue;
      if (!canClickNow()) return;
      lastClickAt.set(el, now());
      clickCount.set(el, count + 1);
      recordClick();
      console.info('[autoclose] 自动点击 ×:', el);
      fireClick(el);
    }
  }

  // ============ 第二遍：dialog 收尾 ============
  function dialogPass() {
    let dialogs;
    try { dialogs = document.querySelectorAll(DIALOG_SELECTOR); } catch (_) { return; }

    const visible = [];
    dialogs.forEach(d => {
      if (d === document.body || d === document.documentElement) return;
      if (d.getAttribute('data-supxh-hidden') === 'true') return;
      if (!isVisible(d)) return;
      const state = d.getAttribute('data-state');
      if (state && state !== 'open') return;
      visible.push(d);
    });
    const targets = visible.filter(d => !visible.some(o => o !== d && o.contains(d)));

    for (const d of targets) {
      if (SKIP_DIALOGS_WITH_FORMS && hasVisibleForm(d)) continue;
      const attempts = attemptMap.get(d) || 0;
      if (attempts >= MAX_CLICKS_PER_DIALOG || !canClickNow()) { hideDialog(d); continue; }

      const overlay = findPairedOverlay(d);
      if (overlay && isClickable(overlay)) {
        attemptMap.set(d, attempts + 1);
        recordClick();
        console.info('[autoclose] 点击遮罩:', d);
        fireClick(overlay);
      } else {
        hideDialog(d);
      }
    }

    document.querySelectorAll('[data-slot$="-overlay"][data-state="open"]').forEach(ov => {
      if (!isVisible(ov) || ov.getAttribute('data-supxh-hidden') === 'true') return;
      const parent = ov.parentElement;
      const hasContent = parent && parent.querySelector(
        ':scope > [data-slot$="-content"], :scope > [role="dialog"], :scope > [role="alertdialog"]'
      );
      if (!hasContent) { hideEl(ov); unlockPage(); }
    });
  }

  // ============ 扫描入口 ============
  function scan() {
    if (!isRunning || window.__supxhAutoClose === false) return;
    globalCloseClickPass();
    dialogPass();
  }

  // ============ 停止 ============
  function shutdown() {
    isRunning = false;
    if (scanTimer !== null) { clearInterval(scanTimer); scanTimer = null; }
    if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
    console.info('[autoclose] 运行时间到，脚本自动退出。');
  }

  // ============ 启动 ============
  function installStyle() {
    if (document.getElementById('supxh-auto-close-style')) return;
    const style = document.createElement('style');
    style.id = 'supxh-auto-close-style';
    style.textContent =
      'html, body { overflow: auto !important; overflow-y: auto !important; }' +
      '[data-supxh-hidden="true"] { visibility: hidden !important; pointer-events: none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }

  // ============ 菜单：始终运行站点管理 ============
  function registerMenu() {
    if (typeof GM_registerMenuCommand === 'undefined') return;
    const host = location.hostname;

    GM_registerMenuCommand(
      (alwaysOn ? '✅ ' : '⏱️ ') + '始终运行：' + host + '（点击切换）',
      () => {
        if (isBuiltinHost(host)) {
          alert('本站属于内置始终运行站点，无法关闭。');
          return;
        }
        const list = loadCustomHosts();
        const lowerHost = host.toLowerCase();
        const idx = list.findIndex(x => String(x).toLowerCase() === lowerHost);

        if (idx >= 0) {
          // 移除
          list.splice(idx, 1);
          saveCustomHosts(list);
          alwaysOn = isAlwaysOnHost(host);
          alert('已从"始终运行"列表移除：\n' + host +
            '\n\n本会话如已启动将持续运行，刷新页面后生效。');
        } else {
          // 添加
          list.push(host);
          saveCustomHosts(list);
          alwaysOn = true;
          if (shutdownTimer) { clearTimeout(shutdownTimer); shutdownTimer = null; }
          alert('已加入"始终运行"列表：\n' + host +
            '\n\n本会话立即生效，刷新后长期有效。');
        }
      },
      { id: 'autoclose_toggle_host' }
    );

    GM_registerMenuCommand(
      '📋 查看 / 清空已添加的站点',
      () => {
        const list = loadCustomHosts();
        if (!list.length) {
          alert('当前没有手动添加的站点。\n\n内置始终运行站点：\n- *.supxh.xin\n- *.52pokemon.cc');
          return;
        }
        if (confirm('当前已添加的站点：\n\n' + list.join('\n') + '\n\n是否清空？（点"取消"仅查看）')) {
          saveCustomHosts([]);
          alert('已清空。刷新页面后生效。');
        }
      },
      { id: 'autoclose_view_hosts' }
    );
  }

  // ============ 主流程 ============
  installStyle();
  scan();
  scanTimer = setInterval(scan, SCAN_MS);

  let moTimer = null;
  try {
    mutationObserver = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'childList' && m.addedNodes.length) {
          clearTimeout(moTimer);
          moTimer = setTimeout(scan, 60);
          return;
        }
      }
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { console.warn('autoclose observer error', e); }

  // 注册菜单
  try { registerMenu(); } catch (e) { console.warn('autoclose menu error', e); }

  // 白名单站点 → 永不退出；其他网站 → 3 秒后退出
  if (alwaysOn) {
    console.info('[autoclose] 本站已在始终运行列表，持续运行中。');
  } else {
    shutdownTimer = setTimeout(() => {
      shutdownTimer = null;
      if (alwaysOn) return; // 用户中途通过菜单添加
      shutdown();
    }, RUN_TIME_MS);
    console.info('[autoclose] 非白名单站点，将在 ' + (RUN_TIME_MS / 1000) + ' 秒后自动退出。\n（可通过油猴菜单添加本站为始终运行）');
  }
})();
