// ==UserScript==
// @name                      百度搜索深度净化器
// @namespace                 http://tampermonkey.net/
// @version                   3.1
// @description               智能移除百度搜索结果中的各类广告、相关搜索、热榜、百家号等，通过油猴菜单打开设置
// @author                    yagizaMJ
// @match                     *://www.baidu.com/*
// @icon                      https://www.baidu.com/favicon.ico
// @grant                     GM_registerMenuCommand
// @run-at                    document-idle
// @license                   MIT      yagizaMJ
// @website                   https://soujiaoben.org/#/s?id=576987&host=greasyfork
// ==/UserScript==



(function() {
    'use strict';

    // ================= 配置管理 =================
    const CONFIG_KEY = 'baidu_purifier_config';
    const defaultConfig = {
        ad: true,               // 1. 各类广告
        rightRelated: true,     // 2. 右侧相关搜索
        rightHot: true,         // 3. 右侧百度热榜
        rightHint: true,        // 4. 右侧百度保障提示
        rightBottomAd: true,    // 5. 右侧底部推广
        searchAlso: true,       // 6. 大家还在搜/都在搜
        bottomRelated: true,    // 7. 底部相关搜索
        baijiahao: true         // 8. 屏蔽百家号
    };

    // 配置项分组与标签定义
    const configStructure = [
        {
            groupName: "广告与推广",
            items: [
                { key: 'ad', label: '搜索结果广告' },
                { key: 'rightBottomAd', label: '右侧底部推广' }
            ]
        },
        {
            groupName: "右侧栏模块",
            items: [
                { key: 'rightRelated', label: '右侧相关搜索' },
                { key: 'rightHot', label: '右侧百度热榜' },
                { key: 'rightHint', label: '右侧保障提示' }
            ]
        },
        {
            groupName: "内容过滤",
            items: [
                { key: 'baijiahao', label: '屏蔽百家号来源' }
            ]
        },
        {
            groupName: "底部与推荐",
            items: [
                { key: 'searchAlso', label: '大家还在搜/都在搜' },
                { key: 'bottomRelated', label: '底部相关搜索' }
            ]
        }
    ];

    function getConfig() {
        let saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            try { return {...defaultConfig, ...JSON.parse(saved)}; }
            catch(e) { return {...defaultConfig}; }
        }
        return {...defaultConfig};
    }

    function saveConfig(cfg) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    }

    // ================= 油猴菜单与设置 UI =================
    let isPanelOpen = false;
    let needReload = false;

    function openSettingsPanel() {
        if (isPanelOpen) return;
        isPanelOpen = true;
        needReload = false;

        // 注入 CSS
        const style = document.createElement('style');
        style.id = 'bp-settings-style';
        style.textContent = `
            #bp-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.4); z-index: 999998;
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #bp-modal {
                background: #fff; width: 360px; border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden;
                display: flex; flex-direction: column;
            }
            #bp-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 15px 20px; border-bottom: 1px solid #e8e8e8;
            }
            #bp-header h3 { margin: 0; font-size: 16px; color: #333; }
            #bp-close-btn {
                background: none; border: none; font-size: 20px; color: #999;
                cursor: pointer; line-height: 1; padding: 0;
            }
            #bp-close-btn:hover { color: #333; }

            #bp-body { padding: 10px 0; max-height: 60vh; overflow-y: auto; }

            .bp-group-title {
                padding: 10px 20px 5px; margin: 0; font-size: 13px; color: #888; font-weight: 500;
            }
            .bp-switch-row {
                display: flex; justify-content: space-between; align-items: center;
                padding: 12px 20px; font-size: 14px; color: #333;
                transition: background 0.2s;
            }
            .bp-switch-row:hover { background: #f5f7fa; }

            .bp-switch {
                position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;
            }
            .bp-switch input { opacity: 0; width: 0; height: 0; }
            .bp-slider {
                position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
                background-color: #ccc; transition: .3s; border-radius: 22px;
            }
            .bp-slider:before {
                position: absolute; content: ""; height: 16px; width: 16px;
                left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .bp-switch input:checked + .bp-slider { background-color: #4e6ef2; }
            .bp-switch input:checked + .bp-slider:before { transform: translateX(18px); }
        `;
        document.head.appendChild(style);

        // 构建弹窗 DOM
        const overlay = document.createElement('div');
        overlay.id = 'bp-overlay';

        const modal = document.createElement('div');
        modal.id = 'bp-modal';

        // 头部
        const header = document.createElement('div');
        header.id = 'bp-header';
        const title = document.createElement('h3');
        title.textContent = '百度净化器 - 设置';
        const closeBtn = document.createElement('button');
        closeBtn.id = 'bp-close-btn';
        closeBtn.textContent = '✕';
        header.appendChild(title);
        header.appendChild(closeBtn);

        // 主体
        const body = document.createElement('div');
        body.id = 'bp-body';

        const cfg = getConfig();

        configStructure.forEach(group => {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'bp-group-title';
            groupTitle.textContent = group.groupName;
            body.appendChild(groupTitle);

            group.items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'bp-switch-row';

                const label = document.createElement('span');
                label.textContent = item.label;

                const switchContainer = document.createElement('label');
                switchContainer.className = 'bp-switch';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = cfg[item.key];
                input.dataset.key = item.key;

                const slider = document.createElement('span');
                slider.className = 'bp-slider';

                switchContainer.appendChild(input);
                switchContainer.appendChild(slider);

                row.appendChild(label);
                row.appendChild(switchContainer);
                body.appendChild(row);

                // 开关事件
                input.addEventListener('change', (e) => {
                    const currentCfg = getConfig();
                    currentCfg[e.target.dataset.key] = e.target.checked;
                    saveConfig(currentCfg);
                    needReload = true; // 标记需要刷新
                });
            });
        });

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 关闭事件
        const closePanel = () => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            isPanelOpen = false;
            if (needReload) location.reload(); // 有关闭改动则刷新
        };

        closeBtn.addEventListener('click', closePanel);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePanel();
        });
    }

    // 注册油猴菜单
    GM_registerMenuCommand('🧹 净化器设置', openSettingsPanel);


    // ================= 核心清理逻辑 =================
    function clearBaiduCrap() {
        const cfg = getConfig();

        // 1. 移除带有"广告"标签的推广内容
        if (cfg.ad) {
            const adLabels = document.querySelectorAll('.ec-tuiguang, .ecfc-tuiguang, span[data-tuiguang], a.m');
            adLabels.forEach(label => {
                const isAd = label.classList.contains('ec-tuiguang') ||
                             label.classList.contains('ecfc-tuiguang') ||
                             label.hasAttribute('data-tuiguang') ||
                             (label.tagName === 'A' && label.classList.contains('m') && label.textContent.trim() === '广告');

                if (isAd) {
                    let adContainer = label.closest('div[data-placeid]') ||
                                      label.closest('.EC_result') ||
                                      label.closest('.c-container') ||
                                      label.closest('.result');
                    if (adContainer) adContainer.remove();
                }
            });
        }

        // 2. 移除右侧"相关搜索"模块
        if (cfg.rightRelated) {
            document.querySelectorAll('[tpl="recommend_list_san"]').forEach(el => el.remove());
            document.querySelectorAll('.recommend-single-list_5TJKn').forEach(el => {
                let container = el.closest('.result-op') || el.closest('.cr-content');
                if (container) container.remove();
            });
        }

        // 3. 移除右侧"百度热榜"模块
        if (cfg.rightHot) {
            document.querySelectorAll('[tpl="right_toplist1"]').forEach(el => el.remove());
            document.querySelectorAll('.FYB_RD').forEach(el => {
                let container = el.closest('.result-op') || el.closest('.cr-content');
                if (container) container.remove();
            });
        }

        // 4. 移除右侧"百度保障为您搜索护航"提示框
        if (cfg.rightHint) {
            document.querySelectorAll('.hint_right_middle, [tpl="app/hint-head-top"]').forEach(el => {
                const container = el.closest('.hint_right_middle') || el;
                if (container) container.remove();
            });
        }

        // 5. 移除右侧底部"想在此推广您的产品吗"广告位
        if (cfg.rightBottomAd) {
            const rightBottomAd = document.querySelector('#con-right-bottom') || document.querySelector('.ad-widget-header');
            if (rightBottomAd) {
                const container = rightBottomAd.closest('#con-right-bottom') || rightBottomAd.closest('div[id^="m"]') || rightBottomAd;
                if (container) container.remove();
            }
        }

        // 6. 移除"大家还在搜" / "大家都在搜"模块
        if (cfg.searchAlso) {
            const searchAlsoNodes = document.evaluate(
                "//div[contains(text(), '大家还在搜') or contains(text(), '大家都在搜')]",
                document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null
            );
            for (let i = 0; i < searchAlsoNodes.snapshotLength; i++) {
                const node = searchAlsoNodes.snapshotItem(i);
                const container = node.closest('.c-container') || node.closest('.result-op') || node.closest('[class*="rg-upgrade"]');
                if (container) container.remove();
            }
        }

        // 7. 移除底部的"相关搜索"表格模块
        if (cfg.bottomRelated) {
            document.querySelectorAll('table[class*="rs-table"]').forEach(el => {
                const container = el.closest('.c-container') || el.closest('.result-op') || el.parentElement;
                if (container) container.remove();
            });
            const relatedSearchNodes = document.evaluate(
                "//div[contains(text(), '相关搜索') or contains(text(), '相关推荐')]",
                document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null
            );
            for (let i = 0; i < relatedSearchNodes.snapshotLength; i++) {
                const node = relatedSearchNodes.snapshotItem(i);
                if (node.closest('table[class*="rs-table"]') || node.querySelector('table[class*="rs-table"]')) {
                    const container = node.closest('.c-container') || node.closest('.result-op') || node.parentElement;
                    if (container) container.remove();
                }
            }
        }

        // 8. 屏蔽百家号来源的搜索结果
        if (cfg.baijiahao) {
            // 遍历所有可能的搜索结果卡片
            document.querySelectorAll('.c-container, .result').forEach(el => {
                // 检查底部显示的来源网址文本
                const showUrl = el.querySelector('.c-showurl');
                const isBaijiahaoText = showUrl && showUrl.textContent.includes('baijiahao.baidu.com');

                // 检查真实落地页链接 (标题或底部链接的 data-landurl 属性)
                const isBaijiahaoLandUrl = el.querySelector('a[data-landurl*="baijiahao.baidu.com"]');

                // 检查容器的 mu 属性 (部分卡片含有此属性标识来源)
                const isBaijiahaoMu = el.hasAttribute('mu') && el.getAttribute('mu').includes('baijiahao.baidu.com');

                // 满足以上任一条件，即视为百家号内容并移除
                if (isBaijiahaoText || isBaijiahaoLandUrl || isBaijiahaoMu) {
                    el.remove();
                }
            });
        }
    }

    // ================= 启动逻辑 =================
    clearBaiduCrap();

    let timer = null;
    const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(clearBaiduCrap, 150);
    });

    const wrapper = document.getElementById('wrapper') || document.body;
    observer.observe(wrapper, { childList: true, subtree: true });

})();