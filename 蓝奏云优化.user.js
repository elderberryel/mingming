// ==UserScript==
// @name         蓝奏云优化
// @version      4.5
// @description  蓝奏云apk文件重定向域名，自动点击下载，记住分享密码自动填写
// @author       DeepSeek
// @include      *.lanosso.com/*
// @include      *.lanzn.com/*
// @include      *.lanzog.com/*
// @include      *.lanpw.com/*
// @include      *.lanpv.com/*
// @include      *.lanzv.com/*
// @include      *://*.lanz*.com/*
// @include      *://lanz*.com/*
// @run-at       document-end
// @grant        none
// @namespace    https://greasyfork.org/users/452911
// @downloadURL https://update.greasyfork.org/scripts/489281/%E8%93%9D%E5%A5%8F%E4%BA%91%E4%BC%98%E5%8C%96.user.js
// @updateURL https://update.greasyfork.org/scripts/489281/%E8%93%9D%E5%A5%8F%E4%BA%91%E4%BC%98%E5%8C%96.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // 记录是否已经点击过，防止无限重复触发
    let isClickedM_Load = false;

    // ========== 1. iframe 跳转处理 ==========
    const iframes = document.getElementsByTagName('iframe');
    if (iframes.length > 0) {
        for (let i = 0; i < iframes.length; i++) {
            const iframeSrc = iframes[i].src;
            if (iframeSrc && iframeSrc !== 'about:blank') {
                window.location.href = iframeSrc;
                break;
            }
        }
    }

    // ========== 2. 修改链接属性（当前标签页打开） ==========
    function modifySingleLink(link) {
        if (link && link.setAttribute) {
            link.setAttribute('target', '_self');
        }
    }

    function modifyAllLinks() {
        const links = document.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
            modifySingleLink(links[i]);
        }
        
        // 处理base标签
        let base = document.getElementsByTagName('base')[0];
        if (base) {
            base.setAttribute('target', '_self');
        } else {
            const head = document.getElementsByTagName('head')[0];
            const newBase = document.createElement('base');
            newBase.setAttribute('target', '_self');
            head.appendChild(newBase);
        }
    }

    modifyAllLinks();

    // ========== 3. 重定向域名（会员页面） ==========
    if (document.body.innerText.includes('会员')) {
        if (!window.location.href.includes('https://www.lanzn.com/')) {
            const currentUrl = new URL(window.location.href);
            currentUrl.hostname = 'www.lanzn.com';
            window.location.href = currentUrl.toString();
            return;
        }
    }

    // ========== 4. 自动下载功能 ==========
    const selectorsToClick = [
        'a.txt',
        'a.appa',
        'a[href^="/tp/"]'
    ];

    function performAutoClick() {
        // 如果页面存在密码输入框且尚未输入密码，则不触发普通的自动下载逻辑，先等待用户输入
        const pwdInput = document.getElementById('pwd');
        if (pwdInput && !pwdInput.value) {
            // 如果密码框未显示，可以帮用户自动展开密码框
            const pwdContainer = document.getElementById('f_pwd');
            if (pwdContainer && pwdContainer.style.display === 'none') {
                const filegoLink = document.querySelector('a[href="javascript:filego();"]');
                if (filegoLink) filegoLink.click();
            }
            return false; 
        }

        let clicked = false;
        
        selectorsToClick.forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                link.click();
                clicked = true;
            });
        });
        
        document.querySelectorAll('a[href*="/file/"]').forEach(link => {
            link.click();
            clicked = true;
        });
        
        if (!isClickedM_Load) {
            const mLoadLink = document.querySelector("[onclick='m_load();'] > a");
            if (mLoadLink && mLoadLink.getAttribute('href') !== 'javascript:filego();') {
                mLoadLink.click();
                isClickedM_Load = true;
                clicked = true;
            }
        }
        
        return clicked;
    }

    let hasClicked = performAutoClick();
    if (!hasClicked) {
        setTimeout(() => {
            performAutoClick();
        }, 500);
    }

    // ========== 5. 提取并跳转URL (已修复正则死循环漏洞) ==========
    function extractAndNavigateURL() {
        const htmlSource = document.documentElement.innerHTML;
        
        // 方式一：vkjxld + hyggid （使用 \b 单词边界精确匹配变量名，防止误伤混淆代码导致死循环）
        const vkjxldMatch = htmlSource.match(/\bvar\s+vkjxld\s*=\s*['"]([^'"]+)['"];/);
        const hyggidMatch = htmlSource.match(/\bvar\s+hyggid\s*=\s*['"]([^'"]+)['"];/);
        
        if (vkjxldMatch && hyggidMatch) {
            const completeURL = vkjxldMatch[1] + hyggidMatch[1];
            window.location.href = completeURL;
            return;
        }
        
        // 方式二：urlpt + link
        const urlptMatch = htmlSource.match(/\bvar\s+urlpt\s*=\s*['"]([^'"]+)['"];/);
        const linkMatch = htmlSource.match(/\bvar\s+link\s*=\s*['"]([^'"]+)['"];/);
        
        if (urlptMatch && linkMatch) {
            let urlptValue = urlptMatch[1];
            if (urlptValue === '/') urlptValue = window.location.origin;
            const completeURL = urlptValue + '/' + linkMatch[1];
            window.location.href = completeURL;
        }
    }

    extractAndNavigateURL();

    // ========== 6. 记住密码功能 ==========
    function passwordManager() {
        function init() {
            retrieveAndFill();
        }

        function retrieveAndFill() {
            document.querySelectorAll('input[type="text"], textarea, input[type="password"]').forEach(function(element) {
                const id = getElementIdentifier(element);
                const storedValue = localStorage.getItem(id);
                if (storedValue) {
                    element.value = storedValue;
                    // 如果自动填入了密码，尝试自动执行网页自带的验证函数
                    if(element.id === 'pwd' && typeof window.pwd === 'function') {
                        setTimeout(() => { window.pwd(); }, 300);
                    }
                }
            });
        }

        function handleInputChange(event) {
            const element = event.target;
            const id = getElementIdentifier(element);
            localStorage.setItem(id, element.value);
        }

        function getElementIdentifier(element) {
            let identifier = window.location.hostname + window.location.pathname;
            identifier += ':' + (element.name || element.id || element.className || getXPathForElement(element));
            return identifier;
        }

        function getXPathForElement(element) {
            const paths = [];
            for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
                let index = 0;
                let hasFollowingSiblings = false;
                for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                    if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                    if (sibling.nodeName === element.nodeName) ++index;
                }
                for (let sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
                    if (sibling.nodeName === element.nodeName) hasFollowingSiblings = true;
                }
                const tagName = element.nodeName.toLowerCase();
                const pathIndex = (index || hasFollowingSiblings ? "[" + (index + 1) + "]" : "");
                paths.splice(0, 0, tagName + pathIndex);
            }
            return paths.length ? "/" + paths.join("/") : null;
        }

        document.querySelectorAll('input[type="text"], textarea, input[type="password"]').forEach(function(element) {
            element.removeEventListener('input', handleInputChange);
            element.addEventListener('input', handleInputChange);
        });

        init();
    }

    passwordManager();

    // ========== 7. 会员文件提示 ==========
    const fbox = document.querySelector('div.fbox');
    if (fbox) {
        fbox.textContent = "会员文件，需要开桌面模式下载";
    }

    // ========== 8. 统一的 MutationObserver（监听新增元素） ==========
    const observer = new MutationObserver(function(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    
                    // 8.1 处理新增的 a 标签本身
                    if (node.tagName && node.tagName.toLowerCase() === 'a') {
                        modifySingleLink(node);
                        
                        // 检查是否需要自动点击
                        if (node.href && node.href.includes('/file/')) {
                            node.click();
                        }
                    }
                    
                    // 8.2 扫描新增节点内部的所有 a 标签
                    if (node.querySelectorAll) {
                        const linksInside = node.querySelectorAll('a');
                        linksInside.forEach(link => {
                            modifySingleLink(link);
                            
                            // 检查是否需要自动点击
                            if (link.href && link.href.includes('/file/')) {
                                link.click();
                            }
                        });
                        
                        // 8.3 扫描新增节点内部的输入框，绑定密码记忆
                        const inputsInside = node.querySelectorAll('input[type="text"], textarea, input[type="password"]');
                        inputsInside.forEach(input => {
                            const id = (function() {
                                let identifier = window.location.hostname + window.location.pathname;
                                identifier += ':' + (input.name || input.id || input.className || '');
                                return identifier;
                            })();
                            
                            const storedValue = localStorage.getItem(id);
                            if (storedValue) {
                                input.value = storedValue;
                            }
                            
                            input.removeEventListener('input', passwordManager.handleInputChange);
                            input.addEventListener('input', function(e) {
                                const el = e.target;
                                const id2 = (function() {
                                    let identifier = window.location.hostname + window.location.pathname;
                                    identifier += ':' + (el.name || el.id || el.className || '');
                                    return identifier;
                                })();
                                localStorage.setItem(id2, el.value);
                            });
                        });
                    }
                });
                
                // 8.4 检查 m_load 链接（加入状态锁及密码状态判定）
                if (!isClickedM_Load) {
                    const pwdInput = document.getElementById('pwd');
                    if (!pwdInput || pwdInput.value) { // 没有密码框，或者密码框已填入值时才允许点击
                        const mLoadLink = document.querySelector("[onclick='m_load();'] > a");
                        if (mLoadLink && mLoadLink.getAttribute('href') !== 'javascript:filego();') {
                            isClickedM_Load = true;
                            mLoadLink.click();
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
