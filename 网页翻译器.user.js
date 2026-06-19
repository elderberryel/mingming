// ==UserScript==
// @name         网页翻译器 (AI增强版)
// @description  谷歌/微软/腾讯/DeepSeek/GLM/硅基流动 多引擎翻译，支持双语对照、API配置、配置导入导出
// @version      8.0
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      translate-pa.googleapis.com
// @connect      edge.microsoft.com
// @connect      api-edge.cognitive.microsofttranslator.com
// @connect      transmart.qq.com
// @connect      api.deepseek.com
// @connect      open.bigmodel.cn
// @connect      api.siliconflow.cn
// @run-at       document-end
// @namespace    https://greasyfork.org/users/452911
// ==/UserScript==

(async () => {
  'use strict';

  try { if (document.contentType === 'application/xml') return } catch (_) {}

  // ══════════════════════════════════════════════════════════
  // 配置读取
  // ══════════════════════════════════════════════════════════
  const deviceLang = (navigator.language || navigator.userLanguage || 'zh-CN').split('-')[0];

  // 悬浮球尺寸自适应
  function getBadgeSize() {
    const w = window.innerWidth;
    if (w >= 1200) return 100;   // 大桌面
    if (w >= 768) return 100;    // 中等屏幕 / 平板
    return 52;                  // 小屏 / 手机
  }

  // 面板宽度自适应
  function getPanelWidth() {
    const w = window.innerWidth;
    if (w >= 1200) return 300;
    if (w >= 768) return 300;
    return 200;
  }

  // 默认位置：底部中间
  function getDefaultRight() {
    return Math.round((window.innerWidth - getBadgeSize()) / 2);
  }
  const BADGE_MARGIN_BOTTOM = 20; // 距底部距离

  const [
    _engine,
    _targetLang,
    _autoMode,
    _excludedHosts,
    _displayMode,
    _pos,
    _deepseekKey,
    _deepseekModel,
    _glmKey,
    _glmModel,
    _siliconflowKey,
    _siliconflowModel
  ] = await Promise.all([
    GM_getValue('engine', 'microsoft'),
    GM_getValue('targetLang', deviceLang === 'zh' ? 'zh-CN' : deviceLang),
    GM_getValue('autoMode', false),
    GM_getValue('excludedHosts', '[]'),
    GM_getValue('displayMode', 'translated'),
    GM_getValue('uiPos', JSON.stringify({})), // 空对象，后续处理
    GM_getValue('deepseekKey', ''),
    GM_getValue('deepseekModel', 'deepseek-chat'),
    GM_getValue('glmKey', ''),
    GM_getValue('glmModel', 'glm-4-flash'),
    GM_getValue('siliconflowKey', ''),
    GM_getValue('siliconflowModel', 'Qwen/Qwen2-7B-Instruct')
  ]);

  let currentEngine = _engine;
// 🔥 自动判断是否走代理（Google 可用性检测）
async function detectEngineAuto() {
  try {
    const res = await gmFetch({
      method: 'GET',
      url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&q=test',
      timeout: 3000
    });

    if (res.status === 200) {
      console.log('[AutoEngine] Google 可用 → 使用 Google');
      return 'google';
    }
  } catch (e) {
    console.log('[AutoEngine] Google 不可用 → 使用 Microsoft');
  }
  return 'microsoft';
}
  let targetLang = _targetLang;
  let autoMode = _autoMode;
  let excludedHosts = JSON.parse(_excludedHosts);
  let displayMode = _displayMode;
  let uiPos = JSON.parse(_pos);

  // 如果位置无效，使用默认值
  if (!uiPos || typeof uiPos.right !== 'number' || typeof uiPos.bottom !== 'number') {
    uiPos = { right: getDefaultRight(), bottom: BADGE_MARGIN_BOTTOM };
  }

  // AI 引擎配置
  let aiConfig = {
    deepseek: { key: _deepseekKey, model: _deepseekModel },
    glm: { key: _glmKey, model: _glmModel },
    siliconflow: { key: _siliconflowKey, model: _siliconflowModel }
  };
  
  const CONCURRENCY_LIMIT = 6;

  if (excludedHosts.includes(location.host)) {
    GM_registerMenuCommand('✅ 在此网站重新启用翻译', () => {
      const idx = excludedHosts.indexOf(location.host);
      if (idx > -1) excludedHosts.splice(idx, 1);
      GM_setValue('excludedHosts', JSON.stringify(excludedHosts));
      location.reload();
    });
    return;
  }

  // ══════════════════════════════════════════════════════════
  // 引擎定义
  // ══════════════════════════════════════════════════════════
  const GoogleHelper_v2 = {
    _lastRequestAuthTime: null, _translateAuth: null, _authNotFound: false, _authPromise: null,
    get translateAuth() { return this._translateAuth; },
    _getAlternativeKey() { return new TextDecoder().decode(new Uint8Array([65,73,122,97,83,121,65,84,66,88,97,106,118,122,81,76,84,68,72,69,81,98,99,112,113,48,73,104,101,48,118,87,68,72,109,79,53,50,48])); },
    async findAuth() {
      if (this._authPromise) return await this._authPromise;
      this._authPromise = new Promise((resolve) => {
        let needUpdate = false;
        if (this._lastRequestAuthTime) {
          const d = new Date();
          if (this._translateAuth) d.setMinutes(d.getMinutes() - 20);
          else if (this._authNotFound) d.setMinutes(d.getMinutes() - 5);
          else d.setMinutes(d.getMinutes() - 1);
          if (d.getTime() > this._lastRequestAuthTime) needUpdate = true;
        } else { needUpdate = true; }
        if (needUpdate) {
          this._lastRequestAuthTime = Date.now();
          const altKey = this._getAlternativeKey();
          GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main',
            timeout: 8000,
            onload: (r) => {
              if (r.responseText && r.responseText.length > 1) {
                const m = r.responseText.match(/['"]x-goog-api-key['"]\s*:\s*['"](\w{39})['"]/i);
                if (m && m.length === 2) { this._translateAuth = m[1]; this._authNotFound = false; }
                else { this._authNotFound = true; this._translateAuth = altKey; }
              } else { this._authNotFound = true; this._translateAuth = altKey; }
              resolve();
            },
            onerror: () => { this._translateAuth = altKey; resolve(); },
            ontimeout: () => { this._translateAuth = altKey; resolve(); }
          });
        } else { resolve(); }
      });
      const p = this._authPromise;
      p.finally(() => { this._authPromise = null; });
      return await p;
    }
  };

  const ALL_LANGUAGES = { "zh-CN": "中文（简体）", "zh-TW": "中文（繁體）", "en": "English", "ja": "日本語", "ko": "한국어", "fr": "Français", "de": "Deutsch", "es": "Español", "ru": "Русский", "pt": "Português", "pt-PT": "Português (Portugal)", "ar": "العربية", "th": "ไทย", "vi": "Tiếng Việt", "it": "Italiano", "tr": "Türkçe", "id": "Indonesia", "ms": "Bahasa Melayu", "nl": "Nederlands", "pl": "Polski", "uk": "Українська", "cs": "Čeština", "sk": "Slovenčina", "hu": "Magyar", "ro": "Română", "bg": "Български", "hr": "Hrvatski", "sr": "Српски", "sl": "Slovenščina", "lt": "Lietuvių", "lv": "Latviešu", "et": "Eesti", "fi": "Suomi", "sv": "Svenska", "da": "Dansk", "no": "Norsk", "is": "Íslenska", "el": "Ελληνικά", "he": "עברית", "hi": "हिन्दी", "bn": "বাংলা", "ta": "தமிழ்", "te": "తెలుగు", "kn": "ಕನ್ನಡ", "ml": "മലയാളം", "pa": "ਪੰਜਾਬੀ", "gu": "ગુજરાતી", "mr": "मराठी", "ne": "नेपाली", "si": "සිංහල", "ur": "اردو", "fa": "فارسی", "ps": "پښتو", "my": "မြန်မာ", "km": "ខ្មែរ", "lo": "ລາວ", "ka": "ქართული", "hy": "Հայերեն", "az": "Azərbaycan", "kk": "Қазақ", "uz": "Oʻzbek", "mn": "Монгол", "sq": "Shqip", "mk": "Македонски", "be": "Беларуская", "bs": "Bosanski", "ca": "Català", "gl": "Galego", "eu": "Euskara", "mt": "Malti", "cy": "Cymraeg", "ga": "Gaeilge", "gd": "Gàidhlig", "lb": "Lëtzebuergesch", "af": "Afrikaans", "sw": "Kiswahili", "ha": "Hausa", "ig": "Igbo", "yo": "Yorùbá", "zu": "isiZulu", "xh": "isiXhosa", "sn": "chiShona", "st": "Sesotho", "so": "Soomaali", "am": "አማርኛ", "ti": "ትግርኛ", "om": "Oromoo", "mg": "Malagasy", "ny": "Chichewa", "lg": "Luganda", "rw": "Kinyarwanda", "tg": "Тоҷикӣ", "tk": "Türkmen", "ky": "Кыргызча", "tt": "Татар", "eo": "Esperanto", "la": "Latina", "co": "Corsu", "fy": "Frysk", "haw": "ʻŌlelo Hawaiʻi", "sm": "Gagana Samoa", "mi": "Te Reo Māori", "ceb": "Cebuano", "fil": "Filipino", "jv": "Basa Jawa", "su": "Basa Sunda", "hmn": "Hmong", "ht": "Kreyòl Ayisyen", "ku": "Kurdî", "ckb": "کوردی", "sd": "سنڌي", "or": "ଓଡ଼ିଆ", "as": "অসমীয়া", "sa": "संस्कृतम्", "mai": "मैथिली", "bho": "भोजपुरी", "doi": "डोगरी", "ug": "ئۇيغۇرچە", "dv": "ދިވެހި", "ak": "Akan", "ee": "Eʋegbe", "gn": "Guarani", "ay": "Aymar", "bm": "Bamanankan", "ln": "Lingála", "nso": "Sepedi", "ts": "Xitsonga", "qu": "Runasimi", "ilo": "Ilokano", "kri": "Krio", "lus": "Mizo tawng", "mni-Mtei": "ꯃꯤꯇꯩꯂꯣꯟ", "gom": "कोंकणी", "ab": "Аԥсуа", "ace": "Bahsa Acèh", "ach": "Lwo", "aa": "Qafaraf", "alz": "Alur", "av": "Авар", "awa": "अवधी", "ban": "ᬩᬮᬶ", "bal": "بلوچی", "bci": "Baoulé", "ba": "Башҡорт", "btx": "Batak Karo", "bts": "Batak Simalungun", "bbc": "Batak Toba", "bem": "Bemba", "bew": "Betawi", "bik": "Bikol", "br": "Brezhoneg", "bua": "Буряад", "yue": "粵語", "ch": "Chamoru", "ce": "Нохчийн", "chk": "Chuukese", "cv": "Чӑваш", "crh": "Qırımtatar", "prs": "دری", "din": "Thuɔŋjäŋ", "dov": "Dombe", "dyu": "Julakan", "dz": "རྫོང་ཁ", "fo": "Føroyskt", "fj": "Na Vosa Vakaviti", "fon": "Fɔ̀ngbè", "fr-CA": "Français (Canada)", "fur": "Furlan", "ff": "Pulaar", "gaa": "Gã", "cnh": "Lai", "hil": "Hiligaynon", "hrx": "Hunsrik", "iba": "Iban", "iu-Latn": "ᐃᓄᒃᑎᑐᑦ (Latin)", "jam": "Jamaican Patois", "kac": "Jingpo", "kl": "Kalaallisut", "kr": "Kanuri", "pam": "Kapampangan", "kha": "Khasi", "cgg": "Rukiga", "kg": "Kikongo", "mkw": "Kituba", "trp": "Kokborok", "kv": "Коми", "ltg": "Latgaļu", "lij": "Lìgure", "li": "Limburgs", "lmo": "Lombard", "luo": "Dholuo", "mad": "Madhurâ", "mak": "Makassar", "ms-Arab": "بهاس ملايو", "mam": "Mam", "gv": "Gaelg", "mh": "Kajin Majōl", "mwr": "मारवाड़ी", "mfe": "Kreol Morisien", "chm": "Марий", "min": "Minangkabau", "nhe": "Nahuatl", "ndc-ZW": "Ndau", "nr": "isiNdebele", "new": "नेपाल भाषा", "nqo": "ߒߞߏ", "nus": "Thok Nath", "oc": "Occitan", "os": "Ирон", "pag": "Pangasinan", "pap": "Papiamento", "pa-Arab": "پنجابی", "kek": "Qʼeqchiʼ", "rom": "Romani", "rn": "Ikirundi", "se": "Davvisámegiella", "sg": "Sängö", "bo": "བོད་ཡིག", "dsb": "Dolnoserbšćina", "hsb": "Hornjoserbšćina", "ikt": "Inuinnaqtun", "iu": "ᐃᓄᒃᑎᑐᑦ", "lzh": "文言文", "mvf": "ᠮᠣᠩᠭᠣᠯ", "brx": "बर'", "hne": "छत्तीसगढ़ी", "ks": "कॉशुर", "mrj": "Мары", "sa-Latn": "Sanskrit (Latin)", "sc": "Sardu", "scn": "Sicilianu", "szl": "Ślůnski", "su-Latn": "Sunda (Latin)", "tcy": "ತುಳು", "vec": "Vèneto", "war": "Winaray", "wo": "Wolof", "zap": "Zapotec", "ms-Latn": "Malay (Latin)" };
  const LANG_GROUPS = { "常用": ["zh-CN","zh-TW","en","ja","ko","fr","de","es","ru","pt","ar","th","vi","it","tr","id"], "欧洲": ["nl","pl","uk","cs","sk","hu","ro","bg","hr","sr","sl","lt","lv","et","fi","sv","da","no","is","el","be","bs","ca","gl","eu","mt","cy","ga","gd","lb","af","eo","la","co","fy","fo","br","oc","sc","scn","szl","fur","lij","lmo","li","vec","ltg","dsb","hsb","gv","se"], "亚洲": ["hi","bn","ta","te","kn","ml","pa","gu","mr","ne","si","ur","fa","ps","my","km","lo","ka","hy","az","kk","uz","mn","tg","tk","ky","tt","ug","dv","or","as","sa","mai","bho","doi","mni-Mtei","gom","awa","ks","brx","hne","mwr","trp","kac","bo","dz","yue","lzh","ms","fil","ceb","jv","su","hmn","ilo","hil","bik","pam","pag","war","ban","mad","mak","min","ace","btx","bts","bbc","bew","iba","ms-Arab","kha"], "非洲": ["sw","ha","ig","yo","zu","xh","sn","st","so","am","ti","om","mg","ny","lg","rw","ak","ee","bm","ln","nso","ts","kri","wo","ff","gaa","fon","bci","dyu","bem","luo","sg","kg","mkw","dov","nus","din","ach","alz","ndc-ZW","nr","rn","mfe"], "美洲/大洋洲": ["pt-PT","fr-CA","ht","qu","gn","ay","haw","sm","mi","fj","mh","ch","chk","jam","nhe","mam","kek","pap","hrx","ikt","iu","iu-Latn","kl"], "其他": ["ab","av","ba","bua","ce","cv","crh","kv","chm","mrj","os","rom","nqo","aa","bal","cnh","kr","prs","pa-Arab","sd","ckb","ku","he"] };

  const Engine = {
    google_v2: {
      name: 'Google (TWP v2)',
      _fixLang(lang) { return lang === "prs" ? "fa-AF" : lang; },
      _transformResponse(result, dontSort) {
        if (result.indexOf("<pre>") !== -1) { result = result.replace("<pre>", ""); const i = result.indexOf(">"); result = result.slice(i + 1); }
        const sentences = []; let idx = 0;
        while (true) {
          const s = result.indexOf("<b>", idx); if (s === -1) break;
          const e = result.indexOf("</b>", s);
          if (e === -1) { sentences.push(result.slice(s + 3)); break; } else { sentences.push(result.slice(s + 3, e)); }
          idx = e;
        }
        result = sentences.length > 0 ? sentences.join(" ") : result; result = result.replace(/<\/b>/g, "");
        let resultArray = []; let lastEnd = 0;
        for (const r of result.matchAll(/(<a i="[0-9]+">)([^<>]*(?=<\/a>))*/g)) {
          const fl = r[0].length, pos = r.index;
          if (pos > lastEnd) { resultArray.push(r[1] + result.slice(lastEnd, pos).replace(/<\/a>/g, "") + (r[2] || "")); } else { resultArray.push(r[0]); }
          lastEnd = pos + fl;
        }
        let indexes;
        if (resultArray.length > 0) {
          indexes = resultArray.map(v => parseInt(v.match(/[0-9]+(?=>)/g)?.[0])).filter(v => !isNaN(v));
          resultArray = resultArray.map(v => v.slice(v.indexOf(">") + 1));
        } else { resultArray = [result]; indexes = [0]; }
        resultArray = resultArray.map(v => Utils.unescapeHTML(v));
        if (dontSort) return resultArray;
        const final = [];
        for (const j in indexes) { if (final[indexes[j]]) final[indexes[j]] += " " + resultArray[j]; else final[indexes[j]] = resultArray[j]; }
        return final;
      },
      async translate(text, toLang) {
        const to = this._fixLang(toLang); await GoogleHelper_v2.findAuth();
        if (!GoogleHelper_v2.translateAuth) throw new Error('No auth');
        const r = await gmFetch({ method: 'POST', url: 'https://translate-pa.googleapis.com/v1/translateHtml', headers: { 'Content-Type': 'application/json+protobuf', 'X-Goog-Api-Key': GoogleHelper_v2.translateAuth }, data: JSON.stringify([[[text], "auto", to], "te"]), });
        if (r.status !== 200) throw new Error('v2 error: ' + r.status);
        const data = JSON.parse(r.responseText);
        if (data && data[0]) { const raw = Array.isArray(data[0]) ? data[0][0] : data[0]; const parsed = this._transformResponse(raw, false); return parsed[0] || raw; }
        throw new Error('v2 empty');
      },
      async translateBatch(texts, toLang) {
        const to = this._fixLang(toLang); await GoogleHelper_v2.findAuth();
        if (!GoogleHelper_v2.translateAuth) throw new Error('No auth');
        const r = await gmFetch({ method: 'POST', url: 'https://translate-pa.googleapis.com/v1/translateHtml', headers: { 'Content-Type': 'application/json+protobuf', 'X-Goog-Api-Key': GoogleHelper_v2.translateAuth }, data: JSON.stringify([[texts, "auto", to], "te"]), });
        if (r.status !== 200) throw new Error('v2 batch error: ' + r.status);
        const data = JSON.parse(r.responseText);
        if (data && data[0] && Array.isArray(data[0])) { return data[0].map(item => { const p = this._transformResponse(item, false); return p[0] || item; }); }
        if (data && data[0]) { const p = this._transformResponse(Array.isArray(data[0]) ? data[0][0] : data[0], false); return [p[0]]; }
        throw new Error('v2 batch empty');
      }
    },
    google_legacy: {
      name: 'Google (Legacy)',
      async translate(text, toLang) {
        const tk = GoogleHelper.calcHash(text);
        const r = await gmFetch({ method: 'GET', url: 'https://translate.googleapis.com/translate_a/single?client=webapp&sl=auto&tl=' + toLang + '&hl=' + toLang + '&dt=t&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=at&ie=UTF-8&oe=UTF-8&otf=1&ssel=0&tsel=0&kc=7&tk=' + tk + '&q=' + encodeURIComponent(text), });
        if (r.status !== 200) return await this._gtx(text, toLang);
        const data = JSON.parse(r.responseText); return data[0].filter(s => s && s[0]).map(s => s[0]).join('');
      },
      async _gtx(text, to) {
        const r = await gmFetch({ method: 'GET', url: 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=' + to + '&q=' + encodeURIComponent(text) });
        if (r.status !== 200) throw new Error('gtx error');
        const data = JSON.parse(r.responseText); return data[0].filter(s => s && s[0]).map(s => s[0]).join('');
      }
    },
    google: {
      name: 'Google (Auto)',
      async translate(text, toLang) { try { return await Engine.google_v2.translate(text, toLang); } catch (e) { return await Engine.google_legacy.translate(text, toLang); } },
      async translateBatch(texts, toLang) { try { return await Engine.google_v2.translateBatch(texts, toLang); } catch (e) { const res = []; for (const t of texts) { try { res.push(await Engine.google_legacy.translate(t, toLang)); } catch (_) { res.push(null); } } return res; } }
    },
    microsoft: {
      name: 'Microsoft', _token: null, _tokenTime: 0,
      async getToken() {
        if (this._token && Date.now() - this._tokenTime < 480000) return this._token;
        const r = await gmFetch({ method: 'GET', url: 'https://edge.microsoft.com/translate/auth' });
        if (r.status !== 200) throw new Error('MS auth');
        this._token = r.responseText; this._tokenTime = Date.now(); return this._token;
      },
      langCode(l) { const m = { 'zh': 'zh-Hans', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant', 'no': 'nb', 'sr': 'sr-Cyrl', 'pt-PT': 'pt-pt', 'fr-CA': 'fr-ca' }; return m[l] || l; },
      async translate(text, toLang) {
        const token = await this.getToken(); const to = this.langCode(toLang);
        const r = await gmFetch({ method: 'POST', url: 'https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=' + to + '&api-version=3.0', headers: { 'authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, data: JSON.stringify([{ Text: text }]), });
        if (r.status !== 200) throw new Error('MS error'); return JSON.parse(r.responseText)[0].translations[0].text;
      },
      async translateBatch(texts, toLang) {
        const token = await this.getToken(); const to = this.langCode(toLang); const results = [];
        for (let b = 0; b < texts.length; b += 25) {
          const chunk = texts.slice(b, b + 25);
          const r = await gmFetch({ method: 'POST', url: 'https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=' + to + '&api-version=3.0', headers: { 'authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, data: JSON.stringify(chunk.map(t => ({ Text: t }))), });
          if (r.status === 200) { for (const item of JSON.parse(r.responseText)) results.push(item.translations[0].text); } else { for (let i = 0; i < chunk.length; i++) results.push(null); }
        }
        return results;
      }
    },
    tencent: {
      name: 'Tencent', _clientKey: null,
      getClientKey() { if (this._clientKey) return this._clientKey; this._clientKey = 'browser-chrome-120.0-Windows_10-' + crypto.randomUUID() + '-' + Date.now(); return this._clientKey; },
      langCode(l) { const m = { 'zh': 'zh', 'zh-CN': 'zh', 'zh-TW': 'zh-TW' }; return m[l] || l; },
      async translate(text, toLang) {
        const to = this.langCode(toLang);
        const r = await gmFetch({ method: 'POST', url: 'https://transmart.qq.com/api/imt', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ header: { fn: 'auto_translation', session: '', client_key: this.getClientKey(), user: '' }, type: 'plain', model_category: 'normal', text_domain: 'general', source: { lang: 'auto', text_list: [text] }, target: { lang: to } }), });
        if (r.status !== 200) throw new Error('Tencent error'); return JSON.parse(r.responseText).auto_translation[0];
      },
      async translateBatch(texts, toLang) {
        const to = this.langCode(toLang);
        const r = await gmFetch({ method: 'POST', url: 'https://transmart.qq.com/api/imt', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ header: { fn: 'auto_translation', session: '', client_key: this.getClientKey(), user: '' }, type: 'plain', model_category: 'normal', text_domain: 'general', source: { lang: 'auto', text_list: texts }, target: { lang: to } }), });
        if (r.status !== 200) throw new Error('Tencent batch error'); return JSON.parse(r.responseText).auto_translation;
      }
    },
    deepseek: {
      name: 'DeepSeek (AI)',
      isAI: true,
      async translate(text, toLang) {
        const key = aiConfig.deepseek.key;
        const model = aiConfig.deepseek.model;
        if (!key) throw new Error('请配置 DeepSeek API Key');
        const systemPrompt = "You are a professional translation engine. Your only function is to translate text. Do not output any conversational filler, explanations, or repeat the prompt.";
        const userPrompt = `Translate the following text to ${toLang}. Output ONLY the translated text.\n\n<source_text>\n${text}\n</source_text>`;
        const r = await gmFetch({
          method: 'POST',
          url: 'https://api.deepseek.com/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          data: JSON.stringify({ 
            model: model, 
            messages: [
              { role: 'system', content: systemPrompt }, 
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
          })
        });
        if (r.status !== 200) throw new Error('DeepSeek Error: ' + r.status);
        const data = JSON.parse(r.responseText);
        return data.choices[0].message.content.trim();
      }
    },
    glm: {
      name: 'GLM-4 (AI)',
      isAI: true,
      async translate(text, toLang) {
        const key = aiConfig.glm.key;
        const model = aiConfig.glm.model;
        if (!key) throw new Error('请配置 GLM API Key');
        const systemPrompt = "You are a professional translation engine. Your only function is to translate text. Do not output any conversational filler, explanations, or repeat the prompt.";
        const userPrompt = `Translate the following text to ${toLang}. Output ONLY the translated text.\n\n<source_text>\n${text}\n</source_text>`;
        const r = await gmFetch({
          method: 'POST',
          url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          data: JSON.stringify({ 
            model: model, 
            messages: [
              { role: 'system', content: systemPrompt }, 
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
          })
        });
        if (r.status !== 200) throw new Error('GLM Error: ' + r.status);
        const data = JSON.parse(r.responseText);
        return data.choices[0].message.content.trim();
      }
    },
    // 硅基流动 AI 翻译引擎
    siliconflow: {
      name: '硅基流动 (AI)',
      isAI: true,
      async translate(text, toLang) {
        const key = aiConfig.siliconflow.key;
        const model = aiConfig.siliconflow.model;
        if (!key) throw new Error('请配置硅基流动 API Key');
        // 获取语言名称用于提示
        const targetLangName = ALL_LANGUAGES[toLang] || toLang;
        const systemPrompt = "You are a professional translation engine. Translate the user's text accurately. Output ONLY the translated text, nothing else. Do not add explanations, notes, or any extra content.";
        const userPrompt = `Translate the following text to ${targetLangName} (${toLang}). Output only the translation.\n\nText: ${text}`;
        
        const r = await gmFetch({
          method: 'POST',
          url: 'https://api.siliconflow.cn/v1/chat/completions',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer ' + key 
          },
          data: JSON.stringify({ 
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 4096,
            stream: false
          })
        });
        
        if (r.status !== 200) {
          console.error('硅基流动 API 错误:', r.status, r.responseText);
          throw new Error('硅基流动 Error: ' + r.status);
        }
        const data = JSON.parse(r.responseText);
        if (data.error) {
          throw new Error(`硅基流动 API: ${data.error.message}`);
        }
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content.trim();
        }
        throw new Error('硅基流动 响应格式异常');
      }
    }
  };

  const GoogleHelper = {
    googleTranslateTKK: "448487.932609646",
    shiftLeftOrRightThenSumOrXor(num, optString) {
      for (let i = 0; i < optString.length - 2; i += 3) {
        let acc = optString.charAt(i + 2); acc = ("a" <= acc) ? acc.charCodeAt(0) - 87 : Number(acc);
        acc = (optString.charAt(i + 1) === "+") ? num >>> acc : num << acc;
        num = (optString.charAt(i) === "+") ? (num + acc) & 4294967295 : num ^ acc;
      }
      return num;
    },
    transformQuery(query) {
      const b = []; let idx = 0;
      for (let i = 0; i < query.length; i++) {
        let c = query.charCodeAt(i);
        if (128 > c) { b[idx++] = c; }
        else {
          if (2048 > c) { b[idx++] = (c >> 6) | 192; }
          else {
            if (55296 === (c & 64512) && i + 1 < query.length && 56320 === (query.charCodeAt(i + 1) & 64512)) {
              c = 65536 + ((c & 1023) << 10) + (query.charCodeAt(++i) & 1023);
              b[idx++] = (c >> 18) | 240; b[idx++] = ((c >> 12) & 63) | 128;
            } else { b[idx++] = (c >> 12) | 224; }
            b[idx++] = ((c >> 6) & 63) | 128;
          }
          b[idx++] = (c & 63) | 128;
        }
      }
      return b;
    },
    calcHash(query) {
      const s = this.googleTranslateTKK.split("."); const tkkIdx = Number(s[0]) || 0; const tkkKey = Number(s[1]) || 0;
      const bytes = this.transformQuery(query); let enc = tkkIdx;
      for (const item of bytes) { enc += item; enc = this.shiftLeftOrRightThenSumOrXor(enc, "+-a^+6"); }
      enc = this.shiftLeftOrRightThenSumOrXor(enc, "+-3^+b+-f"); enc ^= tkkKey;
      if (enc <= 0) enc = (enc & 2147483647) + 2147483648;
      const n = enc % 1000000; return n.toString() + "." + (n ^ tkkIdx);
    }
  };

  const Utils = {
    escapeHTML(t) { const d = document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; },
    unescapeHTML(t) { const d = new DOMParser().parseFromString(t, 'text/html'); return d.documentElement.textContent; }
  };

  function gmFetch(opts) { return new Promise((resolve, reject) => { GM_xmlhttpRequest({ timeout: 20000, ...opts, onload: resolve, onerror: reject, ontimeout: reject }); }); }

  // ══════════════════════════════════════════════════════════
  // 缓存管理
  // ══════════════════════════════════════════════════════════
  const cache = new Map();
  const MAX_CACHE = 3000;
  function cacheGet(t) { return cache.get(t); }
  function cacheSet(t, v) { if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); cache.set(t, v); }

  async function translate(text) {
    if (!text || !text.trim()) return null;
    const trimmed = text.trim(); if (/^\d+$/.test(trimmed)) return null;
    const cached = cacheGet(trimmed); if (cached) return cached;
    try {
      const result = await Engine[currentEngine].translate(trimmed, targetLang);
      if (result && result !== trimmed) { cacheSet(trimmed, result); return result; }
    } catch (e) {
      if (Engine[currentEngine].isAI) {
        console.error("[Translate] AI Engine Error:", e);
        return null;
      }
      const fallbackEngine = currentEngine === 'google' ? 'microsoft' : 'google_legacy';
      try {
        const result = await Engine[fallbackEngine].translate(trimmed, targetLang);
        if (result && result !== trimmed) { cacheSet(trimmed, result); return result; }
      } catch (_) {}
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════
  // 批量翻译 + 去重 + 并发控制
  // ══════════════════════════════════════════════════════════
  async function batchTranslate(texts) {
    const results = new Array(texts.length).fill(null);
    
    const uniqueTexts = []; 
    const textToIndices = new Map();
    const seenInBatch = new Set();

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i].trim();
      if (!t || /^\d+$/.test(t)) continue;
      const cached = cacheGet(t);
      if (cached) {
        results[i] = cached;
        continue;
      }
      if (!seenInBatch.has(t)) {
        uniqueTexts.push(t);
        seenInBatch.add(t);
        textToIndices.set(t, [i]);
      } else {
        textToIndices.get(t).push(i);
      }
    }

    if (uniqueTexts.length === 0) return results;
    
    const engine = Engine[currentEngine];
    
    const fillResults = (text, translation) => {
      if (!translation) return;
      cacheSet(text, translation);
      const indices = textToIndices.get(text);
      if (indices) {
        indices.forEach(idx => results[idx] = translation);
      }
    };

    if (engine.isAI || !engine.translateBatch) {
       for (let i = 0; i < uniqueTexts.length; i += CONCURRENCY_LIMIT) {
         const batch = uniqueTexts.slice(i, i + CONCURRENCY_LIMIT);
         await Promise.allSettled(batch.map(async (text) => { 
            try {
                const r = await engine.translate(text, targetLang); 
                if (r) fillResults(text, r);
            } catch (e) {
                console.warn("Translate failed for:", text, e);
            }
         }));
       }
       return results;
    }

    if (engine.translateBatch) {
      try {
        const BATCH_SIZE = currentEngine === 'microsoft' ? 25 : 50;
        for (let b = 0; b < uniqueTexts.length; b += BATCH_SIZE) {
            const chunkTexts = uniqueTexts.slice(b, b + BATCH_SIZE);
            try {
                const batchResults = await engine.translateBatch(chunkTexts, targetLang);
                if (batchResults) {
                    for (let j = 0; j < batchResults.length; j++) {
                        if (batchResults[j] && batchResults[j] !== chunkTexts[j]) {
                            fillResults(chunkTexts[j], batchResults[j]);
                        }
                    }
                }
            } catch (e) {
                console.warn("Batch translate error:", e);
                for (const text of chunkTexts) {
                    try {
                        const r = await translate(text);
                        if (r) fillResults(text, r);
                    } catch (_) {}
                }
            }
        }
        return results;
      } catch (e) { console.error(e); }
    }
    
    for (const text of uniqueTexts) {
        const r = await translate(text);
        if (r) fillResults(text, r);
    }
    return results;
  }

  const SKIP_TAGS = /^(script|style|code|pre|svg|math|noscript|iframe|canvas|video|audio|img|br|hr|input|select|option|textarea)$/i;
  const SKIP_CLASS = /translate-ui|notranslate|katex|mathjax/i;

  function shouldSkip(node) {
    if (!node) return true;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.test(node.tagName)) return true;
      if (SKIP_CLASS.test(node.className)) return true;
      if (node.isContentEditable) return true;
      if (node.dataset && node.dataset.translated) return true;
      if (node.classList && node.classList.contains('tu-bi')) return true;
    }
    return false;
  }

  const _langRegex = {};
  function getLangRegex(lang) {
    if (_langRegex[lang]) return _langRegex[lang];
    const patterns = { 'zh': /^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\s\d\p{P}]+$/u, 'en': /^[a-zA-Z\s\d\p{P}]+$/u, 'ja': /^[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\s\d\p{P}]+$/u, 'ko': /^[\uac00-\ud7af\u1100-\u11ff\s\d\p{P}]+$/u, 'ar': /^[\u0600-\u06ff\u0750-\u077f\s\d\p{P}]+$/u, 'th': /^[\u0e00-\u0e7f\s\d\p{P}]+$/u, 'ru': /^[\u0400-\u04ff\s\d\p{P}]+$/u, };
    _langRegex[lang] = patterns[lang] || null; return _langRegex[lang];
  }

  function isTargetLang(text) { if (!text || !text.trim()) return true; const lang = targetLang.split('-')[0]; const re = getLangRegex(lang); return re ? re.test(text.trim()) : false; }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
        const text = node.textContent.trim();
        if (!text || text.length < 2 || /^\d+$/.test(text)) return NodeFilter.FILTER_REJECT;
        if (isTargetLang(text)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.dataset?.translated) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function collectPlaceholders(root) { return [...root.querySelectorAll('input[placeholder], textarea[placeholder]')].filter(el => !el.dataset.translated && el.placeholder.trim() && !isTargetLang(el.placeholder)); }

  // ══════════════════════════════════════════════════════════
  // 可视区域翻译逻辑
  // ══════════════════════════════════════════════════════════
  let visibilityObserver = null;
  const pendingQueue = []; 
  let processTimer = null;

  function initObserver() {
      if (visibilityObserver) visibilityObserver.disconnect();
      visibilityObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
              if (entry.isIntersecting) {
                  visibilityObserver.unobserve(entry.target);
                  pendingQueue.push(entry.target);
              }
          }
          if (pendingQueue.length > 0 && !processTimer) {
              processTimer = setTimeout(processVisibleQueue, 150); 
          }
      }, { rootMargin: '300px 0px', threshold: 0 }); 
  }

  async function processVisibleQueue() {
      processTimer = null;
      if (pendingQueue.length === 0) return;
      
      const elements = [...pendingQueue];
      pendingQueue.length = 0;

      const texts = [];
      const metas = []; 

      for (const el of elements) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              if (el.dataset.translated) continue;
              const t = el.placeholder.trim();
              if (t && !isTargetLang(t)) {
                  texts.push(t);
                  metas.push({ type: 'ph', el: el });
              }
          } else {
              if (el.dataset.translated) continue;
              const nodes = [];
              const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
                  acceptNode(node) {
                      if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
                      if (node.parentElement.dataset.translated) return NodeFilter.FILTER_REJECT;
                      return NodeFilter.FILTER_ACCEPT;
                  }
              });
              while(walker.nextNode()) nodes.push(walker.currentNode);

              for (const node of nodes) {
                  const t = node.textContent.trim();
                  if (t && !isTargetLang(t)) {
                      texts.push(t);
                      metas.push({ type: 'text', node: node });
                  }
              }
          }
      }

      if (texts.length === 0) return;
      
      const results = await batchTranslate(texts);

      for (let i = 0; i < metas.length; i++) {
          if (!results[i]) continue;
          const meta = metas[i];
          if (meta.type === 'text') {
              const parent = meta.node.parentElement;
              if (!parent || parent.dataset.translated) continue;
              
              if (!parent.dataset.originalText) parent.dataset.originalText = meta.node.textContent;
              parent.dataset.translated = '1'; 

              if (displayMode === 'bilingual') {
                  const s = document.createElement('span'); s.className = 'tu-bi'; s.textContent = results[i];
                  if (meta.node.nextSibling) { parent.insertBefore(s, meta.node.nextSibling); } else { parent.appendChild(s); }
              } else { 
                  meta.node.textContent = results[i]; 
              }
          } else { 
              if (meta.el.dataset.translated) continue;
              meta.el.dataset.originalPlaceholder = meta.el.placeholder; 
              meta.el.placeholder = results[i]; 
              meta.el.dataset.translated = '1'; 
          }
      }
  }

  function scanAndObserve(root) {
      if (!visibilityObserver) initObserver();
      
      const nodes = collectTextNodes(root);
      const parents = new Set();
      nodes.forEach(node => {
          const p = node.parentElement;
          if (p && !p.dataset.translated) parents.add(p);
      });

      const inputs = collectPlaceholders(root);
      inputs.forEach(el => {
          if (!el.dataset.translated) parents.add(el);
      });

      parents.forEach(el => {
          try {
              visibilityObserver.observe(el);
          } catch(e) {}
      });
  }

  function restorePage() {
    if (visibilityObserver) visibilityObserver.disconnect();
    pendingQueue.length = 0;
    if(processTimer) clearTimeout(processTimer);
    processTimer = null;

    document.querySelectorAll('.tu-bi').forEach(el => el.remove());
    document.querySelectorAll('[data-translated]').forEach(el => {
      if (el.dataset.originalText) {
        for (const child of el.childNodes) { if (child.nodeType === Node.TEXT_NODE) { child.textContent = el.dataset.originalText; break; } }
        delete el.dataset.originalText;
      }
      if (el.dataset.originalPlaceholder) { el.placeholder = el.dataset.originalPlaceholder; delete el.dataset.originalPlaceholder; }
      delete el.dataset.translated;
    });
  }

  let mutationRafId = null;
  const pendingMutationRoots = new Set();
  const observer = new MutationObserver((mutations) => {
    if (!autoMode) return;
    for (const m of mutations) { for (const node of m.addedNodes) { if (node.nodeType === Node.ELEMENT_NODE && !shouldSkip(node)) { pendingMutationRoots.add(node); } } }
    if (pendingMutationRoots.size > 0 && !mutationRafId) {
      mutationRafId = setTimeout(() => {
        mutationRafId = null;
        const roots = [...pendingMutationRoots]; pendingMutationRoots.clear();
        if (roots.length > 5) { scanAndObserve(document.body); } else { roots.forEach(r => scanAndObserve(r)); }
      }, 200);
    }
  });

  function buildLangOptions() {
    let html = '';
    for (const [group, codes] of Object.entries(LANG_GROUPS)) {
      html += '<optgroup label="' + group + '">';
      for (const code of codes) { const name = ALL_LANGUAGES[code] || code; html += '<option value="' + code + '"' + (code === targetLang ? ' selected' : '') + '>' + name + '</option>'; }
      html += '</optgroup>';
    }
    return html;
  }

  function isPageInTargetLang() { const lang = (document.documentElement.lang || '').split('-')[0].toLowerCase(); const target = targetLang.split('-')[0].toLowerCase(); return lang === target; }

  function initWhenBodyReady() { if (document.body) { init(); } else { requestAnimationFrame(initWhenBodyReady); } }

  let _initialized = false;

  // ─── 确保悬浮球位置在可视范围内 ───
  function clampUiPos(ui) {
    const badgeSize = getBadgeSize();
    const maxRight = Math.max(0, window.innerWidth - badgeSize);
    const maxBottom = Math.max(0, window.innerHeight - badgeSize);
    let changed = false;
    if (uiPos.right < 0) { uiPos.right = 0; changed = true; }
    if (uiPos.right > maxRight) { uiPos.right = maxRight; changed = true; }
    if (uiPos.bottom < 0) { uiPos.bottom = 0; changed = true; }
    if (uiPos.bottom > maxBottom) { uiPos.bottom = maxBottom; changed = true; }
    if (changed) {
      ui.style.right = uiPos.right + 'px';
      ui.style.bottom = uiPos.bottom + 'px';
    }
    return changed;
  }

  function updateUIPos(ui) {
    const badgeSize = getBadgeSize();
    ui.style.width = badgeSize + 'px';
    ui.style.height = badgeSize + 'px';
    const btn = document.getElementById('tuBtn');
    if (btn) {
      btn.style.width = badgeSize + 'px';
      btn.style.height = badgeSize + 'px';
    }
    clampUiPos(ui);
  }

  async function init() {
    if (_initialized) return;
    _initialized = true;
    currentEngine = await detectEngineAuto();
    GM_addStyle(`
      .translate-ui{position:fixed;z-index:999999;font-family:system-ui,-apple-system,sans-serif;touch-action:none;overflow:visible}
      .translate-ui *{box-sizing:border-box;margin:0;padding:0}
      
      /* 悬浮球样式 */
      .tu-btn{
        border-radius:50%;border:none;background:#1e1e2f;color:#fff;cursor:grab;
        display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,0.3);
        transition:transform .2s,background .2s
      }
      .tu-btn:active{cursor:grabbing;transform:scale(0.9)}
      .tu-btn.active{background:#1f5a3a;color:#c3e8c3}
      
      /* 面板 - 强制夜间模式 */
      .tu-panel{
        position:absolute;bottom:100%;left:50%;transform:translateX(-50%);max-height:80vh;overflow-y:auto;
        background:rgba(20,22,27,0.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,0.5);padding:12px;display:none;
        color:#eef2ff;font-size:13px;margin-bottom:8px;border:1px solid rgba(70,80,100,0.5)
      }
      .tu-panel.show{display:block}
      
      .tu-panel label{display:block;margin:8px 0 4px;font-size:11px;color:#a0adc0;text-transform:uppercase;letter-spacing:.5px;font-weight:500}
      .tu-panel select, .tu-panel input{
        width:100%;padding:6px 10px;border:1px solid #3a3f4e;border-radius:10px;font-size:12px;
        background:#2a2e3a;color:#f0f3fa;outline:none;appearance:auto;transition:all .15s
      }
      .tu-panel select:focus, .tu-panel input:focus{border-color:#5a7cbf;box-shadow:0 0 0 2px rgba(90,124,191,0.3)}
      .tu-panel option{background:#2a2e3a;color:#f0f3fa}
      
      .tu-ai-config{background:#1e2532;padding:8px 10px;border-radius:12px;margin-top:6px;border:1px solid #2f3b4e;display:none}
      .tu-ai-config.show{display:block}
      .tu-ai-config input{margin-top:6px;background:#262d3c}
      
      .tu-status{margin-top:10px;padding:8px;background:#1a1e26;border-radius:10px;font-size:11px;color:#b0becc;text-align:center;border:1px solid #2e3540}
      
      /* 模式切换按钮组 */
      .tu-modes{display:flex;margin-top:8px;background:#232833;border-radius:12px;padding:3px;gap:4px}
      .tu-modes button{
        flex:1;padding:6px 0;border:none;border-radius:8px;font-size:11px;cursor:pointer;
        background:transparent;color:#a0aec0;transition:all .2s;font-weight:500
      }
      .tu-modes button.on{background:#3a4a6e;color:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
      .tu-modes button:hover:not(.on){background:#2f3648;color:#e2e8ff}
      
      /* 底部按钮行 */
      .tu-row{display:flex;gap:8px;margin-top:12px}
      .tu-row button{
        flex:1;padding:8px 0;border:none;border-radius:10px;font-size:12px;cursor:pointer;
        transition:all .2s;font-weight:500
      }
      .tu-row .tu-restore{background:#2a2f3c;color:#cbd5e6;border:1px solid #3f4658}
      .tu-row .tu-restore:hover{background:#353c4c;color:#ffffff}
      .tu-row .tu-go{background:#2c5a7c;color:#ffffff}
      .tu-row .tu-go:hover{background:#3671a0}
      .tu-row .tu-exclude{background:#6b2e3a;color:#ffcdd6}
      .tu-row .tu-exclude:hover{background:#8a3a48}
      .tu-row .tu-io{background:#3a3e52;color:#dce6f5}
      .tu-row .tu-io:hover{background:#4e546c}
      
      /* 双语对照样式 */
      .tu-bi{display:block;margin-top:3px;font-size:0.9em;line-height:1.5;color:#9ab9e0;border-left:2px solid #5a7cbf;padding-left:8px}
      a .tu-bi, span .tu-bi, em .tu-bi, strong .tu-bi, b .tu-bi, i .tu-bi, label .tu-bi,
      small .tu-bi, sub .tu-bi, sup .tu-bi, u .tu-bi{
        display:inline;border-left:none;padding-left:0;margin-top:0;margin-left:5px;font-size:0.88em
      }
      a .tu-bi::before, span .tu-bi::before, em .tu-bi::before, strong .tu-bi::before,
      b .tu-bi::before, i .tu-bi::before, label .tu-bi::before, small .tu-bi::before,
      sub .tu-bi::before, sup .tu-bi::before, u .tu-bi::before{content:"("}
      a .tu-bi::after, span .tu-bi::after, em .tu-bi::after, strong .tu-bi::after,
      b .tu-bi::after, i .tu-bi::after, label .tu-bi::after, small .tu-bi::after,
      sub .tu-bi::after, sup .tu-bi::after, u .tu-bi::after{content:")"}
      
      /* 滚动条美化 */
      .tu-panel::-webkit-scrollbar{width:5px}
      .tu-panel::-webkit-scrollbar-track{background:#1e222a;border-radius:10px}
      .tu-panel::-webkit-scrollbar-thumb{background:#525c72;border-radius:10px}
      .tu-panel::-webkit-scrollbar-thumb:hover{background:#6f7c98}
    `);

    const ui = document.createElement('div');
    ui.className = 'translate-ui';
    
    // 应用初始位置
    ui.style.right = uiPos.right + 'px';
    ui.style.bottom = uiPos.bottom + 'px';

    ui.innerHTML =
      '<div class="tu-panel" id="tuPanel">' +
        '<label>翻译引擎</label>' +
        '<select id="tuEngine">' +
          '<option value="microsoft">Microsoft (默认)</option>' +
          '<option value="google">Google (Auto)</option>' +
          '<option value="tencent">Tencent</option>' +
          '<option value="deepseek">DeepSeek (AI)</option>' +
          '<option value="glm">GLM-4 (AI)</option>' +
          '<option value="siliconflow">硅基流动 (AI)</option>' +
          '<option value="google_v2">Google (v2)</option>' +
          '<option value="google_legacy">Google (Legacy)</option>' +
        '</select>' +
        
        '<div id="tuAiConfig" class="tu-ai-config">' +
          '<label style="margin-top:0">API Key</label>' +
          '<input type="text" id="tuApiKey" placeholder="sk-...">' +
          '<label>模型名称</label>' +
          '<input type="text" id="tuModel" placeholder="例如: Qwen/Qwen2-7B-Instruct">' +
        '</div>' +

        '<label>目标语言</label>' +
        '<select id="tuLang">' + buildLangOptions() + '</select>' +
        '<label>显示模式</label>' +
        '<div class="tu-modes" id="tuModes">' +
          '<button data-m="translated"' + (displayMode === 'translated' ? ' class="on"' : '') + '>仅译文</button>' +
          '<button data-m="bilingual"' + (displayMode === 'bilingual' ? ' class="on"' : '') + '>双语</button>' +
          '<button data-m="original"' + (displayMode === 'original' ? ' class="on"' : '') + '>原文</button>' +
        '</div>' +
        '<div class="tu-status" id="tuStatus">Ready</div>' +
        '<div class="tu-row">' +
          '<button class="tu-restore" id="tuRestore">还原</button>' +
          '<button class="tu-go" id="tuGo">翻译</button>' +
        '</div>' +
        '<div class="tu-row">' +
          '<button class="tu-exclude" id="tuExclude">排除此站</button>' +
        '</div>' +
        '<div class="tu-row">' +
          '<button class="tu-io" id="tuExport">导出配置</button>' +
          '<button class="tu-io" id="tuImport">导入配置</button>' +
        '</div>' +
        '<input type="file" id="tuFileInput" accept=".json" style="display:none;">' +
      '</div>' +
      '<button class="tu-btn' + (autoMode ? ' active' : '') + '" id="tuBtn" draggable="false">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>' +
        '</svg>' +
      '</button>';
    document.body.appendChild(ui);

    // 动态尺寸
    updateUIPos(ui);

    const panel = document.getElementById('tuPanel');
    panel.style.width = getPanelWidth() + 'px';

    const btn = document.getElementById('tuBtn');
    const engineSelect = document.getElementById('tuEngine');
    const langSelect = document.getElementById('tuLang');
    const statusEl = document.getElementById('tuStatus');
    const modesEl = document.getElementById('tuModes');
    const aiConfigDiv = document.getElementById('tuAiConfig');
    const apiKeyInput = document.getElementById('tuApiKey');
    const modelInput = document.getElementById('tuModel');

    engineSelect.value = currentEngine;
    langSelect.value = targetLang;

    function updateAiConfigUI() {
        const selectedEngine = engineSelect.value;
        const isAI = Engine[selectedEngine]?.isAI;
        if (isAI) {
            aiConfigDiv.classList.add('show');
            if (selectedEngine === 'deepseek') {
                apiKeyInput.value = aiConfig.deepseek.key;
                modelInput.value = aiConfig.deepseek.model;
                modelInput.placeholder = "deepseek-chat";
            } else if (selectedEngine === 'glm') {
                apiKeyInput.value = aiConfig.glm.key;
                modelInput.value = aiConfig.glm.model;
                modelInput.placeholder = "glm-4-flash";
            } else if (selectedEngine === 'siliconflow') {
                apiKeyInput.value = aiConfig.siliconflow.key;
                modelInput.value = aiConfig.siliconflow.model;
                modelInput.placeholder = "Qwen/Qwen2-7B-Instruct";
            }
        } else {
            aiConfigDiv.classList.remove('show');
        }
    }
    updateAiConfigUI();

    let isDragging = false;
    let startX, startY, startRight, startBottom;
    let hasMoved = false;

    btn.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = uiPos.right;
      startBottom = uiPos.bottom;
      hasMoved = false;
      btn.setPointerCapture(e.pointerId);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
      let newRight = startRight + dx;
      let newBottom = startBottom + dy;
      const badgeSize = getBadgeSize();
      const maxX = Math.max(0, window.innerWidth - badgeSize);
      const maxY = Math.max(0, window.innerHeight - badgeSize);
      newRight = Math.max(0, Math.min(newRight, maxX));
      newBottom = Math.max(0, Math.min(newBottom, maxY));
      ui.style.right = newRight + 'px';
      ui.style.bottom = newBottom + 'px';
    });

    btn.addEventListener('pointerup', () => {
      if (!isDragging) return;
      isDragging = false;
      uiPos.right = parseInt(ui.style.right);
      uiPos.bottom = parseInt(ui.style.bottom);
      GM_setValue('uiPos', JSON.stringify(uiPos));
    });

    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

    btn.addEventListener('click', (e) => {
      if (hasMoved) return;
      e.stopPropagation();
      panel.classList.toggle('show');
    });

    document.addEventListener('click', (e) => { if (!ui.contains(e.target)) panel.classList.remove('show'); });

    engineSelect.addEventListener('change', async () => {
      currentEngine = engineSelect.value;
      GM_setValue('engine', currentEngine);
      updateAiConfigUI();
      cache.clear();
      setStatus('切换至: ' + (Engine[currentEngine] ? Engine[currentEngine].name : currentEngine));
      
      if (displayMode !== 'original' && autoMode) {
        restorePage();
        setStatus('正在重新翻译...');
        scanAndObserve(document.body); 
      }
    });

    apiKeyInput.addEventListener('blur', () => {
        const val = apiKeyInput.value.trim();
        if (engineSelect.value === 'deepseek') {
            aiConfig.deepseek.key = val;
            GM_setValue('deepseekKey', val);
        } else if (engineSelect.value === 'glm') {
            aiConfig.glm.key = val;
            GM_setValue('glmKey', val);
        } else if (engineSelect.value === 'siliconflow') {
            aiConfig.siliconflow.key = val;
            GM_setValue('siliconflowKey', val);
        }
    });
    
    modelInput.addEventListener('blur', () => {
        const val = modelInput.value.trim();
        if (engineSelect.value === 'deepseek') {
            aiConfig.deepseek.model = val;
            GM_setValue('deepseekModel', val);
        } else if (engineSelect.value === 'glm') {
            aiConfig.glm.model = val;
            GM_setValue('glmModel', val);
        } else if (engineSelect.value === 'siliconflow') {
            aiConfig.siliconflow.model = val;
            GM_setValue('siliconflowModel', val);
        }
    });

    langSelect.addEventListener('change', async () => {
      targetLang = langSelect.value;
      GM_setValue('targetLang', targetLang);
      cache.clear();
      setStatus('语种切为: ' + (ALL_LANGUAGES[targetLang] || targetLang));
      
      if (displayMode !== 'original' && autoMode) {
        restorePage();
        setStatus('正在更新翻译...');
        scanAndObserve(document.body);
      }
    });

    modesEl.addEventListener('click', async (e) => {
      var b = e.target.closest('button[data-m]');
      if (!b) return;
      var m = b.dataset.m;
      if (m === displayMode) return;
      modesEl.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      displayMode = m;
      GM_setValue('displayMode', m);
      if (m === 'original') {
        restorePage();
        btn.classList.remove('active');
        setStatus('显示原文');
      } else {
        restorePage();
        btn.classList.add('active');
        setStatus(m === 'bilingual' ? '双语翻译中...' : '翻译中...');
        scanAndObserve(document.body);
      }
    });

    document.getElementById('tuGo').addEventListener('click', async () => {
      if (apiKeyInput.value) apiKeyInput.dispatchEvent(new Event('blur'));
      if (modelInput.value) modelInput.dispatchEvent(new Event('blur'));

      panel.classList.remove('show'); btn.classList.add('active');
      autoMode = true; GM_setValue('autoMode', true);
      restorePage(); cache.clear();
      setStatus('翻译中...');
      scanAndObserve(document.body);
      setTimeout(() => setStatus('已开始处理可见区域...'), 100);
    });

    document.getElementById('tuRestore').addEventListener('click', () => {
      panel.classList.remove('show'); btn.classList.remove('active');
      autoMode = false; GM_setValue('autoMode', false);
      restorePage(); setStatus('已还原');
    });

    document.getElementById('tuExclude').addEventListener('click', () => {
      if (!excludedHosts.includes(location.host)) {
        excludedHosts.push(location.host);
        GM_setValue('excludedHosts', JSON.stringify(excludedHosts));
      }
      location.reload();
    });

    document.getElementById('tuExport').addEventListener('click', () => {
      const data = {
        engine: currentEngine,
        targetLang: targetLang,
        autoMode: autoMode,
        excludedHosts: excludedHosts,
        displayMode: displayMode,
        uiPos: uiPos,
        deepseek: aiConfig.deepseek,
        glm: aiConfig.glm,
        siliconflow: aiConfig.siliconflow
      };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "翻译配置.json"; 
      a.click();
      URL.revokeObjectURL(url);
      setStatus("✅ 配置已导出");
    });

    const fileInput = document.getElementById('tuFileInput');
    document.getElementById('tuImport').addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported.engine) GM_setValue('engine', imported.engine);
          if (imported.targetLang) GM_setValue('targetLang', imported.targetLang);
          if (typeof imported.autoMode === 'boolean') GM_setValue('autoMode', imported.autoMode);
          if (imported.displayMode) GM_setValue('displayMode', imported.displayMode);
          
          if (imported.excludedHosts) GM_setValue('excludedHosts', JSON.stringify(imported.excludedHosts));
          if (imported.uiPos) GM_setValue('uiPos', JSON.stringify(imported.uiPos));
          
          if (imported.deepseek) {
            if (imported.deepseek.key) GM_setValue('deepseekKey', imported.deepseek.key);
            if (imported.deepseek.model) GM_setValue('deepseekModel', imported.deepseek.model);
          }
          if (imported.glm) {
            if (imported.glm.key) GM_setValue('glmKey', imported.glm.key);
            if (imported.glm.model) GM_setValue('glmModel', imported.glm.model);
          }
          if (imported.siliconflow) {
            if (imported.siliconflow.key) GM_setValue('siliconflowKey', imported.siliconflow.key);
            if (imported.siliconflow.model) GM_setValue('siliconflowModel', imported.siliconflow.model);
          }
          
          alert("✅ 导入成功，即将刷新页面");
          location.reload();
        } catch (err) {
          alert("❌ 解析文件失败，请检查 JSON 格式");
          console.error(err);
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    // 窗口大小改变时重新调整尺寸和位置
    window.addEventListener('resize', () => {
      panel.style.width = getPanelWidth() + 'px';
      updateUIPos(ui);
      GM_setValue('uiPos', JSON.stringify(uiPos));
    });

    GM_registerMenuCommand('🚀 立即翻译当前页面', () => { scanAndObserve(document.body); });
    GM_registerMenuCommand('⏪ 还原当前页面', () => { restorePage(); });

    observer.observe(document.body, { childList: true, subtree: true });

    if (autoMode && !isPageInTargetLang() && displayMode !== 'original') {
      queueMicrotask(async () => {
        setStatus(displayMode === 'bilingual' ? '双语翻译中...' : '自动翻译中...');
        scanAndObserve(document.body);
      });
    }
  }

  initWhenBodyReady();

})();