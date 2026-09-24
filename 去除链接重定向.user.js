// ==UserScript==
// @name         去除链接重定向
// @namespace    https://github.com/elderberryel/mingming
// @version      2.0
// @description  去除链接重定向
// @exclude      *://*.chatgpt.com/*
// @match        *://*/*
// @grant        GM.xmlHttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const MARK = "data-fixed";
  const cache = new Map();
  const pending = new Map();

  // 安全解码函数
  function safeDecode(url) {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }

  function clean(url) {
    try {
      const u = new URL(url, location.href);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"]
        .forEach(k => u.searchParams.delete(k));
      return u.toString();
    } catch {
      return url;
    }
  }

  function getParam(url, keys) {
    try {
      const p = new URL(url, location.href).searchParams;
      for (const k of keys) {
        const v = p.get(k);
        if (v) return safeDecode(v);
      }
    } catch {}
  }

  function isAuthPage() {
    const host = location.hostname;
    const path = location.pathname;

    if (/(^|\.)account\.stepfun\.com$/i.test(host) && /^\/login(\/|$)/i.test(path)) {
      return true;
    }

    return /\/(login|signin|sign-in|auth|oauth|sso|register|signup)(\/|$)/i.test(path);
  }

  (function () {
    if (isAuthPage()) return;
    const url = new URL(location.href);
    const p = url.searchParams;

    if (/pixiv\.net/i.test(location.host) && location.pathname === '/jump.php') {
      const search = location.search.substring(1);
      if (search && /^https?:/i.test(safeDecode(search))) {
        location.replace(clean(safeDecode(search)));
        return;
      }
    }

    const keys = ["url","target","u","dest","to","toasturl"];

    for (const k of keys) {
      const v = p.get(k);
      if (v && /^https?:/i.test(v)) {

        location.replace(safeDecode(v));
        return;
      }
    }

    if (/\/(jump|redirect|out|link|go)(\/|$)/i.test(location.pathname)) {
      const r = p.get("redirect");
      if (r && /^https?:/i.test(r)) {
        location.replace(clean(safeDecode(r)));
        return;
      }
    }

    // === 适配：书签地球 ===
    if (/bookmarkearth\.cn/i.test(location.host) && location.pathname.startsWith('/view/')) {
      const jumpToLink = () => {
        const el = document.querySelector('p.link');
        if (el) {
          const link = el.textContent.trim();
          // 防循环检测
          if (link && /^https?:/i.test(link) && link !== location.href) {
            setTimeout(() => {
              location.replace(link);
            }, 0);
            return true;
          }
        }
        return false;
      };

      if (!jumpToLink()) {
        const obs = new MutationObserver(() => {
          if (jumpToLink()) {
            obs.disconnect();
          }
        });
        const target = document.documentElement || document;
        obs.observe(target, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 3000);
      }
    }
    
    const tryExtractWarningLink = () => {
      const el = document.querySelector("p.url a, .url a, .notice .url a");
      if (el) {
        const link = (el.textContent || "").trim();
        if (link && /^https?:/i.test(link) && link !== location.href) {
          location.replace(clean(link));
          return true;
        }
      }
      return false;
    };

    if (!tryExtractWarningLink()) {
      const obs = new MutationObserver(() => {
        if (tryExtractWarningLink()) obs.disconnect();
      });
      obs.observe(document.documentElement || document, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 3000);
    }
  })();

  async function resolveShort(a) {
    const url = a.href;

    if (cache.has(url)) {
      a.href = cache.get(url);
      return;
    }

    if (pending.has(url)) {
      a.href = await pending.get(url);
      return;
    }

    let resolveFn;
    const p = new Promise(r => resolveFn = r);
    pending.set(url, p);

    try {
      const res = await GM.xmlHttpRequest({
        method: "GET",
        url,
        anonymous: true,
        timeout: 5000
      });

      const final = clean(res.finalUrl || url);
      cache.set(url, final);
      resolveFn(final);
      a.href = final;
    } catch {
      resolveFn(url);
    } finally {
      pending.delete(url);
    }
  }

  function fix(a) {
    if (!a.href || a.hasAttribute(MARK)) return;

    if (isAuthPage()) return;

    if (/pixiv\.net/i.test(location.host) && a.href.includes('/jump.php')) {
      const search = new URL(a.href, location.href).search.substring(1);
      if (search) {
        const decoded = safeDecode(search);
        if (/^https?:/i.test(decoded)) {
          a.href = clean(decoded);
          a.setAttribute(MARK, "1");
          return;
        }
      }
    }

    let real = getParam(a.href, [
      "url","target","u","dest","to","toasturl"
    ]);

    if (real) {
      a.href = clean(real);
      a.setAttribute(MARK, "1");
      return;
    }

    // ===== Google =====
    if (/google\./.test(location.host)) {
      const r = getParam(a.href, ["url","q"]);
      if (r) {
        a.href = clean(r);
        a.removeAttribute("ping");
        a.setAttribute(MARK, "1");
        return;
      }
    }

    // ===== 微博 =====
    if (/weibo/.test(location.host)) {
      const r = getParam(a.href, ["u","url","toasturl"]);
      if (r) {
        a.href = clean(r);
        a.setAttribute(MARK, "1");
        return;
      }
    }

    // ===== 短链 =====
    if (/t\.co|t\.cn|bit\.ly|tinyurl/.test(a.href)) {
      resolveShort(a);
      a.setAttribute(MARK, "1");
      return;
    }
  }

  function scan(root=document) {
    root.querySelectorAll("a").forEach(fix);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.tagName === "A") fix(n);
        else n.querySelectorAll?.("a").forEach(fix);
      }
    }
  }).observe(document, { childList: true, subtree: true });

})();
