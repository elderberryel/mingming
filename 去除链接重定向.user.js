// ==UserScript==
// @name         去除链接重定向 v10
// @namespace    https://h3110w0r1d.com/
// @version      10.0.0
// @description  
// @match        *://*/*
// @grant        GM.xmlHttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  /** ================= 页面级秒跳 ================= **/
  (function () {
    const url = new URL(location.href);
    const p = url.searchParams;

    // === 适配：Pixiv 跳转页 ===
    // 格式：/jump.php?https://target.com（目标URL直接跟在?后面，没有key）
    if (/pixiv\.net/i.test(location.host) && location.pathname === '/jump.php') {
      const search = location.search.substring(1);
      if (search && /^https?:/i.test(safeDecode(search))) {
        location.replace(clean(safeDecode(search)));
        return;
      }
    }

    // 通用参数跳转
    const keys = ["url","target","u","dest","redirect","to","toasturl"];

    for (const k of keys) {
      const v = p.get(k);
      if (v && /^https?:/i.test(v)) {
        // 使用 safeDecode 防止解码报错
        location.replace(safeDecode(v));
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

    // === 通用安全提示页识别 ===
    // 适用于各种"该链接不安全"/"即将跳转"的安全中间页
    // 常见结构：<p class="url"><a href="...">https://real-target.com</a></p>
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

  /** ================= 工具 ================= **/
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

  /** ================= 短链解析 ================= **/
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

  /** ================= 核心处理 ================= **/
  function fix(a) {
    if (!a.href || a.hasAttribute(MARK)) return;

    // ===== Pixiv jump.php =====
    // 格式：/jump.php?https://target.com（无参数名）
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

    // ===== 规则引擎 =====
    let real = getParam(a.href, [
      "url","target","u","dest","redirect","to","toasturl"
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

  /** ================= 扫描 ================= **/
  function scan(root=document) {
    root.querySelectorAll("a").forEach(fix);
  }

  /** ================= 启动 ================= **/
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  /** ================= 动态监听 ================= **/
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.tagName === "A") fix(n);
        else n.querySelectorAll?.("a").forEach(fix);
      }
    }
  }).observe(document, { childList: true, subtree: true });

})();
