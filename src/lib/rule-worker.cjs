const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');
const cheerio = require('cheerio');

// Persistent cookie jar file path
const COOKIE_JAR_PATH = path.join(os.tmpdir(), 'wftv_curl_cookies.txt');

// Global Host Cache across worker executions if preserved
const HOST_CACHE = new Map();

function fixUrl(url, host) {
  if (!url) return '';
  url = String(url).trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (!host) return url;
  try {
    const hostObj = new URL(host.startsWith('http') ? host : 'https://' + host);
    if (url.startsWith('/')) {
      return hostObj.origin + url;
    }
    return hostObj.origin + '/' + url;
  } catch (_e) {
    return url;
  }
}

function pdfa(html, parse) {
  if (!html || !parse) return [];
  const $ = typeof html === 'string' ? cheerio.load(html) : html;

  const selector = String(parse).trim();
  const eqMatch = selector.match(/:eq\((\d+)\)/);
  let elements;
  if (eqMatch) {
    const idx = parseInt(eqMatch[1], 10);
    const baseSel = selector.replace(/:eq\(\d+\)/, '');
    elements = $(baseSel).eq(idx);
  } else {
    elements = $(selector);
  }

  const result = [];
  elements.each((_, el) => {
    const outer = $(el).prop('outerHTML') || (typeof $.html === 'function' ? $.html(el) : '');
    result.push(outer ? cheerio.load(outer) : cheerio.load(el));
  });
  return result;
}

function parseSinglePdfh($, singleParse) {
  const parts = singleParse.split('&&');
  let current = $;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (i === parts.length - 1) {
      if (/^text$/i.test(part)) {
        return (typeof current.text === 'function' ? current.text() : '').trim();
      }
      if (/^html$/i.test(part)) {
        return (typeof current.html === 'function' ? current.html() : '').trim();
      }
      return (typeof current.attr === 'function' ? (current.attr(part) || '') : '').trim();
    }

    const eqMatch = part.match(/:eq\((\d+)\)/);
    if (eqMatch) {
      const idx = parseInt(eqMatch[1], 10);
      const baseSel = part.replace(/:eq\(\d+\)/, '').trim();
      if (typeof current === 'function') {
        current = baseSel ? current(baseSel).eq(idx) : current('*').eq(idx);
      } else if (typeof current.find === 'function') {
        current = baseSel ? current.find(baseSel).eq(idx) : current.eq(idx);
      } else {
        current = $(baseSel).eq(idx);
      }
    } else {
      if (typeof current === 'function') {
        current = current(part);
      } else if (typeof current.find === 'function') {
        current = current.find(part);
      } else {
        current = $(part);
      }
    }
  }

  return (typeof current.text === 'function' ? current.text() : '').trim();
}

function pdfh(html, parse) {
  if (!html || !parse) return '';
  const $ = typeof html === 'string' ? cheerio.load(html) : html;
  const candidates = String(parse).split(';');
  for (const c of candidates) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const res = parseSinglePdfh($, trimmed);
    if (res && res.length > 0) return res;
  }
  return '';
}

function pd(html, parse, host) {
  if (!html || !parse) return '';
  const $ = typeof html === 'string' ? cheerio.load(html) : html;
  const candidates = String(parse).split(';');
  for (const c of candidates) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const res = parseSinglePdfh($, trimmed);
    if (res && res.length > 0) return fixUrl(res, host);
  }
  return '';
}

function cyDecrypt(encryptedBase64, key) {
  try {
    const encrypted = Buffer.from(encryptedBase64, 'base64').toString('binary');
    const keyLen = key.length;
    const dataLen = encrypted.length;
    const s = new Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % keyLen)) % 256;
      const tmp = s[i];
      s[i] = s[j];
      s[j] = tmp;
    }
    let i = 0;
    j = 0;
    let decrypted = '';
    for (let k = 0; k < dataLen; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const tmp = s[i];
      s[i] = s[j];
      s[j] = tmp;
      decrypted += String.fromCharCode(encrypted.charCodeAt(k) ^ s[(s[i] + s[j]) % 256]);
    }
    return decrypted;
  } catch (_e) {
    return '';
  }
}

function decodeBufferToText(buf, encoding) {
  if (!buf) return '';
  if (encoding && encoding.toLowerCase().includes('gb')) {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch (_e) {}
  }
  try {
    return new TextDecoder('utf-8').decode(buf);
  } catch (_e) {
    return buf.toString('utf-8');
  }
}

function syncRequest(url, opt = {}) {
  const method = (opt.method || 'GET').toUpperCase();
  const headers = opt.headers || {};
  // Respect rule script's own timeout (e.g. 8s, 15s). Default 10s, capped at 20s.
  const timeout = Math.min(Math.max(Number(opt.timeout) || 10, 3), 20);

  // Bypass SafeLine WAF for 4kcz.com directly with Node fetch process
  const isSafeLineTarget = url.includes('4kcz.com') || url.includes('cz4k.com') || url.includes('czzy.top');

  if (!isSafeLineTarget) {
    try {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '';
      const args = [
        '-s',
        '-L',
        '--connect-timeout', '4',
        '--max-time', String(timeout),
        '--retry', '0',
        '-c', COOKIE_JAR_PATH,
        '-b', COOKIE_JAR_PATH,
      ];
      if (proxy) {
        args.push('--proxy', proxy);
      }
      if (method !== 'GET') {
        args.push('-X', method);
      }
      for (const [k, v] of Object.entries(headers)) {
        args.push('-H', `${k}: ${v}`);
      }
      if (opt.body) {
        args.push('--data', typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body));
      }
      args.push(url);

      const res = spawnSync('curl', args, { encoding: null, maxBuffer: 20 * 1024 * 1024 });

      if (res.status === 0 && res.stdout && res.stdout.length > 0) {
        let text = decodeBufferToText(res.stdout, opt.encoding);

        // Auto-bypass 403 challenge redirect (Cookie set -> window.location.href reload)
        if (text && text.includes('window.location.href') && text.includes('<title></title>')) {
          const res2 = spawnSync('curl', args, { encoding: null, maxBuffer: 20 * 1024 * 1024 });
          if (res2.status === 0 && res2.stdout && res2.stdout.length > 0) {
            text = decodeBufferToText(res2.stdout, opt.encoding);
          }
        }

        const isWafBlocked = text.includes('SafeLine') || text.includes('雷池') || text.includes('slg-box') || text.includes('slg-warning');
        if (!isWafBlocked) {
          return {
            code: 200,
            status: 200,
            text,
            body: text,
            headers: {},
            toString() {
              return text;
            },
          };
        }
      } else {
        // Fast fail on connection error without freezing
        return {
          code: 500,
          status: 500,
          text: '',
          body: '',
          headers: {},
          toString() {
            return '';
          },
        };
      }
    } catch (_err) {
      return {
        code: 500,
        status: 500,
        text: '',
        body: '',
        headers: {},
        toString() {
          return '';
        },
      };
    }
  }

  // Fallback: Node.js fetch process for SafeLine WAF
  try {
    const payload = JSON.stringify({ url, method, headers, body: opt.body, timeout: timeout * 1000 });
    const script = `
      (async () => {
        try {
          const input = JSON.parse(process.argv[1]);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), input.timeout || 10000);
          const resp = await fetch(input.url, {
            method: input.method || 'GET',
            headers: input.headers || {},
            body: input.body ? (typeof input.body === 'string' ? input.body : JSON.stringify(input.body)) : undefined,
            redirect: 'follow',
            signal: controller.signal
          });
          clearTimeout(timer);
          const buf = Buffer.from(await resp.arrayBuffer());
          process.stdout.write(buf);
        } catch (e) {
          process.exit(1);
        }
      })();
    `;
    const res = spawnSync(process.execPath, ['-e', script, payload], { encoding: null, maxBuffer: 20 * 1024 * 1024 });
    const text = decodeBufferToText(res.stdout, opt.encoding);
    return {
      code: res.status === 0 ? 200 : 500,
      status: res.status === 0 ? 200 : 500,
      text,
      body: text,
      headers: {},
      toString() {
        return text;
      },
    };
  } catch (_e) {
    return {
      code: 500,
      status: 500,
      text: '',
      body: '',
      headers: {},
      toString() {
        return '';
      },
    };
  }
}

function smartSniffStreamUrl(targetUrl, host, customHeaders) {
  if (!targetUrl || !targetUrl.startsWith('http')) return null;

  // 1. Specialized: jisuzhuiju.com
  const jm = targetUrl.match(/\/vodplay\/(\d+)-([^-]+)-(\d+)\.html/i);
  if (jm) {
    const apiUrl = `https://jisuzhuiju.com/api/play-url?vodId=${jm[1]}&playFrom=${jm[2]}&index=${jm[3]}`;
    const res = syncRequest(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
        'Referer': targetUrl,
      },
      timeout: 8,
    });
    try {
      const json = JSON.parse(res.text);
      if (json && json.url && String(json.url).startsWith('http')) {
        return {
          url: json.url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
            'Referer': 'https://jisuzhuiju.com/',
          },
        };
      }
    } catch (_e) {}
  }

  // 2. Specialized: cupfox.in tea play
  if (targetUrl.includes('cupfox.in') && targetUrl.includes('/tea/')) {
    const res = syncRequest(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.cupfox.in/',
      },
      timeout: 8,
    });
    try {
      const data = JSON.parse(res.text);
      const plays = data?.video_plays || [];
      if (plays.length && plays[0].play_data?.startsWith('http')) {
        return {
          url: plays[0].play_data,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cupfox.in/' },
        };
      }
    } catch (_e) {}
  }

  // 3. General HTML page sniffing
  const pageHeaders = {
    'User-Agent': customHeaders?.['User-Agent'] || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': host ? (host.endsWith('/') ? host : host + '/') : targetUrl,
    ...(customHeaders || {}),
  };

  const pageRes = syncRequest(targetUrl, { headers: pageHeaders, timeout: 10 });
  const html = pageRes.text || '';
  if (!html) return null;

  // 3.1 Direct stream link inside HTML
  const directM = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
  if (directM) {
    return { url: directM[1].replace(/\\/g, ''), headers: pageHeaders };
  }

  // 3.2 MacPlayer player_aaaa JSON
  const macM = html.match(/var\s+player_aaaa\s*=\s*({[\s\S]*?});/i);
  if (macM) {
    try {
      const pdata = JSON.parse(macM[1]);
      if (pdata && pdata.url) {
        let pUrl = String(pdata.url).trim();
        if (pUrl.includes('url=http')) {
          const m = pUrl.match(/[?&]url=([^&]+)/);
          if (m) pUrl = decodeURIComponent(m[1]);
        }
        if (pUrl.startsWith('http')) {
          return { url: pUrl, headers: pageHeaders };
        }
      }
    } catch (_e) {}
  }

  // 3.3 ddcloud (DDYS / 低端影视)
  const ddMatch = html.match(/ddcloud\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/i);
  if (ddMatch) {
    const realUrl = cyDecrypt(ddMatch[1], ddMatch[2]);
    if (realUrl && realUrl.startsWith('http')) {
      return { url: realUrl, headers: pageHeaders };
    }
  }

  // 3.4 ArtPlayer Url & Sign
  const urlM = html.match(/const\s+Url\s*=\s*["']([^"']+)["']/i) || html.match(/var\s+url\s*=\s*["']([^"']+)["']/i);
  const signM = html.match(/const\s+Sign\s*=\s*["']([^"']+)["']/i) || html.match(/var\s+sign\s*=\s*["']([^"']+)["']/i);
  const fromM = html.match(/const\s+From\s*=\s*["']([^"']+)["']/i) || html.match(/var\s+from\s*=\s*["']([^"']+)["']/i);
  if (urlM && signM) {
    try {
      const origin = new URL(targetUrl).origin;
      const api = `${origin}/player/api.php?url=${encodeURIComponent(urlM[1])}&sign=${encodeURIComponent(signM[1])}&t=${encodeURIComponent(fromM ? fromM[1] : 'm3u8')}`;
      const apiRes = syncRequest(api, { headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': targetUrl }, timeout: 8 });
      const apiJson = JSON.parse(apiRes.text);
      if (apiJson && apiJson.url && apiJson.url.startsWith('http')) {
        return { url: apiJson.url, headers: pageHeaders };
      }
    } catch (_e) {}
  }

  // 3.5 iframe recursion (1 level)
  const ifmM = html.match(/<iframe\b[^>]*src=["']?([^"'>]+)/i);
  if (ifmM) {
    let ifr = ifmM[1].trim();
    if (ifr.startsWith('//')) ifr = 'https:' + ifr;
    else if (!ifr.startsWith('http')) {
      try {
        const u = new URL(targetUrl);
        ifr = u.origin + (ifr.startsWith('/') ? '' : '/') + ifr;
      } catch (_e) {}
    }

    const upm = ifr.match(/[?&]url=([^&]+)/i);
    if (upm) {
      const dec = decodeURIComponent(upm[1]);
      if (dec.startsWith('http') && (dec.includes('.m3u8') || dec.includes('.mp4'))) {
        return { url: dec, headers: pageHeaders };
      }
    }

    const ifRes = syncRequest(ifr, { headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': targetUrl }, timeout: 8 });
    const ifHtml = ifRes.text || '';
    if (ifHtml) {
      const ifDirect = ifHtml.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || ifHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
      if (ifDirect) {
        return { url: ifDirect[1].replace(/\\/g, ''), headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': ifr } };
      }

      const ifUrlM = ifHtml.match(/const\s+Url\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+url\s*=\s*["']([^"']+)["']/i);
      const ifSignM = ifHtml.match(/const\s+Sign\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+sign\s*=\s*["']([^"']+)["']/i);
      const ifFromM = ifHtml.match(/const\s+From\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+from\s*=\s*["']([^"']+)["']/i);
      if (ifUrlM && ifSignM) {
        try {
          const origin = new URL(ifr).origin;
          const api = `${origin}/player/api.php?url=${encodeURIComponent(ifUrlM[1])}&sign=${encodeURIComponent(ifSignM[1])}&t=${encodeURIComponent(ifFromM ? ifFromM[1] : 'm3u8')}`;
          const apiRes = syncRequest(api, { headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': ifr }, timeout: 8 });
          const apiJson = JSON.parse(apiRes.text);
          if (apiJson && apiJson.url && apiJson.url.startsWith('http')) {
            return { url: apiJson.url, headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': ifr } };
          }
        } catch (_e) {}
      }
    }
  }

  return null;
}

function parseDeclarativeYiji(rule, tid, pg) {
  const host = rule.host || '';
  let url = rule.url || '';
  url = url.replace(/fyclass/g, encodeURIComponent(tid)).replace(/fypage/g, String(pg));
  if (!url.startsWith('http')) {
    url = host + (url.startsWith('/') ? '' : '/') + url;
  }

  const resp = syncRequest(url, { headers: rule.headers, timeout: 15 });
  const html = resp.text || '';
  const parts = String(rule['一级']).split(';');
  const items = pdfa(html, parts[0]?.trim());

  const list = [];
  for (const item of items) {
    const title = parts[1] ? pdfh(item, parts[1].trim()) : '';
    const pic = parts[2] ? pd(item, parts[2].trim(), host) : '';
    const desc = parts[3] ? pdfh(item, parts[3].trim()) : '';
    const link = parts[4] ? pd(item, parts[4].trim(), host) : '';

    if (title && link) {
      list.push({
        vod_id: link,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: desc,
      });
    }
  }

  return {
    code: 1,
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    limit: list.length || 20,
    total: 1000,
    list,
  };
}

function parseDeclarativeErji(rule, vid) {
  const host = rule.host || '';
  const detailUrl = fixUrl(vid, host);
  const resp = syncRequest(detailUrl, { headers: rule.headers, timeout: 15 });
  const html = resp.text || '';
  if (!html) return null;

  const erji = rule['二级'];
  if (typeof erji !== 'object') return null;

  const title = erji.title ? pdfh(html, erji.title) : '';
  const img = erji.img ? pd(html, erji.img, host) : '';
  const desc = erji.desc ? pdfh(html, erji.desc) : '';
  const content = erji.content ? pdfh(html, erji.content) : '';

  let tabs = [];
  if (erji.tabs) {
    const tabEls = pdfa(html, erji.tabs);
    tabs = tabEls.map(t => pdfh(t, 'body&&Text')).filter(Boolean);
  }
  if (!tabs.length) tabs = ['默认线路'];

  const playFrom = [];
  const playUrls = [];

  if (erji.lists) {
    const listStr = String(erji.lists).trim();
    if (listStr.includes('#id')) {
      const tabCount = Math.max(tabs.length, 1);
      for (let i = 0; i < tabCount; i++) {
        const sel = listStr.replace(/#id/g, String(i));
        const epEls = pdfa(html, sel);
        const eps = [];
        for (const ep of epEls) {
          const epName = pdfh(ep, 'body&&Text') || pdfh(ep, 'a&&title') || '正片';
          const epLink = pd(ep, 'a&&href', host) || pd(ep, 'body&&href', host);
          if (epLink) eps.push(`${epName}$${epLink}`);
        }
        if (eps.length) {
          playFrom.push(tabs[i] || `线路${i + 1}`);
          playUrls.push(eps.join('#'));
        }
      }
    } else {
      const listEls = pdfa(html, listStr);
      for (let i = 0; i < listEls.length; i++) {
        const epEls = pdfa(listEls[i], 'a');
        const eps = [];
        for (const ep of epEls) {
          const epName = pdfh(ep, 'body&&Text') || pdfh(ep, 'a&&title') || '正片';
          const epLink = pd(ep, 'a&&href', host) || pd(ep, 'body&&href', host);
          if (epLink) eps.push(`${epName}$${epLink}`);
        }
        if (eps.length) {
          playFrom.push(tabs[i] || `线路${i + 1}`);
          playUrls.push(eps.join('#'));
        }
      }
    }
  }

  return {
    vod_id: vid,
    vod_name: title || '未知视频',
    vod_pic: img,
    vod_remarks: desc,
    vod_content: content,
    vod_play_from: playFrom.join('$$$'),
    vod_play_url: playUrls.join('$$$'),
  };
}

function runRule(code, action, params, ruleUrl) {
  const context = {
    console,
    request: syncRequest,
    req: syncRequest,
    fetchHtml: (url, ref) => syncRequest(url, { headers: { Referer: ref } }).text,
    pdfa,
    pdfh,
    pd,
    cyDecrypt,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    encodeURIComponent,
    decodeURIComponent,
    parseInt,
    parseFloat,
    JSON,
    String,
    Object,
    Array,
    RegExp,
    Date,
    Math,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  const rule = context.rule || context.spider || {};

  const categories = [];
  if (rule.class_name && rule.class_url) {
    const names = String(rule.class_name).split('&');
    const urls = String(rule.class_url).split('&');
    for (let i = 0; i < names.length; i++) {
      if (names[i] && urls[i]) {
        categories.push({ type_id: urls[i].trim(), type_name: names[i].trim() });
      }
    }
  }

  // 1. HOME ACTION
  if (action === 'home') {
    if (typeof rule.home === 'function') {
      try {
        const homeRes = rule.home();
        if (!homeRes.class && categories.length > 0) {
          homeRes.class = categories;
        }
        return {
          code: 1,
          msg: '数据列表',
          class: homeRes.class || categories,
          list: homeRes.list || [],
        };
      } catch (err) {
        console.error(`Rule home() error for ${ruleUrl}:`, err);
      }
    }

    const firstCat = categories[0]?.type_id || '1';
    let firstList = [];
    try {
      if (typeof rule.category === 'function') {
        const catRes = rule.category(firstCat, 1);
        firstList = catRes?.list || [];
      } else if (rule['一级']) {
        const catRes = parseDeclarativeYiji(rule, firstCat, 1);
        firstList = catRes?.list || [];
      }
    } catch (_err) {}

    return {
      code: 1,
      msg: '数据列表',
      class: categories,
      list: firstList,
    };
  }

  // 2. CATEGORY ACTION
  if (action === 'category') {
    const tid = String(params.tid || categories[0]?.type_id || '1');
    const pg = parseInt(String(params.pg || 1), 10) || 1;

    if (typeof rule.category === 'function') {
      try {
        const res = rule.category(tid, pg, params.filter, params.extend);
        return {
          code: 1,
          page: res?.page || pg,
          pagecount: res?.pagecount || (res?.list?.length ? pg + 1 : pg),
          limit: res?.limit || res?.list?.length || 20,
          total: res?.total || 1000,
          class: categories,
          list: res?.list || [],
        };
      } catch (err) {
        console.error(`Rule category() error for ${ruleUrl}:`, err);
        return { code: 0, msg: String(err), list: [] };
      }
    }

    if (rule['一级']) {
      return parseDeclarativeYiji(rule, tid, pg);
    }

    return { code: 1, page: pg, pagecount: pg, total: 0, list: [] };
  }

  // 3. DETAIL ACTION
  if (action === 'detail') {
    const vid = String(params.vid || '').trim();
    let detailItem = null;

    if (typeof rule.detail === 'function') {
      try {
        detailItem = rule.detail(vid);
        if (Array.isArray(detailItem)) {
          detailItem = detailItem[0];
        } else if (detailItem && Array.isArray(detailItem.list)) {
          detailItem = detailItem.list[0];
        }
      } catch (err) {
        console.error(`Rule detail() error for ${ruleUrl}:`, err);
      }
    } else if (rule['二级']) {
      detailItem = parseDeclarativeErji(rule, vid);
    }

    if (detailItem) {
      return {
        code: 1,
        list: [detailItem],
      };
    }

    return { code: 0, msg: '未找到视频详情', list: [] };
  }

  // 4. PLAY ACTION
  if (action === 'play') {
    const flag = String(params.flag || '').trim();
    const playUrl = String(params.playUrl || '').trim();
    let candidateUrl = playUrl;
    let candidateHeaders = rule.headers;

    if (typeof rule.play === 'function') {
      try {
        const playRes = rule.play(flag || rule.title || '默认', playUrl || flag, []);
        if (typeof playRes === 'string') {
          candidateUrl = playRes;
        } else if (playRes && playRes.url) {
          candidateUrl = playRes.url;
          if (playRes.headers) candidateHeaders = playRes.headers;
        }
      } catch (err) {
        console.error(`Rule play() error for ${ruleUrl}:`, err);
      }
    } else if (rule.play_url) {
      let templ = String(rule.play_url);
      templ = templ.replace('{vodId}', params.vid || '');
      templ = templ.replace('{playFrom}', encodeURIComponent(flag));
      templ = templ.replace('{index}', playUrl);
      if (!templ.startsWith('http')) {
        templ = (rule.host || '') + (templ.startsWith('/') ? '' : '/') + templ;
      }
      candidateUrl = templ;
    }

    if (candidateUrl.includes('.m3u8') || candidateUrl.includes('.mp4') || candidateUrl.includes('.flv')) {
      return { code: 1, url: candidateUrl, headers: candidateHeaders };
    }

    const sniffed =
      smartSniffStreamUrl(candidateUrl, rule.host, candidateHeaders) ||
      smartSniffStreamUrl(playUrl, rule.host, candidateHeaders);

    if (sniffed && sniffed.url) {
      return { code: 1, url: sniffed.url, headers: sniffed.headers || candidateHeaders };
    }

    return { code: 0, url: '', msg: '未能解析到可用的视频流，请尝试更换线路或刷新重试' };
  }

  // 5. SEARCH ACTION
  if (action === 'search') {
    const wd = String(params.wd || '').trim();
    const pg = parseInt(String(params.pg || 1), 10) || 1;

    if (typeof rule.search === 'function') {
      try {
        const res = rule.search(wd, pg);
        return {
          code: 1,
          page: pg,
          pagecount: 999,
          list: res?.list || [],
        };
      } catch (err) {
        console.error(`Rule search() error for ${ruleUrl}:`, err);
      }
    }

    if (rule['搜索'] && rule.searchUrl) {
      try {
        let sUrl = String(rule.searchUrl)
          .replace(/\*\*/g, encodeURIComponent(wd))
          .replace(/fypage/g, String(pg));
        if (!sUrl.startsWith('http')) {
          sUrl = (rule.host || '') + (sUrl.startsWith('/') ? '' : '/') + sUrl;
        }

        const resp = syncRequest(sUrl, { headers: rule.headers, timeout: 15 });
        const html = resp.text || '';
        const parts = String(rule['搜索']).split(';');
        const items = pdfa(html, parts[0]?.trim());

        const list = [];
        for (const item of items) {
          const title = parts[1] ? pdfh(item, parts[1].trim()) : '';
          const pic = parts[2] ? pd(item, parts[2].trim(), rule.host) : '';
          const desc = parts[3] ? pdfh(item, parts[3].trim()) : '';
          const link = parts[4] ? pd(item, parts[4].trim(), rule.host) : '';

          if (title && link) {
            list.push({
              vod_id: link,
              vod_name: title,
              vod_pic: pic,
              vod_remarks: desc,
            });
          }
        }

        return {
          code: 1,
          page: pg,
          pagecount: 999,
          list,
        };
      } catch (err) {
        console.error(`Rule declarative search error for ${ruleUrl}:`, err);
      }
    }

    return { code: 1, page: pg, pagecount: pg, list: [] };
  }

  return { code: 0, msg: `Unknown action: ${action}`, list: [] };
}

// Read payload from stdin
let inputChunks = [];
process.stdin.on('data', chunk => {
  inputChunks.push(chunk);
});

process.stdin.on('end', () => {
  try {
    const inputStr = Buffer.concat(inputChunks).toString('utf-8');
    const input = JSON.parse(inputStr);
    const result = runRule(input.code, input.action, input.params, input.ruleUrl);
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ code: 0, msg: err.message || 'Worker execution failed', list: [] }));
    process.exit(1);
  }
});
