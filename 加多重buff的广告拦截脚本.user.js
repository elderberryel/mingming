// ==UserScript==
// @name   加多重buff的广告拦截脚本
// @author ChatGPT
// @description 去广告脚本，可能有误杀，可以在脚本菜单禁用当前域名拦截
// @version 12.2
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @match *://*/*
// @run-at     document-start
// @namespace https://greasyfork.org/users/452911
// @downloadURL https://update.greasyfork.org/scripts/459944/%E5%8A%A0%E5%A4%9A%E9%87%8Dbuff%E7%9A%84%E5%B9%BF%E5%91%8A%E6%8B%A6%E6%88%AA%E8%84%9A%E6%9C%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/459944/%E5%8A%A0%E5%A4%9A%E9%87%8Dbuff%E7%9A%84%E5%B9%BF%E5%91%8A%E6%8B%A6%E6%88%AA%E8%84%9A%E6%9C%AC.meta.js
// ==/UserScript==

(function() {
 'use strict';

 // 获取当前网站URL，并根据其生成一个唯一的存储键
 var storageKey = window.location.hostname;

 // 根据存储键获取已保存的设置（如果存在）
 var isEnabled = GM_getValue(storageKey, true);

 function showAlert() {
 (function() {
 var g_times = 0,
 itids = [],
 timer;

 function myfun() {
 //隐藏元素
 itids.push(
 setTimeout(function() {
var styleTag = document.createElement('style');
styleTag.innerHTML = `
  .hidden-element {
    display: none !important;
    visibility: hidden;
    opacity: 0;
    z-index: -999;
    width: 0;
    height: 0;
    pointer-events: none;
    position: absolute;
    left: -9999px;
    top: -9999px;
  }
`;
document.head.appendChild(styleTag);

var elements = document.querySelectorAll("[style^='left'],[style^='visibility:visible;padding:0;margin:0;-webkit-appearance:none;position:absolute !important;left:0px;top:-'],[style*='background-size: 400px 127px !important;'],[style*='background-size: 470px 149px !important;'],[style*='position: fixed; left: 0px; transform: none; top: 0px; z-index: '],[style$='width:100vw;display:block;'],[style*='width: 100vw; position: fixed;'],[style$='important;'],p[class],ul *,UL,H2,body.clearfix *,[style^='display: block; z-index: '],[style^='background-image: url('],body#read.read *,.adsbygoogle[referrerpolicy],[style='height: 125px;'],[style^='display: block;'],[style='height: 125.002px;'],[classname],[ontouchstar],[style='height: 125px;'],[style='height: 125.002px;'],[style$='display: block;'],[class*='_'][id*='_'],[style='height:0px;'],[style*='background: url'],[style*='width: 100vw; top:']");
for (var i = 0; i < elements.length; i++) {
  var zIndex = parseInt(elements[i].style.zIndex);
  if (zIndex > 600) {
    elements[i].classList.add('hidden-element');
  }
}
 }, 350)
 );

 if (g_times >= 6) {
 window.clearInterval(timer);
 }
 g_times++;
 }
 itids.push(
 setTimeout(function() {
 //主循环计时器
 timer = setInterval(myfun, 500);
 itids.push(timer);
 myfun();
 }, 500)
 );
 })();
//通用规则
// 假定的输入字符串，分为三部分
const input1 = `##DIV[data-text-ad]
###bottom_ads.hl_bottom_ads
##A[href*='jialu6699h.vip']
##DIV.adj
##[style*='px; top: 0px; left: 0px; animation: 1.5s ease 0.2s infinite normal none running shakegwegs; z-index:']
##A[href*='youqu.buzz']
##A[href^='https://tv2356.cc']
##DIV[class$='_ad_wrap']
##DIV[class^='ads_border_']
##body > A[ontouchstart='this.click();'][href]
##div[id*='cat_'][id*='_ad']
##IMG[alt^='kaiybet']
##DIV.myui-content__acc[style='position: relative;padding: 0 10px']
##[style^='bottom: 0px; width: 100%; height: 50vw; position: fixed; left: 0px; right: 0px; margin: 0px; background: url("https://']
##[href='/aga2/1661087']
##[href^='http://jg.awaliwa.com/']
##.player_pic_link > [src*='/player.gif']
##div.close-player_pic[onclick="document.getElementById('player_pic').style.display='none'"]
##[href^='https://jincai.sohu.com/']
##[href*='sohu.com/hy-op']
##[href='/jump.html']
##[href='/ad.html']
##DIV._42701c0173
##DIV._4e544f1dde
##div.m0auto div.s_h,div.m0auto div.s_h + *
##secion#ly LI[role='group'],secion#ly > H2
##div.play_boxbg div[class$='_acmsd']
##DIV.bot-per-context[data-width='728'][data-height='90']
##DIV.fixed-bottom.d-block.d-sm-none.movies_ad
##DIV.col-4.col-sm-2.col-xl-2.px-1.px-sm-2.pb-3.pt-3.pt-sm-0.d-block.d-sm-none
##[href*='.lookxmh3']
##[href='https://dpurl.cn/HifSTUtz']
##[href^="openapp.jdmobile://virtual?params="]
##[onclick*="trackEvent', 'ad"]
##[src^='https://ae01.alicdn.com/'][alt='歪歪漫画']
##UL[style='margin: 0px; padding: 0px; font-size: 0px; display: flex;']
###topNavad
###bottomNavad
##.ff-ads
##.ssr1
##.ad_img
##body.conch-hasone section > span > video
##div.stui-pannel__bd > #t-img-box
##P[style$='transparent !important; font-size: 0px !important; text-indent: -10000px !important; height: 125px !important;']
##DIV[style^='width:100%;height:100%;line-height: 100%;overflow:hidden; margin:auto;border:1px #']
##[src$='/dibu.adadadad']
##.ayx[style="position: fixed;bottom: -10px;right:0;z-index:999;width:250px"]
##[href*="/entry/register/?i_code="]
##[style$='auto;text-align: center;line-height: initial;margin-bottom: 10px;margin-left: 20px;margin-right: 20px;']
##[style$="both;margin: auto;text-align: center;line-height: initial;margin-bottom: 10px;"]
##DIV#mhbottom_ad_box
##[href^='https://w5979.com:']
##[href^='https://dc.vvsmse72']
##oxk
##body > a[id*='hudie_']
##div.synopsisArea > a[id*='hudie_']
##div.recommend > a[id*='hudie_']
##div.poi-row a > IMG[width='100%'][height='auto'][src]
##div.row > div[id] > ul > li.cpn > a
##SPAN[style$='font-size: 6vw; color:#fff; text-align: center; transform: rotate(-90deg);']
##div.page.player > div.main > div.content > div.module.module-player > div.module-main > div.player-box > div.player-rm.rm-list > a > img
##IMG[src*='/gg/'][src$='180.gif'][src*='800']
##[onclick="window.open('http://682kg.com/')"]
##[href^='https://www.00285164.com']
##[href^='https://97749516.com/']
##[href^='https://www.00426740.com']
##[href^='https://tz.kefuyuming.vip/']
##[href^='https://gougew.lanzoub.com/']
##[href='/ad/bfy.html']
##[href='/my/gd.html']
##[style^="pointer-events: none;background-image:url('https://33789.qqqwww987.site"],[style^='z-index: 2147483647; height: 123px; ']
###ad-header-mobile-contener
###downapp1
##[data^='/banners/pr_advertising_ads_banner']
##[src^='/banners/pr_advertising_ads_banner']
##body > DIV[class][style='top: 132px;']
##body > DIV[style*='height: 33px'][style*='132px !important;']
##body > DIV[style='display: block; width: 100%; height: 132px;']
##[href^='https://www.qlspx.com:']
##[href^="https://9996867.com"]
##[href="/ad/007.html"]
###ad-index.position-relative
##[src^='https://l.bt5v.com/v.php']
##div.container > div.row div.yalayi_box
##center > [href^='https://docs.qq.com/doc'][target='_blank']
##A[href='/hth.html']
##[alt="要恰饭的嘛"]
##img#hth[onclick^="window.open"]
##[onclick*='https://i.opiwb.com:']
##[href='https://click.aliyun.com/m/1000332699/']
##[src^='https://qwe0231141.bj.bcebos.com/']
##.gr_slide_car_inner
##.__isboostOverContent
##IMG[referrerpolicy='no-referrer'][style='box-sizing: border-box;height:calc(10vh); width:100%;padding: 0px 15px 10px 15px;']
##.C1U,.C1M,.C2L,.C2R
##[src^='/Uploads/ad/'][src$='.gif'][alt='广告']
##img#hth[onclick$="hth.html')"]
##A[onclick$='()'][target='_top'][style*='.gif) no-repeat;background-size:100% 100%;']
##body#nr_body.nr_all.c_nr > div[class] > DIV[style='height:90px;width:100%;']
##IMG[src$='.dl'][style='width:100% !important;height:90px'][onclick]
##A[style='width: 100%;height: 150px;z-index:1000;position: absolute;display:block;top: 0px;'][onclick$=';this.style.display="none";']
##[src^='https://play.cdn6.buzz/js/']
##[href='https://www.aiwajbh.com/mh.php']
##div#reader-scroll.acgn-reader-chapter.v>div>center>strong>button
##[onclick^="window.location.href='https://apps.apple.com/cn/app/%E9%80%9F%E9%98%85%E5%B0%8F%E8%AF%B4"]
##.fed-part-advs.fed-text-center.fed-font-xvi
##A[href^='http'][style^='display:block;left:0;right:0;position:fixed;border-left:']
###hongbao20201217
###whYuTlxF
###t4>a
##[href^='https://kcc.qrjxween.com/cc/']
##.zozoads
##[src='http://m.guangzhoubingqing.com/88888.jpg']
###bl_mobile_float[style='height: 152px;']
###sOIcquIT
##[src^='/MDassets/images/']
##DIV.ec-ad.tim-box
##DIV.box-width.ec-ad
##[class^="chapter_"] > .baiduCenter
##[href*="/?channelCode="] > [referrerpolicy='no-referrer']
##[href^='http://mm.alameinv.com/']
##[onclick='gourl()'][src^='/images/bfq/']
##[onclick="window.open('https://docs.qq.com/doc/DZGtmWUxpamJGTnNY');"]
###coupletBox
##.advertise
##[href^='https://xcc.'][href*='cn/']
##a.gggg[href^="https"]
###adDisabledBtn
###Page-1[stroke='none'][fill='none'][fill-rule='evenodd']
###header_global_ad
##DIV#bl_mobile_float
##[href^='https://iluluweb.club']
##.width.imgs_1
##[href^='https://jd.dangbei.com/']
##[href^='https://dt.mydrivers.com/b.ashx']
##.bottom-pic,.col-pd.mb10
##.mi_btcon.ad
##.fc_foot
##SPAN#VuMk2.IgpuN2
##[href^='https://fcc.hxaxfcc.cn/']
##SPAN[style^="position: fixed; bottom: 30vh; z-index: 2147483647; right: 0px; margin-right: 6vw; padding: 0px; text-decoration: none; background-color: red; width: 7vw; height: 7vw; border-radius: 7vw; font-size: 6vw; color:"]
##SPAN#qdSZ2
##div[class^="is_"] > a > img[referrerpolicy="no-referrer"][src*="hdslb.com"]
##[alt='ACG里番']
##[alt='52bl']
##[alt='西瓜社']
##VIDEO[loop='true'][muted='true'][autoplay='true'][playsinline='true'][preload='auto']
##[href^="https://lantianyong"]
##[href='http://ky53362.com/']
##[href^='https://js.xiaobaofei.com']
##[href^='https://tz.jing