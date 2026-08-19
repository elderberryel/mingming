// ==UserScript==
// @name         套壳浏览器谷歌下载修复
// @version      2.5
// @description  修复套壳浏览器fonts.google.com，contacts.google.com，translate.google.com等无法下载的bug
// @author       undefined303
// @run-at       document-start
// @match        https://*.google.com/*
// @namespace   https://greasyfork.org/users/452911
// @grant        none
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/584378/%E5%A5%97%E5%A3%B3%E6%B5%8F%E8%A7%88%E5%99%A8%E8%B0%B7%E6%AD%8C%E4%B8%8B%E8%BD%BD%E4%BF%AE%E5%A4%8D.user.js
// @updateURL https://update.greasyfork.org/scripts/584378/%E5%A5%97%E5%A3%B3%E6%B5%8F%E8%A7%88%E5%99%A8%E8%B0%B7%E6%AD%8C%E4%B8%8B%E8%BD%BD%E4%BF%AE%E5%A4%8D.meta.js
// ==/UserScript==
(function(){
var downloadObj={};
var downloadTimeout;

// 辅助函数：根据 Data URI 的 MIME 类型获取常见图片后缀
function getExtensionFromDataURI(dataURI) {
    if (!dataURI || !dataURI.startsWith('data:')) return '';
    var match = dataURI.match(/^data:([^;]+);/);
    if (match && match[1]) {
        var mime = match[1].toLowerCase();
        if (mime === 'image/png') return '.png';
        if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
        if (mime === 'image/webp') return '.webp';
        if (mime === 'image/gif') return '.gif';
        if (mime === 'image/svg+xml') return '.svg';
    }
    return '';
}

// 辅助函数：将 Data URI 转回 Blob（解决部分套壳浏览器下载 href="data:..." 时文件名失效的Bug）
function dataURIToBlob(dataURI) {
    try {
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {type: mimeString});
    } catch(e) {
        return null;
    }
}

// 原生下载替代方案
function nativeDownload(fileName, fileData) {
    if (!fileData) return;

    // 如果文件名存在，且没有点号（即没有后缀名），尝试根据数据流补全
    if (fileName && !fileName.includes('.')) {
        var ext = getExtensionFromDataURI(fileData);
        fileName = fileName + ext;
    }
    
    // 如果依然没有文件名，或者文件名包含了浏览器的异常前缀，给一个默认名字
    if (!fileName || fileName.startsWith('blob_download')) {
        var ext = getExtensionFromDataURI(fileData);
        fileName = "download_" + Date.now() + (ext || ".png");
    }

    // 创建临时的 a 标签触发原生下载
    var a = document.createElement('a');
    
    // 核心修改：将 Data URI 转换为 Blob URL。大部分套壳浏览器对 Data URI 起名无效，但对 Blob URL 起名完全有效。
    var blob = dataURIToBlob(fileData);
    var url = blob ? URL.createObjectURL(blob) : fileData;
    
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 延迟移除
    setTimeout(function() {
        document.body.removeChild(a);
        if (blob && url.startsWith('blob:')) {
            URL.revokeObjectURL(url); // 释放内存
        }
    }, 150);

    downloadObj = {};
}

function downloadAddData(obj){
if(obj.type=="fileName"){
downloadObj.fileName=obj.data;
try{clearTimeout(downloadTimeout);}catch(e){}
downloadObj.fileData?nativeDownload(downloadObj.fileName,downloadObj.fileData):null;
}
if(obj.type=="fileData"){
downloadObj.fileData=obj.data;
if(downloadObj.fileName){
downloadObj.fileData?nativeDownload(downloadObj.fileName,downloadObj.fileData):null;
}else{
downloadTimeout=setTimeout(function(){
downloadObj.fileData?nativeDownload("",downloadObj.fileData):null;
},100)
}
}
}

window.addEventListener("message",(event)=>{
console.log(event.data)
downloadAddData(event.data)
})
})();
var nativeDCE1=document.createElement;
document.createElement=function(...arg){
var element=nativeDCE1.call(document,...arg);
if(arg[0].toLowerCase()=="iframe"){
setTimeout(
function(){
if(element.srcdoc){
/<script (.*?)>/.test(element.srcdoc);
var t=RegExp.$1+"";
var result1=element.srcdoc.replace(/<script (.*?)>/,`<script `+t+`>
function blobToDataURI(blob, callback) {
  var reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onload = function (e) {
    callback(e.target.result);
  };
}
var nativeCOU=URL.createObjectURL;
URL.createObjectURL=function(...args){
blobToDataURI(args[0],(e)=>{
window.parent.postMessage({type:"fileData",data:e},"*")
});
return nativeCOU.call(URL,...args);
};

var nativeDCE1=document.createElement;
document.createElement=function(...arg){
var element=nativeDCE1.call(document,...arg)
if(arg[0].toLowerCase()=="a"){
element.addEventListener("click",()=>{
  element.download?window.parent.postMessage({type:"fileName",data:element.download},"*"):null;
return false;
})
}
  return element
}

window.addEventListener("load",function(){
[...document.getElementsByTagName("a")].forEach((e)=>{
e.addEventListener("click",()=>{
  e.download?window.parent.postMessage({type:"fileName",data:e.download},"*"):null;
return false;
})
})
})

`);
var policy1=trustedTypes.createPolicy("policy1",{createHTML:(str)=>str});
element.srcdoc=policy1.createHTML(result1);
}
},0);
}
  return element;
}
