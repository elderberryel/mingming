// ==UserScript==
// @name         网页广告拦截器
// @namespace    http://tampermonkey.net/
// @version      5.9.0
// @author       DeepSeek&Gemini
// @description  一个手机端浏览器能用的强大的广告拦截器，新增配置导入导出功能
// @match        *://*/*
// @exclude      *://*.baidu.*/*
// @exclude      *://*.sogou.*/*
// @exclude      *://*.so.*/*
// @exclude      *://*.bing.*/*
// @exclude      *://*.yandex.*/*
// @exclude      *://*.google.*/*
// @exclude      *://github.com/*
// @exclude      *://scriptcat.org/*
// @exclude      *://greasyfork.org/*
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ======================== 初始样式注入 ========================
  (function () {
    try {
      var s = document.createElement('style');
      s.setAttribute('data-adblock-hide-style', 'true');
      s.textContent = '.adblock-universal-hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;top:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;z-index:-999!important;}';
      (document.documentElement || document).appendChild(s);
    } catch (e) { }
  })();

  // ======================== 默认配置 ========================
  const DEFAULT_MODULE_STATE = {
    removeInlineScripts: false,
    removeExternalScripts: false,
    interceptThirdParty: false,
    blockDynamicScripts: false,
    manageCSP: false,
    overlayIntercept: false,
    scriptBlacklistMode: true,
  };
  const DEFAULT_CONFIG_STATE = {
    inlineScriptStrictMode: false,
    dynamicScriptStrictMode: false,
    thirdPartyStrictMode: false,
    thirdPartyStrictMethod: false,
    spoofUAEnabled: false,
    simplePlatformSpoof: false,
    residualCleanupEnabled: false,
    iframeUIFix: false,
    redirectBlockerEnabled: true,
    builtinBlacklistEnabled: true,
    redirectBlockerCompatibilityMode: false,
    heuristicBlacklistEnabled: false,
    crossTagPatternThreshold: 3,
  };
  const DEFAULT_CSP_RULES_TEMPLATE = [
    { id: 1, name: '只允许同源外部脚本', rule: "script-src 'self'", enabled: false },
    { id: 2, name: '只允许同源外部样式', rule: "style-src 'self'", enabled: false },
    { id: 3, name: '只允许同源图片', rule: "img-src 'self'", enabled: false },
    { id: 4, name: '只允许同源框架', rule: "frame-src 'self'", enabled: false },
    { id: 5, name: '只允许同源媒体', rule: "media-src 'self'", enabled: false },
    { id: 6, name: '只允许同源对象与嵌入', rule: "object-src 'self'", enabled: false },
    { id: 7, name: '只允许同源网络请求', rule: "connect-src 'self'", enabled: false },
  ];
  const BUILTIN_BLACKLIST_KEYWORDS = [
    'hm.baidu.com', 'tongji()', 'tj()', 'push.js', 'cnzz', 'histats.com', 'https://hongosi.xn--', '{return void 0!==b[a]?b[a]:a}).join("")}', '${scripts[randomIndex]}', '${scripts[Math.random()', 'https://"+Date.parse(new Date())+', 'https://"+(new Date().getDate())+"', 'https://{randomstr}.', 'new Function(t)()', 'new Function(b)()', 'new Function(c)()', 'new Function(t);', 'new Function(b);', 'new Function(c);', "new Function('d',e)", 'new Function(document[', 'new Function(function(p,a,c,k,e,d)', 'function a(a){', 'function b(b){', 'function c(c){', 'function updateCarousel()', 'Math.floor(2147483648 * Math.random());', 'Math.floor(Math.random()*url.length)', 'Math.floor(Math.random() * urls.length)', "new Date()['getTime']()", 'newDate=new window', 'Math.floor(((new Date()).getTime()', '&&navigator[', '=navigator;', 'navigator.platform){setTimeout(function', 'disableDebugger', 'blockDeveloperTools', '["Date"]())[\'getTime\']()', '</\'+\'s\'+\'c\'+\'ri\'+\'pt\'+\'>\')', '<\\/\'+\'s\'+\'c\'+\'ri\'+\'pt\'+\'>\')', '(\'#htmlContenthtml\').html', 'D.createElement(\'span\');', 'window.$m(', '{win:false,mac:false,xll:false}', 'function|getDate', 'parseInt(Math[\'random\''
  ];
  const HEURISTIC_REGEX_GROUPS = (() => {
    try {
      const hexGroup = [
        '(?:_0x[a-zA-Z0-9]{4,}.*){5,}',
        'parseInt\\s*\\(\\s*[\'"\\x60]0x[0-9a-fA-F]{2,}[\'"\\x60]?\\s*\\)\\s*(?:\\||\\^|&)',
        '(?:\\\\x[0-9a-fA-F]{2}){10,}',
        '(?:\\\\u[0-9a-fA-F]{4}){10,}',
        '\\\\x[0-9a-fA-F]{2}(?:\\\\x[0-9a-fA-F]{2}){20,}',
        '(?:\\^|\\||~)\\s*0x[0-9a-fA-F]{2,}\\s*(?:\\^|\\||~)',
        'parseInt\\s*\\([^)]+\\)\\s*\\^\\s*0x[0-9a-fA-F]{2,}',
      ];
      const domGroup = [
        '(?:window|document|navigator|location)\\s*\\[\\s*(?![\'"](?:getElementById|querySelector|addEventListener|removeEventListener|createElement|getElementsByClassName|getElementsByTagName|getComputedStyle|matchMedia|requestAnimationFrame|cancelAnimationFrame|fetch|XMLHttpRequest))[\'"]\\s*[^\\+]+?\\]\\s*\\(',
        '\\bwith\\s*\\(\\s*(?:document|window)\\s*\\)\\s*\\{',
        '(?:window|document)\\s*\\[\\s*[\'"][^\'"]+[\'"]\\s*\\+\\s*[\'"][^\'"]+[\'"]\\s*\\]\\s*[=;(]',
      ];
      const controlGroup = [
        'blockDeveloperTools|disableDebugger|devtoolschange',
        'setTimeout\\s*\\(\\s*[\'"\\x60](?:javascript:|eval\\s*\\(|Function\\s*\\()',
        'setInterval\\s*\\(\\s*[\'"\\x60](?:javascript:|eval\\s*\\(|Function\\s*\\()',
        'setTimeout\\s*\\(\\s*(?:function|\\(\\)\\s*=>)\\s*\\{[^}]*?location\\.(?:href|replace|assign)',
      ];
      const cipherGroup = [
        'atob\\s*\\([^)]*\\)[^;]{0,100}?(?:eval|Function)\\s*\\(',
        '(?:eval|Function|document\\.write)\\s*\\([^)]{0,200}?atob\\s*\\(',
        'atob\\s*\\(.+?\\.split\\s*\\(\\s*[\'"][\'"]\\s*\\)\\s*\\.map',
        '\\batob\\s*\\(\\s*[\'"][A-Za-z0-9+/=]{80,}[\'"]\\s*\\)[^;]{0,200}?(?:eval|Function|document\\.write|\\.src\\s*=|\\.href\\s*=)',
        'atob\\s*\\(.*?\\).*?atob\\s*\\(',
        'unescape\\s*\\(.*?\\)\\s*\\+\\s*unescape',
        '(?:eval|Function)\\s*\\([^)]{0,200}?unescape\\s*\\(',
        'unescape\\s*\\([^)]*\\)[^;]{0,100}?(?:eval|Function)\\s*\\(',
        '(?:eval|Function|JSON\\.parse)\\s*\\([^)]{0,200}?decodeURIComponent\\s*\\(',
        'decodeURIComponent\\s*\\([^)]*\\)[^;]{0,100}?(?:eval|Function)\\s*\\(',
        'JSON\\s*\\.\\s*parse\\s*\\(\\s*(?:atob|decodeURIComponent|unescape)\\s*\\(',
        '"[\\w\\-~!@#$%^&*()+=\\[\\]{}|\\\\:;\'<>,.?/` ]{60,}".*?"[\\w\\-~!@#$%^&*()+=\\[\\]{}|\\\\:;\'<>,.?/` ]{60,}"',
        '\\.replace\\s*\\(\\s*\\/\\\\\\\\[a-f0-9]+\\/g\\s*,\\s*[\'"\\x60]\\\\\\\\x[\'"\\x60]\\s*\\).*?eval',
        '(?:\\\\x[0-9a-fA-F]{2}){10,}[^;]{0,100}?eval',
        '(?:\\\\u[0-9a-fA-F]{4}){5,}[^;]{0,100}?eval',
        '(?:decodeURIComponent|atob|unescape)\\s*\\([^)]{5,}\\).*?(?:decodeURIComponent|atob|unescape)\\s*\\(',
        '(?:var|let|const)\\s+\\w+\\s*=\\s*[\'"][A-Za-z0-9+/=]{300,}[\'"][^;]{0,80}?(?:eval|Function)\\s*\\(',
        '(?:String\\.fromCharCode|fromCodePoint)\\s*\\([^)]{20,}\\)[^;]{0,100}?(?:eval|Function)\\s*\\(',
        '\\[\\d{2,3}(?:,\\d{2,3}){5,}\\][^;]{0,50}?(?:eval|Function|String\\.fromCharCode)\\s*\\(',
        '\\.split\\s*\\(\\s*""\\s*\\)\\s*\\.\\s*map\\s*\\([^)]{0,1000}\\)[^;]{0,1000}?new\\s+Function',
        '\\.split\\s*\\(\\s*[\'"][\'"]\\s*\\)\\.reverse\\s*\\(\\s*\\)\\.join',
        '\\.split\\s*\\(\\s*[\'"][^\'"]{1,5}[\'"]\\s*\\)\\s*\\.reverse\\s*\\(\\s*\\)\\s*\\.join',
        '\\.split\\s*\\(\\s*[\'"][^\'"]{1,5}[\'"]\\s*\\)\\s*\\.map\\s*\\([^)]{0,1000}\\)[^;]{0,500}?\\.(?:join|toString)',
        'String\\.fromCharCode\\.apply\\s*\\(null,\\s*\\[',
        '\\(function\\s*\\([^)]*\\)\\s*\\{[^}]{0,800}?(?:atob[^}]{0,800}?(?:eval|Function)|(?:eval|Function)[^}]{0,800}?atob)\\s*\\(',
        'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{[^}]*?atob[^}]*?(?:eval|Function)\\s*\\(',
        '(?:toString|split|replace|substring|substr|slice|trim|charAt|charCodeAt|join|reverse){5,}[^;]{0,200}?(?:eval|Function|atob|document\\.write)\\s*\\(',
        '(?:setTimeout|setInterval)\\s*\\(\\s*(?:function|\\(\\)\\s*=>)\\s*\\{[^}]{0,300}?(?:eval|Function|atob)\\s*\\(',
        '(?:fetch|XMLHttpRequest)\\s*\\(?[^)]{0,200}?\\)[^;]{0,300}?(?:eval|Function)\\s*\\(',
        '\\beval\\s*\\(\\s*atob\\s*\\(',
        '\\beval\\s*\\(\\s*String\\.fromCharCode\\s*\\(',
        '\\blocation\\s*\\.\\s*href\\s*=\\s*(?:atob|String\\.fromCharCode|decodeURIComponent)',
        '\\blocation\\s*(?:\\.\\s*href|\\[\\s*[\'"]href[\'"]\\s*\\])\\s*=\\s*[\'"][^\'"]{200,}',
        'setTimeout\\s*\\(\\s*[\'"][^\'"]*location\\.href[^\'"]*[\'"]',
        '\\b[a-zA-Z_]\\w{2,}\\s*\\(\\s*\\d{3,}(?:\\s*,\\s*\\d+)*\\s*\\)',
        '\\$\\s*\\(\\s*(?:function\\s*\\([^)]*\\)\\s*\\{|document\\)\\.ready)\\s*[^}]*?\\w{2,}\\s*\\(\\s*\\d{4,}',
        '^[a-zA-Z_$]\\w{2,}\\s*\\(\\s*\\d{3,}(?:\\s*,\\s*\\d+)*\\s*\\)\\s*;?\\s*$',
      ];
      const miscGroup = [
        'constructor\\s*\\(\\s*[\'"\\x60]return\\s+this[\'"\\x60]\\s*\\)\\s*\\(',
        '\\.constructor\\.constructor\\([^\\)]+\\)\\s*\\(',
        'try\\s*\\{[^}]{0,200}?(?:eval|Function|atob|document\\.write)\\s*\\([^)]{0,200}\\}\\s*catch\\s*\\(\\s*[a-zA-Z_]+\\s*\\)\\s*\\{\\s*\\}',
        '(?:try\\s*\\{[^}]*\\}\\s*catch\\s*\\(\\w+\\)\\s*\\{){3,}',
        'try\\s*\\{[^}]{0,150}\\}\\s*catch\\s*\\(\\s*\\w+\\s*\\)\\s*\\{\\s*return\\s+(?:_0x|this|constructor)',
        '\\.style\\.position\\s*=\\s*[\'"]fixed[\'"][\\s\\S]{0,50}?\\.style\\.zIndex\\s*=\\s*[\'"]?[1-9]\\d{4,}',
        '_0x[0-9a-f]+\\s*=\\s*function\\s*\\(\\s*_0x[0-9a-f]+\\s*,\\s*_0x[0-9a-f]+\\s*\\)',
        '_0x[0-9a-f]+\\s*=\\s*function\\s*\\(\\s*_0x[0-9a-f]+\\s*,\\s*_0x[0-9a-f]+\\s*,\\s*_0x[0-9a-f]+\\s*\\)',
        '(?:Object\\.keys|Object\\.values)\\s*\\(\\s*_0x[0-9a-f]+\\s*\\)\\.map\\s*\\(',
        '_0x[0-9a-f]+\\s*\\.forEach\\s*\\(\\s*(?:_0x[0-9a-f]+|function)\\s*\\(',
        '(?:const|let|var)\\s*\\{[^}]{5,}\\}\\s*=\\s*_0x[0-9a-f]+\\s*\\(',
        '!function\\s*\\(\\s*\\)\\s*\\{[^}]{0,200}return\\s+_0x[0-9a-f]+\\s*\\(',
        'JSON\\.parse\\s*\\(\\s*_0x[0-9a-f]+\\s*\\(',
        '(?:window|document|navigator)\\s*\\[\\s*[\'"][^\'"]{2,10}[\'"]\\s*\\+\\s*[\'"][^\'"]{2,10}[\'"]\\s*\\]',
        'function\\s+[a-z]\\d[a-z0-9]{5,}',
        '\\[\\s*[\'"][^\'"]{1,10}[\'"]\\s*\\+\\s*[\'"][^\'"]{1,10}[\'"]\\s*\\+\\s*[\'"][^\'"]{1,10}[\'"]\\s*\\]',
        'arguments\\s*\\[\\s*\\d+\\s*\\]\\s*\\(\\s*\\d+\\s*\\)',
        'try\\s*\\{\\s*[a-zA-Z_]\\w*?\\d{1,4}\\s*\\([^)]*\\)\\s*;?\\s*\\}\\s*catch\\s*\\(\\s*\\w+\\s*\\)\\s*\\{\\s*\\}?\\s*;?\\s*try\\s*\\{\\s*[a-zA-Z_]\\w*?\\d{1,4}\\s*\\([^)]*\\)\\s*;?\\s*\\}\\s*catch\\s*\\(\\s*\\w+\\s*\\)\\s*\\{\\s*\\}?\\s*;?\\s*try\\s*\\{\\s*[a-zA-Z_]\\w*?\\d{1,4}\\s*\\([^)]*\\)\\s*;?\\s*\\}\\s*catch\\s*\\(\\s*\\w+\\s*\\)\\s*\\{\\s*\\}?\\s*',
        'document\\.cookie[^;]{0,200}?(?:new\\s+)?Image\\s*[=(]',
        '_0x[0-9a-f]+\\s*\\(\\s*_0x[0-9a-f]+\\s*\\)[^;]{0,50}?(?:eval|Function|atob|JSON\\.parse)\\s*\\(',
        '\\b[a-zA-Z]{4,}(?:md|bm|tp|fn|cb|ex|rx|tx|dx|sx|px|qx|kx|one|two|three|four|five|six|seven|eight|nine|ten)\\s*\\(',
        '^\\s*[a-zA-Z_]\\w{3,}\\s*\\(\\s*\\)\\s*;?\\s*$',
      ];
      const baseGroups = [
        new RegExp(hexGroup.map(p => `(?:${p})`).join('|'), 'i'),
        new RegExp(domGroup.map(p => `(?:${p})`).join('|'), 'i'),
        new RegExp(controlGroup.map(p => `(?:${p})`).join('|'), 'i'),
        new RegExp(cipherGroup.map(p => `(?:${p})`).join('|'), 'i'),
        new RegExp(miscGroup.map(p => `(?:${p})`).join('|'), 'i'),
      ];
      return baseGroups;
    } catch (e) {
      return [];
    }
  })();

  let currentConfig = {
    ...DEFAULT_CONFIG_STATE,
    modules: { ...DEFAULT_MODULE_STATE },
    cspRules: DEFAULT_CSP_RULES_TEMPLATE.map((rule) => ({ ...rule })),
    whitelist: new Set(),
    keywordWhitelist: new Set(),
    scriptBlacklist: new Set(),
    thirdPartyWhitelist: [],
    removedBuiltinKeywords: new Set(),
    whitelistDisplayNames: new Map(),
  };

  const ConfigUpdater = {
    saveNow() {
      StorageManager.saveConfig();
    },
  };

  const StorageManager = {
    getConfigKey(domain) {
      return `adblock_unified_config_${domain}`;
    },
    loadConfig() {
      const hostname = location.hostname;
      const key = this.getConfigKey(hostname);
      try {
        const saved = GM_getValue(key, null);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.modules) Object.assign(currentConfig.modules, data.modules);
          if (data.cspRules) currentConfig.cspRules = data.cspRules.map((r) => ({ ...r }));
          if (Array.isArray(data.whitelist)) currentConfig.whitelist = new Set(data.whitelist);
          if (Array.isArray(data.keywordWhitelist)) currentConfig.keywordWhitelist = new Set(data.keywordWhitelist);
          if (Array.isArray(data.scriptBlacklist)) currentConfig.scriptBlacklist = new Set(data.scriptBlacklist);
          if (Array.isArray(data.thirdPartyWhitelist)) currentConfig.thirdPartyWhitelist = data.thirdPartyWhitelist;
          if (Array.isArray(data.removedBuiltinKeywords)) currentConfig.removedBuiltinKeywords = new Set(
            data.removedBuiltinKeywords
          );
          if (Array.isArray(data.whitelistDisplayNames)) {
            try {
              currentConfig.whitelistDisplayNames = new Map(data.whitelistDisplayNames);
            } catch (e) {
              currentConfig.whitelistDisplayNames = new Map();
            }
          }
          Object.keys(DEFAULT_CONFIG_STATE).forEach((configKey) => {
            if (data[configKey] !== undefined) {
              currentConfig[configKey] = data[configKey];
            } else if (currentConfig[configKey] === undefined) {
              currentConfig[configKey] = DEFAULT_CONFIG_STATE[configKey];
            }
          });
          if (data.crossTagPatternThreshold !== undefined && data.crossTagPatternThreshold !== 3) {
            currentConfig.crossTagPatternThreshold = data.crossTagPatternThreshold;
          }
        }
      } catch (e) {
        console.warn('[广告拦截器] 配置加载失败，已回退默认值:', e.message || e);
        try {
          GM_deleteValue(key);
        } catch (e2) { }
      }
    },
    saveConfig() {
      const hostname = location.hostname;
      const key = this.getConfigKey(hostname);
      const toStore = {
        modules: currentConfig.modules,
        cspRules: currentConfig.cspRules,
        whitelist: Array.from(currentConfig.whitelist),
        keywordWhitelist: Array.from(currentConfig.keywordWhitelist),
        scriptBlacklist: Array.from(currentConfig.scriptBlacklist),
        thirdPartyWhitelist: currentConfig.thirdPartyWhitelist,
        removedBuiltinKeywords: Array.from(currentConfig.removedBuiltinKeywords),
        whitelistDisplayNames: Array.from(currentConfig.whitelistDisplayNames.entries()),
      };
      Object.keys(DEFAULT_CONFIG_STATE).forEach((k) => {
        if (k === 'crossTagPatternThreshold' && currentConfig[k] === 3) return;
        toStore[k] = currentConfig[k];
      });
      GM_setValue(key, JSON.stringify(toStore));
    },
    resetAllSettings() {
      currentConfig.modules = { ...DEFAULT_MODULE_STATE };
      currentConfig.cspRules = DEFAULT_CSP_RULES_TEMPLATE.map((rule) => ({
        ...rule,
      }));
      currentConfig.whitelist.clear();
      currentConfig.keywordWhitelist.clear();
      currentConfig.scriptBlacklist.clear();
      currentConfig.thirdPartyWhitelist = [];
      currentConfig.removedBuiltinKeywords.clear();
      currentConfig.whitelistDisplayNames.clear();
      Object.keys(DEFAULT_CONFIG_STATE).forEach((k) => {
        currentConfig[k] = DEFAULT_CONFIG_STATE[k];
      });
      this.saveConfig();
    },
    // ======================== 导入导出功能 ========================
    // 导出当前域名配置（返回JSON字符串）
    exportCurrentConfig() {
      const hostname = location.hostname;
      const key = this.getConfigKey(hostname);
      const raw = GM_getValue(key, null);
      let configData = raw ? JSON.parse(raw) : null;
      if (!configData) {
        // 如果没有存储，则基于当前内存配置构造一份
        configData = {
          modules: currentConfig.modules,
          cspRules: currentConfig.cspRules,
          whitelist: Array.from(currentConfig.whitelist),
          keywordWhitelist: Array.from(currentConfig.keywordWhitelist),
          scriptBlacklist: Array.from(currentConfig.scriptBlacklist),
          thirdPartyWhitelist: currentConfig.thirdPartyWhitelist,
          removedBuiltinKeywords: Array.from(currentConfig.removedBuiltinKeywords),
          whitelistDisplayNames: Array.from(currentConfig.whitelistDisplayNames.entries()),
        };
        Object.keys(DEFAULT_CONFIG_STATE).forEach((k) => {
          if (k === 'crossTagPatternThreshold' && currentConfig[k] === 3) return;
          configData[k] = currentConfig[k];
        });
      }
      const exportObj = {
        version: '5.9.0',
        exportDate: new Date().toISOString(),
        domain: hostname,
        config: configData,
      };
      return JSON.stringify(exportObj, null, 2);
    },
    // 导入当前域名配置（覆盖）
    importCurrentConfig(jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.config || typeof parsed.config !== 'object') {
          throw new Error('无效的配置文件：缺少 config 字段');
        }
        const importData = parsed.config;
        const hostname = location.hostname;
        const key = this.getConfigKey(hostname);
        // 校验必要字段（至少包含 modules）
        if (!importData.modules) {
          throw new Error('配置文件缺少 modules 字段');
        }
        GM_setValue(key, JSON.stringify(importData));
        // 重新加载配置
        this.loadConfig();
        // 重置缓存和状态
        resetAllCachesAndStates();
        // 重新初始化所有模块
        if (typeof UIController !== 'undefined' && UIController.init) {
          UIController.uiInitialized = false;
          UIController.modulesInitialized = false;
          UIController.init();
        }
        return true;
      } catch (e) {
        console.error('[广告拦截器] 导入配置失败:', e);
        return false;
      }
    },
    // 导出全部域名配置
    exportAllConfigs() {
      const allKeys = GM_listValues();
      const configs = {};
      for (let i = 0; i < allKeys.length; i++) {
        const key = allKeys[i];
        if (key.startsWith('adblock_unified_config_')) {
          try {
            const raw = GM_getValue(key, null);
            if (raw) {
              const domain = key.replace('adblock_unified_config_', '');
              configs[domain] = JSON.parse(raw);
            }
          } catch (e) {}
        }
      }
      const exportObj = {
        version: '5.9.0',
        exportDate: new Date().toISOString(),
        type: 'all_domains',
        configs: configs,
      };
      return JSON.stringify(exportObj, null, 2);
    },
    // 导入全部域名配置（会覆盖已有配置）
    importAllConfigs(jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type !== 'all_domains' || !parsed.configs || typeof parsed.configs !== 'object') {
          throw new Error('无效的全局配置文件');
        }
        for (const domain in parsed.configs) {
          const key = this.getConfigKey(domain);
          GM_setValue(key, JSON.stringify(parsed.configs[domain]));
        }
        // 重新加载当前域名的配置
        this.loadConfig();
        resetAllCachesAndStates();
        if (typeof UIController !== 'undefined' && UIController.init) {
          UIController.uiInitialized = false;
          UIController.modulesInitialized = false;
          UIController.init();
        }
        return true;
      } catch (e) {
        console.error('[广告拦截器] 导入全局配置失败:', e);
        return false;
      }
    },
  };
  StorageManager.loadConfig();

  const URL_DYNAMIC_COMPILED = (() => {
    try {
      return new RegExp([
        '\\?.*[tT]=',
        '\\?.*timestamp',
        '\\?.*rand',
        '\\?.*rnd',
        '\\?.*[0-9]{13,}',
        '\\?.*\\d{10,}',
        '[0-9a-f]{32,}\\.'
      ].map(p => `(?:${p})`).join('|'));
    } catch (e) {
      return null;
    }
  })();

  const CONFIG = {
    Z_INDEX: 2147483640,
    CACHE_TTL: 300000,
    BATCH_SIZE: 20,
    LOG_MAX: 200,
    LOG_IDENTIFIER_TTL: 300000,
    STRONG_BLOCK_TIMEOUT: 600000,
    THROTTLE_LIMIT: 100,
    RESIDUAL_MIN_WIDTH: 30,
    RESIDUAL_MIN_HEIGHT: 30,
    CONTENT_PREVIEW_LENGTH: 200,
    LOG_DETAIL_LENGTH: 500,
    TOOLTIP_GAP: 12,
    ZINDEX_HIDE_THRESHOLD: 600,
    FIXED_HEIGHT_THRESHOLD: 50,
    CONTAINER_MIN_VISIBLE: 10,
    LAZY_PLACEHOLDER_MAX_LEN: 200,
    OVERLAY_MIN_SIZE: 30,
    DYNAMIC_URL_SHORT_TTL: 30000,
    INVALID_HOSTNAME_TTL: 30000,
    DATA_URL_TTL: 60000,
    IDLE_SCAN_INTERVAL: 3000,
    BATCH_SIZE_CLEANUP: 30,
    PAGE_SIZE: 20,
    CACHE_CAPACITY_URL: 1000,
    CACHE_CAPACITY_SMALL: 500,
    ANCHOR_CLICK_THROTTLE: 16,
  };

  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const _globals = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const _document = _globals.document;
  const _location = _globals.location;
  const _MutationObserver = _globals.MutationObserver;
  const _Element = _globals.Element;
  const _Document = _globals.Document;
  const _Node = _globals.Node;
  const _setTimeout = _globals.setTimeout;
  const _clearTimeout = _globals.clearTimeout;
  const _requestAnimationFrame = _globals.requestAnimationFrame;
  const _cancelAnimationFrame = _globals.cancelAnimationFrame;
  const _XMLHttpRequest = _globals.XMLHttpRequest;
  const _fetch = _globals.fetch;
  const _Proxy = _globals.Proxy;
  const _Set = _globals.Set;
  const _Map = _globals.Map;
  const _IntersectionObserver = _globals.IntersectionObserver;
  const _AbortController = _globals.AbortController;
  const _getComputedStyle = _globals.getComputedStyle ? _globals.getComputedStyle.bind(_globals) : window.getComputedStyle;
  const _requestIdleCallback = _globals.requestIdleCallback || function (cb) {
    return _setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false }), 1);
  };
  const _cancelIdleCallback = _globals.cancelIdleCallback || _clearTimeout;

  function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  function generateContentHash(str) {
    if (typeof str !== 'string') return '';
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return 'hash_' + hash.toString(36);
  }

  const HASH_TYPE_PREFIX_MAP = {
    EVAL: 'EVAL_HASH',
    FUNCTION_CONSTRUCTOR: 'FUNCTION_HASH',
    DOCUMENT_WRITE: 'DOCUMENT_WRITE_HASH',
    SETTIMEOUT: 'SETTIMEOUT_HASH',
    SETINTERVAL: 'SETINTERVAL_HASH',
    REQUESTANIMATIONFRAME: 'REQUESTANIMATIONFRAME_HASH',
  };
  const HASH_TYPE_NAMES = Object.keys(HASH_TYPE_PREFIX_MAP);
  const OBFUSCATION_SUFFIX_RE = /_(?:OBFUSCATED|INDIRECT)$/i;
  function extractFirstUrl(detail) {
    if (!detail || typeof detail !== 'string' || !detail.includes('://')) return null;
    var m = detail.match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
  }
  function getBaseReasonType(type) {
    return type ? type.replace(OBFUSCATION_SUFFIX_RE, '') : type;
  }

  class LRUCache {
    constructor(capacity, defaultTTL) {
      this.capacity = capacity || 100;
      this.defaultTTL = defaultTTL || 0;
      this.cache = new _Map();
    }
    get(key) {
      if (!this.cache.has(key)) return null;
      const entry = this.cache.get(key);
      const ttl = entry.ttl !== undefined ? entry.ttl : this.defaultTTL;
      if (ttl > 0 && Date.now() - entry.timestamp > ttl) {
        this.cache.delete(key);
        return null;
      }
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }
    set(key, value, ttl) {
      const finalTTL = ttl !== undefined ? ttl : this.defaultTTL;
      const entry = { value: value, timestamp: Date.now(), ttl: finalTTL };
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.capacity) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, entry);
    }
    has(key) {
      const entry = this.cache.get(key);
      if (!entry) return false;
      const ttl = entry.ttl !== undefined ? entry.ttl : this.defaultTTL;
      if (ttl > 0 && Date.now() - entry.timestamp > ttl) {
        this.cache.delete(key);
        return false;
      }
      return true;
    }
    delete(key) {
      return this.cache.delete(key);
    }
    clear() {
      this.cache.clear();
    }
    get size() {
      return this.cache.size;
    }
  }

  const PUBLIC_SUFFIX_LIST = new Set([
    'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk', 'gov.uk',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
    'co.jp', 'ne.jp', 'or.jp', 'go.jp', 'ac.jp', 'ad.jp',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
    'co.nz', 'org.nz', 'net.nz', 'edu.nz', 'govt.nz',
    'com.hk', 'org.hk', 'edu.hk', 'gov.hk', 'net.hk',
    'com.tw', 'net.tw', 'org.tw', 'edu.tw', 'gov.tw', 'idv.tw', 'game.tw', 'ebiz.tw', 'club.tw'
  ]);
  const COMMON_SLD_HEURISTIC = ['com', 'co', 'org', 'net', 'edu', 'gov', 'ac', 'go'];

  class URLResolutionCache {
    constructor() {
      this.hostnameCache = new LRUCache(CONFIG.CACHE_CAPACITY_URL, CONFIG.CACHE_TTL);
      this.domainCache = new LRUCache(CONFIG.CACHE_CAPACITY_URL, CONFIG.CACHE_TTL);
      this.absoluteUrlCache = new LRUCache(CONFIG.CACHE_CAPACITY_URL, CONFIG.CACHE_TTL);
      this.thirdPartyCache = new LRUCache(CONFIG.CACHE_CAPACITY_URL, CONFIG.CACHE_TTL);
      this.whitelistCache = new LRUCache(CONFIG.CACHE_CAPACITY_SMALL, CONFIG.CACHE_TTL);
      this.urlCheckCache = new LRUCache(CONFIG.CACHE_CAPACITY_SMALL, CONFIG.CACHE_TTL);
    }
    isDynamicURL(url) {
      if (!url || typeof url !== 'string') return false;
      const cacheKey = 'dynamic_' + url;
      if (this.urlCheckCache.has(cacheKey)) return this.urlCheckCache.get(cacheKey);
      const result = URL_DYNAMIC_COMPILED ? URL_DYNAMIC_COMPILED.test(url) : false;
      this.urlCheckCache.set(cacheKey, result, CONFIG.CACHE_TTL);
      return result;
    }
    getHostname(url) {
      if (!url || typeof url !== 'string') return null;
      const cacheKey = 'hostname_' + url;
      if (this.hostnameCache.has(cacheKey)) return this.hostnameCache.get(cacheKey);
      if (
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('about:blank')
      ) {
        this.hostnameCache.set(cacheKey, null, CONFIG.DATA_URL_TTL);
        return null;
      }
      try {
        const hostname = new URL(url, _location.href).hostname;
        this.hostnameCache.set(cacheKey, hostname, CONFIG.CACHE_TTL);
        return hostname;
      } catch (e) {
        this.hostnameCache.set(cacheKey, null, CONFIG.INVALID_HOSTNAME_TTL);
        return null;
      }
    }
    isIPv4(hostname) {
      return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    }
    getDomain(hostname) {
      if (!hostname) return null;
      const cacheKey = 'domain_' + hostname;
      if (this.domainCache.has(cacheKey)) return this.domainCache.get(cacheKey);
      if (this.isIPv4(hostname)) {
        this.domainCache.set(cacheKey, hostname, CONFIG.CACHE_TTL);
        return hostname;
      }
      const parts = hostname.split('.');
      let domain = hostname;
      for (let i = 1; i <= parts.length; i++) {
        const candidate = parts.slice(-i).join('.');
        if (PUBLIC_SUFFIX_LIST.has(candidate)) {
          if (i + 1 <= parts.length) {
            domain = parts.slice(-(i + 1)).join('.');
          } else {
            domain = candidate;
          }
          break;
        }
      }
      if (domain === hostname && parts.length > 2) {
        const tld = parts[parts.length - 1];
        const sld = parts[parts.length - 2];
        const isCountryCode = /^[a-z]{2}$/i.test(tld);
        if (isCountryCode && COMMON_SLD_HEURISTIC.indexOf(sld) !== -1) {
          domain = parts.slice(-3).join('.');
        } else {
          domain = parts.slice(-2).join('.');
        }
      }
      this.domainCache.set(cacheKey, domain, CONFIG.CACHE_TTL);
      return domain;
    }
    getAbsoluteURL(url) {
      if (!url) return '';
      const cacheKey = 'absolute_' + url + '_' + _location.href;
      if (this.absoluteUrlCache.has(cacheKey)) return this.absoluteUrlCache.get(cacheKey);
      try {
        const absoluteUrl = new URL(url, _location.href).href;
        const ttl = this.isDynamicURL(url) ? CONFIG.DYNAMIC_URL_SHORT_TTL : CONFIG.CACHE_TTL;
        this.absoluteUrlCache.set(cacheKey, absoluteUrl, ttl);
        return absoluteUrl;
      } catch (e) {
        this.absoluteUrlCache.set(cacheKey, url, CONFIG.INVALID_HOSTNAME_TTL);
        return url;
      }
    }
    isThirdPartyHost(resourceHostname, currentHost, blockParentSubDomains) {
      if (!resourceHostname) return false;
      const cacheKey = 'thirdparty_' + resourceHostname + '_' + currentHost + '_' + blockParentSubDomains;
      if (this.thirdPartyCache.has(cacheKey)) return this.thirdPartyCache.get(cacheKey);
      let isThirdParty = false;
      if (!currentHost || !resourceHostname) {
        isThirdParty = false;
      } else if (resourceHostname === currentHost) {
        isThirdParty = false;
      } else if (blockParentSubDomains) {
        isThirdParty = true;
      } else {
        const currentDomain = this.getDomain(currentHost);
        const resourceDomain = this.getDomain(resourceHostname);
        isThirdParty = currentDomain !== resourceDomain;
      }
      this.thirdPartyCache.set(cacheKey, isThirdParty, CONFIG.CACHE_TTL);
      return isThirdParty;
    }
    isWhitelisted(url, thirdPartyWhitelist) {
      if (!url || !thirdPartyWhitelist) return false;
      const cacheKey = 'whitelist_' + url + '_' + _location.hostname;
      if (this.whitelistCache.has(cacheKey)) return this.whitelistCache.get(cacheKey);
      let isWhitelisted = false;
      for (const pattern of thirdPartyWhitelist) {
        if (!pattern) continue;
        try {
          if (pattern.includes('://')) {
            if (url.includes(pattern)) {
              isWhitelisted = true;
              break;
            }
          } else {
            const urlHost = new URL(url, _location.href).hostname;
            let patternHost = pattern.startsWith('*.') ? pattern.substring(2) : pattern;
            const escapeRegExp = function (str) {
              return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };
            patternHost = escapeRegExp(patternHost);
            const regex = new RegExp('(^|\\.)' + patternHost + '$');
            if (regex.test(urlHost)) {
              isWhitelisted = true;
              break;
            }
          }
        } catch (e) {
          if (url.includes(pattern)) {
            isWhitelisted = true;
            break;
          }
        }
      }
      this.whitelistCache.set(cacheKey, isWhitelisted, CONFIG.CACHE_TTL);
      return isWhitelisted;
    }
    clear() {
      this.hostnameCache.clear();
      this.domainCache.clear();
      this.absoluteUrlCache.clear();
      this.thirdPartyCache.clear();
      this.whitelistCache.clear();
      this.urlCheckCache.clear();
    }
  }
  const urlCache = new URLResolutionCache();

  const ProcessedElementsCache = {
    _processedElements: new WeakSet(),
    isProcessed(element) {
      return element instanceof _Element && this._processedElements.has(element);
    },
    markAsProcessed(element) {
      if (element instanceof _Element) this._processedElements.add(element);
    },
    unmark(element) {
      if (element instanceof _Element) {
        this._processedElements.delete(element);
      }
    },
    clear() {
      this._processedElements = new WeakSet();
    },
  };

  const MODULE_NAMES = {
    removeInlineScripts: '移除内嵌脚本',
    removeExternalScripts: '移除外联脚本',
    blockDynamicScripts: '拦截动态脚本',
    interceptThirdParty: '拦截第三方资源',
    overlayIntercept: '覆盖层拦截',
    manageCSP: 'CSP策略管理',
    scriptBlacklistMode: '脚本黑名单模式',
  };

  const Utils = {
    truncateString: function (str, maxLength) {
      maxLength = maxLength || CONFIG.CONTENT_PREVIEW_LENGTH;
      if (typeof str !== 'string') return '';
      if (str.length <= maxLength) return str;
      return str.slice(0, maxLength) + '...';
    },
    getCurrentHostname: function () {
      return _location.hostname;
    },
    isElement: function (el) {
      return el instanceof _Element;
    },
    getScriptContentPreview: function (scriptElement) {
      if (!scriptElement || scriptElement.tagName !== 'SCRIPT') return '';
      return this.truncateString(
        scriptElement.textContent,
        CONFIG.CONTENT_PREVIEW_LENGTH
      );
    },
    getIframeSrcPreview: function (iframeElement) {
      if (!iframeElement || iframeElement.tagName !== 'IFRAME') return '';
      return this.truncateString(iframeElement.src, CONFIG.CONTENT_PREVIEW_LENGTH);
    },
    getResourceHostname: function (url) {
      return urlCache.getHostname(url);
    },
    getDomain: function (hostname) {
      return urlCache.getDomain(hostname);
    },
    isThirdPartyHost: function (resourceHostname, currentHost, blockParentSubDomains) {
      return urlCache.isThirdPartyHost(
        resourceHostname,
        currentHost,
        blockParentSubDomains
      );
    },
    isThirdParty: function (url, blockParentSubDomains) {
      blockParentSubDomains = blockParentSubDomains !== undefined ? blockParentSubDomains : true;
      if (!url) return false;
      try {
        var urlObj = new URL(url, _location.href);
        var hostname = urlObj.hostname;
        if (!hostname || url.startsWith('data:') || url.startsWith('blob:')) return false;
        return urlCache.isThirdPartyHost(hostname, this.getCurrentHostname(), blockParentSubDomains);
      } catch (e) {
        return false;
      }
    },
    shouldInterceptByModule: function (element, moduleKey) {
      if (!currentConfig.modules[moduleKey]) return false;
      if (
        ProcessedElementsCache.isProcessed(element) ||
        this.isParentProcessed(element)
      )
        return false;
      if (Whitelisting.isElementWhitelisted(element, moduleKey)) return false;
      return true;
    },
    getBlockParentSubDomainsSetting: function () {
      return !!currentConfig.thirdPartyStrictMode;
    },
    isUIElement: function (el) {
      return (
        el &&
        el.classList &&
        (el.classList.contains('mask') ||
          el.classList.contains('panel') ||
          el.id === 'ad-blocker-settings-container')
      );
    },
    isPanelElement: function (el) {
      return el && el.classList && el.classList.contains('panel');
    },
    isAnyModuleEnabled: function () {
      var mv = Object.values(currentConfig.modules);
      for (var i = 0; i < mv.length; i++) {
        if (mv[i] === true) return true;
      }
      return false;
    },
    isContainerEmpty: function (container, ignoreProcessedFlag) {
      ignoreProcessedFlag = ignoreProcessedFlag !== undefined ? ignoreProcessedFlag : true;
      if (!this.isElement(container)) return false;
      if (
        container.children.length === 0 &&
        container.textContent.trim() === ''
      ) {
        return this.isSuspiciousAdContainer(container);
      }
      let hasVisibleContent = false;
      for (const child of container.childNodes) {
        if (child.nodeType === _Node.TEXT_NODE && child.textContent.trim().length > 0) {
          hasVisibleContent = true;
          break;
        }
        if (child.nodeType === _Node.ELEMENT_NODE) {
          const el = child;
          if (ignoreProcessedFlag && ProcessedElementsCache.isProcessed(el)) continue;
          const style = _getComputedStyle(el);
          if (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          ) {
            if (
              el.tagName === 'IMG' ||
              el.tagName === 'VIDEO' ||
              el.tagName === 'CANVAS' ||
              (el.textContent && el.textContent.trim().length > 0)
            ) {
              hasVisibleContent = true;
              break;
            }
            if (
              el.offsetWidth > 0 &&
              el.offsetHeight > 0 &&
              el.tagName !== 'BR' &&
              el.tagName !== 'HR'
            ) {
              hasVisibleContent = true;
              break;
            }
          }
        }
      }
      return !hasVisibleContent;
    },
    isSuspiciousAdContainer: function (container) {
      if (!this.isElement(container)) return false;
      const style = _getComputedStyle(container);
      const hasVisualStyling = (style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        style.backgroundColor !== 'transparent') ||
        style.backgroundImage !== 'none' ||
        style.borderWidth !== '0px' ||
        style.boxShadow !== 'none';
      const hasSuspiciousPosition = style.position === 'absolute' || style.position === 'fixed' || style.position === 'sticky';
      const hasSuspiciousSize = parseFloat(style.width) > CONFIG.RESIDUAL_MIN_WIDTH &&
        parseFloat(style.height) > CONFIG.RESIDUAL_MIN_HEIGHT;
      const hasSpacing = style.paddingTop !== '0px' || style.paddingBottom !== '0px' ||
        style.marginTop !== '0px' || style.marginBottom !== '0px';
      const relativeWithStyle = style.position === 'relative' && hasVisualStyling &&
        (hasSuspiciousSize || hasSpacing);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      return (
        isVisible &&
        (hasSuspiciousPosition || hasSuspiciousSize || hasSpacing || relativeWithStyle)
      );
    },
    throttle: function (func, limit) {
      limit = limit || CONFIG.THROTTLE_LIMIT;
      let inThrottle;
      return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          _setTimeout(function () {
            inThrottle = false;
          }, limit);
        }
      };
    },
    isParentProcessed: function (element) {
      let parent = element.parentElement;
      while (parent) {
        if (ProcessedElementsCache.isProcessed(parent)) return true;
        parent = parent.parentElement;
      }
      return false;
    },
    getActiveBlacklistSet: function () {
      const set = new Set(currentConfig.scriptBlacklist);
      if (currentConfig.builtinBlacklistEnabled) {
        BUILTIN_BLACKLIST_KEYWORDS.forEach(function (k) {
          if (!currentConfig.removedBuiltinKeywords.has(k)) set.add(k);
        });
      }
      return set;
    },
    getActiveBlacklistArray: function () {
      return Array.from(this.getActiveBlacklistSet());
    },
    getContentIdentifier: function (element, reasonType) {
      if (!element && !reasonType) return null;
      if (element && this.isElement(element)) {
        const tagName = element.tagName;
        const srcAttrs = {
          SCRIPT: 'src', IFRAME: 'src', IMG: { src: 'src', dataSrc: 'data-src' },
          A: 'href', LINK: 'href', EMBED: 'src', OBJECT: 'data', STYLE: null
        };
        const handle = {
          SCRIPT: function (el) {
            return el.src
              ? 'SCRIPT_SRC: ' + Utils.truncateString(el.src, CONFIG.LOG_DETAIL_LENGTH)
              : 'SCRIPT_CONTENT: ' + Utils.truncateString(el.textContent, CONFIG.LOG_DETAIL_LENGTH);
          },
          IFRAME: function (el) {
            return 'IFRAME_SRC: ' + Utils.truncateString(el.src, CONFIG.LOG_DETAIL_LENGTH);
          },
          IMG: function (el) {
            var src = el.src || el.getAttribute('data-src') || el.href || '';
            return src ? 'IMG_SRC: ' + Utils.truncateString(src, CONFIG.LOG_DETAIL_LENGTH) : null;
          },
          A: function (el) {
            return el.href ? 'A_HREF: ' + Utils.truncateString(el.href, CONFIG.LOG_DETAIL_LENGTH) : null;
          },
          LINK: function (el) {
            return (el.rel === 'stylesheet' && el.href) ? 'CSS_HREF: ' + Utils.truncateString(el.href, CONFIG.LOG_DETAIL_LENGTH) : null;
          },
          STYLE: function (el) {
            return 'STYLE_CONTENT: ' + Utils.truncateString(el.textContent, CONFIG.LOG_DETAIL_LENGTH);
          },
          EMBED: function (el) {
            return el.src ? 'EMBED_SRC: ' + Utils.truncateString(el.src, CONFIG.LOG_DETAIL_LENGTH) : null;
          },
          OBJECT: function (el) {
            return el.data ? 'OBJECT_DATA: ' + Utils.truncateString(el.data, CONFIG.LOG_DETAIL_LENGTH) : null;
          }
        };
        var fn = handle[tagName];
        if (fn) return fn(element);
        var src = element.src || element.getAttribute('data-src') || element.href || element.action || '';
        if (src) return tagName + '_SRC: ' + Utils.truncateString(src, CONFIG.LOG_DETAIL_LENGTH);
        return null;
      }
      if (reasonType && typeof reasonType.detail === 'string') {
        var baseType = getBaseReasonType(reasonType.type);
        var prefix = HASH_TYPE_PREFIX_MAP[baseType];
        if (prefix) return prefix + ': ' + generateContentHash(reasonType.detail);
        if (reasonType.type === 'THIRD_PARTY') {
          var url = extractFirstUrl(reasonType.detail);
          if (url) return 'THIRD_PARTY_URL: ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH);
          return 'THIRD_PARTY_DETAIL: ' + Utils.truncateString(reasonType.detail, CONFIG.LOG_DETAIL_LENGTH);
        }
        if (reasonType.type === 'SCRIPT_BLACKLIST') return 'BLACKLIST: ' + Utils.truncateString(reasonType.detail, CONFIG.LOG_DETAIL_LENGTH);
        if (reasonType.type === '内联事件') return 'INLINE_EVENT: ' + reasonType.detail;
        if (reasonType.type === 'javascript URL') return 'JAVASCRIPT_URL: ' + reasonType.detail;
        if (reasonType.type === '内嵌脚本移除') return 'INLINE_SCRIPT: ' + generateContentHash(reasonType.detail);
        if (reasonType.type === '外联脚本移除') return 'EXTERNAL_SCRIPT: ' + reasonType.detail;
        return 'LOG_DETAIL: ' + Utils.truncateString(reasonType.detail, CONFIG.LOG_DETAIL_LENGTH);
      }
      return null;
    },
  };

  let _kwRegex = null, _kwHash = '';
  function getKeywordWhitelistRegex() {
    const hash = Array.from(currentConfig.keywordWhitelist).sort().join('\x00');
    if (hash === _kwHash) return _kwRegex;
    _kwHash = hash;
    if (!hash) {
      _kwRegex = null;
      return null;
    }
    const escaped = Array.from(currentConfig.keywordWhitelist).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      _kwRegex = new RegExp(escaped.join('|'));
    } catch(e) {
      _kwRegex = null;
    }
    return _kwRegex;
  }

  let _tpRegex = null, _tpHash = '';
  function getThirdPartyWhitelistRegex() {
    const hash = currentConfig.thirdPartyWhitelist.slice().sort().join('\x00');
    if (hash === _tpHash) return _tpRegex;
    _tpHash = hash;
    if (!hash) {
      _tpRegex = null;
      return null;
    }
    const escaped = currentConfig.thirdPartyWhitelist.map(p => {
      let prefix = p.startsWith('*.') ? '(^|\\.)' : '^';
      let host = p.startsWith('*.') ? p.substring(2) : p;
      host = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return prefix + host + '$';
    });
    try {
      _tpRegex = new RegExp(escaped.join('|'), 'i');
    } catch(e) {
      _tpRegex = null;
    }
    return _tpRegex;
  }

  function shouldBlockResource(url) {
    if (!url) return false;
    const tpRegex = getThirdPartyWhitelistRegex();
    if (tpRegex) {
      try {
        const urlHost = new URL(url, _location.href).hostname;
        if (tpRegex.test(urlHost)) return false;
      } catch(e) {}
    }
    const kr = getKeywordWhitelistRegex();
    if (kr && kr.test(url)) return false;
    return Utils.isThirdParty(url, Utils.getBlockParentSubDomainsSetting());
  }

  function parseLogContext(element, reason) {
    let elementIdentifier = '[未知元素]';
    let interceptedContent = '[无法获取内容]';
    let contentIdentifier = null;
    let resourceDomain = '';

    if (reason && reason.elementContentIdentifier) {
      contentIdentifier = reason.elementContentIdentifier;
    }
    if (reason && typeof reason.detail === 'string') {
      var baseType = getBaseReasonType(reason.type);
      const isSpecificType = [
        '内联事件',
        'javascript URL',
        ...HASH_TYPE_NAMES,
        'THIRD_PARTY',
        'SCRIPT_BLACKLIST',
        'THIRD_PARTY_SCAN',
        '内嵌脚本移除',
        '外联脚本移除',
        'THIRD_PARTY_HTML_INJECTION',
        'TRACKING_PIXEL',
      ].includes(baseType);

      if (isSpecificType || !Utils.isElement(element)) {
        interceptedContent = Utils.truncateString(reason.detail, CONFIG.LOG_DETAIL_LENGTH);
        elementIdentifier = reason.type ? '[' + reason.type + ']' : '[未知类型]';
        if (!contentIdentifier) {
          if (HASH_TYPE_NAMES.includes(baseType)) {
            contentIdentifier = Utils.getContentIdentifier(null, {
              type: baseType,
              detail: reason.rawDetail || reason.detail,
            });
          } else {
            contentIdentifier = Utils.getContentIdentifier(null, reason);
          }
        }
        var url = extractFirstUrl(reason.detail);
        if (url) {
          resourceDomain = Utils.getResourceHostname(url) || '';
        }
        if (isSpecificType) return { elementIdentifier, interceptedContent, contentIdentifier, resourceDomain };
      }
    }
    if (Utils.isElement(element)) {
      const tagName = element.tagName;
      const id = element.id ? '#' + element.id : '';
      const className = element.className ? '.' + element.className.split(/\s+/).join('.') : '';
      elementIdentifier = tagName + id + className;
      if (!contentIdentifier) {
        contentIdentifier = Utils.getContentIdentifier(element);
      }
      const tagHandlers = {
        SCRIPT: () => {
          if (element.src) {
            interceptedContent = '外联脚本: ' + Utils.truncateString(element.src, CONFIG.LOG_DETAIL_LENGTH);
            resourceDomain = Utils.getResourceHostname(element.src) || '';
          } else {
            interceptedContent = '内嵌脚本: ' + Utils.getScriptContentPreview(element);
          }
        },
        IFRAME: () => {
          interceptedContent = Utils.getIframeSrcPreview(element);
          if (element.src) resourceDomain = Utils.getResourceHostname(element.src) || '';
        },
        IMG: () => {
          const src = element.src || element.dataset.src || element.getAttribute('data-src') || '';
          interceptedContent = Utils.truncateString(src, CONFIG.LOG_DETAIL_LENGTH);
          if (src) resourceDomain = Utils.getResourceHostname(src) || '';
        },
        A: () => {
          interceptedContent = Utils.truncateString(element.href || '', CONFIG.LOG_DETAIL_LENGTH);
          if (element.href) resourceDomain = Utils.getResourceHostname(element.href) || '';
        },
        LINK: () => {
          interceptedContent = Utils.truncateString(element.href || '', CONFIG.LOG_DETAIL_LENGTH);
          if (element.href) resourceDomain = Utils.getResourceHostname(element.href) || '';
        },
        STYLE: () => {
          interceptedContent = Utils.truncateString(element.textContent, CONFIG.LOG_DETAIL_LENGTH);
        },
        EMBED: () => {
          interceptedContent = Utils.truncateString(element.src || '', CONFIG.LOG_DETAIL_LENGTH);
          if (element.src) resourceDomain = Utils.getResourceHostname(element.src) || '';
        },
        OBJECT: () => {
          interceptedContent = Utils.truncateString(element.data || '', CONFIG.LOG_DETAIL_LENGTH);
          if (element.data) resourceDomain = Utils.getResourceHostname(element.data) || '';
        },
      };
      if (tagHandlers[tagName]) tagHandlers[tagName]();
      else interceptedContent = Utils.truncateString(element.outerHTML, CONFIG.LOG_DETAIL_LENGTH);
    }
    return { elementIdentifier, interceptedContent, contentIdentifier, resourceDomain };
  }

  const LogManager = {
    logs: [],
    maxLogs: CONFIG.LOG_MAX,
    loggedContentIdentifiers: new LRUCache(CONFIG.LOG_MAX, CONFIG.LOG_IDENTIFIER_TTL),
    add: function (moduleKey, element, reason) {
      if (!Utils.isAnyModuleEnabled()) return;
      if (element !== null && element !== undefined && !Utils.isElement(element)) return;
      if (reason !== null && reason !== undefined && typeof reason !== 'object') return;
      if (
        Whitelisting.isElementWhitelisted(element, moduleKey) ||
        Whitelisting.isReasonWhitelisted(reason, moduleKey)
      )
        return;
      const ctx = parseLogContext(element, reason);
      var { elementIdentifier, interceptedContent, contentIdentifier, resourceDomain } = ctx;
      if (!contentIdentifier) {
        var fallbackSource = moduleKey;
        if (reason && typeof reason.detail === 'string') {
          fallbackSource += ':' + reason.detail;
        } else if (reason && typeof reason.type === 'string') {
          fallbackSource += ':' + reason.type;
        }
        contentIdentifier = 'FALLBACK_' + generateContentHash(fallbackSource);
      }
      var existingIndex = -1;
      for (var ei = 0; ei < this.logs.length; ei++) {
        if (this.logs[ei] && this.logs[ei].contentIdentifier === contentIdentifier) {
          existingIndex = ei;
          break;
        }
      }
      if (existingIndex !== -1) {
        return;
      }
      this.logs.push({
        id: this.logs.length + 1,
        moduleKey: moduleKey,
        module: MODULE_NAMES[moduleKey] || moduleKey,
        element: elementIdentifier,
        content: interceptedContent,
        domain: resourceDomain,
        timestamp: Date.now(),
        contentIdentifier: contentIdentifier,
      });
      this.loggedContentIdentifiers.set(contentIdentifier, true);
      if (this.logs.length > this.maxLogs) {
        const removed = this.logs.shift();
        this.loggedContentIdentifiers.delete(removed.contentIdentifier);
      }
    },
    clearLoggedIdentifiers: function () {
      this.loggedContentIdentifiers.clear();
    },
  };

  const Whitelisting = {
    isElementWhitelisted: function (element, moduleKey) {
      if (!element || !Utils.isElement(element)) return false;
      const ci = Utils.getContentIdentifier(element);
      if (ci && currentConfig.whitelist.has(ci)) return true;
      if (moduleKey === 'interceptThirdParty' && currentConfig.modules.interceptThirdParty) {
        const hostname = Utils.getResourceHostname(
          element.src || element.href || element.action || element.data || element.getAttribute('data-src') || ''
        );
        if (hostname) {
          const ru = element.src || element.href || element.action || element.data || element.getAttribute('data-src') || '';
          if (urlCache.isWhitelisted(ru, currentConfig.thirdPartyWhitelist)) return true;
        }
      }
      if (currentConfig.keywordWhitelist.size > 0) {
        const kr = getKeywordWhitelistRegex();
        if (kr) {
          const sc = element.textContent || '';
          const src = element.src || element.href || element.action || element.data || element.getAttribute('data-src') || '';
          if ((sc && kr.test(sc)) || (src && kr.test(src))) return true;
        }
      }
      return false;
    },
    isReasonWhitelisted: function (reason, moduleKey) {
      if (!reason || typeof reason.detail !== 'string') return false;
      var baseType = reason.type ? reason.type.replace(/_(?:OBFUSCATED|INDIRECT)$/i, '') : reason.type;
      var ci = Utils.getContentIdentifier(null, {
        type: baseType,
        detail: reason.rawDetail || reason.detail,
      });
      if (ci && currentConfig.whitelist.has(ci)) return true;
      if (moduleKey === 'interceptThirdParty' && currentConfig.modules.interceptThirdParty) {
        const um = reason.detail.match(/https?:\/\/[^\s]+/);
        if (um) {
          if (urlCache.isWhitelisted(um[0], currentConfig.thirdPartyWhitelist)) return true;
        }
      }
      if (currentConfig.keywordWhitelist.size > 0) {
        const kr = getKeywordWhitelistRegex();
        if (kr && kr.test(reason.detail)) return true;
      }
      return false;
    },
    isCodeWhitelisted: function (code, type) {
      if (typeof code !== 'string' || code.trim() === '') return false;
      if (currentConfig.keywordWhitelist.size > 0) {
        const kr = getKeywordWhitelistRegex();
        if (kr && kr.test(code)) return true;
      }
      var baseType = type ? type.replace(/_(?:OBFUSCATED|INDIRECT)$/i, '') : type;
      var ci = Utils.getContentIdentifier(null, { type: baseType, detail: code });
      if (ci && currentConfig.whitelist.has(ci)) return true;
      return false;
    },
    add: function (contentIdentifier, displayName) {
      if (!contentIdentifier || contentIdentifier.trim() === '') return;
      currentConfig.whitelist.add(contentIdentifier);
      if (displayName && typeof displayName === 'string' && displayName.trim() !== '') {
        currentConfig.whitelistDisplayNames.set(contentIdentifier, displayName.trim());
      }
      ConfigUpdater.saveNow();
    },
    addKeyword: function (keyword) {
      if (!keyword || keyword.trim() === '') return;
      currentConfig.keywordWhitelist.add(keyword.trim());
      ConfigUpdater.saveNow();
    },
    removeKeywordsMatchingDomain: function (domain) {
      let changed = false;
      const toRemove = [];
      for (const kw of currentConfig.keywordWhitelist) {
        if (kw === domain) {
          toRemove.push(kw);
        }
      }
      toRemove.forEach(function (k) {
        currentConfig.keywordWhitelist.delete(k);
        changed = true;
      });
      if (changed) ConfigUpdater.saveNow();
    },
    clearAllWhitelists: function () {
      currentConfig.whitelist.clear();
      currentConfig.keywordWhitelist.clear();
      currentConfig.thirdPartyWhitelist = [];
      currentConfig.whitelistDisplayNames.clear();
      ConfigUpdater.saveNow();
    },
  };

  function getLogWhitelistStatus(log) {
    if (currentConfig.whitelist.has(log.contentIdentifier)) return 'whitelisted';
    const kr = getKeywordWhitelistRegex();
    if (kr && (kr.test(log.content || '') || kr.test(log.domain || ''))) return 'keyword-whitelisted';
    if (log.moduleKey === 'interceptThirdParty' && log.domain && urlCache.isWhitelisted(log.domain, currentConfig.thirdPartyWhitelist)) return 'whitelisted';
    return '';
  }

  function isThirdPartyUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('#') || url.startsWith('javascript:')) return false;
    try {
      const targetUrl = new URL(url, _location.href);
      const currentHost = _location.hostname;
      if (targetUrl.hostname === currentHost) return false;
      return urlCache.isThirdPartyHost(
        targetUrl.hostname,
        currentHost,
        !!currentConfig.thirdPartyStrictMode
      );
    } catch (e) {
      return false;
    }
  }

  const TRACKING_PARAM_KEYS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'msclkid', 'dclid', 'mc_eid',
    'ref', 'source', 'medium', 'campaign', 'aff_id', 'click_id', 'sid', 'track_id', 'tid',
    'spm', 'scm', 'tracking', 'trk', 'mc_cid', 'mc_eid', 'oly_anon_id', 'oly_enc_id',
    '_ga', '_gl', 'yclid', 'wickedid', 'igshid'
  ];
  const TRACKING_PARAM_CLEAN_REGEX = new RegExp(
    '[?&](?:' + TRACKING_PARAM_KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')=[^&]*',
    'gi'
  );

  function cleanTrackingParams(url) {
    if (typeof url !== 'string') return url;
    if (url.charAt(0) === '#') return url;
    try {
      var u = new URL(url, _location.origin);
    } catch (e) {
      return url;
    }
    var query = u.search;
    var cleanedQuery = query.replace(TRACKING_PARAM_CLEAN_REGEX, '');
    cleanedQuery = cleanedQuery.replace(/^[?&]+/, '').replace(/&$/, '');
    var result = u.origin + u.pathname + (cleanedQuery ? '?' + cleanedQuery : '') + u.hash;
    if (url.charAt(0) === '/' && !url.startsWith('//')) {
      result = u.pathname + (cleanedQuery ? '?' + cleanedQuery : '') + u.hash;
      if (!result.startsWith('/')) result = '/' + result;
    }
    return result;
  }

  function resetAllCachesAndStates() {
    if (centralScheduler) centralScheduler.clearCache();
    ProcessedElementsCache.clear();
    LogManager.clearLoggedIdentifiers();
    urlCache.clear();
    _kwHash = '';
    _kwRegex = null;
    _tpHash = '';
    _tpRegex = null;
    CrossScriptPatternTracker.reset();
    OverlayInterceptor.restoreWhitelistedElements();
  }

  let activePanels = new _Set();
  let strongBlockingEnabled = false;
  let blockingTimer = null;
  const _beforeunloadHandler = function (e) {
    e.preventDefault();
    e.returnValue = '系统可能不会保存您所做的更改。';
    return e.returnValue;
  };
  const _errorHandler = function (e) {
    if (strongBlockingEnabled) {
      disableStrongBlocking();
      activePanels.clear();
    }
  };
  function enableStrongBlocking() {
    if (strongBlockingEnabled) return;
    _globals.addEventListener('beforeunload', _beforeunloadHandler);
    _globals.addEventListener('error', _errorHandler, true);
    strongBlockingEnabled = true;
    if (blockingTimer) _clearTimeout(blockingTimer);
    blockingTimer = _setTimeout(function () {
      if (activePanels.size > 0) {
        activePanels.clear();
        disableStrongBlocking();
      }
    }, CONFIG.STRONG_BLOCK_TIMEOUT);
  }
  function disableStrongBlocking() {
    if (!strongBlockingEnabled) return;
    _globals.removeEventListener('beforeunload', _beforeunloadHandler);
    _globals.removeEventListener('error', _errorHandler, true);
    strongBlockingEnabled = false;
    if (blockingTimer) {
      _clearTimeout(blockingTimer);
      blockingTimer = null;
    }
    if (currentConfig.modules.blockDynamicScripts) DynamicScriptInterceptor.enable();
  }
  function setupNavigationBlocking(panelId) {
    activePanels.add(panelId);
    if (activePanels.size === 1) {
      enableStrongBlocking();
      if (currentConfig.modules.blockDynamicScripts) DynamicScriptInterceptor.disable();
    }
  }
  function teardownNavigationBlocking(panelId) {
    activePanels.delete(panelId);
    if (activePanels.size === 0) {
      disableStrongBlocking();
      if (currentConfig.modules.blockDynamicScripts) DynamicScriptInterceptor.enable();
    }
  }

  const WriteHookManager = {
    hooks: [],
    originalWrite: null,
    originalWriteln: null,
    _installed: false,
    init: function () {
      if (this._installed) return;
      this.originalWrite = _document.write;
      this.originalWriteln = _document.writeln;
      this._installed = true;
      const self = this;
      try {
        _document.write = function () {
          const a = arguments;
          for (const hook of self.hooks) {
            const result = hook(a, 'write');
            if (result === false) return;
          }
          return self.originalWrite.apply(this, a);
        };
        _document.writeln = function () {
          const a = arguments;
          for (const hook of self.hooks) {
            const result = hook(a, 'writeln');
            if (result === false) return;
          }
          return self.originalWriteln.apply(this, a);
        };
      } catch (e) { }
    },
    addHook: function (hookFn) {
      if (!this.hooks.includes(hookFn)) this.hooks.push(hookFn);
    },
    removeHook: function (hookFn) {
      const idx = this.hooks.indexOf(hookFn);
      if (idx !== -1) this.hooks.splice(idx, 1);
    },
  };

  const RedirectBlocker = {
    _initialized: false,
    _writeTimingHook: null,
    _savedDescriptors: [],
    _savedValues: {},
    _savedObservers: [],
    _savedEventHandlers: [],
    _iframeSandboxSet: null,
    _checkAndBlockUrl: function (url) { return isThirdPartyUrl(url); },
    _compat: function () { return currentConfig.redirectBlockerCompatibilityMode !== false; },
    _applyDefine: function (obj, prop, descriptor) {
      try {
        var orig = Object.getOwnPropertyDescriptor(obj, prop);
        Object.defineProperty(obj, prop, descriptor);
        this._savedDescriptors.push({ obj: obj, prop: prop, desc: orig });
        return true;
      } catch (e) {
        return false;
      }
    },
    init: function () {
      if (this._initialized) return;
      if (!currentConfig.redirectBlockerEnabled) return;
      this._initialized = true;
      this._savedDescriptors = [];
      this._savedValues = {};
      this._savedObservers = [];
      this._savedEventHandlers = [];
      this._iframeSandboxSet = new WeakSet();
      var _c = this._compat();
      var self = this;

      self._earlyScanMetaRefresh();

      try {
        var d = Object.getOwnPropertyDescriptor(_globals.Location.prototype, 'href');
        if (d && d.set) {
          var origHrefSet = d.set;
          self._applyDefine(_globals.Location.prototype, 'href', {
            get: d.get,
            set: function (v) {
              if (self._checkAndBlockUrl(v)) return;
              origHrefSet.call(this, v);
            },
            enumerable: true,
            configurable: _c,
          });
        }
      } catch (e) { }

      try {
        var origAssign = _globals.Location.prototype.assign;
        self._applyDefine(_globals.Location.prototype, 'assign', {
          value: function (u) {
            if (self._checkAndBlockUrl(u)) return;
            return origAssign.call(this, u);
          },
          writable: _c,
          configurable: _c,
        });
      } catch (e) { }
      try {
        var origReplace = _globals.Location.prototype.replace;
        self._applyDefine(_globals.Location.prototype, 'replace', {
          value: function (u) {
            if (self._checkAndBlockUrl(u)) return;
            return origReplace.call(this, u);
          },
          writable: _c,
          configurable: _c,
        });
      } catch (e) { }

      try {
        var origOpen = _globals.open;
        self._applyDefine(_globals, 'open', {
          value: function () {
            if (self._checkAndBlockUrl(arguments[0])) return null;
            return origOpen.apply(this, arguments);
          },
          writable: _c,
          configurable: _c,
        });
      } catch (e) { }

      try {
        var origPushState = _globals.history.pushState;
        var origReplaceState = _globals.history.replaceState;
        self._applyDefine(_globals.history, 'pushState', {
          value: function () {
            var url = arguments[2];
            if (url) {
              if (typeof url === 'string') {
                if (url.charAt(0) === '/' || url.startsWith(_location.origin) || url.charAt(0) !== '#') {
                  var cleaned = cleanTrackingParams(url);
                  if (cleaned !== url) {
                    arguments[2] = cleaned;
                  }
                }
                if (url.charAt(0) === '#' || url.charAt(0) === '/' || url.startsWith(_location.origin)) {
                  if (typeof resetAllCachesAndStates === 'function') resetAllCachesAndStates();
                  return origPushState.apply(this, arguments);
                }
              }
              if (self._checkAndBlockUrl(url)) return;
            }
            if (typeof resetAllCachesAndStates === 'function') resetAllCachesAndStates();
            return origPushState.apply(this, arguments);
          },
          writable: _c,
          configurable: _c,
        });
        self._applyDefine(_globals.history, 'replaceState', {
          value: function () {
            var url = arguments[2];
            if (url) {
              if (typeof url === 'string') {
                if (url.charAt(0) === '/' || url.startsWith(_location.origin) || url.charAt(0) !== '#') {
                  var cleaned = cleanTrackingParams(url);
                  if (cleaned !== url) {
                    arguments[2] = cleaned;
                  }
                }
                if (url.charAt(0) === '#' || url.charAt(0) === '/' || url.startsWith(_location.origin)) {
                  if (typeof resetAllCachesAndStates === 'function') resetAllCachesAndStates();
                  return origReplaceState.apply(this, arguments);
                }
              }
              if (self._checkAndBlockUrl(url)) return;
            }
            if (typeof resetAllCachesAndStates === 'function') resetAllCachesAndStates();
            return origReplaceState.apply(this, arguments);
          },
          writable: _c,
          configurable: _c,
        });
      } catch (e) { }

      var popstateHandler = function () {
        if (typeof resetAllCachesAndStates === 'function') resetAllCachesAndStates();
      };
      _globals.addEventListener('popstate', popstateHandler, { capture: true });
      self._savedEventHandlers.push({ target: _globals, type: 'popstate', handler: popstateHandler, useCapture: true });

      try {
        var dDomain = Object.getOwnPropertyDescriptor(_Document.prototype, 'domain');
        if (dDomain && dDomain.set) {
          self._applyDefine(_Document.prototype, 'domain', {
            get: dDomain.get,
            set: function () { return; },
            enumerable: true,
            configurable: _c,
          });
        }
      } catch (e) { }

      self._hookDocumentLocation(_c);

      try {
        var baseObserver = new _MutationObserver(function (ms) {
          for (const m of ms) {
            if (m.type === 'childList') {
              m.addedNodes.forEach(function (n) {
                if (n.nodeType === _Node.ELEMENT_NODE && n.tagName === 'BASE') {
                  var h = n.getAttribute('href');
                  if (h && self._checkAndBlockUrl(h)) n.removeAttribute('href');
                }
              });
            } else if (m.type === 'attributes' && m.attributeName === 'href' && m.target.tagName === 'BASE') {
              var h2 = m.target.getAttribute('href');
              if (h2 && self._checkAndBlockUrl(h2)) m.target.removeAttribute('href');
            }
          }
        });
        baseObserver.observe(_document.documentElement || _document, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
        self._savedObservers.push(baseObserver);
      } catch (e) { }

      try {
        var ap = _globals.HTMLAreaElement.prototype;
        var areaHrefDesc = Object.getOwnPropertyDescriptor(ap, 'href');
        if (areaHrefDesc && areaHrefDesc.set && areaHrefDesc.configurable) {
          var origAreaHrefSet = areaHrefDesc.set;
          self._applyDefine(ap, 'href', {
            configurable: true, enumerable: true,
            get: areaHrefDesc.get,
            set: function (v) {
              if (self._checkAndBlockUrl(v)) return;
              origAreaHrefSet.call(this, v);
            },
          });
        }
      } catch (e) { }

      try {
        var ep = _globals.HTMLEmbedElement.prototype;
        var embedSrcDesc = Object.getOwnPropertyDescriptor(ep, 'src');
        if (embedSrcDesc && embedSrcDesc.set && embedSrcDesc.configurable) {
          var origEmbedSrcSet = embedSrcDesc.set;
          self._applyDefine(ep, 'src', {
            configurable: true, enumerable: true,
            get: embedSrcDesc.get,
            set: function (v) {
              if (self._checkAndBlockUrl(v)) return;
              origEmbedSrcSet.call(this, v);
            },
          });
        }
      } catch (e) { }

      try {
        var op = _globals.HTMLObjectElement.prototype;
        var objDataDesc = Object.getOwnPropertyDescriptor(op, 'data');
        if (objDataDesc && objDataDesc.set && objDataDesc.configurable) {
          var origObjDataSet = objDataDesc.set;
          self._applyDefine(op, 'data', {
            configurable: true, enumerable: true,
            get: objDataDesc.get,
            set: function (v) {
              if (self._checkAndBlockUrl(v)) return;
              origObjDataSet.call(this, v);
            },
          });
        }
      } catch (e) { }

      try {
        var metaObserver = new _MutationObserver(function (ms) {
          for (const m of ms) {
            if (!m.addedNodes) continue;
            m.addedNodes.forEach(function (n) {
              if (!(n instanceof _Element)) return;
              if (n.tagName === 'META') {
                if (/refresh/i.test(n.getAttribute('http-equiv')) && /url\s*=/i.test(n.getAttribute('content') || ''))
                  n.remove();
              } else {
                if (
                  n.tagName === 'LINK' &&
                  (n.rel === 'prefetch' || n.rel === 'prerender' || n.rel === 'preload')
                ) {
                  var h = n.getAttribute('href');
                  if (h && self._checkAndBlockUrl(h)) n.remove();
                }
                if (n.querySelectorAll)
                  n.querySelectorAll('meta[http-equiv="refresh"]').forEach(function (m2) {
                    m2.remove();
                  });
              }
            });
          }
        });
        metaObserver.observe(_document.documentElement || _document, { childList: true, subtree: true });
        self._savedObservers.push(metaObserver);
      } catch (e) { }

      WriteHookManager.init();
      this._writeTimingHook = function (args, type) {
        if (_document.readyState !== 'loading') return false;
      };
      WriteHookManager.addHook(this._writeTimingHook);

      var anchorClickLastCheck = 0;
      var anchorClickHandler = function (e) {
        var t = e.target;
        if (t.tagName !== 'A') t = t.closest('a');
        if (!t || !t.href) return;
        var h = t.getAttribute('href') || t.href;
        if (!h || h.startsWith('#') || h.startsWith('javascript:')) return;
        if (e.isTrusted === false) {
          if (self._checkAndBlockUrl(h)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
          return;
        }
        var now = Date.now();
        if (now - anchorClickLastCheck < CONFIG.ANCHOR_CLICK_THROTTLE) return;
        anchorClickLastCheck = now;
        if (self._checkAndBlockUrl(h)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      };
      _document.addEventListener('click', anchorClickHandler, true);
      self._savedEventHandlers.push({ target: _document, type: 'click', handler: anchorClickHandler, useCapture: true });

      try {
        var origAnchorClick = _globals.HTMLAnchorElement.prototype.click;
        self._applyDefine(_globals.HTMLAnchorElement.prototype, 'click', {
          value: function () {
            var h = this.getAttribute('href') || this.href;
            if (self._checkAndBlockUrl(h)) return;
            return origAnchorClick.call(this);
          },
          writable: _c,
          configurable: _c,
        });
      } catch (e) { }

      try {
        if (_globals.navigation && _globals.navigation.navigate) {
          var origNavigate = _globals.navigation.navigate;
          self._applyDefine(_globals.navigation, 'navigate', {
            value: function (u) {
              if (self._checkAndBlockUrl(u)) {
                return { committed: Promise.reject(), finished: Promise.reject() };
              }
              return origNavigate.apply(this, arguments);
            },
            writable: _c,
            configurable: _c,
          });
        }
      } catch (e) { }

      try {
        if (_globals.navigation && typeof _globals.navigation.addEventListener === 'function') {
          var navigateEventHandler = function (e) {
            if (e.destination && e.destination.url && self._checkAndBlockUrl(e.destination.url)) {
              e.preventDefault();
            }
          };
          _globals.navigation.addEventListener('navigate', navigateEventHandler);
          self._savedEventHandlers.push({
            target: _globals.navigation,
            type: 'navigate',
            handler: navigateEventHandler,
            useCapture: false,
          });
        }
      } catch (e) { }

      self._setupIframeSandbox();
    },
    _earlyScanMetaRefresh: function () {
      try {
        var metas = _document.querySelectorAll('meta[http-equiv="refresh"]');
        for (var i = 0; i < metas.length; i++) {
          var content = metas[i].getAttribute('content') || '';
          if (/url\s*=/i.test(content)) {
            var urlMatch = content.match(/url\s*=\s*['"]?([^'"\s]+)/i);
            if (urlMatch) {
              if (this._checkAndBlockUrl(urlMatch[1])) {
                metas[i].remove();
              }
            } else {
              metas[i].remove();
            }
          }
        }
      } catch (e) { }
    },
    _hookDocumentLocation: function (_c) {
      try {
        var docLocDesc = Object.getOwnPropertyDescriptor(_Document.prototype, 'location');
        if (docLocDesc && docLocDesc.set && docLocDesc.configurable !== false) {
          var origDocLocSet = docLocDesc.set;
          var self = this;
          this._applyDefine(_Document.prototype, 'location', {
            get: docLocDesc.get,
            set: function (v) {
              if (v && typeof v === 'string' && self._checkAndBlockUrl(v)) return;
              return origDocLocSet.call(this, v);
            },
            enumerable: true,
            configurable: _c,
          });
        }
      } catch (e) { }
    },
    _setupIframeSandbox: function () {
      var self = this;
      try {
        var existingIframes = _document.querySelectorAll('iframe');
        for (var i = 0; i < existingIframes.length; i++) {
          self._sandboxIframe(existingIframes[i]);
        }
      } catch (e) { }
      try {
        var iframeObserver = new _MutationObserver(function (ms) {
          for (var mi = 0; mi < ms.length; mi++) {
            var m = ms[mi];
            if (m.type === 'childList') {
              for (var ni = 0; ni < m.addedNodes.length; ni++) {
                var n = m.addedNodes[ni];
                if (n.nodeType !== _Node.ELEMENT_NODE) continue;
                if (n.tagName === 'IFRAME') self._sandboxIframe(n);
                if (n.querySelectorAll) {
                  var subIframes = n.querySelectorAll('iframe');
                  for (var si = 0; si < subIframes.length; si++) {
                    self._sandboxIframe(subIframes[si]);
                  }
                }
              }
            } else if (m.type === 'attributes' && m.attributeName === 'src' && m.target.tagName === 'IFRAME') {
              self._sandboxIframe(m.target);
            }
          }
        });
        iframeObserver.observe(_document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src'],
        });
        self._savedObservers.push(iframeObserver);
      } catch (e) { }
    },
    _sandboxIframe: function (iframe) {
      if (!iframe || !Utils.isElement(iframe)) return;
      if (!iframe.isConnected) return;
      if (this._iframeSandboxSet.has(iframe)) return;
      this._iframeSandboxSet.add(iframe);
      var src = iframe.src || iframe.getAttribute('src') || '';
      if (!src || src === 'about:blank' || src.startsWith('javascript:') || src.startsWith('data:')) return;
      if (ProcessedElementsCache.isProcessed(iframe)) return;
      if (!isThirdPartyUrl(src)) return;
      if (urlCache.isWhitelisted(src, currentConfig.thirdPartyWhitelist)) return;
      var existingSandbox = iframe.getAttribute('sandbox');
      if (existingSandbox !== null) {
        var tokens = existingSandbox.trim().split(/\s+/);
        var filtered = tokens.filter(function (t) {
          return t !== 'allow-top-navigation' && t !== 'allow-top-navigation-by-user-activation';
        });
        if (filtered.length !== tokens.length) {
          try {
            iframe.setAttribute('sandbox', filtered.join(' '));
          } catch (e) { }
        }
      } else {
        try {
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        } catch (e) { }
      }
    },
    disable: function () {
      if (!this._initialized) return true;
      var allRestored = true;
      for (var i = this._savedDescriptors.length - 1; i >= 0; i--) {
        var r = this._savedDescriptors[i];
        try {
          if (r.desc) Object.defineProperty(r.obj, r.prop, r.desc);
          else try { delete r.obj[r.prop]; } catch (e2) { }
        } catch (e) {
          allRestored = false;
        }
      }
      this._savedDescriptors = [];
      if (this._writeTimingHook) {
        WriteHookManager.removeHook(this._writeTimingHook);
        this._writeTimingHook = null;
      }
      for (var j = 0; j < this._savedObservers.length; j++) {
        try {
          this._savedObservers[j].disconnect();
        } catch (e) { }
      }
      this._savedObservers = [];
      for (var k = 0; k < this._savedEventHandlers.length; k++) {
        var eh = this._savedEventHandlers[k];
        try {
          eh.target.removeEventListener(eh.type, eh.handler, eh.useCapture);
        } catch (e) { }
      }
      this._savedEventHandlers = [];
      if (this._iframeSandboxSet) {
        this._iframeSandboxSet = new WeakSet();
      }
      this._initialized = false;
      return allRestored;
    },
  };
  if (typeof currentConfig.redirectBlockerEnabled === 'boolean' && currentConfig.redirectBlockerEnabled) {
    RedirectBlocker.init();
  }

  const DynamicScriptInterceptor = {
    _enabled: false,
    _dynamicWriteHook: null,
    _callbackCheckCache: new WeakMap(),
    originalEval: null,
    originalFunction: null,
    originalFunctionConstructorDescriptor: null,
    originalSetTimeout: null,
    originalSetInterval: null,
    originalRequestAnimationFrame: null,
    originalWorker: null,
    originalSharedWorker: null,
    _proxyRecursive: false,
    isCodeSuspiciousByHeuristic: function (code) {
      if (!currentConfig.heuristicBlacklistEnabled || !HEURISTIC_REGEX_GROUPS) return false;
      if (typeof code !== 'string' || code.length < 10) return false;
      const samples = [];
      if (code.length > 2000) {
        samples.push(code.substring(0, 2000));
        const mid = Math.floor(code.length / 2);
        samples.push(code.substring(mid - 1000, mid + 1000));
        samples.push(code.substring(code.length - 2000));
      } else {
        samples.push(code);
      }
      for (let si = 0; si < samples.length; si++) {
        for (let j = 0; j < HEURISTIC_REGEX_GROUPS.length; j++) {
          if (HEURISTIC_REGEX_GROUPS[j].test(samples[si])) return true;
        }
      }
      return false;
    },
    shouldBlockScriptElement: function(scriptElement, noLog) {
      if (!Utils.isElement(scriptElement) || scriptElement.tagName !== 'SCRIPT') return false;
      if (ProcessedElementsCache.isProcessed(scriptElement)) return false;
      var self = this;
      var checkAndLog = function(code, type) {
        if (typeof code !== 'string' || code.trim() === '') return false;
        if (Whitelisting.isCodeWhitelisted(code, type)) return false;
        var baseType = type.replace(/_(?:OBFUSCATED|INDIRECT)$/i, '');
        var ci = Utils.getContentIdentifier(null, { type: baseType, detail: code });
        var isWhitelistedByCi = ci && currentConfig.whitelist.has(ci);
        if (!isWhitelistedByCi) {
          if (!noLog) {
            LogManager.add('blockDynamicScripts', null, {
              type: type,
              detail: Utils.truncateString(code, CONFIG.LOG_DETAIL_LENGTH),
              rawDetail: code,
              elementContentIdentifier: ci,
            });
          }
          return true;
        }
        return false;
      };
      var src = scriptElement.src || scriptElement.getAttribute('src') || '';
      if (src) {
        if (src.startsWith('data:text/javascript') || src.toLowerCase().startsWith('javascript:')) {
          return checkAndLog(src, 'SCRIPT_SRC_DATA_OR_JS');
        }
      }
      if (currentConfig.dynamicScriptStrictMode) {
        var content = scriptElement.textContent || '';
        if (content && content.trim() !== '') {
          if (self.isCodeSuspiciousByHeuristic(content)) {
            return checkAndLog(content, 'SCRIPT_CONTENT_DYNAMIC_INSERT');
          }
          if (checkAndLog(content, 'SCRIPT_CONTENT_DYNAMIC_INSERT')) {
            return true;
          }
        }
      }
      return false;
    },
    init: function () {
      if (currentConfig.modules.blockDynamicScripts) this.enable();
    },
    enable: function () {
      if (this._enabled) return;
      this._enabled = true;
      this.originalEval = _globals.eval;
      this.originalFunction = _globals.Function;
      this.originalSetTimeout = _globals.setTimeout;
      this.originalSetInterval = _globals.setInterval;
      this.originalRequestAnimationFrame = _globals.requestAnimationFrame;
      this.originalWorker = _globals.Worker || null;
      this.originalSharedWorker = _globals.SharedWorker || null;
      this._callbackCheckCache = new WeakMap();
      const self = this;
      var strictModePatterns = [
        /document\s*\.\s*write(?:ln)?\s*\(/i,
        /document\s*\[\s*['"][^'"]*?write[^'"]*?['"]\s*\]\s*\(/i,
        /location\s*\.\s*(?:assign|replace)\s*\(/i,
        /location\s*\[\s*['"][^'"]*?(?:assign|replace)[^'"]*?['"]\s*\]\s*\(/i,
        /location\s*(?:\.\s*href|\[\s*['"][^'"]*?href[^'"]*?['"]\s*\])\s*=/i,
        /(?:window|self|top|parent|frames|globalThis)\s*\.\s*open\s*\(/i,
        /(?:window|self|top|parent|frames|globalThis)\s*\[\s*['"][^'"]*?open[^'"]*?['"]\s*\]\s*\(/i,
        /\w+\s*\[\s*['"][^'"]*?(?:write|writeln)[^'"]*?['"]\s*\]\s*\(/i,
        /\w+\s*\[\s*['"][^'"]*?open[^'"]*?['"]\s*\]\s*\(/i,
        /\w+\s*\[\s*['"][^'"]*?(?:assign|replace|href)[^'"]*?['"]\s*\]\s*[\(=]/i,
        /(?:document|location|window|self|top|parent)\s*\[\s*\w+\s*\]\s*\(/i,
        /['"][wW][rR][iI][tT][eE]['"].*?\+/i,
        /['"](?:open|href|assign|replace)['"].*?\+/i,
      ];
      var checkAndBlock = function (code, type) {
        if (typeof code !== 'string' || code.trim() === '') return null;
        if (Whitelisting.isCodeWhitelisted(code, type)) return 'allow';
        var baseType = type.replace(/_(?:OBFUSCATED|INDIRECT)$/i, '');
        var ci = Utils.getContentIdentifier(null, { type: baseType, detail: code });
        var isWhitelistedByCi = ci && currentConfig.whitelist.has(ci);
        if (!isWhitelistedByCi) {
          LogManager.add('blockDynamicScripts', null, {
            type: type,
            detail: Utils.truncateString(code, CONFIG.LOG_DETAIL_LENGTH),
            rawDetail: code,
            elementContentIdentifier: ci,
          });
          return 'block';
        }
        return null;
      };
      var checkCallback = function (callback, type) {
        if (typeof callback === 'function' && self._callbackCheckCache.has(callback)) {
          return self._callbackCheckCache.get(callback);
        }
        var baseType = type.replace(/_(?:OBFUSCATED|INDIRECT)$/i, '');
        if (typeof callback === 'string') {
          return checkAndBlock(callback, baseType) === 'block' ? { blocked: true } : { blocked: false };
        } else if (typeof callback === 'function') {
          var fs = callback.toString();
          if (Whitelisting.isCodeWhitelisted(fs, type)) {
            var ar = { blocked: false };
            self._callbackCheckCache.set(callback, ar);
            return ar;
          }
          if (fs.includes('eval') || fs.includes('Function')) {
            if (checkAndBlock(fs, baseType) === 'block') {
              var br = { blocked: true };
              self._callbackCheckCache.set(callback, br);
              return br;
            }
          }
          if (currentConfig.dynamicScriptStrictMode) {
            var patternMatched = false;
            for (var si = 0; si < strictModePatterns.length; si++) {
              if (strictModePatterns[si].test(fs)) {
                var result = checkAndBlock(fs, baseType);
                if (result === 'block') {
                  var br2 = { blocked: true };
                  self._callbackCheckCache.set(callback, br2);
                  return br2;
                } else if (result === 'allow') {
                  var ar2 = { blocked: false };
                  self._callbackCheckCache.set(callback, ar2);
                  return ar2;
                }
                patternMatched = true;
                break;
              }
            }
            if (!patternMatched && self.isCodeSuspiciousByHeuristic(fs)) {
              var obsResult = checkAndBlock(fs, baseType);
              if (obsResult === 'block') {
                var obr = { blocked: true };
                self._callbackCheckCache.set(callback, obr);
                return obr;
              } else if (obsResult === 'allow') {
                var oar = { blocked: false };
                self._callbackCheckCache.set(callback, oar);
                return oar;
              }
            }
          }
          var fbr = { blocked: false };
          self._callbackCheckCache.set(callback, fbr);
          return fbr;
        }
        return { blocked: false };
      };
      try {
        _globals.eval = function (code) {
          if (self._proxyRecursive) return self.originalEval.call(this, code);
          if (typeof code === 'string') {
            self._proxyRecursive = true;
            try {
              var result = checkAndBlock(code, 'EVAL');
              if (result === 'block') return undefined;
            } finally {
              self._proxyRecursive = false;
            }
          }
          return self.originalEval.call(this, code);
        };
      } catch (e) { }
      try {
        this.originalFunctionConstructorDescriptor = Object.getOwnPropertyDescriptor(
          _globals.Function.prototype, 'constructor'
        );
        _globals.Function = new _Proxy(this.originalFunction, {
          construct: function (target, args, newTarget) {
            if (self._proxyRecursive) return Reflect.construct(target, args, newTarget || target);
            var code = args.length > 0 ? String(args[args.length - 1]) : '';
            if (typeof code === 'string') {
              self._proxyRecursive = true;
              try {
                var result = checkAndBlock(code, 'FUNCTION_CONSTRUCTOR');
                if (result === 'block') return Reflect.construct(target, ['return;'], newTarget || target);
              } finally {
                self._proxyRecursive = false;
              }
            }
            return Reflect.construct(target, args, newTarget || target);
          },
          apply: function (target, thisArg, args) {
            if (self._proxyRecursive) return Reflect.apply(target, thisArg, args);
            var code = args.length > 0 ? String(args[args.length - 1]) : '';
            if (typeof code === 'string') {
              self._proxyRecursive = true;
              try {
                var result = checkAndBlock(code, 'FUNCTION_CONSTRUCTOR');
                if (result === 'block') return Reflect.apply(target, thisArg, ['return;']);
              } finally {
                self._proxyRecursive = false;
              }
            }
            return Reflect.apply(target, thisArg, args);
          },
        });
        try {
          Object.defineProperty(_globals.Function.prototype, 'constructor', {
            get: function () {
              return _globals.Function;
            },
            configurable: true,
          });
        } catch (e) { }
      } catch (e) { }
      try {
        _globals.setTimeout = function (cb, d) {
          var a = Array.prototype.slice.call(arguments, 2);
          var r = checkCallback(cb, 'SETTIMEOUT');
          if (r.blocked) return -1;
          return self.originalSetTimeout.apply(this, [cb, d].concat(a));
        };
        _globals.setInterval = function (cb, d) {
          var a = Array.prototype.slice.call(arguments, 2);
          var r = checkCallback(cb, 'SETINTERVAL');
          if (r.blocked) return -1;
          return self.originalSetInterval.apply(this, [cb, d].concat(a));
        };
        _globals.requestAnimationFrame = function (cb) {
          var r = checkCallback(cb, 'REQUESTANIMATIONFRAME');
          if (r.blocked) return -1;
          return self.originalRequestAnimationFrame.call(this, cb);
        };
      } catch (e) { }
      if (this.originalWorker) {
        try {
          _globals.Worker = new _Proxy(this.originalWorker, {
            construct: function (target, args, newTarget) {
              var url = typeof args[0] === 'string' ? args[0] : '';
              if (url) {
                if (url.startsWith('data:text/javascript') || url.toLowerCase().startsWith('javascript:')) {
                  LogManager.add('blockDynamicScripts', null, {
                    type: 'WORKER_DATA_OR_JS',
                    detail: 'WORKER: ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH),
                  });
                  return Reflect.construct(target, ['data:text/javascript,', args[1]], newTarget);
                }
                if (shouldBlockResource(url)) {
                  LogManager.add('blockDynamicScripts', null, {
                    type: 'THIRD_PARTY',
                    detail: 'WORKER: ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH),
                  });
                  return Reflect.construct(target, ['data:text/javascript,', args[1]], newTarget);
                }
              }
              return Reflect.construct(target, args, newTarget);
            },
          });
        } catch (e) { }
      }
      if (this.originalSharedWorker) {
        try {
          _globals.SharedWorker = new _Proxy(this.originalSharedWorker, {
            construct: function (target, args, newTarget) {
              var url = typeof args[0] === 'string' ? args[0] : '';
              if (url) {
                if (url.startsWith('data:text/javascript') || url.toLowerCase().startsWith('javascript:')) {
                  LogManager.add('blockDynamicScripts', null, {
                    type: 'SHARED_WORKER_DATA_OR_JS',
                    detail: 'SHARED_WORKER: ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH),
                  });
                  return Reflect.construct(target, ['data:text/javascript,', args[1]], newTarget);
                }
                if (shouldBlockResource(url)) {
                  LogManager.add('blockDynamicScripts', null, {
                    type: 'THIRD_PARTY',
                    detail: 'SHARED_WORKER: ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH),
                  });
                  return Reflect.construct(target, ['data:text/javascript,', args[1]], newTarget);
                }
              }
              return Reflect.construct(target, args, newTarget);
            },
          });
        } catch (e) { }
      }
      WriteHookManager.init();
      this._dynamicWriteHook = function (args, type) {
        var c = args.join('');
        if (typeof c === 'string') {
          var result = checkAndBlock(c, 'DOCUMENT_WRITE');
          if (result === 'block') return false;
        }
      };
      WriteHookManager.addHook(this._dynamicWriteHook);
    },
    disable: function () {
      if (!this._enabled) return;
      this._enabled = false;
      if (this._dynamicWriteHook) {
        WriteHookManager.removeHook(this._dynamicWriteHook);
        this._dynamicWriteHook = null;
      }
      try {
        _globals.eval = this.originalEval;
      } catch (e) { }
      try {
        _globals.Function = this.originalFunction;
        if (this.originalFunctionConstructorDescriptor) Object.defineProperty(_globals.Function.prototype, 'constructor', this.originalFunctionConstructorDescriptor);
        else try {
          delete _globals.Function.prototype.constructor;
        } catch (e) { }
      } catch (e) { }
      try {
        _globals.setTimeout = this.originalSetTimeout;
      } catch (e) { }
      try {
        _globals.setInterval = this.originalSetInterval;
      } catch (e) { }
      try {
        _globals.requestAnimationFrame = this.originalRequestAnimationFrame;
      } catch (e) { }
      if (this.originalWorker) {
        try {
          _globals.Worker = this.originalWorker;
        } catch (e) { }
      }
      if (this.originalSharedWorker) {
        try {
          _globals.SharedWorker = this.originalSharedWorker;
        } catch (e) { }
      }
    },
  };
  if (currentConfig.modules.blockDynamicScripts) DynamicScriptInterceptor.enable();

  const CrossScriptPatternTracker = {
    _counters: null,
    _scriptMap: null,
    _blockedPatterns: null,
    _scriptElements: null,
    _scriptIndex: 0,
    _escapedScripts: null,
    _retroactiveBlockedSet: null,
    _seenPfxPerScript: null,
    SAFE_OBJECTS: new Set([
      'console', 'document', 'window', 'Math', 'JSON', 'Object', 'Array',
      'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Map',
      'Set', 'Promise', 'Symbol', 'Proxy', 'Reflect', 'parseInt',
      'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
      'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa',
      'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval',
      'clearTimeout', 'clearInterval', 'requestAnimationFrame',
      'cancelAnimationFrame', 'fetch', 'navigator', 'location',
      'history', 'screen', 'localStorage', 'sessionStorage',
      'indexedDB', 'crypto', 'performance', 'getComputedStyle',
      'matchMedia', 'XMLHttpRequest', 'MutationObserver',
      'IntersectionObserver', 'ResizeObserver', 'AbortController',
    ]),
    SAFE_FUNCTIONS: new Set([
      'log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table',
      'time', 'timeEnd', 'group', 'groupEnd', 'assert', 'clear',
      'getElementById', 'getElementsByClassName', 'getElementsByTagName',
      'getElementsByName', 'querySelector', 'querySelectorAll',
      'createElement', 'createTextNode', 'createDocumentFragment',
      'addEventListener', 'removeEventListener', 'dispatchEvent',
      'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute',
      'appendChild', 'removeChild', 'insertBefore', 'replaceChild',
      'cloneNode', 'contains', 'observe', 'unobserve', 'disconnect',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
      'atob', 'btoa', 'alert', 'confirm', 'prompt',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'requestAnimationFrame', 'cancelAnimationFrame',
      'fetch', 'getComputedStyle', 'matchMedia',
      'scrollTo', 'scrollIntoView', 'focus', 'blur',
      'open', 'close', 'write', 'writeln',
      'push', 'pop', 'shift', 'unshift', 'splice', 'slice',
      'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex',
      'concat', 'join', 'split', 'replace', 'match', 'search',
      'test', 'exec', 'toString', 'valueOf', 'hasOwnProperty',
      'bind', 'call', 'apply', 'preventDefault', 'stopPropagation',
      'getBoundingClientRect', 'postMessage', 'reload', 'assign',
      'init', 'initialize', 'setup', 'render', 'mount',
      'parse', 'stringify', 'resolve', 'reject', 'then', 'catch',
      'abort', 'cancel', 'start', 'stop', 'pause', 'resume',
      'remove', 'add', 'toggle', 'show', 'hide', 'update',
      'load', 'save', 'read', 'reset', 'clear', 'flush',
      'commit', 'connect', 'disconnect', 'listen',
      'format', 'validate', 'transform', 'convert', 'encode', 'decode',
      'clone', 'copy', 'merge', 'diff', 'sort', 'reverse',
      'debounce', 'throttle', 'memoize', 'compose',
      'notify', 'subscribe', 'unsubscribe', 'dispatch',
      'on', 'off', 'emit', 'trigger', 'handleEvent',
      'register', 'unregister', 'enable', 'disable',
      'next', 'done', 'play', 'send', 'respond',
      'callback', 'handler', 'processor', 'configure',
    ]),
    JS_KEYWORDS: new Set([
      'function', 'return', 'var', 'let', 'const', 'if', 'else', 'for',
      'while', 'do', 'switch', 'case', 'break', 'continue', 'try',
      'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof',
      'in', 'of', 'void', 'this', 'super', 'class', 'extends', 'import',
      'export', 'default', 'from', 'as', 'async', 'await', 'yield',
      'with', 'debugger', 'null', 'undefined', 'true', 'false',
      'arguments', 'eval', 'static',
    ]),
    SAFE_CAMEL_PREFIXES: [
      'get', 'set', 'is', 'has', 'add', 'remove', 'create', 'delete',
      'can', 'should', 'will'
    ],
    GP_MIN_PREFIX: 4,
    GP_MAX_PREFIX: 8,
    _patterns: null,
    init: function () {
      this._counters = new _Map();
      this._scriptMap = new _Map();
      this._blockedPatterns = new _Set();
      this._scriptElements = [];
      this._scriptIndex = 0;
      this._escapedScripts = [];
      this._retroactiveBlockedSet = new _Set();
      this._seenPfxPerScript = new _Map();
      this._patterns = {
        funcStr: /(?:\b([a-zA-Z_]\w{1,30})\s*\.\s*)?([a-zA-Z_]\w{1,30})\s*\(\s*["'][^"']{1,80}["']\s*\)/g,
        prefixCall: /(?:\b([a-zA-Z_]\w{1,30})\s*\.\s*)?([a-zA-Z_]\w*?)\d{1,4}\s*\([^)]*\)/g,
        varPrefix: /\bvar\s+([a-zA-Z_]\w*?)\d{1,4}\s*=/g,
        funcDefPrefix: /\bfunction\s+([a-zA-Z_]\w*?)\d{1,4}\s*\(/g,
        assignPrefix: /(?:\b([a-zA-Z_]\w{1,30})\s*\.\s*)?([a-zA-Z_]\w*?)\d{1,4}\s*=[^;,]{1,200}\s*[;,]/g,
        prefixWordCall: /(?:\b([a-zA-Z_]\w{1,20})\s*\.\s*)?([a-zA-Z_]\w{2,20}?)([A-Z][a-z]{0,4}|[a-z]{2,4})\s*\([^)]*\)/gi,
        funcNumArg: /(?:\b([a-zA-Z_]\w{1,30})\s*\.\s*)?([a-zA-Z_]\w{2,30})\s*\(\s*\d{1,8}(?:\s*,\s*\d{1,8})*\s*\)/g,
        jQueryCall: /\$\s*\(\s*function\s*\([^)]*\)\s*\{[^}]*?([a-zA-Z_]\w{1,30})\s*\([^)]*\d+[^)]*\)[^}]*\}/g,
        genericCall: /(?:\b([a-zA-Z_]\w{1,20})\s*\.\s*)?([a-zA-Z_]\w{3,25})\s*\([^)]*\)/g,
        singleCall: /^\s*[a-zA-Z_$]\w*\s*\([^)]*\)\s*;?\s*$/,
      };
    },
    reset: function () { this.init(); },
    _extractPrefix: function (funcName) {
      if (!funcName || funcName.length < 4) return null;
      var self = this;
      var m1 = funcName.match(/^(.+)([A-Z][a-z]{0,2}\d{1,3})$/);
      if (m1 && m1[1].length >= 3 && !self._isSafePrefix(m1[1])) return m1[1];
      var m2 = funcName.match(/^(.+?)(\d+)$/);
      if (m2 && m2[1].length >= 3 && !self._isSafePrefix(m2[1])) return m2[1];
      var m3 = funcName.match(/^(.+)([A-Z][a-z]{0,4})$/);
      if (m3 && m3[1].length >= 3 && !self._isSafePrefix(m3[1])) return m3[1];
      var m4 = funcName.match(/^(.+)([a-z]{3,})$/);
      if (m4 && m4[1].length >= 3 && !self._isSafePrefix(m4[1])) return m4[1];
      var m5 = funcName.match(/^(.+)([a-z]{2})$/);
      if (m5 && m5[1].length >= 3 && !self._isSafePrefix(m5[1])) return m5[1];
      var m6 = funcName.match(/^(.+)([a-z])$/);
      if (m6 && m6[1].length >= 3 && !self._isSafePrefix(m6[1])) return m6[1];
      return null;
    },
    _isSafePrefix: function (pfx) {
      if (!pfx || pfx.length < 3) return false;
      var lower = pfx.toLowerCase();
      for (var i = 0; i < this.SAFE_CAMEL_PREFIXES.length; i++) {
        var sp = this.SAFE_CAMEL_PREFIXES[i];
        if (lower === sp) return true;
        if (lower.length > sp.length && lower.startsWith(sp) && pfx.length > sp.length && pfx[sp.length] === pfx[sp.length].toUpperCase() && pfx[sp.length] !== pfx[sp.length].toLowerCase()) {
          return true;
        }
      }
      return false;
    },
    _extractGPPrefixKeys: function (funcName) {
      if (!funcName || funcName.length < this.GP_MIN_PREFIX) return [];
      var keys = [];
      for (var length = this.GP_MIN_PREFIX; length < Math.min(this.GP_MAX_PREFIX + 1, funcName.length); length++) {
        keys.push(funcName.substring(0, length));
      }
      return keys;
    },
    _isSafeFunc: function (funcName) {
      if (this.SAFE_FUNCTIONS.has(funcName)) return true;
      if (this.JS_KEYWORDS.has(funcName)) return true;
      if (funcName.length > 12) return true;
      for (var i = 0; i < this.SAFE_CAMEL_PREFIXES.length; i++) {
        var sp = this.SAFE_CAMEL_PREFIXES[i];
        if (funcName === sp || 
            (funcName.startsWith(sp) && 
             funcName.length > sp.length &&
             funcName.charAt(sp.length) === funcName.charAt(sp.length).toUpperCase() &&
             funcName.charAt(sp.length) !== funcName.charAt(sp.length).toLowerCase())) {
          return true;
        }
      }
      return false;
    },
    _isSafe: function (objectName, funcName) {
      if (objectName) return this.SAFE_OBJECTS.has(objectName);
      return this.SAFE_FUNCTIONS.has(funcName);
    },
    _increment: function (key, scriptIndex) {
      var count = (this._counters.get(key) || 0) + 1;
      this._counters.set(key, count);
      var map = this._scriptMap.get(key) || [];
      map.push(scriptIndex);
      this._scriptMap.set(key, map);
      return count;
    },
    _incrementPfx: function (prefix, scriptIndex) {
      var key = 'PFX:' + prefix;
      var seen = this._seenPfxPerScript.get(scriptIndex);
      if (!seen) {
        seen = new _Set();
        this._seenPfxPerScript.set(scriptIndex, seen);
      }
      if (seen.has(key)) return this._counters.get(key) || 0;
      seen.add(key);
      return this._increment(key, scriptIndex);
    },
    _doRetroactiveScan: function (pattern, currentIdx) {
      if (this._escapedScripts.length === 0) return;
      var blockedIndices = [];
      for (var i = 0; i < this._escapedScripts.length; i++) {
        var entry = this._escapedScripts[i];
        if (entry.index === currentIdx) continue;
        if (this._retroactiveBlockedSet.has(entry.index)) continue;
        if (entry.content.indexOf(pattern) !== -1) {
          blockedIndices.push(i);
          this._retroactiveBlockedSet.add(entry.index);
          if (entry.element && entry.element.isConnected && !ProcessedElementsCache.isProcessed(entry.element)) {
            var ci = Utils.getContentIdentifier(entry.element);
            LogManager.add('scriptBlacklistMode', entry.element, {
              type: 'SCRIPT_BLACKLIST',
              detail: '命中跨标签重复模式(回溯): ' + pattern + ' - 脚本: ' + Utils.truncateString(entry.content, CONFIG.CONTENT_PREVIEW_LENGTH),
              elementContentIdentifier: ci,
            });
            ResourceCanceller.cancelResourceLoading(entry.element);
            ProcessedElementsCache.markAsProcessed(entry.element);
          }
        }
      }
      for (var j = blockedIndices.length - 1; j >= 0; j--) {
        this._escapedScripts.splice(blockedIndices[j], 1);
      }
    },
    _doSCRetroactiveScan: function (currentIdx) {
      if (this._escapedScripts.length === 0) return;
      var singleCallRe = this._patterns.singleCall;
      var blockedIndices = [];
      for (var i = 0; i < this._escapedScripts.length; i++) {
        var entry = this._escapedScripts[i];
        if (entry.index === currentIdx) continue;
        if (this._retroactiveBlockedSet.has(entry.index)) continue;
        if (singleCallRe.test(entry.content)) {
          blockedIndices.push(i);
          this._retroactiveBlockedSet.add(entry.index);
          if (entry.element && entry.element.isConnected && !ProcessedElementsCache.isProcessed(entry.element)) {
            var ci = Utils.getContentIdentifier(entry.element);
            LogManager.add('scriptBlacklistMode', entry.element, {
              type: 'SCRIPT_BLACKLIST',
              detail: '命中单调用脚本聚合(回溯) - 脚本: ' + Utils.truncateString(entry.content, CONFIG.CONTENT_PREVIEW_LENGTH),
              elementContentIdentifier: ci,
            });
            ResourceCanceller.cancelResourceLoading(entry.element);
            ProcessedElementsCache.markAsProcessed(entry.element);
          }
        }
      }
      for (var j = blockedIndices.length - 1; j >= 0; j--) {
        this._escapedScripts.splice(blockedIndices[j], 1);
      }
    },
    _retroactiveBlockFull: function (patternStr, patternName, thresholdNum) {
      for (var i = 0; i < this._scriptElements.length; i++) {
        var entry = this._scriptElements[i];
        if (!entry || !entry.element || !entry.element.isConnected) continue;
        if (ProcessedElementsCache.isProcessed(entry.element)) continue;
        if (this._retroactiveBlockedSet.has(entry.index)) continue;
        var c = entry.element.textContent || '';
        if (c.indexOf(patternStr) !== -1) {
          this._retroactiveBlockedSet.add(entry.index);
          var ci = Utils.getContentIdentifier(entry.element);
          LogManager.add('scriptBlacklistMode', entry.element, {
            type: 'SCRIPT_BLACKLIST',
            detail: '命中跨标签重复模式: ' + patternName + ' (全量回溯) - 脚本: ' + Utils.truncateString(c, CONFIG.CONTENT_PREVIEW_LENGTH),
            elementContentIdentifier: ci,
          });
          ResourceCanceller.cancelResourceLoading(entry.element);
          ProcessedElementsCache.markAsProcessed(entry.element);
        }
      }
    },
    checkScript: function (scriptElement, content) {
      if (!content || typeof content !== 'string') return { blocked: false, reason: null };
      if (ProcessedElementsCache.isProcessed(scriptElement)) return { blocked: false, reason: null };
      var currentIdx = this._scriptIndex++;
      this._scriptElements.push({ element: scriptElement, index: currentIdx });
      var self = this;
      var patterns = this._patterns;
      var threshold = (typeof currentConfig.crossTagPatternThreshold === 'number' && currentConfig.crossTagPatternThreshold >= 1)
          ? currentConfig.crossTagPatternThreshold : 3;
      var maybeBlock = null;
      if (this._blockedPatterns.size > 0) {
        var _iter = this._blockedPatterns.values();
        var _result = _iter.next();
        while (!_result.done) {
          var bp = _result.value;
          if (bp === '__SINGLE_CALL__') { _result = _iter.next(); continue; }
          if (content.indexOf(bp) !== -1) {
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: Utils.truncateString(bp, 30), scriptPreview: Utils.truncateString(content, 120) };
            break;
          }
          _result = _iter.next();
        }
      }
      if (!maybeBlock) {
        var re0 = new RegExp(patterns.funcStr.source, 'g');
        var match;
        while ((match = re0.exec(content)) !== null) {
          var obj0 = match[1], func0 = match[2];
          if (self._isSafe(obj0, func0) || (!obj0 && self._isSafeFunc(func0))) continue;
          var key0 = 'FS:' + func0;
          var count0 = self._increment(key0, currentIdx);
          var pfx0 = self._extractPrefix(func0);
          if (pfx0) self._incrementPfx(pfx0, currentIdx);
          if (count0 >= threshold) {
            self._blockedPatterns.add(func0);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: func0, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(key0, func0, threshold, currentIdx);
            self._doRetroactiveScan(func0, currentIdx);
            self._retroactiveBlockFull(func0, func0, threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var re1 = new RegExp(patterns.prefixCall.source, 'g');
        var match;
        while ((match = re1.exec(content)) !== null) {
          var obj1 = match[1], prefix1 = match[2];
          if (obj1 && self.SAFE_OBJECTS.has(obj1)) continue;
          if (!prefix1 || prefix1.length < 1) continue;
          var key1 = 'PC:' + prefix1;
          var count1 = self._increment(key1, currentIdx);
          self._incrementPfx(prefix1, currentIdx);
          if (count1 >= threshold) {
            self._blockedPatterns.add(prefix1);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: prefix1, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(key1, prefix1 + 'N()', threshold, currentIdx);
            self._doRetroactiveScan(prefix1, currentIdx);
            self._retroactiveBlockFull(prefix1, prefix1 + 'N()', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var rePW = new RegExp(patterns.prefixWordCall.source, 'gi');
        var matchPW;
        while ((matchPW = rePW.exec(content)) !== null) {
          var objPW = matchPW[1], prefixPW = matchPW[2];
          if (objPW && self.SAFE_OBJECTS.has(objPW)) continue;
          if (!prefixPW || prefixPW.length < 2) continue;
          if (self._isSafePrefix(prefixPW)) continue;
          var keyPW = 'PW:' + prefixPW;
          var countPW = self._increment(keyPW, currentIdx);
          self._incrementPfx(prefixPW, currentIdx);
          if (countPW >= threshold) {
            self._blockedPatterns.add(prefixPW);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: prefixPW, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(keyPW, prefixPW + '*', threshold, currentIdx);
            self._doRetroactiveScan(prefixPW, currentIdx);
            self._retroactiveBlockFull(prefixPW, prefixPW + '*', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var reFN = new RegExp(patterns.funcNumArg.source, 'g');
        var matchFN;
        while ((matchFN = reFN.exec(content)) !== null) {
          var objFN = matchFN[1], funcFN = matchFN[2];
          if (self._isSafe(objFN, funcFN) || (!objFN && self._isSafeFunc(funcFN))) continue;
          var keyFN = 'FN:' + funcFN;
          var countFN = self._increment(keyFN, currentIdx);
          var pfxFN = self._extractPrefix(funcFN);
          if (pfxFN) self._incrementPfx(pfxFN, currentIdx);
          if (countFN >= threshold) {
            self._blockedPatterns.add(funcFN);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: funcFN + '(数字参数)', scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(keyFN, funcFN + '(...)', threshold, currentIdx);
            self._doRetroactiveScan(funcFN, currentIdx);
            self._retroactiveBlockFull(funcFN, funcFN + '(...)', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var reJQ = new RegExp(patterns.jQueryCall.source, 'g');
        var matchJQ;
        while ((matchJQ = reJQ.exec(content)) !== null) {
          var innerFunc = matchJQ[1];
          if (!innerFunc || self.SAFE_FUNCTIONS.has(innerFunc)) continue;
          var keyJQ = 'JQ:' + innerFunc;
          var countJQ = self._increment(keyJQ, currentIdx);
          if (countJQ >= threshold) {
            self._blockedPatterns.add(innerFunc);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: '$().' + innerFunc, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(keyJQ, '$().' + innerFunc, threshold, currentIdx);
            self._doRetroactiveScan(innerFunc, currentIdx);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var reGC = new RegExp(patterns.genericCall.source, 'g');
        var matchGC;
        var seenPfx = {};
        while ((matchGC = reGC.exec(content)) !== null) {
          var objGC = matchGC[1], funcGC = matchGC[2];
          if (self._isSafe(objGC, funcGC)) continue;
          if (self._isSafeFunc(funcGC)) continue;
          var gpKeys = self._extractGPPrefixKeys(funcGC);
          for (var gi = 0; gi < gpKeys.length; gi++) {
            var gpKeyStr = gpKeys[gi];
            if (seenPfx[gpKeyStr]) continue;
            seenPfx[gpKeyStr] = true;
            var gpCount = self._incrementPfx(gpKeyStr, currentIdx);
            if (gpCount >= threshold && !self._blockedPatterns.has(gpKeyStr)) {
              self._blockedPatterns.add(gpKeyStr);
              maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: gpKeyStr, scriptPreview: Utils.truncateString(content, 120) };
              var pfxKeyFull = 'PFX:' + gpKeyStr;
              self._retroactiveBlock(pfxKeyFull, gpKeyStr + '*', threshold, currentIdx);
              self._doRetroactiveScan(gpKeyStr, currentIdx);
              self._retroactiveBlockFull(gpKeyStr, gpKeyStr + '*', threshold);
              break;
            }
          }
          if (maybeBlock) break;
        }
      }
      if (!maybeBlock) {
        var re3 = new RegExp(patterns.varPrefix.source, 'g');
        var match;
        while ((match = re3.exec(content)) !== null) {
          var prefix3 = match[1];
          if (!prefix3 || prefix3.length < 1) continue;
          var key3 = 'VP:' + prefix3;
          var count3 = self._increment(key3, currentIdx);
          if (count3 >= threshold) {
            self._blockedPatterns.add(prefix3);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: prefix3, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(key3, 'var ' + prefix3 + 'N', threshold, currentIdx);
            self._doRetroactiveScan(prefix3, currentIdx);
            self._retroactiveBlockFull(prefix3, 'var ' + prefix3 + 'N', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var re4 = new RegExp(patterns.funcDefPrefix.source, 'g');
        var match;
        while ((match = re4.exec(content)) !== null) {
          var prefix4 = match[1];
          if (!prefix4 || prefix4.length < 1) continue;
          var key4 = 'FD:' + prefix4;
          var count4 = self._increment(key4, currentIdx);
          if (count4 >= threshold) {
            self._blockedPatterns.add(prefix4);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: prefix4, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(key4, 'function ' + prefix4 + 'N', threshold, currentIdx);
            self._doRetroactiveScan(prefix4, currentIdx);
            self._retroactiveBlockFull(prefix4, 'function ' + prefix4 + 'N', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var re5 = new RegExp(patterns.assignPrefix.source, 'g');
        var match;
        while ((match = re5.exec(content)) !== null) {
          var obj5 = match[1], prefix5 = match[2];
          if (obj5 && self.SAFE_OBJECTS.has(obj5)) continue;
          if (!prefix5 || prefix5.length < 1) continue;
          var key5 = 'AP:' + prefix5;
          var count5 = self._increment(key5, currentIdx);
          if (count5 >= threshold) {
            self._blockedPatterns.add(prefix5);
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: prefix5, scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(key5, prefix5 + 'N =', threshold, currentIdx);
            self._doRetroactiveScan(prefix5, currentIdx);
            self._retroactiveBlockFull(prefix5, prefix5 + 'N =', threshold);
            break;
          }
        }
      }
      if (!maybeBlock) {
        var hasFetch = /\b(?:fetch|XMLHttpRequest)\s*\(/.test(content);
        var hasEval = /\b(?:eval|Function)\s*\(/.test(content);
        if (hasFetch && hasEval) {
          var keyFE = 'FE:fetchEval';
          var countFE = self._increment(keyFE, currentIdx);
          if (countFE >= 3) {
            self._blockedPatterns.add('fetch+eval');
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: 'fetch后执行', scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(keyFE, 'fetch后执行代码', 3, currentIdx);
          }
        }
      }
      if (!maybeBlock) {
        var domCreateCount = (content.match(/document\.createElement\s*\(/g) || []).length;
        if (domCreateCount >= 4) {
          var keyDOM = 'DI:domBatch';
          var countDOM = self._increment(keyDOM, currentIdx);
          if (countDOM >= 2) {
            self._blockedPatterns.add('domBatch');
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: 'DOM批量创建', scriptPreview: Utils.truncateString(content, 120) };
            self._retroactiveBlock(keyDOM, 'DOM批量创建', 2, currentIdx);
          }
        }
      }
      if (!maybeBlock) {
        if (patterns.singleCall.test(content)) {
          var scKey = 'SC:singleCall';
          var scCount = self._increment(scKey, currentIdx);
          if (scCount >= threshold) {
            self._blockedPatterns.add('__SINGLE_CALL__');
            maybeBlock = { blocked: true, reason: '跨标签重复模式', subject: '单调用脚本聚合', scriptPreview: Utils.truncateString(content, 120) };
            self._doSCRetroactiveScan(currentIdx);
            self._retroactiveBlockFull('', '单调用脚本', threshold);
          }
        }
      }
      if (ProcessedElementsCache.isProcessed(scriptElement)) {
        return { blocked: true, reason: maybeBlock ? maybeBlock.reason : '跨标签重复模式', subject: maybeBlock ? maybeBlock.subject : null };
      }
      if (maybeBlock && maybeBlock.blocked) {
        var ci = Utils.getContentIdentifier(scriptElement);
        if (ci && !currentConfig.whitelist.has(ci)) {
          LogManager.add('scriptBlacklistMode', scriptElement, {
            type: 'SCRIPT_BLACKLIST',
            detail: '命中跨标签重复模式: ' + (maybeBlock.subject || '未知') + ' - 脚本: ' + (maybeBlock.scriptPreview || ''),
            elementContentIdentifier: ci,
          });
          ResourceCanceller.cancelResourceLoading(scriptElement);
          ProcessedElementsCache.markAsProcessed(scriptElement);
          return { blocked: true, reason: maybeBlock.reason, subject: maybeBlock.subject };
        }
      }
      if (!maybeBlock || !maybeBlock.blocked) {
        this._escapedScripts.push({ index: currentIdx, content: content, element: scriptElement });
      }
      return { blocked: false, reason: null };
    },
    _retroactiveBlock: function (key, patternName, threshold, currentIdx) {
      var indices = this._scriptMap.get(key) || [];
      var thresholdNum = (threshold || 3);
      for (var i = 0; i < indices.length; i++) {
        if (typeof currentIdx === 'number' && indices[i] === currentIdx) continue;
        if (this._retroactiveBlockedSet.has(indices[i])) continue;
        var entry = this._scriptElements[indices[i]];
        if (entry && entry.element && entry.element.isConnected && !ProcessedElementsCache.isProcessed(entry.element)) {
          this._retroactiveBlockedSet.add(indices[i]);
          var ci = Utils.getContentIdentifier(entry.element);
          var scriptContent = entry.element.textContent || entry.element.src || '';
          var contentPreview = Utils.truncateString(scriptContent, CONFIG.CONTENT_PREVIEW_LENGTH);
          LogManager.add('scriptBlacklistMode', entry.element, {
            type: 'SCRIPT_BLACKLIST',
            detail: '命中跨标签重复模式: ' + patternName + ' (出现' + thresholdNum + '次以上, 回溯拦截) - 脚本: ' + contentPreview,
            elementContentIdentifier: ci,
          });
          ResourceCanceller.cancelResourceLoading(entry.element);
          ProcessedElementsCache.markAsProcessed(entry.element);
        }
      }
    },
  };
  CrossScriptPatternTracker.init();

  _document.addEventListener('DOMContentLoaded', function () {
    CrossScriptPatternTracker.reset();
  });

  const ResidualCleaner = {
    _scanTimer: null,
    _pendingNodes: [],
    _maxCleanupDepth: 5,
    observer: null,
    _isLazyImage: function (el) {
      if (el.tagName !== 'IMG') return false;
      if (el.loading === 'lazy') return true;
      var lazyAttrs = [
        'data-src', 'data-original', 'data-echo', 'data-lazy-src',
        'data-bg', 'data-srcset', 'data-lazy', 'data-ll-status', 'data-islazy',
      ];
      for (var i = 0; i < lazyAttrs.length; i++) {
        if (el.hasAttribute(lazyAttrs[i])) return true;
      }
      if (el.classList) {
        if (el.classList.contains('lazyload') || el.classList.contains('lazy')) return true;
      }
      if (el.srcset && el.srcset.trim()) return true;
      if (el.parentElement && el.parentElement.tagName === 'PICTURE') return true;
      return false;
    },
    init: function () {
      if (!Utils.isAnyModuleEnabled() || !currentConfig.residualCleanupEnabled) {
        this.stop();
        return;
      }
      this.setupMutationObserver();
      this.initialScan();
      this.startPeriodicScan();
    },
    stop: function () {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this._scanTimer !== null) {
        _cancelIdleCallback(this._scanTimer);
        this._scanTimer = null;
      }
      this._pendingNodes = [];
    },
    getScanSelectors: function () {
      var selectors = ['div', 'span', 'section', 'aside'];
      if (currentConfig.modules.interceptThirdParty) {
        selectors.push('iframe');
        selectors.push('object');
        selectors.push('embed');
      }
      return selectors.join(', ');
    },
    setupMutationObserver: function () {
      var self = this;
      this.observer = new _MutationObserver(function (ms) {
        for (const m of ms) {
          if (m.type === 'childList') {
            if (m.addedNodes.length > 0) {
              for (const n of m.addedNodes) {
                if (n.nodeType === _Node.ELEMENT_NODE && Utils.isElement(n)) {
                  self._pendingNodes.push(n);
                  self.checkAndCleanup(n);
                }
              }
            }
            if (m.removedNodes.length > 0 && m.target && Utils.isElement(m.target)) self.checkAndCleanup(m.target);
          }
        }
      });
      this.observer.observe(_document.documentElement, { childList: true, subtree: true, attributes: false });
    },
    cleanEmptyParents: function (parent, depth) {
      depth = depth || 0;
      if (depth > this._maxCleanupDepth) return;
      if (
        !parent ||
        parent === _document.body ||
        parent === _document.documentElement ||
        !Utils.isElement(parent) ||
        ProcessedElementsCache.isProcessed(parent)
      )
        return;
      if (this.isStrictEmpty(parent) && Utils.isSuspiciousAdContainer(parent)) {
        ProcessedElementsCache.markAsProcessed(parent);
        var np = parent.parentElement;
        parent.remove();
        this.cleanEmptyParents(np, depth + 1);
      }
    },
    isStrictEmpty: function (container) {
      if (!Utils.isElement(container)) return false;
      if (container.getAttribute && container.getAttribute('data-adblock-safe') === 'true') return false;
      var hasReal = false;
      for (var i = 0; i < container.childNodes.length; i++) {
        var child = container.childNodes[i];
        if (child.nodeType === _Node.ELEMENT_NODE && ProcessedElementsCache.isProcessed(child)) continue;
        if (child.nodeType === _Node.TEXT_NODE) {
          if (child.textContent.trim().length > 1) {
            hasReal = true;
            break;
          }
        } else if (child.nodeType === _Node.ELEMENT_NODE) {
          var el = child;
          if (el.offsetWidth <= 0 && el.offsetHeight <= 0) continue;
          var inlineStyle = el.style;
          if (inlineStyle.display === 'none' || inlineStyle.visibility === 'hidden' || inlineStyle.opacity === '0') continue;
          var s = _getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;
          if (el.tagName === 'IMG') {
            if (this._isLazyImage(el)) {
              hasReal = true;
              break;
            }
            var imgSrc = el.getAttribute('src') || el.getAttribute('data-src') || '';
            var isDataPlaceholder = imgSrc.startsWith('data:') && imgSrc.length < CONFIG.LAZY_PLACEHOLDER_MAX_LEN;
            if (imgSrc && !isDataPlaceholder) {
              hasReal = true;
              break;
            }
            if ((el.naturalWidth <= 5 && el.naturalHeight <= 5) || (el.offsetWidth <= 5 && el.offsetHeight <= 5)) continue;
          }
          if (el.offsetWidth > CONFIG.CONTAINER_MIN_VISIBLE && el.offsetHeight > CONFIG.CONTAINER_MIN_VISIBLE) {
            if (el.tagName === 'A') {
              var hasLink = false;
              for (var j = 0; j < el.childNodes.length; j++) {
                var c = el.childNodes[j];
                if (c.nodeType === _Node.TEXT_NODE && c.textContent.trim().length > 0) {
                  hasLink = true;
                  break;
                }
                if (c.nodeType === _Node.ELEMENT_NODE) {
                  if (c.tagName === 'IMG' && (c.naturalWidth > 5 || this._isLazyImage(c))) {
                    hasLink = true;
                    break;
                  }
                  if (c.offsetWidth > CONFIG.CONTAINER_MIN_VISIBLE && c.offsetHeight > CONFIG.CONTAINER_MIN_VISIBLE && c.tagName !== 'BR' && c.tagName !== 'HR' && c.tagName !== 'A') {
                    hasLink = true;
                    break;
                  }
                }
              }
              if (!hasLink) continue;
            }
            hasReal = true;
            break;
          }
        }
      }
      return !hasReal;
    },
    checkAndCleanup: function (element) {
      if (!element || !Utils.isElement(element) || ProcessedElementsCache.isProcessed(element) || element === _document.body || element === _document.documentElement) return;
      var w = element.offsetWidth;
      var h = element.offsetHeight;
      if (w > 0 && w < CONFIG.RESIDUAL_MIN_WIDTH && h > 0 && h < CONFIG.RESIDUAL_MIN_HEIGHT) return;
      if (!currentConfig.residualCleanupEnabled) return;
      if (this.isStrictEmpty(element)) {
        var s = _getComputedStyle(element);
        var isFH = s.height !== 'auto' && parseFloat(s.height) > CONFIG.FIXED_HEIGHT_THRESHOLD;
        var isHZ = parseInt(s.zIndex) > CONFIG.ZINDEX_HIDE_THRESHOLD;
        var isAF = s.position === 'absolute' || s.position === 'fixed';
        if (isFH || isAF || isHZ || Utils.isSuspiciousAdContainer(element)) {
          ProcessedElementsCache.markAsProcessed(element);
          this.cleanupContainer(element, isAF || isHZ);
        }
      }
    },
    cleanupContainer: function (container, forceHide) {
      forceHide = forceHide || false;
      if (!container || !Utils.isElement(container) || !container.isConnected) return;
      if (forceHide) {
        container.style.setProperty('display', 'none', 'important');
        container.style.setProperty('visibility', 'hidden', 'important');
        container.style.setProperty('pointer-events', 'none', 'important');
        container.style.setProperty('height', '0px', 'important');
        container.style.setProperty('overflow', 'hidden', 'important');
        var p = container.parentElement;
        while (p && p !== _document.body && p !== _document.documentElement) {
          if (!Utils.isElement(p)) break;
          p.style.setProperty('pointer-events', 'none', 'important');
          if (Array.from(p.childNodes).some(function (c) {
            return ((c.nodeType === _Node.ELEMENT_NODE && !ProcessedElementsCache.isProcessed(c)) || (c.nodeType === _Node.TEXT_NODE && c.textContent.trim().length > 0));
          })) break;
          p = p.parentElement;
        }
        ProcessedElementsCache.markAsProcessed(container);
      } else {
        var p2 = container.parentElement;
        ProcessedElementsCache.markAsProcessed(container);
        container.remove();
        this.cleanEmptyParents(p2);
      }
    },
    initialScan: function () {
      var els = Array.from(_document.querySelectorAll(this.getScanSelectors()));
      var toR = [];
      var toH = [];
      for (const el of els) {
        if (!el || !Utils.isElement(el) || ProcessedElementsCache.isProcessed(el) || el === _document.body || el === _document.documentElement) continue;
        var w = el.offsetWidth;
        var h = el.offsetHeight;
        if (w > 0 && w < CONFIG.RESIDUAL_MIN_WIDTH && h > 0 && h < CONFIG.RESIDUAL_MIN_HEIGHT) continue;
        if (this.isStrictEmpty(el)) {
          var s = _getComputedStyle(el);
          var isFH = s.height !== 'auto' && parseFloat(s.height) > CONFIG.FIXED_HEIGHT_THRESHOLD;
          var isHZ = parseInt(s.zIndex) > CONFIG.ZINDEX_HIDE_THRESHOLD;
          var isAF = s.position === 'absolute' || s.position === 'fixed';
          if (isFH || isAF || isHZ || Utils.isSuspiciousAdContainer(el)) {
            ProcessedElementsCache.markAsProcessed(el);
            if (isAF || isHZ) toH.push(el);
            else toR.push(el);
          }
        }
      }
      toR.forEach(function (el) {
        var p = el.parentElement;
        el.remove();
        ResidualCleaner.cleanEmptyParents(p);
      });
      toH.forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
      });
    },
    startPeriodicScan: function () {
      var self = this;
      var last = 0;
      var loop = function (dl) {
        if (!currentConfig.residualCleanupEnabled) return;
        var now = Date.now();
        if (now - last > CONFIG.IDLE_SCAN_INTERVAL && dl.timeRemaining() > 5) {
          var cnt = 0;
          var batch = self._pendingNodes.splice(0, CONFIG.BATCH_SIZE_CLEANUP);
          for (var i = 0; i < batch.length && dl.timeRemaining() > 5 && cnt < CONFIG.BATCH_SIZE_CLEANUP; i++) {
            var el = batch[i];
            if (!el || !Utils.isElement(el) || !el.isConnected) continue;
            self.checkAndCleanup(el);
            cnt++;
          }
          if (self._pendingNodes.length > 500) {
            self._pendingNodes = self._pendingNodes.filter(function(n) {
              return n && n.isConnected;
            });
            if (self._pendingNodes.length > 800) {
              self._pendingNodes = self._pendingNodes.slice(-500);
            }
          }
          if (cnt > 0) last = now;
        }
        self._scanTimer = _requestIdleCallback(loop);
      };
      this._scanTimer = _requestIdleCallback(loop);
    },
  };

  const OverlayInterceptor = {
    _enabled: false,
    _observer: null,
    _intersectionObserver: null,
    _processedSet: new WeakSet(),
    _hideClass: 'adblock-universal-hidden',
    _periodicTimer: null,
    _hiddenElementsMap: null,
    init: function () {
      currentConfig.modules.overlayIntercept ? this.enable() : this.disable();
    },
    _computeOverlayCI: function (el) {
      if (!el || !Utils.isElement(el)) return null;
      var ci = Utils.getContentIdentifier(el);
      if (ci) return ci;
      var tagInfo = el.tagName + (el.id ? '#' + el.id : '') +
          (el.className ? '.' + String(el.className).split(/\s+/).filter(function(c){return c;}).join('.') : '');
      var contentPreview = Utils.truncateString(el.textContent || '', 100);
      return 'OVERLAY_' + generateContentHash('overlayIntercept:' + tagInfo + ':' + contentPreview);
    },
    enable: function () {
      if (this._enabled) return;
      this._enabled = true;
      this._hiddenElementsMap = new _Map();
      this.setupIntersectionObserver();
      this.setupMutationObserver();
      if (thirdPartyModule && thirdPartyModule.domHooker) {
        thirdPartyModule.domHooker.enableOverlayCheck();
      }
      this.initialScan();
      this.restoreWhitelistedElements();
      this.startPeriodicScan();
    },
    disable: function () {
      if (!this._enabled) return;
      this._enabled = false;
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      if (this._intersectionObserver) { this._intersectionObserver.disconnect(); this._intersectionObserver = null; }
      if (thirdPartyModule && thirdPartyModule.domHooker) {
        thirdPartyModule.domHooker.disableOverlayCheck();
      }
      this.stopPeriodicScan();
      var cls = this._hideClass;
      try {
        _document.querySelectorAll('.' + cls).forEach(function (el) { el.classList.remove(cls); });
      } catch (e) { }
      this._processedSet = new WeakSet();
      if (this._hiddenElementsMap) this._hiddenElementsMap.clear();
    },
    setupIntersectionObserver: function () {
      var self = this;
      this._intersectionObserver = new _IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            var el = e.target;
            self._intersectionObserver.unobserve(el);
            self.checkAndHandle(el);
          }
        });
      }, { threshold: 0 });
    },
    setupMutationObserver: function () {
      var self = this;
      this._observer = new _MutationObserver(function (ms) {
        for (var mi = 0; mi < ms.length; mi++) {
          var m = ms[mi];
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            for (var ni = 0; ni < m.addedNodes.length; ni++) {
              var n = m.addedNodes[ni];
              if (n.nodeType === 1) self.checkAndHandle(n);
            }
          }
        }
      });
      this._observer.observe(_document.documentElement, { childList: true, subtree: true });
    },
    isOverlayElement: function (el) {
      if (!el || el.nodeType !== 1 || !Utils.isElement(el)) return false;
      if (Utils.isUIElement(el)) return false;
      if (this._processedSet.has(el)) return false;
      if (el.getAttribute && el.getAttribute('data-adblock-safe') === 'true') return false;
      if (el === _document.body || el === _document.documentElement) return false;
      var w = el.offsetWidth, h = el.offsetHeight;
      if (w < 30 && h < 30) return false;
      var style;
      try { style = _getComputedStyle(el); } catch (e) { return false; }
      var pos = style.position;
      if (pos === 'static') return false;
      var vw = _globals.innerWidth || _document.documentElement.clientWidth;
      var vh = _globals.innerHeight || _document.documentElement.clientHeight;
      var z = parseInt(style.zIndex);
      var hasHighZ = !isNaN(z) && z > CONFIG.ZINDEX_HIDE_THRESHOLD;
      var isFixed = pos === 'fixed';
      var isAbs = pos === 'absolute';
      if (hasHighZ) return true;
      if (isFixed && w >= vw * 0.5 && h >= vh * 0.5) return true;
      var hasThirdPartyIframe = false;
      if (currentConfig.modules.interceptThirdParty) {
        var ifs = el.querySelectorAll('iframe');
        for (var i = 0; i < ifs.length; i++) {
          var src = ifs[i].src;
          if (src && shouldBlockResource(src)) { hasThirdPartyIframe = true; break; }
        }
      }
      if (hasThirdPartyIframe && (isFixed || isAbs) && (w >= vw * 0.3 || h >= vh * 0.3)) return true;
      if ((isFixed || isAbs) && !isNaN(z) && z >= 100) {
        var hasVisibleContent = false;
        for (var ci = 0; ci < el.childNodes.length; ci++) {
          var c = el.childNodes[ci];
          if (c.nodeType === _Node.TEXT_NODE && c.textContent.trim().length > 0) { hasVisibleContent = true; break; }
          if (c.nodeType === _Node.ELEMENT_NODE) {
            if (c.tagName === 'IMG' && c.offsetWidth > 5 && c.offsetHeight > 5) { hasVisibleContent = true; break; }
            if (c.offsetWidth > 5 && c.offsetHeight > 5 && c.tagName !== 'BR' && c.tagName !== 'HR') { hasVisibleContent = true; break; }
          }
        }
        if (!hasVisibleContent) return true;
      }
      if (isFixed && (w >= vw * 0.8 || h >= vh * 0.8)) {
        var bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
      }
      return false;
    },
    _isInsideAdBlockUI: function(el) {
      if (!el) return false;
      var node = el;
      while (node && node !== _document.documentElement) {
        if (node.nodeType === 1) {
          if (node.getAttribute && node.getAttribute('data-adblock-safe') === 'true') return true;
          if (node.id === 'ad-blocker-settings-container') return true;
          if (node.classList && (node.classList.contains('mask') || node.classList.contains('panel'))) return true;
        }
        node = node.parentElement || node.parentNode;
      }
      return false;
    },
    checkAndHandle: function (el) {
      if (!el || el.nodeType !== 1 || !Utils.isElement(el)) return;
      if (Utils.isUIElement(el)) return;
      if (this._processedSet.has(el)) return;
      if (el.getAttribute && el.getAttribute('data-adblock-safe') === 'true') return;
      if (this._isInsideAdBlockUI(el)) {
        this._processedSet.add(el);
        return;
      }
      if (el.getAttribute && el.getAttribute('data-adblock-overlay-whitelisted') === 'true') {
        this._processedSet.add(el);
        return;
      }
      var overlayCi = el.getAttribute && el.getAttribute('data-adblock-overlay-ci');
      if (overlayCi && currentConfig.whitelist.has(overlayCi)) {
        this._processedSet.add(el);
        return;
      }
      if (Whitelisting.isElementWhitelisted(el)) {
        this._processedSet.add(el);
        return;
      }
      if (!overlayCi) {
        var computedOverlayCi = this._computeOverlayCI(el);
        if (computedOverlayCi && currentConfig.whitelist.has(computedOverlayCi)) {
          this._processedSet.add(el);
          el.setAttribute('data-adblock-overlay-whitelisted', 'true');
          return;
        }
      }
      if (currentConfig.keywordWhitelist.size > 0) {
        var kr = getKeywordWhitelistRegex();
        if (kr) {
          var sc = el.textContent || '';
          var src = el.src || el.href || el.action || el.data || el.getAttribute('data-src') || '';
          var className = el.className && typeof el.className === 'string' ? el.className : '';
          var elId = el.id || '';
          var allAttrs = '';
          if (el.attributes) {
            for (var ai = 0; ai < el.attributes.length; ai++) {
              allAttrs += el.attributes[ai].value + ' ';
            }
          }
          var combinedText = sc + ' ' + src + ' ' + className + ' ' + elId + ' ' + allAttrs;
          if (kr.test(combinedText)) {
            this._processedSet.add(el);
            el.setAttribute('data-adblock-overlay-whitelisted', 'true');
            return;
          }
        }
      }
      if (this.isOverlayElement(el)) {
        this.hideElement(el);
        return;
      }
      if (el.querySelectorAll) {
        var children = el.querySelectorAll('div, iframe, section, aside, a, span, article, main');
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (this._processedSet.has(child)) continue;
          if (Whitelisting.isElementWhitelisted(child)) {
            this._processedSet.add(child);
            continue;
          }
          var childOverlayCi = child.getAttribute && child.getAttribute('data-adblock-overlay-ci');
          if (childOverlayCi && currentConfig.whitelist.has(childOverlayCi)) {
            this._processedSet.add(child);
            continue;
          }
          var childComputedCi = this._computeOverlayCI(child);
          if (childComputedCi && currentConfig.whitelist.has(childComputedCi)) {
            this._processedSet.add(child);
            child.setAttribute('data-adblock-overlay-whitelisted', 'true');
            continue;
          }
          if (currentConfig.keywordWhitelist.size > 0) {
            var kr2 = getKeywordWhitelistRegex();
            if (kr2) {
              var csc = child.textContent || '';
              var csrc = child.src || child.href || child.action || child.data || child.getAttribute('data-src') || '';
              var cClass = child.className && typeof child.className === 'string' ? child.className : '';
              var cId = child.id || '';
              if (kr2.test(csc + ' ' + csrc + ' ' + cClass + ' ' + cId)) {
                this._processedSet.add(child);
                child.setAttribute('data-adblock-overlay-whitelisted', 'true');
                continue;
              }
            }
          }
          if (this.isOverlayElement(child)) this.hideElement(child);
        }
      }
    },
    hideElement: function (el) {
      if (!el || this._processedSet.has(el)) return;
      var ci = Utils.getContentIdentifier(el);
      var tagInfo = el.tagName + (el.id ? '#' + el.id : '') +
          (el.className ? '.' + String(el.className).split(/\s+/).filter(function(c){return c;}).join('.') : '');
      var contentPreview = Utils.truncateString(el.textContent || '', 100);
      var detail = '覆盖层拦截: ' + tagInfo + ' - ' + contentPreview;
      if (!ci) {
        ci = 'OVERLAY_' + generateContentHash('overlayIntercept:' + tagInfo + ':' + contentPreview);
      }
      if (currentConfig.whitelist.has(ci)) {
        this._processedSet.add(el);
        el.setAttribute('data-adblock-overlay-ci', ci);
        el.setAttribute('data-adblock-overlay-whitelisted', 'true');
        return;
      }
      if (currentConfig.keywordWhitelist.size > 0) {
        var kr = getKeywordWhitelistRegex();
        if (kr) {
          var sc = el.textContent || '';
          var src = el.src || el.href || el.action || el.data || el.getAttribute('data-src') || '';
          if ((sc && kr.test(sc)) || (src && kr.test(src))) {
            this._processedSet.add(el);
            el.setAttribute('data-adblock-overlay-ci', ci);
            el.setAttribute('data-adblock-overlay-whitelisted', 'true');
            return;
          }
        }
      }
      el.setAttribute('data-adblock-overlay-ci', ci);
      el.classList.add(this._hideClass);
      this._processedSet.add(el);
      ProcessedElementsCache.markAsProcessed(el);
      this._hiddenElementsMap.set(el, ci);
      LogManager.add('overlayIntercept', el, {
        type: 'OVERLAY',
        detail: detail,
        elementContentIdentifier: ci,
      });
    },
    restoreWhitelistedElements: function () {
      if (!this._hiddenElementsMap || this._hiddenElementsMap.size === 0) return;
      var self = this;
      var toRestore = [];
      this._hiddenElementsMap.forEach(function (ci, el) {
        if (!el.isConnected) {
          self._hiddenElementsMap.delete(el);
          return;
        }
        if (ci && currentConfig.whitelist.has(ci)) {
          toRestore.push(el);
          return;
        }
        if (currentConfig.keywordWhitelist.size > 0) {
          var kr = getKeywordWhitelistRegex();
          if (kr) {
            var sc = el.textContent || '';
            var src = el.src || el.href || '';
            if ((sc && kr.test(sc)) || (src && kr.test(src))) {
              toRestore.push(el);
              return;
            }
          }
        }
        if (el.querySelector) {
          var iframes = el.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            var iframeSrc = iframes[i].src;
            if (iframeSrc && urlCache.isWhitelisted(iframeSrc, currentConfig.thirdPartyWhitelist)) {
              toRestore.push(el);
              return;
            }
          }
        }
      });
      toRestore.forEach(function (el) {
        el.classList.remove(self._hideClass);
        el.setAttribute('data-adblock-overlay-whitelisted', 'true');
        self._hiddenElementsMap.delete(el);
      });
    },
    initialScan: function () {
      var self = this;
      try {
        _document.querySelectorAll('*').forEach(function (el) {
          if (!self._processedSet.has(el)) self.checkAndHandle(el);
        });
      } catch (e) { }
    },
    startPeriodicScan: function () {
      var self = this;
      var last = 0;
      var loop = function (dl) {
        if (!self._enabled || !currentConfig.modules.overlayIntercept) return;
        var now = Date.now();
        if (now - last > CONFIG.IDLE_SCAN_INTERVAL && dl.timeRemaining() > 5) {
          var cnt = 0;
          try {
            var els = _document.querySelectorAll('div, iframe, section, aside, a, span, article, main');
            for (var i = 0; i < els.length && cnt < 30 && dl.timeRemaining() > 5; i++) {
              var el = els[i];
              if (!self._processedSet.has(el) && el.isConnected) {
                self.checkAndHandle(el);
                cnt++;
              }
            }
          } catch (e) { }
          if (cnt > 0) last = now;
        }
        self._periodicTimer = _requestIdleCallback(loop);
      };
      this._periodicTimer = _requestIdleCallback(loop);
    },
    stopPeriodicScan: function () {
      if (this._periodicTimer !== null) {
        _cancelIdleCallback(this._periodicTimer);
        this._periodicTimer = null;
      }
    },
  };

  const _xhrBlockState = new WeakMap();

  const ResourceCanceller = {
    cancelResourceLoading: function (element) {
      if (!Utils.isElement(element) || ProcessedElementsCache.isProcessed(element)) return;
      var t = element.tagName;
      if (t === 'IMG') {
        element.removeAttribute('src');
        element.removeAttribute('srcset');
        element.removeAttribute('data-src');
      } else if (t === 'IFRAME') {
        element.removeAttribute('src');
        element.style.display = 'none';
      } else if (t === 'SCRIPT') {
        element.removeAttribute('src');
        element.textContent = '';
      } else if (t === 'LINK' && element.rel === 'stylesheet') element.removeAttribute('href');
      else if (t === 'STYLE') element.textContent = '';
      else if (t === 'EMBED') element.removeAttribute('src');
      else if (t === 'OBJECT') element.removeAttribute('data');
      var p = element.parentElement;
      if (p && p !== _document.body && p !== _document.documentElement && Utils.isContainerEmpty(p, true) && Utils.isSuspiciousAdContainer(p)) ResidualCleaner.checkAndCleanup(p);
      if (element.parentNode) element.parentNode.removeChild(element);
      ProcessedElementsCache.markAsProcessed(element);
    },
  };

  const TAG_HANDLERS = {
    SCRIPT: {
      srcAttr: 'src',
      inlineContent: true,
      check: function (el, mk, reason) {
        var ci = Utils.getContentIdentifier(el);
        if (ci && currentConfig.whitelist.has(ci)) return false;
        LogManager.add(mk, el, reason);
        if (mk === 'removeExternalScripts' || mk === 'scriptBlacklistMode') ResourceCanceller.cancelResourceLoading(el);
        else if (mk === 'removeInlineScripts' && !el.src) ResourceCanceller.cancelResourceLoading(el);
        ProcessedElementsCache.markAsProcessed(el);
        return true;
      },
    },
    IFRAME: {
      srcAttr: 'src',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.src;
        if (u && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'IFRAME: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          ResourceCanceller.cancelResourceLoading(el);
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
    IMG: {
      srcAttr: 'src',
      dataSrcAttr: 'data-src',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.src || el.getAttribute('data-src');
        if (u && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'IMG: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          ResourceCanceller.cancelResourceLoading(el);
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
    LINK: {
      srcAttr: 'href',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.href;
        if (u && el.rel === 'stylesheet' && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'LINK: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          ResourceCanceller.cancelResourceLoading(el);
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
    EMBED: {
      srcAttr: 'src',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.src;
        if (u && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'EMBED: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          ResourceCanceller.cancelResourceLoading(el);
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
    OBJECT: {
      srcAttr: 'data',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.data;
        if (u && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'OBJECT: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          ResourceCanceller.cancelResourceLoading(el);
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
    A: {
      srcAttr: 'href',
      check: function (el, mk) {
        if (mk !== 'interceptThirdParty') return false;
        var u = el.href;
        if (u && shouldBlockResource(u)) {
          LogManager.add(mk, el, { type: 'THIRD_PARTY', detail: 'A: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH) });
          el.href = 'javascript:void(0)';
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
        return false;
      },
    },
  };

  class BaseModule {
    constructor(mk) {
      this.moduleKey = mk;
      this.enabled = false;
      this.observer = null;
    }
    init() {
      currentConfig.modules[this.moduleKey] ? this.enable() : this.disable();
    }
    enable() {
      if (this.enabled) return;
      this.enabled = true;
      this.onEnable();
    }
    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      this.onDisable();
    }
    onEnable() {}
    onDisable() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
    checkElement(el) {
      if (!Utils.shouldInterceptByModule(el, this.moduleKey)) return false;
      return this._checkElement(el);
    }
    _checkElement(el) {
      throw new Error('_checkElement must be implemented');
    }
  }

  class RemoveInlineScriptsModule extends BaseModule {
    constructor() {
      super('removeInlineScripts');
      this.attributeObserver = null;
    }
    onEnable() {
      var self = this;
      this.observer = new _MutationObserver(function (ms) {
        for (const m of ms) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              if (currentConfig.inlineScriptStrictMode) self.sanitizeInlineEventAttributes(n);
              if (n.tagName === 'SCRIPT' && !n.src) self.checkElement(n);
              else if (n.querySelectorAll) {
                n.querySelectorAll('script:not([src])').forEach(function (s) { self.checkElement(s); });
              }
            }
          }
        }
      });
      this.observer.observe(_document.documentElement, { childList: true, subtree: true });

      _document.querySelectorAll('script:not([src])').forEach(function (s) {
        self.checkElement(s);
      });
      if (currentConfig.inlineScriptStrictMode) _document.querySelectorAll('*').forEach(function (el) {
        self.sanitizeInlineEventAttributes(el);
      });
      if (currentConfig.inlineScriptStrictMode) {
        this.attributeObserver = new _MutationObserver(function (ms) {
          for (const m of ms) {
            if (m.type !== 'attributes' || m.target.nodeType !== 1) continue;
            var an = m.attributeName;
            var t = m.target;
            if (an && an.toLowerCase().startsWith('on')) {
              var v = t.getAttribute(an);
              if (v && typeof v === 'string' && v.trim() !== '') {
                var r = { type: '内联事件', detail: '属性: ' + an + '="' + v + '"' };
                if (!Whitelisting.isReasonWhitelisted(r, self.moduleKey)) {
                  LogManager.add(self.moduleKey, t, r);
                  t.removeAttribute(an);
                  ProcessedElementsCache.markAsProcessed(t);
                }
              }
            } else if (['href', 'src', 'action', 'data', 'formaction'].indexOf(an) !== -1) {
              var v2 = t.getAttribute(an);
              if (v2 && typeof v2 === 'string' && v2.trim().toLowerCase().startsWith('javascript:')) {
                var r2 = { type: 'javascript URL', detail: an + '="' + v2 + '"' };
                if (!Whitelisting.isReasonWhitelisted(r2, self.moduleKey)) {
                  LogManager.add(self.moduleKey, t, r2);
                  t.removeAttribute(an);
                  ProcessedElementsCache.markAsProcessed(t);
                }
              }
            }
          }
        });
        this.attributeObserver.observe(_document.documentElement, { attributes: true, subtree: true });
      }
    }
    onDisable() {
      super.onDisable();
      if (this.attributeObserver) {
        this.attributeObserver.disconnect();
        this.attributeObserver = null;
      }
    }
    _checkElement(el) {
      if (el.tagName === 'SCRIPT' && !el.src) return TAG_HANDLERS.SCRIPT.check(el, this.moduleKey, {
        type: '内嵌脚本移除',
        detail: '内容: ' + Utils.truncateString(el.textContent, CONFIG.LOG_DETAIL_LENGTH),
        elementContentIdentifier: Utils.getContentIdentifier(el),
      });
      return false;
    }
    sanitizeInlineEventAttributes(el) {
      if (!Utils.isElement(el) || ProcessedElementsCache.isProcessed(el)) return false;
      var mod = false;
      if (el.attributes) {
        for (var i = el.attributes.length - 1; i >= 0; i--) {
          var a = el.attributes[i];
          if (a.name.toLowerCase().startsWith('on') && typeof a.value === 'string' && a.value.trim() !== '') {
            var r = { type: '内联事件', detail: '属性: ' + a.name + '="' + a.value + '"' };
            if (!Whitelisting.isReasonWhitelisted(r, this.moduleKey)) {
              LogManager.add(this.moduleKey, el, r);
              el.removeAttribute(a.name);
              mod = true;
            }
          }
        }
      }
      ['href', 'src', 'action', 'data', 'formaction'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v && typeof v === 'string' && v.trim().toLowerCase().startsWith('javascript:')) {
          var r = { type: 'javascript URL', detail: attr + '="' + v + '"' };
          if (!Whitelisting.isReasonWhitelisted(r, self.moduleKey)) {
            LogManager.add(el.tagName === 'SCRIPT' ? 'removeInlineScripts' : 'removeInlineScripts', el, r);
            el.removeAttribute(attr);
            mod = true;
          }
        }
      });
      if (mod) ProcessedElementsCache.markAsProcessed(el);
      return mod;
    }
    updateStrictMode() {
      if (this.enabled) {
        this.onDisable();
        this.onEnable();
      }
    }
  }

  class RemoveExternalScriptsModule extends BaseModule {
    constructor() {
      super('removeExternalScripts');
    }
    onEnable() {
      var self = this;
      this.observer = new _MutationObserver(function (ms) {
        for (const m of ms) {
          if (m.type === 'childList') {
            for (const n of m.addedNodes) {
              if (n.nodeType === 1) {
                if (n.tagName === 'SCRIPT' && n.src) self.checkElement(n);
                if (n.querySelectorAll) n.querySelectorAll('script[src]').forEach(function (s) {
                  self.checkElement(s);
                });
              }
            }
          } else if (m.type === 'attributes' && m.attributeName === 'src') {
            var el = m.target;
            if (el.tagName === 'SCRIPT' && el.src) self.checkElement(el);
          }
        }
      });
      this.observer.observe(_document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
      _document.querySelectorAll('script[src]').forEach(function (s) {
        self.checkElement(s);
      });
    }
    _checkElement(el) {
      if (el.tagName === 'SCRIPT' && el.src) return TAG_HANDLERS.SCRIPT.check(el, this.moduleKey, {
        type: '外联脚本移除',
        detail: 'SRC: ' + Utils.truncateString(el.src, CONFIG.LOG_DETAIL_LENGTH),
        elementContentIdentifier: Utils.getContentIdentifier(el),
      });
      return false;
    }
  }

  class ScriptBlacklistModeModule extends BaseModule {
    constructor() {
      super('scriptBlacklistMode');
      this.activeBlacklistSet = null;
      this.lastBlacklistHash = '';
      this._plainKeywords = [];
      this._blacklistRegex = null;
    }
    updateActiveBlacklistSet() {
      var h = Array.from(currentConfig.scriptBlacklist).sort().join('|') + '|' + currentConfig.builtinBlacklistEnabled + '|' + Array.from(currentConfig.removedBuiltinKeywords).sort().join('|');
      if (h !== this.lastBlacklistHash) {
        this.lastBlacklistHash = h;
        this.activeBlacklistSet = Utils.getActiveBlacklistSet();
        var keywords = Array.from(this.activeBlacklistSet).filter(function (k) {
          return k && k.length > 0;
        });
        if (keywords.length === 0) {
          this._plainKeywords = [];
          this._blacklistRegex = null;
        } else {
          var plainKeywords = [];
          var regexKeywords = [];
          var hasMetaChars = /[.*+?^${}()|[\]\\]/;
          for (var i = 0; i < keywords.length; i++) {
            if (hasMetaChars.test(keywords[i])) {
              regexKeywords.push(keywords[i]);
            } else {
              plainKeywords.push(keywords[i]);
            }
          }
          this._plainKeywords = plainKeywords;
          if (regexKeywords.length > 0) {
            var escaped = regexKeywords.map(function (k) {
              return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            });
            try {
              this._blacklistRegex = new RegExp(escaped.join('|'), 'i');
            } catch (e) {
              this._blacklistRegex = null;
            }
          } else {
            this._blacklistRegex = null;
          }
        }
      }
    }
    _checkHeuristic(content) {
      if (!currentConfig.heuristicBlacklistEnabled || !HEURISTIC_REGEX_GROUPS) return false;
      const samples = [];
      if (content.length > 2000) {
        samples.push(content.substring(0, 2000));
        const mid = Math.floor(content.length / 2);
        samples.push(content.substring(mid - 1000, mid + 1000));
        samples.push(content.substring(content.length - 2000));
      } else {
        samples.push(content);
      }
      for (const sample of samples) {
        for (let i = 0; i < HEURISTIC_REGEX_GROUPS.length; i++) {
          if (HEURISTIC_REGEX_GROUPS[i].test(sample)) return true;
        }
      }
      return false;
    }
    rebuildBlacklist() {
      this.updateActiveBlacklistSet();
    }
    onEnable() {
      var self = this;
      this.updateActiveBlacklistSet();
      this.observer = new _MutationObserver(function (ms) {
        for (const m of ms) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) {
              if (n.tagName === 'SCRIPT') self.checkElement(n);
              if (n.querySelectorAll) n.querySelectorAll('script').forEach(function (s) {
                self.checkElement(s);
              });
            }
          }
        }
      });
      this.observer.observe(_document.documentElement, { childList: true, subtree: true });
      _document.querySelectorAll('script').forEach(function (s) {
        self.checkElement(s);
      });
    }
    _checkElement(el) {
      if (el.tagName !== 'SCRIPT') return false;
      var content = el.src || el.textContent || '';
      if (!content) return false;

      var matched = false, mk = '';
      var plainKeywords = this._plainKeywords;
      if (plainKeywords && plainKeywords.length > 0) {
        for (var pi = 0; pi < plainKeywords.length; pi++) {
          if (content.indexOf(plainKeywords[pi]) !== -1) {
            matched = true;
            mk = plainKeywords[pi];
            break;
          }
        }
      }
      if (!matched && this._blacklistRegex) {
        var regexMatch = content.match(this._blacklistRegex);
        if (regexMatch) {
          matched = true;
          mk = regexMatch[0];
        }
      }
      if (matched) {
        var elementCI = Utils.getContentIdentifier(el);
        LogManager.add(this.moduleKey, el, {
          type: 'SCRIPT_BLACKLIST',
          detail: '命中' + (mk === '启发式规则' ? '启发式规则' : '关键词: ' + mk) + ' - ' + (el.src ? 'SRC: ' + Utils.truncateString(el.src, CONFIG.LOG_DETAIL_LENGTH) : '内嵌: ' + Utils.truncateString(el.textContent, CONFIG.LOG_DETAIL_LENGTH)),
          elementContentIdentifier: elementCI,
        });
        ResourceCanceller.cancelResourceLoading(el);
        ProcessedElementsCache.markAsProcessed(el);
        return true;
      }

      if (currentConfig.heuristicBlacklistEnabled) {
        var crossResult = CrossScriptPatternTracker.checkScript(el, el.textContent || '');
        if (crossResult.blocked) {
          var crossCI = Utils.getContentIdentifier(el);
          if (crossCI && !currentConfig.whitelist.has(crossCI)) {
            if (!ProcessedElementsCache.isProcessed(el)) {
              var scriptInfo = crossResult.scriptPreview
                  ? (' - 脚本: ' + crossResult.scriptPreview)
                  : '';
              LogManager.add(this.moduleKey, el, {
                type: 'SCRIPT_BLACKLIST',
                detail: '命中跨标签重复模式: ' + (crossResult.subject || '未知') + scriptInfo,
                elementContentIdentifier: crossCI,
              });
              ResourceCanceller.cancelResourceLoading(el);
              ProcessedElementsCache.markAsProcessed(el);
            }
            return true;
          }
        }
      }

      if (!el.src && this._checkHeuristic(el.textContent || '')) {
        var heuristicCI = Utils.getContentIdentifier(el);
        LogManager.add(this.moduleKey, el, {
          type: 'SCRIPT_BLACKLIST',
          detail: '命中启发式规则 - 内嵌: ' + Utils.truncateString(el.textContent, CONFIG.LOG_DETAIL_LENGTH),
          elementContentIdentifier: heuristicCI,
        });
        ResourceCanceller.cancelResourceLoading(el);
        ProcessedElementsCache.markAsProcessed(el);
        return true;
      }

      return false;
    }
  }

  class HTMLSanitizer {
    constructor(mk) {
      this.moduleKey = mk;
    }
    filterHTMLString(html) {
      if (typeof html !== 'string' || !html.includes('<')) return html;
      var qr = /<(?:script|link|img|iframe|embed|object|a|form|base)[^>]*(?:src|href|data|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
      var need = false;
      var m;
      while ((m = qr.exec(html)) !== null) {
        if (m[1] || m[2] || m[3]) {
          var u = m[1] || m[2] || m[3];
          if (u && shouldBlockResource(u)) {
            need = true;
            break;
          }
        }
      }
      if (!need) return html;
      try {
        var doc = new _globals.DOMParser().parseFromString(html, 'text/html');
        var self = this;
        doc.querySelectorAll('script,link,img,iframe,embed,object,a,form,base').forEach(function (el) {
          var t = el.tagName.toLowerCase();
          var a;
          if (['script', 'img', 'iframe', 'embed'].indexOf(t) !== -1) a = 'src';
          else if (['link', 'a', 'base'].indexOf(t) !== -1) a = 'href';
          else if (t === 'object') a = 'data';
          else if (t === 'form') a = 'action';
          if (!a) return;
          var u = el.getAttribute(a);
          if (!u) return;
          if (t === 'link') {
            var r = el.getAttribute('rel');
            if (!r || !r.includes('stylesheet')) return;
          }
          if (shouldBlockResource(u)) {
            LogManager.add(self.moduleKey, null, {
              type: 'THIRD_PARTY_HTML_INJECTION',
              detail: '阻止: ' + t.toUpperCase() + ' ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
            });
            if (t === 'img') {
              el.setAttribute(a, TRANSPARENT_PIXEL);
              el.removeAttribute('srcset');
              el.removeAttribute('data-src');
            } else if (t === 'a' || t === 'form') el.removeAttribute(a);
            else el.remove();
          }
        });
        return doc.body.innerHTML;
      } catch (e) {
        return html;
      }
    }
  }

  class NetworkInterceptor {
    constructor(mk) {
      this.moduleKey = mk;
      this.restoredFns = [];
    }
    setupNetworkInterception() {
      var self = this;
      try {
        var origFetch = _fetch;
        _globals.fetch = new _Proxy(_fetch, {
          apply: function (t, ta, a) {
            try {
              var u = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) ? a[0].url : undefined;
              if (u && typeof u === 'string') {
                try {
                  u = new URL(u, _location.href).href;
                } catch (urlErr) { }
              }
              if (u && shouldBlockResource(u)) {
                LogManager.add(self.moduleKey, null, {
                  type: 'THIRD_PARTY',
                  detail: 'FETCH: ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
                });
                return Promise.resolve(new Response('', { status: 0, statusText: 'Blocked by AdBlocker', headers: { 'X-AdBlock-Blocked': 'true' } }));
              }
            } catch (innerErr) { }
            return Reflect.apply(t, ta, a);
          },
        });
        this.restoredFns.push(function () {
          try {
            _globals.fetch = origFetch;
          } catch (e) { }
        });
      } catch (e) { }
      try {
        var oo = _XMLHttpRequest.prototype.open;
        var os = _XMLHttpRequest.prototype.send;
        _XMLHttpRequest.prototype.open = new _Proxy(oo, {
          apply: function (t, ta, a) {
            if (a[1] && shouldBlockResource(a[1])) {
              LogManager.add(self.moduleKey, null, {
                type: 'THIRD_PARTY',
                detail: 'XHR: ' + Utils.truncateString(a[1], CONFIG.LOG_DETAIL_LENGTH)
              });
              _xhrBlockState.set(ta, { blocked: true, url: a[1] });
              try {
                Reflect.apply(t, ta, [a[0] || 'GET', 'about:blank', a[2] !== false]);
              } catch (e) { }
              return;
            }
            _xhrBlockState.delete(ta);
            return Reflect.apply(t, ta, a);
          },
        });
        _XMLHttpRequest.prototype.send = new _Proxy(os, {
          apply: function (t, ta, a) {
            var state = _xhrBlockState.get(ta);
            if (state && state.blocked) {
              _xhrBlockState.delete(ta);
              _setTimeout(function () {
                try {
                  Object.defineProperty(ta, 'readyState', { value: 4, writable: false, configurable: true });
                  Object.defineProperty(ta, 'status', { value: 0, writable: false, configurable: true });
                  Object.defineProperty(ta, 'statusText', { value: 'Blocked', writable: false, configurable: true });
                  Object.defineProperty(ta, 'responseText', { value: '', writable: false, configurable: true });
                  Object.defineProperty(ta, 'response', { value: '', writable: false, configurable: true });
                  if (typeof ta.onreadystatechange === 'function') ta.onreadystatechange();
                  if (typeof ta.onload === 'function') ta.onload();
                  if (typeof ta.addEventListener === 'function') {
                    var evt = { type: 'load', target: ta, currentTarget: ta };
                    ta.dispatchEvent(evt);
                  }
                } catch (e) { }
              }, 0);
              return;
            }
            return Reflect.apply(t, ta, a);
          },
        });
        this.restoredFns.push(function () {
          try {
            _XMLHttpRequest.prototype.open = oo;
          } catch (e) { }
          try {
            _XMLHttpRequest.prototype.send = os;
          } catch (e) { }
        });
      } catch (e) { }
    }
    stopInterception() {
      this.restoredFns.forEach(function (fn) {
        try {
          fn();
        } catch (e) { }
      });
      this.restoredFns = [];
    }
  }

  class ImageInterceptor {
    constructor(mk) {
      this.moduleKey = mk;
      this.originalImage = null;
      this.trackingPatterns = [
        /pixel/i, /beacon/i, /track/i, /analytics/i, /__utm/i, /gtag/i,
        /\bga\.(?:js|gif|png)\b/i, /ping/i, /\/collect\b/i, /\/stat(istic)?s?\b/i,
        /\/log(ger)?\b/i, /\/metric(s)?\b/i, /\/monitor(ing)?\b/i, /\/report(ing)?\b/i,
        /\/hit(s)?\b/i, /\/event(s)?\b/i, /\/counter\b/i, /\/pageview\b/i, /\/activity\b/i,
        /\/telemetry\b/i, /\/rum\b/i, /\/error_report/i, /\/imp(ression)?s?\b/i,
        /\/click(s|track)?\b/i, /\/conv(ersion)?s?\b/i, /\/ref(erral)?(s)?\b/i,
        /\b(?:1x1|spacer|blank|px)\.(?:gif|png|jpe?g)\b/i,
        /\b(?:tr|trk|ct)\.(?:gif|png|jpe?g)\b/i, /\btag\.(?:js|gif|png)\b/i,
        /\.(?:gif|png|jpe?g)\?.*(?:id|uid|sid|pid|session|visitor|ref|source|campaign)=/i,
        /[?&](?:utm_source|utm_medium|utm_campaign|utm_term|utm_content)=/i,
        /[?&](?:gclid|fbclid|msclkid|dclid|mc_eid)=/i,
        /[?&](?:ref|source|medium|campaign|aff_id|click_id|sid|track_id|tid)=/i,
        /[?&]tid=UA-/i, /[?&]tid=G-/i, /[?&]callback=/i,
        /\bfingerprint/i, /\bclient_id/i,
      ];
    }
    init() {
      var self = this;
      try {
        this.originalImage = _globals.Image;
        var OriginalImage = this.originalImage;
        var trackingPatterns = this.trackingPatterns;
        var compiledTrackingRegex = (function() {
          try {
            return new RegExp(trackingPatterns.map(p => `(?:${p.source})`).join('|'), 'i');
          } catch(e) {
            return null;
          }
        })();
        var isTrackingPixel = function (src) {
          if (!src || typeof src !== 'string') return false;
          return compiledTrackingRegex ? compiledTrackingRegex.test(src) : false;
        };
        var WrappedImage = function () {
          var img;
          if (arguments.length === 2) img = new OriginalImage(arguments[0], arguments[1]);
          else if (arguments.length === 1) img = new OriginalImage(arguments[0]);
          else img = new OriginalImage();
          var srcDescriptor = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'src');
          if (srcDescriptor && srcDescriptor.set) {
            var originalSrcSet = srcDescriptor.set;
            Object.defineProperty(img, 'src', {
              get: function () {
                return srcDescriptor.get.call(this);
              },
              set: function (v) {
                if (v && typeof v === 'string') {
                  if (isTrackingPixel(v) || shouldBlockResource(v)) {
                    LogManager.add(self.moduleKey, null, {
                      type: 'TRACKING_PIXEL',
                      detail: '拦截追踪像素: ' + Utils.truncateString(v, CONFIG.LOG_DETAIL_LENGTH)
                    });
                    return originalSrcSet.call(this, TRANSPARENT_PIXEL);
                  }
                }
                return originalSrcSet.call(this, v);
              },
              configurable: true,
              enumerable: true,
            });
          }
          return img;
        };
        WrappedImage.prototype = OriginalImage.prototype;
        _globals.Image = WrappedImage;
      } catch (e) { }
    }
    stop() {
      if (this.originalImage) {
        try {
          _globals.Image = this.originalImage;
        } catch (e) { }
        this.originalImage = null;
      }
    }
  }

  class DOMPrototypeHooker {
    constructor(mk, hs) {
      this.moduleKey = mk;
      this.htmlSanitizer = hs;
      this.restoredFns = [];
      this.observer = null;
      this._applyingElements = new WeakSet();
      this._strictDOMInterceptorCount = 0;
      this._overlayCheckEnabled = false;
    }
    enableOverlayCheck() {
      this._overlayCheckEnabled = true;
      this._incrementStrictDOM();
    }
    disableOverlayCheck() {
      this._overlayCheckEnabled = false;
      this._decrementStrictDOM();
    }
    _incrementStrictDOM() {
      if (this._strictDOMInterceptorCount === 0) {
        this.setupStrictDOMInterception();
      }
      this._strictDOMInterceptorCount++;
    }
    _decrementStrictDOM() {
      if (this._strictDOMInterceptorCount > 0) {
        this._strictDOMInterceptorCount--;
        if (this._strictDOMInterceptorCount === 0) {
          this.restoreStrictDOMInterception();
        }
      }
    }
    setupProxyInterception() {
      var self = this;
      var lc = function (el, attr, url, tag) {
        LogManager.add(self.moduleKey, el, {
          type: 'THIRD_PARTY',
          detail: tag + ': ' + Utils.truncateString(url, CONFIG.LOG_DETAIL_LENGTH)
        });
        ResourceCanceller.cancelResourceLoading(el);
        ProcessedElementsCache.markAsProcessed(el);
      };
      try {
        var osa = _Element.prototype.setAttribute;
        _Element.prototype.setAttribute = new _Proxy(osa, {
          apply: function (t, ta, a) {
            if (self._applyingElements.has(ta)) {
              return Reflect.apply(t, ta, a);
            }
            if (ProcessedElementsCache.isProcessed(ta)) {
              return Reflect.apply(t, ta, a);
            }
            var handler = TAG_HANDLERS[ta.tagName];
            if (handler && shouldBlockResource(a[1])) {
              var attrName = a[0] && typeof a[0] === 'string' ? a[0].toLowerCase() : a[0];
              if ((handler.srcAttr && handler.srcAttr === attrName) || (handler.dataSrcAttr && handler.dataSrcAttr === attrName)) {
                lc(ta, a[0], a[1], ta.tagName);
                return;
              }
            }
            if (ta.tagName === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(ta, true)) {
              lc(ta, a[0], a[1], ta.tagName);
              return;
            }
            self._applyingElements.add(ta);
            try {
              return Reflect.apply(t, ta, a);
            } finally {
              self._applyingElements.delete(ta);
            }
          },
        });
        this.restoredFns.push(function () {
          try {
            _Element.prototype.setAttribute = osa;
          } catch (e) { }
        });
      } catch (e) { }
      for (var tag in TAG_HANDLERS) {
        var proto = _globals['HTML' + tag + 'Element'] ? _globals['HTML' + tag + 'Element'].prototype : undefined;
        if (!proto) continue;
        var sa = TAG_HANDLERS[tag].srcAttr;
        try {
          var desc = Object.getOwnPropertyDescriptor(proto, sa);
          if (desc && desc.set && desc.configurable !== false) {
            var os = desc.set;
            Object.defineProperty(proto, sa, {
              set: new _Proxy(os, {
                apply: function (t, ta, a) {
                  if (self._applyingElements.has(ta)) {
                    return Reflect.apply(t, ta, a);
                  }
                  if (ProcessedElementsCache.isProcessed(ta)) {
                    return Reflect.apply(t, ta, a);
                  }
                  if (shouldBlockResource(a[0])) {
                    lc(ta, sa, a[0], tag);
                    return;
                  }
                  if (ta.tagName === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(ta, true)) {
                    lc(ta, sa, a[0], tag);
                    return;
                  }
                  self._applyingElements.add(ta);
                  try {
                    return Reflect.apply(t, ta, a);
                  } finally {
                    self._applyingElements.delete(ta);
                  }
                },
              }),
              get: desc.get,
              configurable: true,
              enumerable: desc.enumerable !== undefined ? desc.enumerable : true,
            });
            this.restoredFns.push((function (p, prop, d) {
              return function () {
                try {
                  Object.defineProperty(p, prop, d);
                } catch (e) { }
              };
            })(proto, sa, desc));
          }
        } catch (e) { }
      }
    }
    setupHTMLInterception() {
      var self = this;
      try {
        var ihd = Object.getOwnPropertyDescriptor(_Element.prototype, 'innerHTML');
        if (ihd && ihd.set) {
          var os = ihd.set;
          Object.defineProperty(_Element.prototype, 'innerHTML', {
            set: function (v) {
              return os.call(this, self.htmlSanitizer.filterHTMLString(v));
            },
            get: ihd.get,
            configurable: true,
            enumerable: true
          });
          this.restoredFns.push(function () {
            try {
              Object.defineProperty(_Element.prototype, 'innerHTML', ihd);
            } catch (e) { }
          });
        }
      } catch (e) { }
      try {
        var oi = _Element.prototype.insertAdjacentHTML;
        _Element.prototype.insertAdjacentHTML = new _Proxy(oi, {
          apply: function (t, ta, a) {
            return Reflect.apply(t, ta, [a[0], self.htmlSanitizer.filterHTMLString(a[1])]);
          }
        });
        this.restoredFns.push(function () {
          try {
            _Element.prototype.insertAdjacentHTML = oi;
          } catch (e) { }
        });
      } catch (e) { }
    }
    setupStrictDOMInterception() {
      var self = this;
      var check = function (el) {
        if (!currentConfig.modules.interceptThirdParty) return false;
        if (!el || !Utils.isElement(el)) return false;
        if (ProcessedElementsCache.isProcessed(el)) return false;
        var t = el.tagName;
        if (TAG_HANDLERS[t]) {
          var h = TAG_HANDLERS[t];
          var u = el[h.srcAttr] || el.getAttribute(h.srcAttr) || (h.dataSrcAttr && el.getAttribute(h.dataSrcAttr));
          if (u && shouldBlockResource(u)) {
            LogManager.add(self.moduleKey, el, {
              type: 'THIRD_PARTY',
              detail: '严格拦截: ' + t + ': ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
            });
            ResourceCanceller.cancelResourceLoading(el);
            ProcessedElementsCache.markAsProcessed(el);
            return true;
          }
        }
        return false;
      };
      try {
        var oa = _Node.prototype.appendChild;
        var newAppendChild = function (child) {
          if (child && Utils.isElement(child)) {
            if (self._overlayCheckEnabled && OverlayInterceptor._enabled) {
              if (child.isConnected) {
                var s = child.style;
                if (s) {
                  var p = (s.position || '').toLowerCase();
                  if (p === 'fixed' || p === 'absolute') {
                    var zi = parseInt(s.zIndex);
                    if (!isNaN(zi) && zi > 100) {
                      _requestAnimationFrame(function () {
                        if (OverlayInterceptor._enabled && child.isConnected) OverlayInterceptor.checkAndHandle(child);
                      });
                    } else {
                      var sw = s.width, sh = s.height;
                      if ((sw === '100%' || sw === '100vw') && (sh === '100%' || sh === '100vh')) {
                        _requestAnimationFrame(function () {
                          if (OverlayInterceptor._enabled && child.isConnected) OverlayInterceptor.checkAndHandle(child);
                        });
                      }
                    }
                  }
                }
                if (child.querySelector && child.querySelector('iframe')) {
                  _requestAnimationFrame(function () {
                    if (OverlayInterceptor._enabled && child.isConnected) OverlayInterceptor.checkAndHandle(child);
                  });
                }
              } else {
                _requestAnimationFrame(function () {
                  if (OverlayInterceptor._enabled && child.isConnected) OverlayInterceptor.checkAndHandle(child);
                });
              }
            }
            if (check(child)) return child;
            if (currentConfig.modules.blockDynamicScripts && child.tagName === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(child, true)) {
              return child;
            }
          }
          return oa.call(this, child);
        };
        _Node.prototype.appendChild = newAppendChild;
        this.restoredFns.push(function () {
          if (_Node.prototype.appendChild === newAppendChild) {
            _Node.prototype.appendChild = oa;
          }
        });
      } catch (e) { }
      try {
        var oi = _Node.prototype.insertBefore;
        var newInsertBefore = function (newNode, referenceNode) {
          if (newNode && Utils.isElement(newNode)) {
            if (self._overlayCheckEnabled && OverlayInterceptor._enabled) {
              _requestAnimationFrame(function () {
                if (OverlayInterceptor._enabled && newNode.isConnected) OverlayInterceptor.checkAndHandle(newNode);
              });
            }
            if (check(newNode)) return newNode;
            if (currentConfig.modules.blockDynamicScripts && newNode.tagName === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(newNode, true)) {
              return newNode;
            }
          }
          return oi.call(this, newNode, referenceNode);
        };
        _Node.prototype.insertBefore = newInsertBefore;
        this.restoredFns.push(function () {
          if (_Node.prototype.insertBefore === newInsertBefore) {
            _Node.prototype.insertBefore = oi;
          }
        });
      } catch (e) { }
    }
    restoreStrictDOMInterception() {
      if (this._strictDOMRestoreFns) {
        this._strictDOMRestoreFns.forEach(function (fn) { try { fn(); } catch (e) {} });
        this._strictDOMRestoreFns = [];
      }
    }
    patchAttachShadow() {
      var self = this;
      var proto = _Element.prototype;
      try {
        if (proto.attachShadow && !proto._adblockOriginalAttachShadow) {
          proto._adblockOriginalAttachShadow = proto.attachShadow;
          proto.attachShadow = function (init) {
            var shadow = proto._adblockOriginalAttachShadow.call(this, init);
            self.observeShadowRoot(shadow);
            var ihd = Object.getOwnPropertyDescriptor(shadow, 'innerHTML');
            if (ihd && ihd.set && ihd.configurable) {
              Object.defineProperty(shadow, 'innerHTML', {
                get: typeof ihd.get === 'function' ? function () {
                  return ihd.get.call(this);
                } : undefined,
                set: function (v) {
                  ihd.set.call(this, self.htmlSanitizer.filterHTMLString(v));
                },
                configurable: true,
              });
            }
            return shadow;
          };
          this.restoredFns.push(function () {
            if (proto._adblockOriginalAttachShadow) {
              proto.attachShadow = proto._adblockOriginalAttachShadow;
              delete proto._adblockOriginalAttachShadow;
            }
          });
        }
      } catch (e) { }
    }
    observeShadowRoot(sr) {
      if (!sr || sr._adblockObserved) return;
      sr._adblockObserved = true;
      var self = this;
      var obs = new _MutationObserver(function (ms) {
        if (!currentConfig.modules.interceptThirdParty && !currentConfig.modules.blockDynamicScripts) return;
        for (const m of ms) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (ProcessedElementsCache.isProcessed(n)) continue;
            var t = n.tagName;
            if (currentConfig.modules.interceptThirdParty && TAG_HANDLERS[t]) {
              var h = TAG_HANDLERS[t];
              var u = n[h.srcAttr] || n.getAttribute(h.srcAttr) || (h.dataSrcAttr && n.getAttribute(h.dataSrcAttr));
              if (u && shouldBlockResource(u)) {
                LogManager.add(self.moduleKey, n, {
                  type: 'THIRD_PARTY',
                  detail: 'Shadow DOM ' + t + ': ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
                });
                ResourceCanceller.cancelResourceLoading(n);
                ProcessedElementsCache.markAsProcessed(n);
              }
            }
            if (n.shadowRoot && currentConfig.modules.interceptThirdParty) self.observeShadowRoot(n.shadowRoot);
            if (currentConfig.modules.blockDynamicScripts && t === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(n, true)) {
              LogManager.add(self.moduleKey, n, {
                type: 'THIRD_PARTY',
                detail: '动态脚本内容检查拦截: ' + Utils.truncateString(n.textContent || n.src, CONFIG.LOG_DETAIL_LENGTH),
              });
              ResourceCanceller.cancelResourceLoading(n);
              ProcessedElementsCache.markAsProcessed(n);
            }
          }
        }
      });
      obs.observe(sr, { childList: true, subtree: true });
      this.restoredFns.push(function () {
        obs.disconnect();
        delete sr._adblockObserved;
      });
    }
    stopInterception() {
      this.restoredFns.forEach(function (fn) {
        try {
          fn();
        } catch (e) { }
      });
      this.restoredFns = [];
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this._strictDOMRestoreFns) {
        this._strictDOMRestoreFns.forEach(function (fn) { try { fn(); } catch (e) {} });
        this._strictDOMRestoreFns = [];
      }
    }
  }

  class ThirdPartyInterceptionModule extends BaseModule {
    constructor() {
      super('interceptThirdParty');
      this.htmlSanitizer = new HTMLSanitizer(this.moduleKey);
      this.networkInterceptor = new NetworkInterceptor(this.moduleKey);
      this.domHooker = new DOMPrototypeHooker(this.moduleKey, this.htmlSanitizer);
      this.imageInterceptor = new ImageInterceptor(this.moduleKey);
    }
    onEnable() {
      this.stopInterception();
      this.domHooker.setupProxyInterception();
      this.networkInterceptor.setupNetworkInterception();
      this.setupMutationFallback();
      this.domHooker.setupHTMLInterception();
      this.domHooker.patchAttachShadow();
      this.scanExistingShadowRoots();
      if (currentConfig.thirdPartyStrictMethod) this.domHooker._incrementStrictDOM();
      this.imageInterceptor.init();
    }
    onDisable() {
      this.stopInterception();
      this.imageInterceptor.stop();
    }
    stopInterception() {
      this.networkInterceptor.stopInterception();
      this.domHooker.stopInterception();
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.domHooker._strictDOMInterceptorCount = 0;
      this.domHooker._overlayCheckEnabled = false;
    }
    scanExistingShadowRoots() {
      var self = this;
      var allElements = _document.querySelectorAll('*');
      for (var i = 0; i < allElements.length; i++) {
        var el = allElements[i];
        if (el.shadowRoot && !el.shadowRoot._adblockObserved) {
          self.domHooker.observeShadowRoot(el.shadowRoot);
        }
      }
    }
    setupMutationFallback() {
      var self = this;
      this.observer = new _MutationObserver(function (ms) {
        for (const m of ms) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (ProcessedElementsCache.isProcessed(n)) continue;
            var t = n.tagName;
            if (TAG_HANDLERS[t]) {
              var h = TAG_HANDLERS[t];
              var u = n[h.srcAttr] || n.getAttribute(h.srcAttr) || (h.dataSrcAttr && n.getAttribute(h.dataSrcAttr));
              if (u && shouldBlockResource(u)) {
                LogManager.add(self.moduleKey, n, {
                  type: 'THIRD_PARTY',
                  detail: t + ': ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
                });
                ResourceCanceller.cancelResourceLoading(n);
                ProcessedElementsCache.markAsProcessed(n);
              }
            }
            if (n.shadowRoot) self.domHooker.observeShadowRoot(n.shadowRoot);
            if (t === 'SCRIPT' && DynamicScriptInterceptor.shouldBlockScriptElement(n, true)) {
              LogManager.add(self.moduleKey, n, {
                type: 'THIRD_PARTY',
                detail: '动态脚本内容检查拦截: ' + Utils.truncateString(n.textContent || n.src, CONFIG.LOG_DETAIL_LENGTH),
              });
              ResourceCanceller.cancelResourceLoading(n);
              ProcessedElementsCache.markAsProcessed(n);
            }
          }
        }
      });
      this.observer.observe(_document.documentElement, { childList: true, subtree: true });
    }
    updateStrictMode() {
      urlCache.clear();
    }
    updateStrictMethod() {
      if (this.enabled) {
        this.onDisable();
        this.onEnable();
      }
    }
    _checkElement(el) {
      var t = el.tagName;
      if (!TAG_HANDLERS[t]) return false;
      var h = TAG_HANDLERS[t];
      var u = el[h.srcAttr] || el.getAttribute(h.srcAttr) || (h.dataSrcAttr && el.getAttribute(h.dataSrcAttr));
      if (u && shouldBlockResource(u)) {
        LogManager.add(this.moduleKey, el, {
          type: 'THIRD_PARTY',
          detail: t + ': ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
        });
        ResourceCanceller.cancelResourceLoading(el);
        ProcessedElementsCache.markAsProcessed(el);
        return true;
      }
      return false;
    }
  }

  const CSPModule = {
    init: function () {
      if (currentConfig.modules.manageCSP) this.applyCSP();
    },
    applyCSP: function () {
      if (!currentConfig.modules.manageCSP) return;
      var ex = _document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (ex) ex.remove();
      var er = currentConfig.cspRules.filter(function (r) {
        return r.enabled;
      });
      if (er.length === 0) return;
      var dirs = {};
      for (const r of er) {
        var p = r.rule.split(/\s+/);
        var d = p[0];
        var v = p.slice(1);
        if (!dirs[d]) dirs[d] = new _Set();
        v.forEach(function (x) {
          dirs[d].add(x);
        });
      }
      var ps = '';
      for (var d2 in dirs) {
        if (dirs.hasOwnProperty(d2)) ps += d2 + ' ' + Array.from(dirs[d2]).join(' ') + '; ';
      }
      ps = ps.trim();
      if (!ps) return;
      var inject = function () {
        if (_document.head) {
          if (!_document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
            var m = _document.createElement('meta');
            m.httpEquiv = 'Content-Security-Policy';
            m.content = ps;
            _document.head.appendChild(m);
          }
        } else {
          new _MutationObserver(function () {
            this.disconnect();
            if (_document.head) {
              if (!_document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
                var m2 = _document.createElement('meta');
                m2.httpEquiv = 'Content-Security-Policy';
                m2.content = ps;
                _document.head.appendChild(m2);
              }
            }
          }).observe(_document.documentElement, { childList: true, subtree: true });
        }
      };
      inject();
    },
    updateRule: function (id, enabled) {
      var r = currentConfig.cspRules.find(function (x) {
        return x.id === id;
      });
      if (r) r.enabled = enabled;
    },
  };

  const UI_CSS = `
    :root {
      --ab-z-index: ${2147483640};
    }
    .mask {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      z-index: var(--ab-z-index);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      pointer-events: auto;
      animation: fade-in 0.3s forwards;
    }
    .panel {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 94vw;
      max-width: 500px;
      font-family: system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
      position: relative;
      transform: scale(0.9);
      opacity: 0;
      animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      max-height: 85vh;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.4;
    }
    .title {
      margin: 0 0 6px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      text-align: center;
      word-break: break-all;
      line-height: 1.3;
      padding: 0 8px;
    }
    .btn-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
    .btn-group button {
      flex: 1 0 calc(50% - 8px);
      min-width: 100px;
    }
    button {
      border: none;
      border-radius: 10px;
      padding: 10px 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      background: #f0f2f5;
      color: #444;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      touch-action: manipulation;
    }
    button:hover {
      background: #e4e6e9;
      transform: translateY(-1px);
    }
    button:active {
      transform: scale(0.95);
    }
    button.primary {
      background: #007AFF;
      color: #fff;
    }
    button.primary:hover {
      background: #0063cc;
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }
    button.danger {
      background: #ff4d4f;
      color: #fff;
    }
    button.danger:hover {
      background: #d9363e;
      box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
    }
    textarea {
      width: 100%;
      height: 140px;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      resize: none;
      box-sizing: border-box;
      outline: none;
      line-height: 1.4;
    }
    textarea:focus {
      border-color: #007AFF;
      box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
    }
    select {
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid #ddd;
      outline: none;
      font-size: 13px;
    }
    .module-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    .module-switch {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: #f8f9fa;
      border-radius: 10px;
      border: 1px solid #eee;
      min-width: 0 !important;
      box-sizing: border-box;
    }
    .switch-label {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0 !important;
      overflow: hidden;
      flex: 1 1 0%;
    }
    .info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #007AFF;
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      margin-left: 4px;
      position: relative;
      flex-shrink: 0;
    }
    .info-icon:hover {
      background: #0056b3;
    }
    .info-tooltip {
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      max-width: 280px;
      min-width: 200px;
      line-height: 1.5;
      white-space: pre-line;
      word-break: break-word;
      z-index: calc(var(--ab-z-index) + 100);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .info-tooltip::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border: 8px solid transparent;
    }
    .info-tooltip.tooltip-bottom::before {
      top: -16px;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: rgba(0, 0, 0, 0.9);
    }
    .info-tooltip.tooltip-top::before {
      bottom: -16px;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: rgba(0, 0, 0, 0.9);
    }
    .switch {
      position: relative;
      width: 40px;
      height: 24px;
      flex-shrink: 0;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
      touch-action: manipulation;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #007AFF;
    }
    input:checked + .slider:before {
      transform: translateX(16px);
    }
    input[type="number"] {
      box-sizing: border-box !important;
      min-width: 0 !important;
      max-width: 60px !important;
      flex-shrink: 0 !important;
      height: 24px !important;
      -webkit-appearance: none;
      -moz-appearance: textfield;
    }
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .sub-panel {
      max-height: 45vh;
      overflow-y: auto;
      background: #f9f9f9;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #eee;
    }
    .log-entry {
      margin-bottom: 10px;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      border-left: 4px solid #007AFF;
      font-size: 12px;
      position: relative;
      min-height: 60px;
    }
    .log-module {
      color: #007AFF;
      font-weight: bold;
      margin-bottom: 3px;
      font-size: 13px;
      padding-right: 60px;
    }
    .log-content {
      color: #666;
      word-break: break-word;
      font-size: 11px;
      max-height: 180px;
      overflow-y: auto;
      white-space: normal;
      line-height: 1.4;
      padding-right: 60px;
    }
    .whitelist-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #34C759;
      color: #fff;
      border: none;
      border-radius: 5px;
      padding: 3px 8px;
      font-size: 10px;
      cursor: pointer;
      z-index: 1;
    }
    .csp-rule {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      margin-bottom: 6px;
    }
    .csp-name {
      font-size: 12px;
      color: #333;
      max-width: 70%;
    }
    .whitelist-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: nowrap;
      width: 100%;
      padding: 8px;
      background: #fff;
      border-radius: 6px;
      margin-bottom: 5px;
    }
    .whitelist-text {
      font-size: 11px;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
    }
    .whitelist-item button {
      flex-shrink: 0;
      margin-left: 8px;
    }
    .panel::-webkit-scrollbar {
      width: 6px;
    }
    .panel::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    .panel::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    .log-entry.whitelisted {
      background-color: #e8f5e8;
    }
    .log-entry.keyword-whitelisted {
      background-color: #e0f0ff;
    }
    .log-entry.blacklisted {
      background-color: #ffe0e0;
    }
    .panel-notice {
      background: #e6f2ff;
      border-left: 4px solid #007AFF;
      padding: 10px 14px;
      margin: 0 4px 6px;
      border-radius: 8px;
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.5;
      white-space: pre-line;
    }
    .confirm-msg {
      text-align: center;
      font-size: 14px;
      color: #555;
      padding: 16px 8px;
      line-height: 1.6;
      white-space: pre-line;
    }
    @media (max-width: 375px) {
      .panel { padding: 12px 8px; border-radius: 14px; }
      .title { font-size: 15px; }
      .switch-label { font-size: 12px; }
      .module-grid { grid-template-columns: 1fr; }
      .btn-group button { min-height: 36px; font-size: 12px; }
      .log-content { font-size: 10px; }
      .whitelist-text { font-size: 10px; }
      .csp-name { font-size: 11px; }
    }
    @media (orientation: landscape) and (max-height: 500px) {
      .btn-group button { flex: 1 0 100%; min-width: 80px; }
      .module-grid { grid-template-columns: repeat(3, 1fr); }
      .panel { max-height: 95vh; padding: 12px 10px; }
      .sub-panel { max-height: 50vh; }
    }
    @media (orientation: landscape) and (max-height: 350px) {
      .module-switch { padding: 4px 8px; }
      .switch-label { font-size: 11px; }
      .btn-group { gap: 4px; }
      .btn-group button { padding: 6px 8px; min-height: 32px; font-size: 11px; }
      .sub-panel { max-height: 40vh; padding: 8px; }
    }
    @media (prefers-color-scheme: dark) {
      .panel { background: #1c1c1e; color: #fff; }
      .title { color: #fff; }
      button { background: #2c2c2e; color: #ccc; }
      button:hover { background: #3a3a3c; }
      textarea { background: #2c2c2e; border-color: #444; color: #eee; }
      select { background: #2c2c2e; border-color: #444; color: #eee; }
      .module-switch { background: #2c2c2e; border-color: #444; }
      .switch-label { color: #eee; }
      .sub-panel { background: #2c2c2e; border-color: #444; }
      .log-entry { background: #1c1c1e; }
      .csp-rule { background: #1c1c1e; }
      .whitelist-item { background: #1c1c1e; }
      .whitelist-text { color: #eee; }
      .panel::-webkit-scrollbar-track { background: #2c2c2e; }
      .panel::-webkit-scrollbar-thumb { background: #555; }
      .log-entry.whitelisted { background-color: #2a4a2a; }
      .log-entry.keyword-whitelisted { background-color: #2a3a5a; }
      .log-entry.blacklisted { background-color: #5a2a2a; }
      .panel-notice { background: #1a2a3a; border-left-color: #3a7aff; color: #cecece; }
      .confirm-msg { color: #ddd; }
      .info-tooltip { background: rgba(255, 255, 255, 0.95); color: #1c1c1e; }
      .info-tooltip.tooltip-bottom::before { border-bottom-color: rgba(255, 255, 255, 0.95); }
      .info-tooltip.tooltip-top::before { border-top-color: rgba(255, 255, 255, 0.95); }
      input[type="number"] {
        background: #2c2c2e;
        color: #eee;
      }
    }
    @keyframes fade-in {
      to {
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(8px);
      }
    }
    @keyframes scale-in {
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `;

  let panelIdCounter = 0;
  let _scriptMap = null;

  class PanelManager {
    constructor() {
      this.shadowRoot = null;
      this.settingsContainer = null;
      this.isAnimating = false;
      this.currentController = null;
      this.activeTooltip = null;
      this._savedBodyStyles = null;
      this._savedDocElOverflow = '';
      this._iframeBlocked = false;
    }
    
    _checkIframeBlocking() {
      if (!currentConfig.iframeUIFix) return false;
      if (!isInIframe()) return false;
      this._iframeBlocked = true;
      try {
        _globals.parent.postMessage({
          type: 'adblock-show-panel',
          source: 'adblock-iframe',
          origin: _location.origin,
          timestamp: Date.now()
        }, _location.ancestorOrigins ? _location.ancestorOrigins[0] : '*');
      } catch (e) { }
      return true;
    }
    
    _showIframeHint() {
      if (!this.shadowRoot) this.ensureShadow();
      if (!this.shadowRoot) return;
      var existing = this.shadowRoot.querySelector('.iframe-hint');
      if (existing) existing.remove();
      var hint = _document.createElement('div');
      hint.className = 'iframe-hint';
      hint.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:999999;pointer-events:auto;animation:fade-in 0.3s forwards;max-width:90vw;text-align:center;';
      hint.textContent = '广告拦截器：检测到嵌套框架，已通知主页面显示面板';
      this.shadowRoot.appendChild(hint);
      var self = this;
      _setTimeout(function() {
        if (hint.parentNode) {
          hint.style.opacity = '0';
          hint.style.transition = 'opacity 0.3s';
          _setTimeout(function() {
            if (hint.parentNode) hint.remove();
          }, 300);
        }
      }, 2000);
    }
    
    ensureShadow() {
      if (this.shadowRoot) return;
      this.settingsContainer = _document.createElement('div');
      this.settingsContainer.id = 'ad-blocker-settings-container';
      this.settingsContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:' + (CONFIG.Z_INDEX + 7) + ';pointer-events:none;';
      this.settingsContainer.setAttribute('data-adblock-safe', 'true');
      _document.documentElement.appendChild(this.settingsContainer);
      this.shadowRoot = this.settingsContainer.attachShadow({ mode: 'closed' });
      var style = _document.createElement('style');
      style.textContent = UI_CSS;
      this.shadowRoot.appendChild(style);
      ProcessedElementsCache.markAsProcessed(this.settingsContainer);
    }
    showInfoTooltip(infoIcon, message) {
      this.closeInfoTooltip();
      this.ensureShadow();
      if (!this.shadowRoot) return;
      var tooltip = _document.createElement('div');
      tooltip.className = 'info-tooltip';
      tooltip.textContent = message;
      this.shadowRoot.appendChild(tooltip);
      this.activeTooltip = tooltip;
      var iconRect = infoIcon.getBoundingClientRect();
      var tooltipRect = tooltip.getBoundingClientRect();
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      var tooltipWidth = tooltipRect.width || 280;
      var tooltipHeight = tooltipRect.height || 100;
      var left = iconRect.left + iconRect.width / 2 - tooltipWidth / 2;
      var top = iconRect.bottom + CONFIG.TOOLTIP_GAP;
      if (left < 10) left = 10;
      if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
      if (top + tooltipHeight > viewportHeight - 10) {
        top = iconRect.top - tooltipHeight - CONFIG.TOOLTIP_GAP;
        tooltip.classList.add('tooltip-top');
      } else {
        tooltip.classList.add('tooltip-bottom');
      }
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      var self = this;
      var closeHandler = function (e) {
        if (e.target !== tooltip && e.target !== infoIcon && !tooltip.contains(e.target)) {
          self.closeInfoTooltip();
          _document.removeEventListener('click', closeHandler, true);
        }
      };
      _setTimeout(function () {
        _document.addEventListener('click', closeHandler, true);
      }, 10);
    }
    closeInfoTooltip() {
      if (this.activeTooltip) {
        if (this.activeTooltip.parentNode) {
          this.activeTooltip.parentNode.removeChild(this.activeTooltip);
        }
        this.activeTooltip = null;
      }
    }
    showConfirm(message, onConfirm) {
      var panelManager = this;
      this.createPanel({
        title: '⚠️ 操作确认',
        contentHtml: '<div class="confirm-msg">' + escapeHtml(message) + '</div>',
        buttons: [
          {
            id: 'confirmOk', text: '确认执行', class: 'danger', onclick: function () {
              panelManager.closeCurrentMask();
              if (onConfirm) onConfirm();
            }
          },
          {
            id: 'confirmNo', text: '取消', onclick: function (e, m) {
              if (m && m._closePanel) m._closePanel();
            }
          },
        ],
        hideBackButton: true,
        onBack: function () {},
      });
    }
    closeCurrentMask() {
      var m = this.shadowRoot ? this.shadowRoot.querySelector('.mask') : null;
      if (!m) return;
      if (this.currentController) {
        this.currentController.abort();
        this.currentController = null;
      }
      var pid = m.getAttribute('data-panel-id');
      if (pid) teardownNavigationBlocking(pid);
      m.style.transition = 'none';
      m.remove();
      this.isAnimating = false;
      this.closeInfoTooltip();
    }
    _lockBodyScroll() {
      if (this._savedBodyStyles) return;
      var scrollY = _globals.scrollY || 0;
      this._savedDocElOverflow = _document.documentElement.style.overflow || '';
      this._savedBodyStyles = {
        overflow: _document.body.style.overflow || '',
        position: _document.body.style.position || '',
        width: _document.body.style.width || '',
        top: _document.body.style.top || '',
      };
      _document.body.setAttribute('data-adblock-scroll', String(scrollY));
      _document.body.style.overflow = 'hidden';
      _document.body.style.position = 'fixed';
      _document.body.style.width = '100%';
      _document.body.style.top = '-' + scrollY + 'px';
      _document.documentElement.style.overflow = 'hidden';
    }
    _unlockBodyScroll() {
      var storedScroll = _document.body.getAttribute('data-adblock-scroll');
      if (this._savedBodyStyles) {
        _document.body.style.overflow = this._savedBodyStyles.overflow;
        _document.body.style.position = this._savedBodyStyles.position;
        _document.body.style.width = this._savedBodyStyles.width;
        _document.body.style.top = this._savedBodyStyles.top;
      } else {
        _document.body.style.overflow = '';
        _document.body.style.position = '';
        _document.body.style.width = '';
        _document.body.style.top = '';
      }
      _document.documentElement.style.overflow = this._savedDocElOverflow;
      if (storedScroll) _globals.scrollTo(0, parseInt(storedScroll));
      _document.body.removeAttribute('data-adblock-scroll');
      this._savedBodyStyles = null;
      this._savedDocElOverflow = '';
    }
    _showListPanel({ title, items, renderItem, deleteAction, clearAction, extraHTML, onBack }) {
      this.closeCurrentMask();
      const self = this;
      const listHtml = items.length === 0
        ? '<div style="text-align:center;color:#999;margin:20px 0;font-size:14px;">列表为空</div>'
        : items.map((item, i) => renderItem(item, i)).join('');
      this.createPanel({
        title: title,
        contentHtml: (extraHTML || '') + '<div class="sub-panel">' + listHtml + '</div>',
        buttons: clearAction ? [{ id: clearAction, text: '清空全部', class: 'danger', onclick: null }] : [],
        onBack: onBack || function () { self.showSettings(); },
      });
    }
    createPanel(options) {
      if (this._checkIframeBlocking()) {
        this._showIframeHint();
        return null;
      }
      if (this.isAnimating) return null;
      var title = options.title;
      var contentHtml = options.contentHtml;
      var onClose = options.onClose;
      var onBack = options.onBack;
      var buttons = options.buttons || [];
      var hideBackButton = options.hideBackButton || false;
      var isRootPanel = options.isRootPanel || false;
      this.ensureShadow();
      this.closeCurrentMask();
      var panelId = 'panel_' + ++panelIdCounter;
      setupNavigationBlocking(panelId);
      var controller = _AbortController ? new _AbortController() : null;
      var signal = controller ? controller.signal : undefined;
      this.currentController = controller;
      var self = this;
      self._lockBodyScroll();
      var mask = _document.createElement('div');
      mask.className = 'mask';
      mask.setAttribute('data-adblock-safe', 'true');
      mask.setAttribute('data-panel-id', panelId);
      var btnHtml = buttons.map(function (b) {
        return ('<button type="button" data-id="' + b.id + '" class="' + (b.class || '') + '">' + escapeHtml(b.text) + '</button>');
      }).join('');
      var backHtml = hideBackButton ? '' : '<button type="button" data-id="backBtn" class="primary">返回设置</button>';
      mask.innerHTML = '<div class="panel" style="max-width:600px; width:95vw;"><div class="title">' + escapeHtml(title) + '</div>' + contentHtml + '<div class="btn-group">' + btnHtml + backHtml + '</div></div>';
      var closePanel = function (anim) {
        if (anim === undefined) anim = true;
        if (!mask.parentNode) return;
        teardownNavigationBlocking(panelId);
        var cleanup = function () {
          if (controller) controller.abort();
          if (self.currentController === controller) self.currentController = null;
          self.isAnimating = false;
          self._unlockBodyScroll();
          self.closeInfoTooltip();
          if (onClose) onClose();
          if (mask.parentNode) mask.remove();
        };
        if (anim) {
          self.isAnimating = true;
          var cleaned = false;
          var onTE = function () {
            if (cleaned) return;
            cleaned = true;
            mask.removeEventListener('transitionend', onTE);
            cleanup();
          };
          mask.addEventListener('transitionend', onTE);
          mask.style.opacity = '0';
          _setTimeout(function () {
            if (!cleaned) {
              mask.removeEventListener('transitionend', onTE);
              cleanup();
            }
          }, 500);
        } else {
          cleanup();
        }
      };
      mask._closePanel = closePanel;
      var handleBack = function () {
        if (isRootPanel) return;
        if (onBack) {
          onBack();
        } else {
          closePanel();
          self.showSettings();
        }
      };
      mask.addEventListener('click', function (e) {
        var path = e.composedPath();
        var isPanel = path.some(function (el) {
          return Utils.isPanelElement(el);
        });
        if (!isPanel && e.target === mask) {
          handleBack();
          return;
        }
        if (isPanel) {
          if (!e.target.closest('button, input, textarea, select, label, .info-icon, .whitelist-btn')) {
            handleBack();
            return;
          }
        }
        var button = e.target.closest('button');
        if (!button) return;
        var action = button.dataset.action || button.dataset.id;
        if (action === 'backBtn') {
          handleBack();
          return;
        }
        var matched = buttons.find(function (b) {
          return b.id === action;
        });
        if (matched && matched.onclick) {
          matched.onclick(e, mask);
          return;
        }
        self.handlePanelAction(action, button.dataset.index, button, mask, e);
      }, { signal: signal });
      mask.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches('.module-toggle')) {
          var k = t.dataset.key;
          currentConfig.modules[k] = t.checked;
          ConfigUpdater.saveNow();
          resetAllCachesAndStates();
          if (k === 'removeInlineScripts' && inlineScriptsModule) inlineScriptsModule.init();
          if (k === 'interceptThirdParty' && thirdPartyModule) thirdPartyModule.init();
          if (k === 'blockDynamicScripts') {
            t.checked ? DynamicScriptInterceptor.enable() : DynamicScriptInterceptor.disable();
          }
          if (k === 'redirectBlockerEnabled') {
            if (t.checked) {
              RedirectBlocker.init();
            } else {
              RedirectBlocker.disable();
            }
          }
          if (k === 'overlayIntercept') OverlayInterceptor.init();
          if (strongBlockingEnabled) disableStrongBlocking();
          if (Utils.isAnyModuleEnabled()) {
            if (currentConfig.residualCleanupEnabled) ResidualCleaner.init();
            else ResidualCleaner.stop();
          } else {
            ResidualCleaner.stop();
          }
        } else if (t.matches('.csp-toggle')) {
          CSPModule.updateRule(parseInt(t.dataset.id), t.checked);
          currentConfig.modules.manageCSP = currentConfig.cspRules.some(function (r) { return r.enabled; });
          ConfigUpdater.saveNow();
          _location.reload();
        } else if (t.matches('.advanced-toggle')) {
          var k2 = t.dataset.key;
          if (k2 === 'spoofUAEnabled') {
            if (t.checked) {
              if (currentConfig.simplePlatformSpoof) {
                currentConfig.simplePlatformSpoof = false;
                var simpleSpoofToggle = mask.querySelector('.advanced-toggle[data-key="simplePlatformSpoof"]');
                if (simpleSpoofToggle) simpleSpoofToggle.checked = false;
              }
            }
          } else if (k2 === 'simplePlatformSpoof') {
            if (t.checked) {
              if (currentConfig.spoofUAEnabled) {
                currentConfig.spoofUAEnabled = false;
                var uaSpoofToggle = mask.querySelector('.advanced-toggle[data-key="spoofUAEnabled"]');
                if (uaSpoofToggle) uaSpoofToggle.checked = false;
              }
            }
          } else if (k2 === 'heuristicBlacklistEnabled') {
            currentConfig.heuristicBlacklistEnabled = t.checked;
            ConfigUpdater.saveNow();
            if (currentConfig.modules.scriptBlacklistMode) {
              if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            }
          } else if (k2 === 'dynamicScriptStrictMode') {
            DynamicScriptInterceptor._callbackCheckCache = new WeakMap();
          }
          currentConfig[k2] = t.checked;
          ConfigUpdater.saveNow();
          if (k2 === 'inlineScriptStrictMode' && inlineScriptsModule) inlineScriptsModule.updateStrictMode();
          if (k2 === 'thirdPartyStrictMode' && thirdPartyModule) thirdPartyModule.updateStrictMode();
          if (k2 === 'thirdPartyStrictMethod' && thirdPartyModule) thirdPartyModule.updateStrictMethod();
          if (k2 === 'residualCleanupEnabled') {
            if (Utils.isAnyModuleEnabled() && currentConfig.residualCleanupEnabled) ResidualCleaner.init();
            else ResidualCleaner.stop();
          }
          if (k2 === 'builtinBlacklistEnabled' && t.checked) currentConfig.removedBuiltinKeywords.clear();
          if (k2 === 'heuristicBlacklistEnabled') {
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
          }
        }
      }, { signal: signal });
      this.shadowRoot.appendChild(mask);
      mask.style.pointerEvents = 'auto';
      mask.querySelector('.panel').style.pointerEvents = 'auto';
      return mask;
    }
    renderLogItem(log, index) {
      var status = getLogWhitelistStatus(log);
      var logEntryClass = 'log-entry' + (status ? ' ' + status : '');
      var isWL = status !== '';
      var domainHint = log.domain ? '<div style="font-size:11px;color:#999;margin-top:4px;">域名: ' + escapeHtml(log.domain) + '</div>' : '';
      return ('<div class="' + logEntryClass + '" data-index="' + index + '"><button type="button" class="whitelist-btn" data-action="whitelistLog" data-index="' + index + '" ' + (isWL ? 'disabled style="background:#999;"' : '') + '>' + (isWL ? '已加白' : '加白') + '</button><div class="log-module">' + escapeHtml(log.module) + ' - ' + escapeHtml(log.element) + '</div><div class="log-content">' + escapeHtml(log.content) + '</div>' + domainHint + '</div>');
    }
    handlePanelAction(action, index, button, mask, event) {
      var self = this;
      switch (action) {
        case 'deleteDiaryItem': {
          var arr = Array.from(currentConfig.whitelist);
          var idx = parseInt(index);
          if (!isNaN(idx) && idx >= 0 && idx < arr.length && arr[idx]) {
            currentConfig.whitelist.delete(arr[idx]);
            currentConfig.whitelistDisplayNames.delete(arr[idx]);
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showDiaryWhitelistPanel();
          }
          break;
        }
        case 'deleteKeywordItem': {
          var arr2 = Array.from(currentConfig.keywordWhitelist);
          var idx2 = parseInt(index);
          if (!isNaN(idx2) && idx2 >= 0 && idx2 < arr2.length && arr2[idx2]) {
            currentConfig.keywordWhitelist.delete(arr2[idx2]);
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showKeywordWhitelistPanel();
          }
          break;
        }
        case 'deleteBlacklistItem': {
          var arr3 = Utils.getActiveBlacklistArray();
          var idx3 = parseInt(index);
          if (!isNaN(idx3) && idx3 >= 0 && idx3 < arr3.length && arr3[idx3]) {
            if (BUILTIN_BLACKLIST_KEYWORDS.indexOf(arr3[idx3]) !== -1) currentConfig.removedBuiltinKeywords.add(arr3[idx3]);
            else currentConfig.scriptBlacklist.delete(arr3[idx3]);
            ConfigUpdater.saveNow();
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            resetAllCachesAndStates();
            self.showScriptBlacklistPanel();
          }
          break;
        }
        case 'deleteThirdPartyItem': {
          var wl = currentConfig.thirdPartyWhitelist;
          var idx4 = parseInt(index);
          if (!isNaN(idx4) && idx4 >= 0 && idx4 < wl.length && wl[idx4]) {
            var removedItem = wl[idx4];
            wl.splice(idx4, 1);
            if (removedItem) Whitelisting.removeKeywordsMatchingDomain(removedItem);
            _tpHash = ''; 
            _tpRegex = null;
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showThirdPartyPanel();
          }
          break;
        }
        case 'whitelistLog': {
          var logs = LogManager.logs;
          var idx5 = parseInt(index);
          if (!isNaN(idx5) && idx5 >= 0 && idx5 < logs.length && logs[idx5] && logs[idx5].contentIdentifier) {
            var le = logs[idx5];
            if (le.moduleKey === 'scriptBlacklistMode') {
              Whitelisting.add(le.contentIdentifier, le.content);
              if (le.domain && currentConfig.thirdPartyWhitelist.indexOf(le.domain) === -1) {
                currentConfig.thirdPartyWhitelist.push(le.domain);
                _tpHash = '';
                _tpRegex = null;
              }
              ConfigUpdater.saveNow();
              var logDiv = button.closest('.log-entry');
              if (logDiv) {
                logDiv.classList.add('whitelisted');
                button.disabled = true;
                button.textContent = '已加白';
                button.style.backgroundColor = '#999';
              }
              resetAllCachesAndStates();
              OverlayInterceptor.restoreWhitelistedElements();
              break;
            }
            var isTPD = currentConfig.modules.interceptThirdParty && le.domain;
            if (isTPD && le.domain) {
              var domainsToAdd = new Set();
              if (currentConfig.thirdPartyWhitelist.indexOf(le.domain) === -1) domainsToAdd.add(le.domain);
              logs.forEach(function (e) {
                if (e.domain === le.domain && currentConfig.thirdPartyWhitelist.indexOf(e.domain) === -1) domainsToAdd.add(e.domain);
              });
              domainsToAdd.forEach(function (d) {
                if (currentConfig.thirdPartyWhitelist.indexOf(d) === -1) currentConfig.thirdPartyWhitelist.push(d);
              });
              _tpHash = '';
              _tpRegex = null;
              ConfigUpdater.saveNow();
              mask.querySelectorAll('.log-entry').forEach(function (div) {
                var btn = div.querySelector('.whitelist-btn');
                if (!btn) return;
                var bi = parseInt(btn.dataset.index);
                if (!isNaN(bi) && logs[bi] && logs[bi].domain === le.domain) {
                  div.classList.add('whitelisted');
                  btn.disabled = true;
                  btn.textContent = '已加白';
                  btn.style.backgroundColor = '#999';
                }
              });
            } else {
              if (!currentConfig.whitelist.has(le.contentIdentifier))
                Whitelisting.add(le.contentIdentifier, le.content);
              ConfigUpdater.saveNow();
              var ld = button.closest('.log-entry');
              if (ld) {
                ld.classList.add('whitelisted');
                button.disabled = true;
                button.textContent = '已加白';
                button.style.backgroundColor = '#999';
              }
            }
            resetAllCachesAndStates();
            OverlayInterceptor.restoreWhitelistedElements();
          }
          break;
        }
        case 'addToBlacklist': {
          var sid = button.dataset.sid;
          if (sid && _scriptMap && _scriptMap.has(sid)) {
            currentConfig.scriptBlacklist.add(_scriptMap.get(sid));
            ConfigUpdater.saveNow();
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            var ld2 = button.closest('.log-entry');
            if (ld2) {
              var tb = ld2.querySelector('button[data-action="addToBlacklist"]');
              if (tb) {
                tb.disabled = true;
                tb.textContent = '已加黑';
                tb.style.backgroundColor = '#999';
              }
              ld2.classList.add('blacklisted');
            }
          }
          break;
        }
        case 'addKeywordWhitelist': {
          var inp = mask.querySelector('#keywordWhitelistInput');
          var kw = inp.value.trim();
          if (kw) {
            Whitelisting.addKeyword(kw);
            inp.value = '';
            OverlayInterceptor.restoreWhitelistedElements();
            self.showLogsPanel();
          }
          break;
        }
        case 'addWhitelist': {
          var inp2 = mask.querySelector('#newWhitelist');
          var v = inp2.value.trim();
          if (!v) break;
          v = v.replace(/^https?:\/\//, '');
          v = v.replace(/\/+$/, '');
          v = v.replace(/:\d+$/, '');
          var slashIdx = v.indexOf('/');
          if (slashIdx > 0) v = v.substring(0, slashIdx);
          var hasWildcard = v.indexOf('*') !== -1;
          if (hasWildcard) {
            var wcPattern = /^\*\.[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/;
            if (!wcPattern.test(v)) break;
          } else {
            var domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/;
            if (!domainPattern.test(v)) break;
          }
          if (currentConfig.thirdPartyWhitelist.indexOf(v) === -1) {
            currentConfig.thirdPartyWhitelist.push(v);
            _tpHash = '';
            _tpRegex = null;
            ConfigUpdater.saveNow();
            inp2.value = '';
            resetAllCachesAndStates();
            self.showThirdPartyPanel();
          }
          break;
        }
        case 'addBlacklist': {
          var inp3 = mask.querySelector('#newBlacklistKeyword');
          var kw2 = inp3.value.trim();
          if (kw2) {
            currentConfig.scriptBlacklist.add(kw2);
            ConfigUpdater.saveNow();
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            inp3.value = '';
            resetAllCachesAndStates();
            self.showScriptBlacklistPanel();
          }
          break;
        }
        case 'addBlacklistFromDomain': {
          var d = decodeURIComponent(button.dataset.domain);
          if (d) {
            currentConfig.scriptBlacklist.add(d);
            ConfigUpdater.saveNow();
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            var ld3 = button.closest('.log-entry');
            if (ld3) {
              var tb2 = ld3.querySelector('button[data-action="addBlacklistFromDomain"]');
              if (tb2) {
                tb2.disabled = true;
                tb2.textContent = '域名已加黑';
                tb2.style.backgroundColor = '#999';
              }
              ld3.classList.add('blacklisted');
            }
          }
          break;
        }
        case 'clearAllDiary': {
          self.showConfirm('确定清空所有日记白名单吗？', function () {
            currentConfig.whitelist.clear();
            currentConfig.whitelistDisplayNames.clear();
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showDiaryWhitelistPanel();
          });
          break;
        }
        case 'clearAllKeyword': {
          self.showConfirm('确定清空所有关键词白名单吗？', function () {
            currentConfig.keywordWhitelist.clear();
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showKeywordWhitelistPanel();
          });
          break;
        }
        case 'clearAllBlacklist': {
          self.showConfirm('确定清空所有脚本黑名单吗？', function () {
            currentConfig.scriptBlacklist.clear();
            currentConfig.removedBuiltinKeywords.clear();
            ConfigUpdater.saveNow();
            if (scriptBlacklistModule) scriptBlacklistModule.rebuildBlacklist();
            resetAllCachesAndStates();
            self.showScriptBlacklistPanel();
          });
          break;
        }
        case 'clearAllThirdParty': {
          self.showConfirm('确定清空所有第三方白名单吗？', function () {
            currentConfig.thirdPartyWhitelist = [];
            _tpHash = '';
            _tpRegex = null;
            ConfigUpdater.saveNow();
            resetAllCachesAndStates();
            self.showThirdPartyPanel();
          });
          break;
        }
        case 'showScriptList': {
          self.showScriptListPanel();
          break;
        }
        case 'enableCSP': {
          currentConfig.modules.manageCSP = true;
          ConfigUpdater.saveNow();
          _location.reload();
          break;
        }
        case 'disableCSP': {
          currentConfig.modules.manageCSP = false;
          ConfigUpdater.saveNow();
          _location.reload();
          break;
        }
        case 'allOn': {
          currentConfig.cspRules.forEach(function (r) { r.enabled = true; });
          currentConfig.modules.manageCSP = true;
          ConfigUpdater.saveNow();
          _location.reload();
          break;
        }
        case 'allOff': {
          currentConfig.cspRules.forEach(function (r) { r.enabled = false; });
          currentConfig.modules.manageCSP = false;
          ConfigUpdater.saveNow();
          _location.reload();
          break;
        }
        case 'closePanel': {
          if (mask._closePanel) mask._closePanel();
          break;
        }
        case 'showAdvancedSettings': {
          self.showAdvancedSettingsPanel();
          break;
        }
        case 'loadMoreLogs': {
          self.loadMoreLogs(mask);
          break;
        }
        case 'loadMoreScripts': {
          self.loadMoreScripts(mask);
          break;
        }
        // ======================== 新增导入导出面板 ========================
        case 'showImportExport': {
          self.showImportExportPanel();
          break;
        }
        case 'exportCurrentConfig': {
          try {
            var jsonStr = StorageManager.exportCurrentConfig();
            var blob = new Blob([jsonStr], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = _document.createElement('a');
            a.href = url;
            a.download = 'adblock_config_' + _location.hostname + '_' + new Date().toISOString().slice(0,19).replace(/:/g, '-') + '.json';
            a.click();
            URL.revokeObjectURL(url);
            GM_notification({ text: '当前域名配置已导出', title: '广告拦截器' });
          } catch (e) {
            GM_notification({ text: '导出失败: ' + (e.message || e), title: '广告拦截器' });
          }
          break;
        }
        case 'importCurrentConfig': {
          var fileInput = _document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'application/json';
          fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
              try {
                var success = StorageManager.importCurrentConfig(ev.target.result);
                if (success) {
                  GM_notification({ text: '当前域名配置已导入，即将刷新页面生效', title: '广告拦截器' });
                  _setTimeout(function() { _location.reload(); }, 1000);
                } else {
                  GM_notification({ text: '导入失败：配置文件无效', title: '广告拦截器' });
                }
              } catch (err) {
                GM_notification({ text: '导入失败: ' + (err.message || err), title: '广告拦截器' });
              }
            };
            reader.readAsText(file, 'UTF-8');
          };
          fileInput.click();
          break;
        }
        case 'exportAllConfigs': {
          try {
            var allJson = StorageManager.exportAllConfigs();
            var blobAll = new Blob([allJson], { type: 'application/json' });
            var urlAll = URL.createObjectURL(blobAll);
            var aAll = _document.createElement('a');
            aAll.href = urlAll;
            aAll.download = 'adblock_all_configs_' + new Date().toISOString().slice(0,19).replace(/:/g, '-') + '.json';
            aAll.click();
            URL.revokeObjectURL(urlAll);
            GM_notification({ text: '全部域名配置已导出', title: '广告拦截器' });
          } catch (e) {
            GM_notification({ text: '导出全部配置失败: ' + (e.message || e), title: '广告拦截器' });
          }
          break;
        }
        case 'importAllConfigs': {
          var fileInputAll = _document.createElement('input');
          fileInputAll.type = 'file';
          fileInputAll.accept = 'application/json';
          fileInputAll.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
              try {
                var success = StorageManager.importAllConfigs(ev.target.result);
                if (success) {
                  GM_notification({ text: '全部配置已导入，即将刷新页面生效', title: '广告拦截器' });
                  _setTimeout(function() { _location.reload(); }, 1000);
                } else {
                  GM_notification({ text: '导入失败：全局配置文件无效', title: '广告拦截器' });
                }
              } catch (err) {
                GM_notification({ text: '导入全部配置失败: ' + (err.message || err), title: '广告拦截器' });
              }
            };
            reader.readAsText(file, 'UTF-8');
          };
          fileInputAll.click();
          break;
        }
      }
    }
    showAdvancedSettingsPanel() {
      this.closeCurrentMask();
      var self = this;
      var c = currentConfig;
      var infoMap = {
        redirectBlocker: '启用后，尝试拦截所有跳转到第三方、非同源域名的行为。\n\n若关闭严格模式的第三方域名，则允许同主域的子域名跳转。',
        redirectCompat: '需要配合异源跳转拦截功能，开启：允许其他用户脚本（如网页翻译、重定向净化等）劫持相同的浏览器API。如果其他脚本后加载，可能覆盖本脚本的拦截功能。\n\n关闭：锁定API劫持，确保跳转拦截始终生效。如果同时安装了翻译/重定向净化等脚本，它们可能报错失效。',
        inlineStrict: '严格模式：额外拦截内联事件（如onclick）和javascript:URL，适用于拦截点击弹窗、悬浮广告等。\n宽松模式（默认）：仅移除内嵌脚本内容。',
        dynamicScriptStrict: '拦截动态代码中的危险API调用，若同时开启“启发黑名单”，会对脚本内容进行混淆检测并阻止执行，可能会影响部分正常网页的功能。',
        thirdPartyStrict: '严格模式：拦截所有第三方资源（包括子域名和兄弟域名）。\n宽松模式（默认）：只拦截完全无关的第三方域名（主域名不同）。',
        thirdPartyMethod: '严格劫持方式：在宽松模式基础上，额外劫持 appendChild 方法，拦截动态创建的第三方资源。',
        residualCleanup: '清空残留容器：在浏览器空闲时清理有明显广告样式且内容为空的容器。',
        iframeUIFix: '开启后，页面内嵌套的窗口（例如视频播放器）会弹出面板，开启本功能后，重新刷新网页后不会再弹出面板，防止同时出现多个面板。',
        builtinBlacklist: '启用后，脚本黑名单模式将使用内置的广告特征关键词列表进行拦截。关闭则不使用内置列表。',
        spoofUA: '使用GM_xmlhttpRequest方法模拟苹果设备，尝试绕过服务端检测，某些视频网页广告过滤无法观看视频可开启，可能可观看，开启后自动关闭"苹果设备模拟"。',
        heuristicBlacklist: '启用后，脚本黑名单模式将额外使用启发式正则规则进行检测，可拦截多种混淆、动态生成、恶意跳转等脚本模式。',
        crossTagThreshold: '需同时开启「脚本黑名单模式」+「启发黑名单」才能生效。\n\n当相同前缀的函数/变量出现次数达到此值时拦截。默认3，范围1~1000，修改后仅当前域名生效，阈值越小误杀率越高。',
      };
      this.createPanel({
        title: '高级设置中心',
        contentHtml: `
          <div class="module-grid" style="margin-bottom:8px;">
            <div class="module-switch"><span class="switch-label">异源跳转拦截 <span class="info-icon" data-info="redirectBlocker">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="redirectBlockerEnabled" ${c.redirectBlockerEnabled ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">跳转拦截兼容 <span class="info-icon" data-info="redirectCompat">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="redirectBlockerCompatibilityMode" ${c.redirectBlockerCompatibilityMode ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">清空残留容器 <span class="info-icon" data-info="residualCleanup">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="residualCleanupEnabled" ${c.residualCleanupEnabled ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">内置黑名单 <span class="info-icon" data-info="builtinBlacklist">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="builtinBlacklistEnabled" ${c.builtinBlacklistEnabled ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">启发黑名单 <span class="info-icon" data-info="heuristicBlacklist">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="heuristicBlacklistEnabled" ${c.heuristicBlacklistEnabled ? 'checked' : ''}><span class="slider"></span></label></div>
          </div>
          <div style="font-size:12px;color:#888;margin-bottom:6px;padding-left:4px;">严格模式</div>
          <div class="module-grid" style="margin-bottom:8px;">
            <div class="module-switch"><span class="switch-label">内嵌脚本 <span class="info-icon" data-info="inlineStrict">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="inlineScriptStrictMode" ${c.inlineScriptStrictMode ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">动态脚本 <span class="info-icon" data-info="dynamicScriptStrict">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="dynamicScriptStrictMode" ${c.dynamicScriptStrictMode ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">第三方域名 <span class="info-icon" data-info="thirdPartyStrict">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="thirdPartyStrictMode" ${c.thirdPartyStrictMode ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch"><span class="switch-label">第三方劫持 <span class="info-icon" data-info="thirdPartyMethod">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="thirdPartyStrictMethod" ${c.thirdPartyStrictMethod ? 'checked' : ''}><span class="slider"></span></label></div>
          </div>
          <div style="margin-bottom:8px;">
            <div class="module-switch" style="margin-bottom:8px;"><span class="switch-label">避免双重面板 <span class="info-icon" data-info="iframeUIFix">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="iframeUIFix" ${c.iframeUIFix ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch" style="margin-bottom:8px;"><span class="switch-label">UA模拟(GM请求) <span class="info-icon" data-info="spoofUA">!</span></span><label class="switch"><input type="checkbox" class="advanced-toggle" data-key="spoofUAEnabled" ${c.spoofUAEnabled ? 'checked' : ''}><span class="slider"></span></label></div>
            <div class="module-switch" style="margin-bottom:8px; padding:6px 10px;">
              <span class="switch-label">跨标签重复阈值 <span class="info-icon" data-info="crossTagThreshold">!</span></span>
              <input type="number" id="crossTagThresholdInput" min="1" max="1000" value="${currentConfig.crossTagPatternThreshold}" 
                style="width:60px;padding:0 8px;border-radius:8px;border:1px solid #ddd;outline:none;font-size:13px;text-align:center;box-sizing:border-box;min-width:0;flex-shrink:0;height:24px;">
            </div>
          </div>
        `,
        buttons: [],
        onBack: function () { self.showSettings(); },
      });
      var me = this.shadowRoot.querySelector('.mask:last-child');
      if (me) {
        var panelEl = me.querySelector('.panel');
        if (panelEl) {
          panelEl.addEventListener('click', function (e) {
            var infoIcon = e.target.closest('.info-icon');
            if (infoIcon && infoIcon.dataset.info) {
              e.stopPropagation();
              var message = infoMap[infoIcon.dataset.info] || '点击查看详情';
              self.showInfoTooltip(infoIcon, message);
            }
          });
          var thresholdInput = panelEl.querySelector('#crossTagThresholdInput');
          if (thresholdInput) {
            thresholdInput.addEventListener('change', function(e) {
              var val = parseInt(this.value);
              if (isNaN(val) || val < 1) val = 1;
              if (val > 1000) val = 1000;
              this.value = val;
              currentConfig.crossTagPatternThreshold = val;
              ConfigUpdater.saveNow();
              CrossScriptPatternTracker.reset();
            });
          }
        }
      }
    }
    showSettings() {
      this.closeCurrentMask();
      var self = this;
      var ms = Object.keys(MODULE_NAMES).filter(function (k) {
        return k !== 'manageCSP';
      }).map(function (k) {
        return ('<div class="module-switch"><span class="switch-label">' + escapeHtml(MODULE_NAMES[k]) + '</span><label class="switch"><input type="checkbox" class="module-toggle" data-key="' + k + '" ' + (currentConfig.modules[k] ? 'checked' : '') + '><span class="slider"></span></label></div>');
      }).join('');
      this.createPanel({
        title: '🛡️广告拦截设置',
        contentHtml: '<div style="font-size:13px;color:#888;margin-bottom:-6px;padding-left:4px;margin-top:4px;">功能模块:</div><div class="module-grid">' + ms + '</div>',
        buttons: [
          { id: 'viewLogs', text: '拦截日志 (' + LogManager.logs.length + ')', onclick: function () { self.showLogsPanel(); } },
          { id: 'manageCSP', text: 'CSP策略管理', onclick: function () { self.showCSPPanel(); } },
          { id: 'manageDiaryWhitelist', text: '日记白名单', onclick: function () { self.showDiaryWhitelistPanel(); } },
          { id: 'manageThirdParty', text: '第三方白名单', onclick: function () { self.showThirdPartyPanel(); } },
          { id: 'manageKeywordWhitelist', text: '关键词白名单', onclick: function () { self.showKeywordWhitelistPanel(); } },
          { id: 'manageScriptBlacklist', text: '脚本黑名单', onclick: function () { self.showScriptBlacklistPanel(); } },
          { id: 'showAdvancedSettings', text: '高级设置中心', onclick: function () { self.showAdvancedSettingsPanel(); } },
          { id: 'showImportExport', text: '📁 数据导入/导出', onclick: function () { self.showImportExportPanel(); } },
          { id: 'closePanel', text: '返回网页', onclick: function (e, m) { if (m._closePanel) m._closePanel(); } },
        ],
        hideBackButton: true,
        isRootPanel: true,
      });
    }
    // ======================== 新增：导入导出面板 ========================
    showImportExportPanel() {
      this.closeCurrentMask();
      var self = this;
      this.createPanel({
        title: '配置数据管理',
        contentHtml: `
          <div style="margin:8px 0; text-align:center;">
            <div style="margin-bottom:12px; padding:8px; background:#f0f7ff; border-radius:10px; font-size:13px;">
              📌 导出当前域名配置：保存当前网站的所有白名单、黑名单及模块设置。<br>
              📌 导入当前域名配置：从备份文件恢复当前网站的配置（会覆盖当前设置）。<br>
              📌 导出全部配置：导出所有已配置域名的完整数据。<br>
              📌 导入全部配置：批量恢复所有域名的配置（谨慎操作）。
            </div>
            <div class="btn-group" style="flex-direction:column;">
              <button type="button" data-id="exportCurrentConfig" class="primary">📤 导出当前域名配置</button>
              <button type="button" data-id="importCurrentConfig" class="primary">📥 导入当前域名配置</button>
              <button type="button" data-id="exportAllConfigs" style="background:#5856d6;">🌐 导出全部域名配置</button>
              <button type="button" data-id="importAllConfigs" style="background:#5856d6;">📂 导入全部域名配置</button>
            </div>
          </div>
        `,
        buttons: [],
        onBack: function () { self.showSettings(); },
      });
    }
    showDiaryWhitelistPanel() {
      var wl = Array.from(currentConfig.whitelist);
      var displayNames = currentConfig.whitelistDisplayNames;
      var prefixMap = {
        'INLINE_EVENT: ': '内联事件: ',
        'JAVASCRIPT_URL: ': 'JS URL: ',
        'SCRIPT_CONTENT: ': '脚本内容: ',
        'SCRIPT_SRC: ': '脚本SRC: ',
        'EVAL_HASH: ': 'Eval调用: ',
        'FUNCTION_HASH: ': 'Function构造器: ',
        'DOCUMENT_WRITE_HASH: ': 'document.write: ',
        'SETTIMEOUT_HASH: ': 'setTimeout: ',
        'SETINTERVAL_HASH: ': 'setInterval: ',
        'REQUESTANIMATIONFRAME_HASH: ': 'requestAnimationFrame: ',
      };
      this._showListPanel({
        title: '日记白名单 (' + wl.length + '项)',
        items: wl,
        renderItem: function (item, i) {
          var displayName = displayNames.get(item);
          if (displayName) {
            var typeLabel = '';
            for (var prefix in prefixMap) {
              if (prefixMap.hasOwnProperty(prefix) && item.startsWith(prefix)) {
                typeLabel = prefixMap[prefix];
                break;
              }
            }
            var contentPreview = displayName.length > 120
                ? displayName.substring(0, 120) + '...'
                : displayName;
            return '<div class="whitelist-item" data-index="' + i + '">'
                + '<span class="whitelist-text">' + escapeHtml(typeLabel + contentPreview) + '</span>'
                + '<button type="button" class="danger" data-action="deleteDiaryItem" data-index="' + i + '" style="padding:4px 8px;font-size:10px;border-radius:6px;">删除</button>'
                + '</div>';
          }
          var display = item;
          for (var prefix in prefixMap) {
            if (prefixMap.hasOwnProperty(prefix) && item.startsWith(prefix)) {
              display = prefixMap[prefix] + item.substring(prefix.length);
              break;
            }
          }
          return '<div class="whitelist-item" data-index="' + i + '">'
              + '<span class="whitelist-text">' + escapeHtml(display) + '</span>'
              + '<button type="button" class="danger" data-action="deleteDiaryItem" data-index="' + i + '" style="padding:4px 8px;font-size:10px;border-radius:6px;">删除</button>'
              + '</div>';
        },
        deleteAction: 'deleteDiaryItem',
        clearAction: 'clearAllDiary',
      });
    }
    showKeywordWhitelistPanel() {
      var kws = Array.from(currentConfig.keywordWhitelist);
      this._showListPanel({
        title: '关键词白名单 (' + kws.length + '项)',
        items: kws,
        renderItem: function (kw, i) {
          return '<div class="whitelist-item" data-index="' + i + '"><span class="whitelist-text">' + escapeHtml(kw) + '</span><button type="button" class="danger" data-action="deleteKeywordItem" data-index="' + i + '" style="padding:4px 8px;font-size:10px;border-radius:6px;">删除</button></div>';
        },
        deleteAction: 'deleteKeywordItem',
        clearAction: 'clearAllKeyword',
      });
    }
    showScriptBlacklistPanel() {
      var self = this;
      var bl = Utils.getActiveBlacklistArray();
      var listHtml = bl.length === 0
        ? '<div style="text-align:center;color:#999;margin:20px 0;font-size:14px;">列表为空</div>'
        : bl.map(function (kw, i) {
          return '<div class="whitelist-item" data-index="' + i + '"><span class="whitelist-text">' + escapeHtml(kw) + '</span><button type="button" class="danger" data-action="deleteBlacklistItem" data-index="' + i + '" style="padding:4px 8px;font-size:10px;border-radius:6px;">删除</button></div>';
        }).join('');
      var contentHtml = '<div class="sub-panel">' + listHtml + '</div>' +
        '<div style="display:flex;gap:8px;margin:10px 0;"><input type="text" id="newBlacklistKeyword" placeholder="输入关键词或脚本内容..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd;outline:none;font-size:13px;"><button type="button" data-id="addBlacklist" class="primary" style="padding:8px 16px;">添加</button></div>' +
        '<div style="display:flex;gap:8px;"><button type="button" data-action="clearAllBlacklist" class="danger" style="flex:1;">清空全部</button><button type="button" data-id="showScriptList" class="primary" style="flex:1;">显示所有脚本</button></div>';
      this.createPanel({
        title: '脚本黑名单 (' + bl.length + '项)',
        contentHtml: contentHtml,
        buttons: [],
        onBack: function () { self.showSettings(); },
      });
      var selfPanel = this;
      _setTimeout(function () {
        var me = selfPanel.shadowRoot && selfPanel.shadowRoot.querySelector('.mask:last-child');
        if (!me) return;
        var inp = me.querySelector('#newBlacklistKeyword');
        if (inp) {
          inp.focus();
          inp.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
              var b = me.querySelector('[data-id="addBlacklist"]');
              if (b) b.click();
            }
          });
        }
      }, 0);
    }
    showScriptListPanel() {
      this.closeCurrentMask();
      var self = this;
      var scripts = Array.from(_document.scripts);
      _scriptMap = new Map();
      var items = scripts.map(function (s, i) {
        var sContent = s.src || s.textContent;
        var sid = generateContentHash(sContent);
        _scriptMap.set(sid, sContent);
        return {
          index: i + 1,
          isExternal: !!s.src,
          content: Utils.truncateString(s.src ? s.src : s.textContent, CONFIG.LOG_DETAIL_LENGTH),
          script: s,
          sid: sid
        };
      });
      var bls = Utils.getActiveBlacklistSet();
      var initial = items.slice(0, CONFIG.PAGE_SIZE);
      var renderItem = function (item) {
        var sContent = item.isExternal ? item.script.src : item.script.textContent;
        var isBL = bls.has(sContent);
        var domainHint = '', extractBtn = '', isDBL = false, domainEnc = '';
        if (item.isExternal && item.script.src) {
          try {
            var d = new URL(item.script.src, _location.href).hostname;
            if (d) {
              domainHint = '<div style="font-size:11px;color:#999;margin-top:4px;">域名: ' + escapeHtml(d) + '</div>';
              isDBL = bls.has(d);
              domainEnc = encodeURIComponent(d);
              extractBtn = '<button type="button" data-action="addBlacklistFromDomain" data-domain="' + domainEnc + '" data-index="' + item.index + '" style="position:absolute;top:8px;right:80px;background:' + (isDBL ? '#999' : '#FF9500') + ';color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;z-index:1;" ' + (isDBL ? 'disabled' : '') + '>' + (isDBL ? '域名已加黑' : '加黑域名') + '</button>';
            }
          } catch (e) { }
        }
        var cls = 'log-entry' + (isBL || isDBL ? ' blacklisted' : '');
        return ('<div class="' + cls + '" style="border-left-color:' + (item.isExternal ? '#FF3B30' : '#007AFF') + ';position:relative;"><div class="log-module">脚本 #' + item.index + ' - ' + (item.isExternal ? '外联' : '内嵌') + '</div><div class="log-content" style="max-height:none;white-space:pre-wrap;word-break:break-all;padding-right:150px;">' + escapeHtml(item.content) + '</div>' + domainHint + extractBtn + '<button type="button" data-action="addToBlacklist" data-sid="' + item.sid + '" data-index="' + item.index + '" style="position:absolute;top:8px;right:8px;background:' + (isBL ? '#999' : '#FF3B30') + ';color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;z-index:1;" ' + (isBL ? 'disabled' : '') + '>' + (isBL ? '已加黑' : '加黑') + '</button></div>');
      };
      this.createPanel({
        title: '当前网页脚本列表 (共' + scripts.length + '个)',
        contentHtml: '<div style="margin-bottom:10px;font-size:13px;color:#666;text-align:center;">点击「加黑」将整个脚本内容添加到脚本黑名单；「加黑域名」将脚本域名加入黑名单</div><div class="sub-panel" style="max-height:60vh;" data-panel="scriptList">' + initial.map(renderItem).join('') + '</div>' + (items.length > CONFIG.PAGE_SIZE ? '<button type="button" data-id="loadMoreScripts" class="primary" style="width:100%;margin-top:8px;">加载更多 (' + CONFIG.PAGE_SIZE + '/' + items.length + ')</button>' : ''),
        buttons: [],
        onBack: function () { self.showScriptBlacklistPanel(); },
      });
    }
    loadMoreScripts(mask) {
      var scripts = Array.from(_document.scripts);
      var bls = Utils.getActiveBlacklistSet();
      var container = mask.querySelector('[data-panel="scriptList"]');
      var btn = mask.querySelector('[data-id="loadMoreScripts"]');
      if (!container || !scripts.length) return;
      var cur = container.children.length;
      if (cur >= scripts.length) {
        if (btn) btn.remove();
        return;
      }
      if (!_scriptMap) _scriptMap = new Map();
      var batch = scripts.slice(cur, cur + CONFIG.PAGE_SIZE);
      var htmlBatch = batch.map(function (s, idx) {
        var ri = cur + idx + 1;
        var sContent = s.src || s.textContent;
        if (!_scriptMap.has(generateContentHash(sContent))) {
          _scriptMap.set(generateContentHash(sContent), sContent);
        }
        var isExt = !!s.src;
        var content = Utils.truncateString(isExt ? s.src : s.textContent, CONFIG.LOG_DETAIL_LENGTH);
        var isBL = bls.has(sContent);
        var domainHint = '', extractBtn = '', isDBL = false;
        if (isExt && s.src) {
          try {
            var d = new URL(s.src, _location.href).hostname;
            if (d) {
              domainHint = '<div style="font-size:11px;color:#999;margin-top:4px;">域名: ' + escapeHtml(d) + '</div>';
              isDBL = bls.has(d);
              extractBtn = '<button type="button" data-action="addBlacklistFromDomain" data-domain="' + encodeURIComponent(d) + '" data-index="' + ri + '" style="position:absolute;top:8px;right:80px;background:' + (isDBL ? '#999' : '#FF9500') + ';color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;z-index:1;" ' + (isDBL ? 'disabled' : '') + '>' + (isDBL ? '域名已加黑' : '加黑域名') + '</button>';
            }
          } catch (e) { }
        }
        var cls = 'log-entry' + (isBL || isDBL ? ' blacklisted' : '');
        return '<div class="' + cls + '" style="border-left-color:' + (isExt ? '#FF3B30' : '#007AFF') + ';position:relative;"><div class="log-module">脚本 #' + ri + ' - ' + (isExt ? '外联' : '内嵌') + '</div><div class="log-content" style="max-height:none;white-space:pre-wrap;word-break:break-all;padding-right:150px;">' + escapeHtml(content) + '</div>' + domainHint + extractBtn + '<button type="button" data-action="addToBlacklist" data-sid="' + generateContentHash(sContent) + '" data-index="' + ri + '" style="position:absolute;top:8px;right:8px;background:' + (isBL ? '#999' : '#FF3B30') + ';color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;z-index:1;" ' + (isBL ? 'disabled' : '') + '>' + (isBL ? '已加黑' : '加黑') + '</button></div>';
      }).join('');
      var tmp = _document.createElement('div');
      tmp.innerHTML = htmlBatch;
      var frag = _document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      container.appendChild(frag);
      var nc = container.children.length;
      if (nc >= scripts.length) {
        if (btn) btn.remove();
      } else if (btn) {
        btn.textContent = '加载更多 (' + nc + '/' + scripts.length + ')';
      }
    }
    showLogsPanel() {
      this.closeCurrentMask();
      var self = this;
      var logs = LogManager.logs;
      var initial = logs.slice(0, CONFIG.PAGE_SIZE);
      this.createPanel({
        title: '拦截日志 (' + logs.length + '条)',
        contentHtml: '<div style="margin-bottom:10px;font-size:13px;color:#666;text-align:center;">关键词加白（添加关键词，该资源加入白名单放行）:</div><div style="display:flex;gap:8px;margin-bottom:15px;"><input type="text" id="keywordWhitelistInput" placeholder="输入关键词，如: abc" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd;outline:none;font-size:13px;"><button type="button" data-id="addKeywordWhitelist" class="primary" style="padding:8px 16px;">添加</button></div><div class="sub-panel" data-panel="logList">' + initial.map(function (l, i) { return self.renderLogItem(l, i); }).join('') + '</div>' + (logs.length > CONFIG.PAGE_SIZE ? '<button type="button" data-id="loadMoreLogs" class="primary" style="width:100%;margin-top:8px;">加载更多 (' + CONFIG.PAGE_SIZE + '/' + logs.length + ')</button>' : ''),
        buttons: [],
        onBack: function () { self.showSettings(); },
      });
      _setTimeout(function () {
        var me = self.shadowRoot && self.shadowRoot.querySelector('.mask:last-child');
        if (!me) return;
        var inp = me.querySelector('#keywordWhitelistInput');
        if (inp) {
          inp.focus();
          inp.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
              var b = me.querySelector('[data-id="addKeywordWhitelist"]');
              if (b) b.click();
            }
          });
        }
      }, 0);
    }
    loadMoreLogs(mask) {
      var self = this;
      var logs = LogManager.logs;
      var container = mask.querySelector('[data-panel="logList"]');
      var btn = mask.querySelector('[data-id="loadMoreLogs"]');
      var cur = container.children.length;
      if (cur >= logs.length) {
        if (btn) btn.remove();
        return;
      }
      var batch = logs.slice(cur, cur + CONFIG.PAGE_SIZE);
      var htmlBatch = batch.map(function (l, i) {
        return self.renderLogItem(l, cur + i);
      }).join('');
      var tmp = _document.createElement('div');
      tmp.innerHTML = htmlBatch;
      var frag = _document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      container.appendChild(frag);
      var nc = container.children.length;
      if (nc >= logs.length) {
        if (btn) btn.remove();
      } else if (btn) {
        btn.textContent = '加载更多 (' + nc + '/' + logs.length + ')';
      }
    }
    showCSPPanel() {
      this.closeCurrentMask();
      var self = this;
      var rulesHtml = currentConfig.cspRules.map(function (r) {
        return ('<div class="csp-rule"><span class="csp-name">' + escapeHtml(r.name) + '</span><label class="switch"><input type="checkbox" class="csp-toggle" data-id="' + r.id + '" ' + (r.enabled ? 'checked' : '') + '><span class="slider"></span></label></div>');
      }).join('');
      this.createPanel({
        title: 'CSP策略管理',
        contentHtml: '<div style="margin-bottom:10px;font-size:13px;color:#666;text-align:center;">当前状态: ' + (currentConfig.modules.manageCSP ? '✅已启用' : '❌已禁用') + '</div><div class="sub-panel">' + rulesHtml + '</div><div class="btn-group"><button type="button" data-id="enableCSP" ' + (currentConfig.modules.manageCSP ? 'disabled' : '') + '>启用CSP</button><button type="button" data-id="disableCSP" ' + (!currentConfig.modules.manageCSP ? 'disabled' : '') + '>禁用CSP</button></div><div class="btn-group"><button type="button" data-id="allOn">全部开启</button><button type="button" data-id="allOff">全部关闭</button></div>',
        buttons: [],
        onBack: function () { self.showSettings(); },
      });
    }
    showThirdPartyPanel() {
      var self = this;
      var wl = currentConfig.thirdPartyWhitelist;
      var extraHTML = '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        + '<input type="text" id="newWhitelist" placeholder="域名(如 example.com) 或通配符(如 *.example.com)" '
        + 'style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd;outline:none;font-size:13px;">'
        + '<button type="button" data-id="addWhitelist" class="primary" style="padding:8px 16px;">添加</button></div>'
        + '<div style="font-size:11px;color:#999;margin-bottom:8px;padding-left:4px;">'
        + '💡 输入完整域名精确匹配，或使用 *.example.com 通配符匹配所有子域名</div>';
      this._showListPanel({
        title: '第三方白名单 (' + wl.length + '项)',
        items: wl,
        renderItem: function (item, i) {
          return '<div class="whitelist-item" data-index="' + i + '"><span class="whitelist-text">' + escapeHtml(item) + '</span><button type="button" class="danger" data-action="deleteThirdPartyItem" data-index="' + i + '" style="padding:4px 8px;font-size:10px;border-radius:6px;">删除</button></div>';
        },
        deleteAction: 'deleteThirdPartyItem',
        clearAction: 'clearAllThirdParty',
        extraHTML: extraHTML,
      });
      _setTimeout(function () {
        var me = self.shadowRoot && self.shadowRoot.querySelector('.mask:last-child');
        if (!me) return;
        var inp = me.querySelector('#newWhitelist');
        if (inp) {
          inp.focus();
          inp.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
              var b = me.querySelector('[data-id="addWhitelist"]');
              if (b) b.click();
            }
          });
        }
      }, 0);
    }
  }

  class CentralScheduler {
    constructor(modules) {
      this.modules = modules;
      this.elementCheckCache = new WeakSet();
      this.urlCheckCache = new LRUCache(CONFIG.CACHE_CAPACITY_SMALL, CONFIG.CACHE_TTL);
    }
    shouldProcessElement(el) {
      return (
        Utils.isElement(el) &&
        !this.elementCheckCache.has(el) &&
        !ProcessedElementsCache.isProcessed(el) &&
        !Utils.isParentProcessed(el) &&
        el.getAttribute('data-adblock-safe') !== 'true'
      );
    }
    processElement(el) {
      if (!this.shouldProcessElement(el)) return false;
      this.elementCheckCache.add(el);
      for (var i = 0; i < this.modules.length; i++) {
        var m = this.modules[i];
        if (m.enabled && m.checkElement(el)) {
          ProcessedElementsCache.markAsProcessed(el);
          return true;
        }
      }
      return false;
    }
    clearCache() {
      this.elementCheckCache = new WeakSet();
      this.urlCheckCache.clear();
      urlCache.clear();
    }
  }

  let inlineScriptsModule = null;
  let thirdPartyModule = null;
  let scriptBlacklistModule = null;
  let centralScheduler = null;
  let menuCommandsRegistered = false;

  var _safeInitMO = null;
  var _reinitGuard = false;

  function registerAllMenuCommands() {
    if (menuCommandsRegistered) return;
    menuCommandsRegistered = true;
    var ensureUI = function (callback) {
      if (!UIController.uiInitialized) UIController.init();
      callback();
    };
    GM_registerMenuCommand('1 ⚙️ 广告拦截设置面板', function () {
      ensureUI(function () {
        if (!UIController.panelManager) {
          GM_notification({ text: '面板初始化失败，请刷新页面重试', title: '广告拦截器' });
          return;
        }
        UIController.panelManager.showSettings();
      });
    });
    GM_registerMenuCommand(
      '2 🍎 苹果设备模拟 ' + (currentConfig.simplePlatformSpoof ? '✅ 已启用' : '❌ 已禁用'),
      function () {
        currentConfig.simplePlatformSpoof = !currentConfig.simplePlatformSpoof;
        if (currentConfig.simplePlatformSpoof) {
          currentConfig.spoofUAEnabled = false;
        }
        ConfigUpdater.saveNow();
        GM_notification({
          text: '平台模拟已' + (currentConfig.simplePlatformSpoof ? '启用' : '禁用') + '，刷新页面生效',
          title: '广告拦截器'
        });
        _location.reload();
      }
    );
    GM_registerMenuCommand('3 🗑️ 清空所有白名单', function () {
      ensureUI(function () {
        UIController.panelManager.showConfirm('确定清空当前域名的所有白名单（包括日记白名单、第三方白名单、关键词白名单等）吗？', function () {
          Whitelisting.clearAllWhitelists();
          resetAllCachesAndStates();
          GM_notification({ text: '所有白名单已清空', title: '广告拦截器' });
          _location.reload();
        });
      });
    });
    GM_registerMenuCommand('4 🔄 当前域名重置所有设置', function () {
      ensureUI(function () {
        UIController.panelManager.showConfirm('确定重置当前域名的所有设置吗？\n\n这将清空当前域名的所有白名单并关闭所有模块，恢复到初始状态。', function () {
          StorageManager.resetAllSettings();
          resetAllCachesAndStates();
          GM_notification({ text: '当前域名设置已重置', title: '广告拦截器' });
          _location.reload();
        });
      });
    });
    GM_registerMenuCommand('5 ⚠️ 全局重置所有设置', function () {
      ensureUI(function () {
        UIController.panelManager.showConfirm('⚠️ 警告：此操作将完全清空本脚本存储的所有配置和数据！\n\n相当于将脚本重新安装，确定要全局重置吗？', function () {
          try {
            var allKeys = GM_listValues();
            for (var i = 0; i < allKeys.length; i++) {
              GM_deleteValue(allKeys[i]);
            }
          } catch (e) { }
          GM_notification({ text: '全局设置已完全清空，正在刷新页面...', title: '广告拦截器' });
          _location.reload();
        });
      });
    });
  }
  registerAllMenuCommands();

  const UIController = {
    uiInitialized: false,
    modulesInitialized: false,
    mutationObserver: null,
    batchProcessingQueue: [],
    batchSize: CONFIG.BATCH_SIZE,
    isProcessingBatch: false,
    lastProcessTime: 0,
    emaFrameTime: 16,
    panelManager: null,
    modules: [],
    _lastIframeMessage: 0,
    
    _setupIframeMessageListener: function() {
      var self = this;
      _globals.addEventListener('message', function(e) {
        if (!e.data || e.data.source !== 'adblock-iframe') return;
        if (e.data.type !== 'adblock-show-panel') return;
        if (!e.origin) return;
        if (self._lastIframeMessage && Date.now() - self._lastIframeMessage < 1000) return;
        self._lastIframeMessage = Date.now();
        if (!isInIframe() && self.panelManager) {
          self.panelManager.showSettings();
        }
      });
    },
    
    init: function () {
      if (this.uiInitialized) return;
      this.uiInitialized = true;
      this.modulesInitialized = true;
      this.applyInitialModuleStates();
      this.panelManager = new PanelManager();
      this.createModules();
      this.applyModuleSettings();
      this.setupObservers();
      this.setupResourceScan();
      if (Utils.isAnyModuleEnabled() && currentConfig.residualCleanupEnabled) ResidualCleaner.init();
      else ResidualCleaner.stop();
      OverlayInterceptor.init();
      this._setupIframeMessageListener();
    },
    applyInitialModuleStates: function () {
      Object.keys(DEFAULT_MODULE_STATE).forEach(function (k) {
        if (currentConfig.modules[k] === undefined) currentConfig.modules[k] = DEFAULT_MODULE_STATE[k];
      });
    },
    createModules: function () {
      inlineScriptsModule = new RemoveInlineScriptsModule();
      thirdPartyModule = new ThirdPartyInterceptionModule();
      scriptBlacklistModule = new ScriptBlacklistModeModule();
      this.modules = [
        inlineScriptsModule,
        new RemoveExternalScriptsModule(),
        scriptBlacklistModule,
        thirdPartyModule,
      ];
    },
    applyModuleSettings: function () {
      this.modules.forEach(function (m) {
        m.init();
      });
      DynamicScriptInterceptor.init();
      CSPModule.init();
      centralScheduler = new CentralScheduler(this.modules);
    },
    setupObservers: function () {
      if (!Utils.isAnyModuleEnabled()) return;
      var self = this;
      this.mutationObserver = new _MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === _Node.ELEMENT_NODE && !ProcessedElementsCache.isProcessed(n) && !Utils.isParentProcessed(n)) self.addToBatchProcessingQueue(n);
          }
        }
      });
      this.mutationObserver.observe(_document.documentElement, { childList: true, subtree: true });
      this.processExistingElementsBatch();
    },
    setupResourceScan: function () {
      var self = this;
      if (currentConfig.modules.interceptThirdParty) {
        _document.addEventListener('DOMContentLoaded', function () {
          _setTimeout(function () {
            self.scanExistingResources();
          }, 1000);
        });
      }
    },
    scanExistingResources: function () {
      try {
        _document
          .querySelectorAll('script[src], iframe[src], img[src], img[data-src], embed[src], object[data], link[href]')
          .forEach(function (el) {
            if (ProcessedElementsCache.isProcessed(el) || Utils.isParentProcessed(el)) return;
            var t = el.tagName;
            var u;
            if (t === 'SCRIPT') u = el.src;
            else if (t === 'IFRAME') u = el.src;
            else if (t === 'IMG') u = el.src || el.getAttribute('data-src');
            else if (t === 'EMBED') u = el.src;
            else if (t === 'OBJECT') u = el.data;
            else if (t === 'LINK') u = el.href;
            if (u && shouldBlockResource(u)) {
              var ci = Utils.getContentIdentifier(el);
              if (ci && !currentConfig.whitelist.has(ci)) {
                LogManager.add('interceptThirdParty', el, {
                  type: 'THIRD_PARTY_SCAN',
                  detail: '扫描发现: ' + t + ': ' + Utils.truncateString(u, CONFIG.LOG_DETAIL_LENGTH)
                });
              }
            }
          });
      } catch (e) { }
    },
    addToBatchProcessingQueue: function (el) {
      if (el.getAttribute && el.getAttribute('data-adblock-safe') === 'true') {
        ProcessedElementsCache.markAsProcessed(el);
        return;
      }
      this.batchProcessingQueue.push(el);
      if (!this.isProcessingBatch) this.processBatch();
    },
    processBatch: function () {
      var self = this;
      if (!centralScheduler) return;
      this.isProcessingBatch = true;
      var bs = this.batchSize;
      var alpha = 0.2;
      var chunk = function () {
        var now = performance.now();
        if (self.lastProcessTime > 0) {
          self.emaFrameTime = alpha * (now - self.lastProcessTime) + (1 - alpha) * self.emaFrameTime;
          bs = self.emaFrameTime > 16 ? Math.max(5, Math.round(bs * 0.9)) : Math.min(50, Math.round(bs * 1.1));
        }
        self.lastProcessTime = now;
        var batch = self.batchProcessingQueue.splice(0, bs);
        for (var i = 0; i < batch.length; i++) {
          centralScheduler.processElement(batch[i]);
        }
        if (self.batchProcessingQueue.length > 0) _requestAnimationFrame(chunk);
        else self.isProcessingBatch = false;
      };
      _requestAnimationFrame(chunk);
    },
    processExistingElementsBatch: function () {
      var self = this;
      var els = Array.from(
        _document.querySelectorAll('script, iframe, img, a[href], style, link[rel="preload"], link[rel="prefetch"], embed, object, link[href]')
      );
      var allElements = _document.querySelectorAll('*');
      for (var hi = 0; hi < allElements.length; hi++) {
        var el = allElements[hi];
        if (el.shadowRoot && !el.shadowRoot._adblockObserved) {
          if (currentConfig.modules.interceptThirdParty && thirdPartyModule && thirdPartyModule.domHooker) {
            thirdPartyModule.domHooker.observeShadowRoot(el.shadowRoot);
          }
          var shadowEls = el.shadowRoot.querySelectorAll('script, iframe, img, a[href], style, link[rel="preload"], link[rel="prefetch"], embed, object, link[href]');
          for (var sei = 0; sei < shadowEls.length; sei++) els.push(shadowEls[sei]);
        }
      }
      var process = function () {
        var batch = els.splice(0, self.batchSize * 2);
        for (var i = 0; i < batch.length; i++) {
          var el = batch[i];
          if (!ProcessedElementsCache.isProcessed(el) && !Utils.isParentProcessed(el)) self.addToBatchProcessingQueue(el);
        }
        if (els.length > 0) _requestIdleCallback(process);
      };
      _requestIdleCallback(process);
    },
  };

  const _UA_SPOOF_KEY = '__adblock_ua_spoof_done__';
  const _DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  function teardownAllBeforeDocWrite() {
    try {
      if (UIController.mutationObserver) {
        UIController.mutationObserver.disconnect();
        UIController.mutationObserver = null;
      }
    } catch (e) {}
    try {
      if (OverlayInterceptor._observer) {
        OverlayInterceptor._observer.disconnect();
        OverlayInterceptor._observer = null;
      }
      if (OverlayInterceptor._intersectionObserver) {
        OverlayInterceptor._intersectionObserver.disconnect();
        OverlayInterceptor._intersectionObserver = null;
      }
      if (OverlayInterceptor._periodicTimer !== null) {
        _cancelIdleCallback(OverlayInterceptor._periodicTimer);
        OverlayInterceptor._periodicTimer = null;
      }
    } catch (e) {}
    try {
      if (ResidualCleaner.observer) {
        ResidualCleaner.observer.disconnect();
        ResidualCleaner.observer = null;
      }
      if (ResidualCleaner._scanTimer !== null) {
        _cancelIdleCallback(ResidualCleaner._scanTimer);
        ResidualCleaner._scanTimer = null;
      }
      ResidualCleaner._pendingNodes = [];
    } catch (e) {}
    try {
      if (RedirectBlocker._savedObservers) {
        for (var j = 0; j < RedirectBlocker._savedObservers.length; j++) {
          try { RedirectBlocker._savedObservers[j].disconnect(); } catch (e2) {}
        }
        RedirectBlocker._savedObservers = [];
      }
    } catch (e) {}
    try {
      if (UIController.modules) {
        for (var mi = 0; mi < UIController.modules.length; mi++) {
          var mod = UIController.modules[mi];
          if (mod && mod.enabled) {
            try { mod.disable(); } catch (e2) {}
          }
        }
      }
    } catch (e) {}
    try { if (thirdPartyModule && thirdPartyModule.enabled) thirdPartyModule.disable(); } catch (e) {}
    try { DynamicScriptInterceptor.disable(); } catch (e) {}
    try { RedirectBlocker.disable(); } catch (e) {}
    try { OverlayInterceptor.restoreDOMHooks?.(); } catch (e) {}
    UIController.uiInitialized = false;
    UIController.modulesInitialized = false;
    UIController.isProcessingBatch = false;
    UIController.batchProcessingQueue = [];
    OverlayInterceptor._enabled = false;
    OverlayInterceptor._domHooked = false;
    OverlayInterceptor._processedSet = new WeakSet();
    if (OverlayInterceptor._hiddenElementsMap) {
      OverlayInterceptor._hiddenElementsMap.clear();
    }
    DynamicScriptInterceptor._callbackCheckCache = new WeakMap();
    ProcessedElementsCache.clear();
    if (centralScheduler) {
      centralScheduler.clearCache();
      centralScheduler.elementCheckCache = new WeakSet();
    }
    urlCache.clear();
    try { CrossScriptPatternTracker.reset(); } catch (e) {}
    try {
      if (UIController.panelManager) {
        UIController.panelManager.settingsContainer = null;
        UIController.panelManager.shadowRoot = null;
        UIController.panelManager.isAnimating = false;
        UIController.panelManager.currentController = null;
        UIController.panelManager._savedBodyStyles = null;
      }
    } catch (e) {}
    try {
      if (strongBlockingEnabled) disableStrongBlocking();
      activePanels.clear();
    } catch (e) {}
    try {
      if (_safeInitMO) {
        _safeInitMO.disconnect();
        _safeInitMO = null;
      }
    } catch (e) {}
  }

  function rebuildAfterDocWrite() {
    try {
      try {
        var hideStyle = _document.querySelector('style[data-adblock-ua-spoof-hide]');
        if (hideStyle) hideStyle.remove();
      } catch (e) {}
      try {
        var s = document.createElement('style');
        s.setAttribute('data-adblock-hide-style', 'true');
        s.textContent = '.adblock-universal-hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;top:-9999px!important;width:0!important;height:0!important;overflow:hidden!important;z-index:-999!important;}';
        (document.documentElement || document).appendChild(s);
      } catch (e) {}
      try { StorageManager.loadConfig(); } catch (e) {}
      try {
        if (currentConfig.redirectBlockerEnabled) {
          RedirectBlocker.disable();
          RedirectBlocker._initialized = false;
          RedirectBlocker.init();
        }
      } catch (e) {}
      try {
        DynamicScriptInterceptor._enabled = false;
        if (currentConfig.modules.blockDynamicScripts) {
          DynamicScriptInterceptor.enable();
        }
      } catch (e) {}
      try {
        UIController.init();
      } catch (e) {
        try {
          UIController.uiInitialized = false;
          UIController.modulesInitialized = false;
          UIController.init();
        } catch (e2) {
          console.warn('[广告拦截器] UA伪装后重建失败:', e2.message || e2);
        }
      }
    } finally {
      _reinitGuard = false;
    }
  }

  function initUASpoof() {
    if (!currentConfig.spoofUAEnabled) return false;
    if (typeof GM_xmlhttpRequest === 'undefined') return false;
    if (_globals[_UA_SPOOF_KEY]) return false;
    try {
      Object.defineProperty(_globals.navigator, 'platform', {
        get: function () { return 'MacIntel'; },
        configurable: true, enumerable: true
      });
      Object.defineProperty(_globals.navigator, 'userAgent', {
        get: function () { return _DESKTOP_UA; },
        configurable: true, enumerable: true
      });
      Object.defineProperty(_globals.navigator, 'maxTouchPoints', {
        get: function () { return 0; },
        configurable: true, enumerable: true
      });
      Object.defineProperty(_globals, 'ontouchstart', {
        value: undefined, configurable: true
      });
      try {
        Object.defineProperty(_globals.screen, 'width', {
          get: function () { return 1920; }, configurable: true
        });
        Object.defineProperty(_globals.screen, 'height', {
          get: function () { return 1080; }, configurable: true
        });
      } catch(e) {}
    } catch (e) {}
    _globals[_UA_SPOOF_KEY] = true;
    try {
      var hideStyle = _document.createElement('style');
      hideStyle.setAttribute('data-adblock-ua-spoof-hide', 'true');
      hideStyle.textContent = 'html{visibility:hidden!important;}';
      (_document.documentElement || _document).appendChild(hideStyle);
    } catch (e) {}
    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: _location.href,
        headers: { 'User-Agent': _DESKTOP_UA },
        anonymous: true,
        timeout: 10000,
        onload: function (response) {
          if (response.status >= 200 && response.status < 400 && response.responseText) {
            try {
              teardownAllBeforeDocWrite();
              _reinitGuard = true;
              var dynWriteHook = DynamicScriptInterceptor._dynamicWriteHook;
              var redirectWriteHook = RedirectBlocker._writeTimingHook;
              if (dynWriteHook) WriteHookManager.removeHook(dynWriteHook);
              if (redirectWriteHook) WriteHookManager.removeHook(redirectWriteHook);
              _document.open();
              _document.write(response.responseText);
              _document.close();
              if (dynWriteHook) WriteHookManager.addHook(dynWriteHook);
              if (redirectWriteHook) WriteHookManager.addHook(redirectWriteHook);
              rebuildAfterDocWrite();
              return;
            } catch (e) {
              console.warn('[广告拦截器] UA伪装页面替换失败:', e.message || e);
            }
          }
          delete _globals[_UA_SPOOF_KEY];
          try {
            var hs = _document.querySelector('style[data-adblock-ua-spoof-hide]');
            if (hs) hs.remove();
          } catch (e) {}
          UIController.init();
        },
        onerror: function () {
          delete _globals[_UA_SPOOF_KEY];
          try {
            var hs = _document.querySelector('style[data-adblock-ua-spoof-hide]');
            if (hs) hs.remove();
          } catch (e) {}
          UIController.init();
        },
        ontimeout: function () {
          delete _globals[_UA_SPOOF_KEY];
          try {
            var hs = _document.querySelector('style[data-adblock-ua-spoof-hide]');
            if (hs) hs.remove();
          } catch (e) {}
          UIController.init();
        },
      });
      return false;
    } catch (e) {
      delete _globals[_UA_SPOOF_KEY];
      try {
        var hs = _document.querySelector('style[data-adblock-ua-spoof-hide]');
        if (hs) hs.remove();
      } catch (e2) {}
      return false;
    }
  }

  function applySimplePlatformSpoof() {
    if (!currentConfig.simplePlatformSpoof) return;
    try {
      Object.defineProperty(_globals.navigator, 'platform', {
        get: function () { return 'MacIntel'; },
        configurable: true,
        enumerable: true
      });
      try {
        Object.defineProperty(_globals.navigator, 'appVersion', {
          get: function () { return '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
      try {
        Object.defineProperty(_globals.screen, 'availWidth', {
          get: function () { return 1920; }, configurable: true
        });
        Object.defineProperty(_globals.screen, 'availHeight', {
          get: function () { return 1080; }, configurable: true
        });
        Object.defineProperty(_globals.screen, 'colorDepth', {
          get: function () { return 24; }, configurable: true
        });
        Object.defineProperty(_globals.screen, 'pixelDepth', {
          get: function () { return 24; }, configurable: true
        });
      } catch (e) {}
      try {
        var origMatchMedia = _globals.matchMedia;
        _globals.matchMedia = function(query) {
          if (typeof query === 'string' && query.includes('pointer: coarse')) {
            return {
              matches: false,
              media: query,
              onchange: null,
              addListener: function(){},
              removeListener: function(){},
              addEventListener: function(){},
              removeEventListener: function(){},
              dispatchEvent: function(){ return true; }
            };
          }
          return origMatchMedia.apply(this, arguments);
        };
      } catch (e) {}
    } catch (e) { }
  }
  applySimplePlatformSpoof();

  function isInIframe() {
    try {
      return _globals.self !== _globals.top;
    } catch (e) {
      return true;
    }
  }

  function safeInit() {
    if (_document.documentElement) {
      if (_reinitGuard) return true;
      if (currentConfig.spoofUAEnabled && !_globals[_UA_SPOOF_KEY]) {
        initUASpoof();
      }
      UIController.init();
      return true;
    }
    return false;
  }

  if (!safeInit()) {
    _safeInitMO = new _MutationObserver(function () {
      if (safeInit()) {
        if (_safeInitMO) {
          _safeInitMO.disconnect();
          _safeInitMO = null;
        }
      }
    });
    _safeInitMO.observe(_document, { childList: true });
    _document.addEventListener('DOMContentLoaded', function () {
      if (!safeInit()) _setTimeout(safeInit, 100);
    }, { once: true });
    _setTimeout(function () {
      if (!safeInit()) {
        UIController.init();
      }
    }, 5000);
  }
})();