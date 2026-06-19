// ==UserScript==
// @name        X视频/原始图片/gif一键下载
// @namespace   http://limbopro.com/
// @version     1.0.0
// @author      limbopro
// @license     MIT
// @description 为 Twitter/X 推文添加一键下载视频、原始图片和 GIF 的功能，支持多图打包为 ZIP，兼容移动端与 PC 端
// @homepageURL https://limbopro.com/Adguard/twdl.user.js
// @supportURL  https://github.com/limbopro
// @match       https://twitter.com/*
// @match       https://x.com/*
// @match       https://twittervideodownloader.com/*
// @match       https://twittervid.com/*
// @match       https://tweeload.com/*
// @match       https://twittervideomp4.com/zh-tw/*
// @match       https://twittervideomp4.com/*
// @icon        https://www.google.com/s2/favicons?sz=64&domain=twitter.com
// @require     https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @grant       none
// @downloadURL https://update.greasyfork.org/scripts/478651/TwitterX%28%E7%BD%91%E9%A1%B5%E7%89%88%29%E8%A7%86%E9%A2%91%E5%8E%9F%E5%A7%8B%E5%9B%BE%E7%89%87gif%E4%B8%80%E9%94%AE%E4%B8%8B%E8%BD%BD%5Blimbopro%5D.user.js
// @updateURL   https://update.greasyfork.org/scripts/478651/TwitterX%28%E7%BD%91%E9%A1%B5%E7%89%88%29%E8%A7%86%E9%A2%91%E5%8E%9F%E5%A7%8B%E5%9B%BE%E7%89%87gif%E4%B8%80%E9%94%AE%E4%B8%8B%E8%BD%BD%5Blimbopro%5D.meta.js
// ==/UserScript==

/*
@ author: limbopro
@ website: http://limbopro.com/
@ Gmail: service.limbopro.com@gmail.com
@ Github: https://github.com/limbopro
@ X: https://x.com/limboprossr
*/

// 引入全局 CSS
var twdlcss_pc = ".twdlimgs {cursor:pointer;} #custom-alert p {color:black;font-size:inherit;} .twdlContainerDown > a {padding:4px 0px 4px 0px} .twdlContainerDown {display:grid;gap:1px;} .twdlhidden {cursor:pointer; background: #adb5bd;/*#6c757d;*/} .twdlhidden:hover {cursor:pointer; background-color: #6c757d;/*#adb5bd;*/ transition: 0.7s;}  .twdlshare { background: #8a63d2; /*background: #6f42c1;*/}  .twdlshare:hover {background:rgb(105, 42, 223);/*#8a63d2;*/transition: 0.7s;} div.contentBox,ins.adsbygoogle[data-ad-slot],ins.adsbygoogle[data-ad-client] {display:none !important;}, span[id^=\"ezoic-pub-ad-placeholder-\"], .ez-sidebar-wall, span[data-ez-ph-id], .ez-sidebar-wall-ad,.ez-sidebar-wall {display:none !important} .download_pics:hover { font-weight:bolder; background:rgb(0, 21, 255); /*background-color: #339dff;*/ transition: 0.7s;} .atx {display:none;} .houseab {position:absolute;top:5%;} .house { background-color:inherit; gap:1px;opacity:0.5;font-size:xx-small;z-index:114154 !important; max-width:235px; display:flex; flex-direction:row; flex-wrap:wrap; margin-top:5px;} .help{top:80px !important;/*background:teal;*/} .house:hover {opacity:1;font-size:xx-small;z-index:114154 !important; max-width:235px; display:flex; flex-direction:row; flex-wrap:wrap; margin-top:5px;} .help{background: #6c757d; top:80px !important;/*background:teal;*/} .twdl { border:0px; text-align:center; width:75px; align-content: center; z-index:114154 !important; line-height:normal; /*font-size:xx-small;*/ font-size:inherit; text-decoration:none; position:sticky; top:5px; /*text-transform:uppercase;*/ padding:4px 8px; color:white; z-index:114154;} .twittervideodownloader {background:#28a745;} .twittervideodownloader:hover {background-color: #5dd17a; transition: 0.7s;} .twittervid {background:linear-gradient(to bottom, #66BB6A 0%, #43A047 100%); box-shadow:inset 0 2px 2px #388E3C;} .twee {background: #28a745;} .twee:hover { background-color: #5dd17a; /* 更亮的颜色 */ transition: 0.7s;} .download_pics {font-weight:bolder; background-color: #339dff; /*background: #007bff;*/} .greasyfork {cursor:help; right:295px;background:linear-gradient(rgb(62 53 53) 0%, rgb(31 29 29) 100%);box-shadow:rgb(0 0 0) 0px 2px 2px inset;}"
var twdlcss_mobile = ".twdlimgs {cursor:pointer;} #custom-alert p {color:black;font-size:inherit;} .twdlContainerDown > a {padding:4px 0px 4px 0px} .twdlContainerDown {display:grid;gap:1px;} .twdlhidden {cursor:pointer; background: #adb5bd;/*#6c757d;*/} .twdlhidden:hover {cursor:pointer; background-color: #6c757d;/*#adb5bd;*/ transition: 0.7s;}  .twdlshare {background: #8a63d2; /*background: #6f42c1;*/} .twdlshare:hover {background: rgb(105, 42, 223); /*#8a63d2;*/transition: 0.7s;}  div.contentBox,ins.adsbygoogle[data-ad-slot],ins.adsbygoogle[data-ad-client] {display:none !important;}, span[id^=\"ezoic-pub-ad-placeholder-\"], .ez-sidebar-wall, span[data-ez-ph-id], .ez-sidebar-wall-ad,.ez-sidebar-wall {display:none !important} .download_pics:hover {font-weight:bolder; background:rgb(0, 21, 255); /*background-color: #339dff;*/ transition: 0.7s;} .atx {display:none;} .house { background-color:inherit; gap:1px;opacity:0.5;font-size:xx-small;z-index:114154 !important; max-width:235px; display:flex; flex-direction:row; flex-wrap:wrap; margin-top:5px;} .house:hover {opacity:1;font-size:xx-small;z-index:114154 !important; max-width:235px; display:flex; flex-direction:row; flex-wrap:wrap; margin-top:5px;} .help{background: #6c757d; top:80px !important;/*background:teal;*/} .help{ background: #6c757d; top:80px !important;/*background: teal;*/} .twdl { border:0px; text-align:center; width:75px; align-content: center; z-index:114154 !important; line-height:normal; /*font-size:xx-small;*/ font-size:inherit; text-decoration:none; position:sticky; top:5px; /*text-transform:uppercase;*/ padding:6px 12px; color:white; z-index:114154;} .twittervideodownloader {background:#28a745;} .twittervideodownloader:hover {background-color: #5dd17a; transition: 0.7s;} .twittervid {background:linear-gradient(to bottom, #66BB6A 0%, #43A047 100%); box-shadow:inset 0 2px 2px #388E3C;} .twee {background: #28a745;} .twee:hover { background-color: #5dd17a; /* 更亮的颜色 */ transition: 0.7s;} .download_pics {font-weight:bolder; background-color: #339dff; /*background: #007bff;*/} .greasyfork {cursor:help; right:295px;background:linear-gradient(rgb(62 53 53) 0%, rgb(31 29 29) 100%);box-shadow:rgb(0 0 0) 0px 2px 2px inset;}"
var newstyle = document.createElement('style')
newstyle.id = 'twdlcss'

if (window.navigator.userAgent.toLowerCase().indexOf('mobile') !== -1) {
    newstyle.innerHTML = twdlcss_mobile
} else {
    newstyle.innerHTML = twdlcss_pc
}
document.querySelector('head').parentNode.insertBefore(newstyle, document.querySelector('head'))

var twURL_regex = new RegExp(/^https:\/\/x\.com\/.*?\/status\/\d{10,100}$/gi)

function twdl_div(article, downloaderURL, className, textContent) {
    let a = document.createElement('a')
    article.querySelectorAll('a').forEach((x) => {
        if (x.href.match(twURL_regex)) {
            a.href = downloaderURL + "#" + x.href;
        }
    })
    a.className = className;
    a.target = '_blank';
    a.zIndex = '114154';
    a.textContent = textContent;
    return a;
}

var twdl_Kurl = '';
var twURL_regex = new RegExp(/\b^https:\/\/x\.com\/.*?\/status\/\d{10,100}\b/gi)

function twdl_url(article) {
    article.querySelectorAll('a').forEach((x) => {
        var length = x.href.length
        if (x.href.replace(twURL_regex, '').length < length) {
            twdl_Kurl = x.href.match(twURL_regex)[0]
        }
    })
    return twdl_Kurl;
}

function iftwnopics_innerText() {
    return "该推文内容不存在图片!";
}

function downloader_innerText() {
    return "⏬ 视频下载";
}

function dlpics_innerText() {
    return "⏬ 图片下载";
}

function showCustomAlert(message) {
    if (document.getElementById('custom-alert')) return;
    const alertBox = document.createElement('div');
    alertBox.id = 'custom-alert';
    alertBox.style.position = 'fixed';
    alertBox.style.top = '50%';
    alertBox.style.left = '50%';
    alertBox.style.transform = 'translate(-50%, -50%)';
    alertBox.style.backgroundColor = '#fff';
    alertBox.style.padding = '20px';
    alertBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    alertBox.style.zIndex = '1000';
    alertBox.style.textAlign = 'center';
    const messageText = document.createElement('p');
    messageText.textContent = message;
    alertBox.appendChild(messageText);
    const closeButton = document.createElement('button');
    closeButton.textContent = '确认';
    closeButton.style.marginTop = '10px';
    closeButton.style.padding = '10px 20px';
    closeButton.style.border = 'none';
    closeButton.style.backgroundColor = '#007BFF';
    closeButton.style.color = '#fff';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => {
        document.body.removeChild(alertBox);
    };
    alertBox.appendChild(closeButton);
    document.body.appendChild(alertBox);
}

function loadImageAsBlob(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
                canvas.remove();
                resolve(blob);
            }, 'image/jpeg', 1.0);
        };
        img.onerror = () => resolve(null);
    });
}

function dlpicsfromURL(imgsrcURL, userName, article, nickName) {
    console.log(nickName + ' ' + userName + ' ' + imgsrcURL);

    // 过滤掉无效 URL
    const validUrls = imgsrcURL.filter(url => url && url.trim() !== '');
    if (validUrls.length === 0) {
        showCustomAlert(iftwnopics_innerText());
        return;
    }

    const safeUserName = userName || 'image';
    const baseName = nickName || userName || 'twitter_images';

    // 单张图片：直接下载，不打包
    if (validUrls.length === 1) {
        (async () => {
            try {
                const blob = await loadImageAsBlob(validUrls[0]);
                if (blob) {
                    const filename = safeUserName + '.1.jpg';
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(downloadUrl);
                    console.log('单张图片直接下载完成:', filename);
                } else {
                    console.warn('图片加载失败:', validUrls[0]);
                }
            } catch (e) {
                console.warn('下载图片失败:', e);
            }
        })();
        return;
    }

    // 多张图片：打包为 ZIP
    (async () => {
        const zip = new JSZip();
        const zipName = baseName + '-' + formatTimetoNumber() + '.zip';
        let successCount = 0;
        for (let i = 0; i < validUrls.length; i++) {
            try {
                const blob = await loadImageAsBlob(validUrls[i]);
                if (blob) {
                    const filename = safeUserName + '.' + (i + 1) + '.jpg';
                    zip.file(filename, blob);
                    successCount++;
                }
            } catch (e) {
                console.warn('图片加载失败:', validUrls[i], e);
            }
        }
        if (successCount === 0) {
            showCustomAlert(iftwnopics_innerText());
            return;
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        console.log(`已打包 ${successCount} 张图片为 ${zipName}`);
    })();
}

function formatTimetoNumber() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const currentPureNumber =
        now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());
    console.log(currentPureNumber);
    return currentPureNumber;
}

function get_imgsURL(article, userName) {
    var url = [];
    var large_regex = new RegExp(/name=.*/ig)
    article.querySelectorAll('a[class=' + userName + ']').forEach((x) => {
        url.push((x.toString().replace(large_regex, 'name=4096x4096')))
    })
    url.forEach((x) => {
        console.log('get_imgsURL ->' + x)
    })
    return url;
}

var regex_name = new RegExp(/\/status\/\d{10,100}.*/gi)
var twURL_regex = new RegExp(/\b^https:\/\/x\.com\/.*?\/status\/\d{10,100}\b/gi)

function userName(article, nickName) {
    var fileName = '';
    if (nickName !== 'nickName') {
        article.querySelectorAll('a').forEach((x) => {
            if (x.href.match(twURL_regex)) {
                fileName = x.href.replaceAll('https://x.com/', '').replaceAll(regex_name, '')
            }
        })
    } else {
        if (article.querySelectorAll('a')[1].textContent !== '') {
            fileName = article.querySelectorAll('a')[1].textContent.replaceAll('.', '')
        } else {
            fileName = article.querySelectorAll('a')[2].textContent.replaceAll('.', '')
        }
        console.log('fileName: ' + fileName)
    }
    return fileName;
}

async function twdl() {
    if (document.querySelectorAll('[data-testid="cellInnerDiv"]')) {
        var large_regex = new RegExp(/name=.*/ig)
        var article = document.querySelectorAll('[data-testid="cellInnerDiv"]')
        for (let i = 0; i < article.length; i++) {
            if (article[i].querySelector('.house') == null && (article[i].querySelector('[data-testid="videoPlayer"]') || article[i].querySelectorAll('[dir=auto][lang]')[0] || article[i].querySelectorAll("img[src*='name=']").length >= 1)) {
                var house = document.createElement('div')
                house.className = 'house'

                var loader_ = twdl_div(article[i], 'https://twittervideodownloader.com/', 'twdl download_pics', downloader_innerText())
                var twee = twdl_div(article[i], 'https://tweeload.com/', 'twdl download_pics', downloader_innerText())
                var twittervideomp = twdl_div(article[i], 'https://twittervideomp4.com/', 'twdl download_pics', downloader_innerText())

                var imgsdownloader = document.createElement('a')
                imgsdownloader.className = 'twdl download_pics twdlimgs'
                imgsdownloader.innerText = dlpics_innerText()

                article[i].querySelectorAll("img[src*='name=']").forEach((x) => {
                    var a = document.createElement('a')
                    a.href = x.src
                    a.className = "twdl_" + userName(article[i])
                    house.appendChild(a)
                    console.log("图片地址: " + a.href)
                })

                var twdlContainerDown = document.createElement('div')
                twdlContainerDown.className = 'twdlContainerDown'

                var arrayContainer = [imgsdownloader, loader_, twee, twittervideomp]
                arrayContainer.forEach((x) => {
                    twdlContainerDown.appendChild(x)
                })

                house.appendChild(twdlContainerDown)

                if (article[i].querySelectorAll("div.css-17502r.r-12kyg2d")[0] && article[i].querySelector('[data-testid="videoPlayer"]') && article[i].querySelectorAll('[dir=auto][lang]')[0] == undefined) {
                    article[i].querySelector('[data-testid="videoPlayer"]').parentElement.parentElement.appendChild(house);
                    console.log('//x 推文存在文字图片且有视频的情况下')
                } else if (article[i].querySelectorAll('[dir=auto][lang]')[0] && article[i].querySelector('[data-testid="videoPlayer"]')) {
                    article[i].querySelectorAll('[dir=auto][lang]')[0].parentElement.appendChild(house);
                    console.log('//x 推文存在文字且有视频的情况下')
                } else if (article[i].querySelector('[data-testid="videoPlayer"]')) {
                    article[i].querySelector("[data-testid='videoComponent']").appendChild(house);
                    console.log('//x 推文没有文字图片仅有视频的情况下')
                } else if (article[i].querySelectorAll('[dir=auto][lang]')[0] && article[i].querySelectorAll("img[src*='name=']").length >= 1) {
                    article[i].querySelectorAll('[dir=auto][lang]')[0].parentElement.appendChild(house);
                    article[i].querySelectorAll("img[src*='name=']").forEach((x) => {
                        x.src = x.src.replace(large_regex, 'name=4096x4096')
                        console.log('4096x4096')
                    })
                } else if (article[i].querySelectorAll("img[src*='name=']").length >= 1 && article[i].querySelectorAll("img")[1] !== null) {
                    house.classList.add('houseab');
                    article[i].querySelectorAll("div[aria-labelledby]")[0].parentNode.insertBefore(house, article[i].querySelectorAll("div[aria-labelledby]")[0].nextElementSibling)
                    article[i].querySelectorAll("img[src*='name=']").forEach((x) => {
                        x.src = x.src.replace(large_regex, 'name=4096x4096')
                        console.log('//x name=4096x4096')
                    })
                    console.log('//x 只有图片的情况下')
                } else {
                    article[i].querySelectorAll('[dir=auto][lang]')[0].parentElement.append(house);
                    console.log('//x [dir=auto][lang]')
                }

                imgsdownloader.addEventListener('click', () => {
                    dlpicsfromURL(get_imgsURL(article[i], "twdl_" + userName(article[i])), userName(article[i]), '', userName(article[i], 'nickName'))
                })
            } else {
                console.log(userName(article[i]) + " " + twdl_url(article[i]) + " 啥也没有...")
            }
        }
    }
}

window.addEventListener('load', function () {
    console.log('页面加载成功🏅...')
    twdl()
});

window.onpopstate = function (event) {
    twdl()
    console.log("URL has changed!");
}

setInterval(() => {
    var scrollY = window.pageYOffset;
    setTimeout(() => {
        if (scrollY !== window.pageYOffset) {
            twdl()
            console.log('滚动条动了...')
        } else {
            console.log('滚动条未动...')
        }
    }, 2500)
}, 1500)

function inDownloaderPage() {
    if (window.location.href.match(/(twittervid\.com)/gi)) {
        if (document.querySelector('#tweetUrl') !== null && document.querySelector('#loadVideos') !== null) {
            document.querySelector('#tweetUrl').value = window.location.href.replace('https://twittervid.com/#', '')
            if (document.querySelector('#tweetUrl').value == 'https://twittervid.com/') {
            } else if (document.querySelector('#tweetUrl').value.match(twURL_regex)) {
                document.querySelector('#loadVideos').click()
            }
        }
    }
    if (window.location.href.match(/(twittervideodownloader\.com)/gi)) {
        if (document.querySelector('#tweetURL') !== null && document.querySelector('#submitBtn') !== null) {
            document.querySelector('#tweetURL').value = window.location.href.replace('https://twittervideodownloader.com/#', '')
            if (document.querySelector('#tweetURL').value == 'https://twittervideodownloader.com/') {
            } else if (document.querySelector('#tweetUrl').value.match(twURL_regex)) {
                document.querySelector('#submitBtn').click()
            }
        }
    }
    if (window.location.href.match(/(tweeload\.com)/gi)) {
        setTimeout(() => {
            (function () {
                const urlHash = window.location.hash;
                if (urlHash && urlHash.includes('/status/')) {
                    const match = urlHash.match(/\/status\/(\d+)/);
                    if (match && match[1]) {
                        const statusId = match[1];
                        const newUrl = `https://tweeload.com/i/status/${statusId}`;
                        window.location.href = newUrl;
                    }
                }
            })();
        }, 1000)
    }
    if (window.location.href.match(/(twittervideomp4\.com)/gi)) {
        setTimeout(() => {
            if (document.querySelector('#txt-url') !== null && document.querySelector('button#btn-submit') !== null) {
                document.querySelector('#txt-url').value = window.location.href.replace('https://twittervideomp4.com/#', '')
                if (document.querySelector('#txt-url').value == 'https://twittervideomp4.com/') {
                } else if (document.querySelector('#txt-url').value.match(twURL_regex)) {
                    document.querySelector('button#btn-submit').click()
                }
            }
        }, 1000)
    }
}

if (window.location.href.match(/(twittervid\.com|twittervideodownloader|tweeload|twittervideomp4)/gi) !== null) {
    inDownloaderPage()
}