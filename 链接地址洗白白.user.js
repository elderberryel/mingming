// ==UserScript==
// @name 链接地址洗白白
// @namespace Daomouse Link Cleaner
// @version 2.0
// @author 稻米鼠
// @description 把链接地址缩减至最短可用状态，并复制到剪切板，以方便分享。
// @run-at       document-start
// @match *://*/*
// @grant GM_setClipboard
// @grant GM_notification
// @grant GM_addStyle
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_registerMenuCommand
// @noframes
// ==/UserScript==

/** 主功能函数 **/

/**
 * 链接净化规则
 * version 0.0.6
 * update 2024-01-15
 */
const rules = {
  'www.bilibili.com': {/* Bilibili - 支持av和BV格式 */
    testReg: /^http(?:s)?:\/\/www\.bilibili\.com\/video\/((?:av|BV)\w+).*$/i,
    replace: 'https://www.bilibili.com/video/$1',
    query: ['p', 't'],
    hash: true
  },
  'itunes.apple.com': {/* Apple Stroe */
    testReg: /^http(?:s)?:\/\/itunes\.apple\.com\/(?:\w{2}\/)?([^\/]+)\/(?:[^\/]+\/)?((?:id)\d+).*$/i,
    replace: 'https://itunes.apple.com/cn/$1/$2',
  },
  'apps.apple.com': {/* Apple Stroe */
    testReg: /^http(?:s)?:\/\/apps\.apple\.com\/(?:\w{2}\/)?([^\/]+)\/(?:[^\/]+\/)?((?:id)\d+).*$/i,
    replace: 'https://apps.apple.com/cn/$1/$2',
  },
  'microsoft.com/win10-store': {/* Win10 apps store */
    testReg: /^http(?:s)?:\/\/www\.microsoft\.com\/[a-zA-Z-]{2,5}\/p\/[^/]+\/([a-zA-Z0-9]{12,})(?:[^a-zA-Z0-9].*|$)/i,
    replace: 'https://www.microsoft.com/store/apps/$1',
  },
  'chrome.google.com/webstore': {/* Chrome Store */
    testReg: /^http(?:s)?:\/\/chrome\.google\.com\/webstore\/detail\/[^\/]+\/([a-z]{32}).*/i,
    replace: 'https://chrome.google.com/webstore/detail/$1',
  },
  's.taobao.com': {/* Taobao Search */
    testReg: /^http(?:s)?:\/\/s\.taobao\.com\/search.*$/i,
    replace: 'https://s.taobao.com/search',
    query: ['q'],
  },
  'list.tmall.com': {/* Tmall Search */
    testReg: /^http(?:s)?:\/\/list\.tmall\.com\/search_product\.htm.*$/i,
    replace: 'https://list.tmall.com/search_product.htm',
    query: ['q'],
  },
  'item.taobao.com': {/* Taobao item */
    testReg: /^http(?:s)?:\/\/item\.taobao\.com\/item\.htm.*$/i,
    replace: 'https://item.taobao.com/item.htm',
    query: ['id'],
  },
  'detail.tmall.com': {/* Tmall item */
    testReg: /^http(?:s)?:\/\/detail\.tmall\.com\/item\.htm.*$/i,
    replace: 'https://detail.tmall.com/item.htm',
    query: ['id'],
  },
  'taobao/tmall.com/shop': {/* Taobao/Tmall Shop */
    testReg: /^http(?:s)?:\/\/(\w+)\.(taobao|tmall)\.com\/shop\/view_shop\.htm.*$/i,
    replace: 'https://$1.$2.com/',
  },
  'c.pc.qq.com': {/* Open Taobao share link from QQ */
    testReg: /^http(?:s)?:\/\/c\.pc\.qq\.com\/middle.html\?.*pfurl=([^&]*)(?:&.*$|$)/i,
    replace: '$1',
    query: [],
    methods: ['decodeUrl'],
  },
  'item.m.jd.com': {/* JD mobile to PC */
    testReg: /^http(?:s)?:\/\/item\.m\.jd\.com\/product\/(\d+)\.html(\?.*)?$/i,
    replace: 'https://item.jd.com/$1.html',
  },
  'item.m.jd.com/ware/': {/* JD mobile to PC */
    testReg: /^http(?:s)?:\/\/item\.m\.jd\.com\/ware\/view\.action\?.*wareId=(\d+).*$/i,
    replace: 'https://item.jd.com/$1.html',
  },
  'search.jd.com': {/* JD Search */
    testReg: /^http(?:s)?:\/\/search\.jd\.com\/Search\?.*$/i,
    query: ['keyword', 'enc'],
  },
  're.jd.com': {/* JD hot sell */
    testReg: /^http(?:s)?:\/\/re\.jd\.com\/cps\/item\/(\d+)\.html.*$/i,
    replace: 'https://item.jd.com/$1.html',
  },
  'weibo.com/u': {/* Weibo personal homepage to mobile */
    testReg: /^http(?:s)?:\/\/(?:www\.)?weibo\.com\/u\/(\d+)(\?.*)?$/i,
    replace: 'https://m.weibo.cn/$1',
  },
  'weibo.com': {/* Weibo article page to mobile */
    testReg: /^http(?:s)?:\/\/(?:www\.)?weibo\.com\/(?:\d+)\/(\w+)(\?.*)?$/i,
    replace: 'https://m.weibo.cn/status/$1',
  },
  'greasyfork.org/script/tabs': {/* Greasyfork Script 脚本下各种标签 */
    testReg: /^http(?:s)?:\/\/(?:www\.)?greasyfork\.org\/(?:[\w-]*\/)?scripts\/(\d+)-[^//]*\/(code|versions|stats|derivatives|admin).*$/i,
    replace: 'https://greasyfork.org/scripts/$1/$2',
    hash: true
  },
  'greasyfork.org': {/* Greasyfork Script 各类页面 */
    testReg: /^http(?:s)?:\/\/(?:www\.)?greasyfork\.org\/(?:[\w-]*\/)?(scripts|users)\/(\d+)-[^//]*$/i,
    replace: 'https://greasyfork.org/$1/$2',
  },
  'greasyfork.org/scripts/list': {/* Greasyfork Script 脚本列表 */
    testReg: /^http(?:s)?:\/\/(?:www\.)?greasyfork\.org\/(?:[\w-]*\/)?scripts\?.*$/i,
    query: ['set', 'page']
  },
  'greasyfork.org/script/discussions': {/* Greasyfork Script 脚本下讨论 */
    testReg: /^http(?:s)?:\/\/(?:www\.)?greasyfork\.org\/(?:[\w-]*\/)?scripts\/(\d+)-[^//]*\/discussions\/(\d+).*$/i,
    replace: 'https://greasyfork.org/scripts/$1/discussions/$2',
    hash: true
  },
  'greasyfork.org/discussions': {/* Greasyfork Script 论坛 */
    testReg: /^http(?:s)?:\/\/(?:www\.)?greasyfork\.org\/(?:[\w-]*\/)?discussions\/(greasyfork|development|requests)\/(\d+)(?:[^\d].*)?$/i,
    replace: 'https://greasyfork.org/discussions/$1/$2',
    hash: true
  },
  'store.steampowered.com|steamcommunity.com': {/* Steam */
    testReg: /^http(?:s)?:\/\/(store\.steampowered|steamcommunity)\.com\/app\/(\d+).*$/i,
    replace: 'https://$1.com/app/$2',
  },
  'meta.appinn.com': {/* Appinn BBS */
    testReg: /^http(?:s)?:\/\/meta\.appinn\.net\/t(?:\/[^/]*)*?\/(\d+)(\/.*$|$)/i,
    replace: 'https://meta.appinn.net/t/$1',
  },
  'amazon.co.jp': {/* amazon.co.jp */
    testReg: /^http(?:s)?:\/\/(?:www\.)?amazon\.co\.jp\/([^\/]+)\/dp\/(\w+)\/.*$/i,
    replace: 'https://www.amazon.co.jp/$1/dp/$2',
  },
  'yangkeduo.com': {/* Pin Duo Duo product Page */
    testReg: /^http(?:s)?:\/\/mobile\.yangkeduo\.com\/goods.html\?.*$/i,
    query: ['goods_id'],
  },
  'trello.com': {/* trello.com */
    testReg: /^http(?:s)?:\/\/(?:www\.)?trello\.com\/(\w)\/(\w+)(\/.*$|$)/i,
    replace: 'https://trello.com/$1/$2',
    hash: true,
  },
  'other': {/* All url */
    testReg: /^(http(?:s)?:\/\/[^?#]*)[?#].*$/i,
    query: ['id', 'tid', 'uid', 'q', 'wd', 'query', 'keyword', 'keywords'],
  }
}
/**
 * 主功能代码
 * version 0.0.1
 * update 2020-09-01 07:07:37
 */
function dms_get_pure_url (url=window.location.href) {
  const hash = url.replace(/^[^#]*(#.*)?$/, '$1')
  const base = url.replace(/(\?|#).*$/, '')
  let pureUrl = url
  const getQueryString = function(key) {
    let ret = url.match(new RegExp('(?:\\?|&)(' + key + '=[^?#&]*)', 'i'))
    return ret === null ? '' : ret[1]
  }
  /* 链接处理方法 */
  const methods = {
    decodeUrl: function(url){return decodeURIComponent(url) }
  }
  for(let i in rules){
    let rule = rules[i]
    let reg = rule.testReg
    let replace = rule.replace
    if (reg.test(url)){
      let newQuerys = ''
      if(typeof(rule.query)!=='undefined' && rule.query.length>0){
        rule.query.map((query) => {
          const ret = getQueryString(query)
          if(ret !== ''){
            newQuerys += (newQuerys.length ? '&' : '?') + ret
          }
        })
      }
      newQuerys += typeof(rule.hash)!=='undefined' && rule.hash
                   ? hash
                   : ''
      pureUrl = (typeof(replace)==='undefined'?base:url.replace(reg, replace) ) + newQuerys
      if(typeof(rule.methods)!=='undefined' && rule.methods.length>0){
        rule.methods.map((methodName)=>{
          pureUrl = methods[methodName](pureUrl)
        })
      }
      break
    }
  }
  return pureUrl
}
/** 必须函数 */
/* 弹出通知 */
const dmsCLNotification = function (text) {
  GM_notification(text, 'Success! by 链接地址洗白白');
};
/* 复制净化后的链接和标题 */
const getCleanUrlAndTitle = () => {
  const pureUrl = dms_get_pure_url();
  const ttileAndUrl = document.title + ' \n' + pureUrl;
  GM_setClipboard(ttileAndUrl);
  dmsCLNotification('链接地址已净化，并和网站标题一起复制到剪切板中~');
};
/* 复制净化后的链接 */
const getCleanUrl = () => {
  const pureUrl = dms_get_pure_url();
  GM_setClipboard(pureUrl);
  dmsCLNotification('链接地址已净化并复制到剪切板中~');
};
/* 直接复制页面链接和标题 */
const getUrlAndTitle = () => {
  const theUrl = document.title + ' \n' + window.location.href;
  GM_setClipboard(theUrl);
  dmsCLNotification('网站标题 & 链接地址已复制到剪切板中~');
  dmsLCToggleEl(panel);
};
/* 复制当前页面链接 */
const getUrlOnly = () => {
  const theUrl = window.location.href;
  GM_setClipboard(theUrl);
  dmsCLNotification('链接地址已复制到剪切板中~');
  dmsLCToggleEl(panel);
};
/* 清理整个页面 */
const cleanAllPage = () => {
  const aTagEles = document.getElementsByTagName('a');
  for (let i = 0; i < aTagEles.length; i++) {
    let theLink = aTagEles[i].href;
    if (theLink.match(/^(http:\/\/|https:\/\/|\/\/)/) !== null) {
      theLink = theLink.replace(/^\/\//, 'https://');
      aTagEles[i].href = dms_get_pure_url(theLink);
    }
  }
  panel.style.display = '';
  dmsCLNotification(
    '页面中所有链接已净化~\n可能导致部分链接无法使用，刷新后恢复。'
  );
  dmsLCToggleEl(panel);
};

/** 获取是否显示页面工具栏 **/
let isShowPageBar = GM_getValue('SHow_page_bar', true);

/* 注册菜单项 */
GM_registerMenuCommand('复制【净化】链接和标题', getCleanUrlAndTitle);
GM_registerMenuCommand('复制【净化】链接', getCleanUrl);
GM_registerMenuCommand('【净化】所有链接', cleanAllPage);
GM_registerMenuCommand('复制【当前】链接和标题', getUrlAndTitle);
GM_registerMenuCommand('复制【当前】链接', getUrlOnly);
GM_registerMenuCommand('显示/隐藏页面工具条', () => {
  GM_setValue('SHow_page_bar', !isShowPageBar);
  isShowPageBar = GM_getValue('SHow_page_bar', true);
  alert(
    '页面工具条已被设置为【' +
      (isShowPageBar ? '显示' : '隐藏') +
      '】，仅在此后新打开页面中生效。'
  );
});

if (isShowPageBar) {
  /** 添加样式 **/
  GM_addStyle(`
  #dms-link-cleaner {
  width: 100%;
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 99999999;
  pointer-events: none;
}
#dms-link-cleaner * {
  pointer-events: auto;
}
#dms-lc-button {
  position: relative;
  margin: 0 auto;
  width: 24px;
  height: 12px;
  color: rgba(0, 0, 0, .3);
  font-size: 12px;
  line-height: 10px;
  cursor: pointer;
  text-align: center;
  border: 1px solid #AAA;
  border-radius: 12px 12px 0 0;
  background-color: rgba(255, 255, 255, .3);
  box-shadow: 0 0 5px rgba(0, 0, 0, .1);
}
#dms-lc-button:hover {
  color: rgba(0, 0, 0, .8);
  background-color: rgba(255, 255, 255, 0.8);
}
#dms-lc-panel {
  display: none;
  border-top: 5px solid #65adff;
  background-color: #FFF;
  box-shadow: 0 0 5px rgba(0, 0, 0, .1);
}
#dms-lc-panel > #dms-lc-panel-content {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1 1 none;
  flex-wrap: wrap;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 0;
  text-align: center;
  position: relative;
}
#dms-lc-panel > #dms-lc-panel-content > .dms-lc-button {
  position: relative;
  padding: 8px 16px;
  margin: 0 8px 0 0;
  font-size: 16px;
  line-height: 1.2em;
  font-weight: lighter;
  border: 1px solid #65adff;
  border-radius: 8px;
  cursor: pointer;
}
#dms-lc-panel > #dms-lc-panel-content > .dms-lc-button:hover {
  border: 1px solid #0062d1;
  background-color: #0062d1;
  color: #FFF;
  font-weight: normal;
}
#dms-lc-panel > #dms-lc-panel-content > .dms-lc-button:hover::before {
  content: attr(data-tip);
  background-color: rgba(0, 0, 0, .9);
  border-radius:3px;
  color: #fff;
  padding: 10px;
  position: absolute;
  width: calc(100% + 20px);
  left: 50%;
  bottom: calc(100% + 10px);
  margin-left: calc(-50% - 20px);
  white-space: pre;
}
#dms-lc-panel > #dms-lc-panel-content > .dms-lc-button:hover::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: calc(50% - 8px);
  top: -10px;
  border-top: 8px solid rgba(0, 0, 0, .8);
  border-right: 8px solid transparent;
  border-left: 8px solid transparent;
}
#dms-lc-panel > #dms-lc-panel-content > .dms-lc-hr {
  width: 100%;
  margin: 5px 0;
}
  `);
  /** 添加界面 **/
  const dmsLCPopPanel = document.createElement('div');
  dmsLCPopPanel.id = 'dms-link-cleaner';
  dmsLCPopPanel.innerHTML = `<div id="dms-lc-button">
  ︽
</div>
<div id="dms-lc-panel">
  <div id="dms-lc-panel-content">
    <div class="dms-lc-button" id="dmsCLButtonTitle" data-tip="复制当前网页标题和净化后的链接">
      复制净化链接和标题
    </div>
    <div class="dms-lc-button" id="dmsCLButtonPure" data-tip="只复制净化后的链接，不包含标题">
      复制净化链接
    </div>
    <div class="dms-lc-hr"></div>
    <div class="dms-lc-button" id="dmsCLButtonCopyTitle" data-tip="复制当前网页标题和原始链接">
      复制原始链接和标题
    </div>
    <div class="dms-lc-button" id="dmsCLButtonCopyLink" data-tip="只复制当前网页的原始链接">
      复制原始链接
    </div>
    <div class="dms-lc-hr"></div>
    <div class="dms-lc-button" id="dmsCLButtonCleanAll" data-tip="净化本页面中所有可识别的链接">
      净化页面所有链接
    </div>
  </div>
</div>`;
  document.body.insertBefore(
    dmsLCPopPanel,
    document.body.lastChild.nextSibling
  );

  /** 事件响应函数 **/

  /* 定义元素 */
  const button = document.getElementById('dms-lc-button');
  const panel = document.getElementById('dms-lc-panel');

  const buttonTitle = document.getElementById('dmsCLButtonTitle');
  const buttonPure = document.getElementById('dmsCLButtonPure');

  const buttonCopyT = document.getElementById('dmsCLButtonCopyTitle');
  const buttonCopyL = document.getElementById('dmsCLButtonCopyLink');

  const buttonCleanLink = document.getElementById('dmsCLButtonCleanAll');

  /**
   * 面板切换
   */
  const dmsLCToggleEl = function (el) {
    const elStyle = getComputedStyle(el, '');
    if (elStyle.display === 'none') {
      el.style.display = 'block';
    } else {
      el.style.display = '';
    }
  };

  /** 添加监听器 **/
  /* 面板切换按钮 */
  button.addEventListener(
    'click',
    () => {
      dmsLCToggleEl(panel);
    },
    false
  );
  /* 净化并复制标题和链接 */
  buttonTitle.addEventListener('click', getCleanUrlAndTitle, false);
  /* 净化并复制链接 */
  buttonPure.addEventListener('click', getCleanUrl, false);
  /* 复制当前链接和标题 */
  buttonCopyT.addEventListener('click', getUrlAndTitle, false);
  /* 复制当前链接 */
  buttonCopyL.addEventListener('click', getUrlOnly, false);
  /* 清理整个页面 */
  buttonCleanLink.addEventListener('click', cleanAllPage, false);
  /* 全屏隐藏按钮 */
  document.addEventListener('fullscreenchange', function (event) {
    if (document.fullscreenElement) {
      button.style.display = 'none';
    } else {
      button.style.display = '';
    }
  });
}