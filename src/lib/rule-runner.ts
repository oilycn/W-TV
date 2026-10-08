import fs from 'fs';
import path from 'path';
import vm from 'vm';
import * as cheerio from 'cheerio';
import { spawnSync } from 'child_process';

interface RuleCacheEntry {
  code: string;
  timestamp: number;
}

const ruleCache = new Map<string, RuleCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolves a URL against host/origin
 */
export function fixUrl(url: string, host?: string): string {
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

/**
 * Parses DOM array based on CSS selector (supporting :eq(n))
 */
export function pdfa(html: any, parse: string): any[] {
  if (!html || !parse) return [];
  const $ = typeof html === 'string' ? cheerio.load(html) : html;

  const selector = String(parse).trim();
  const eqMatch = selector.match(/:eq\((\d+)\)/);
  let elements: any;
  if (eqMatch) {
    const idx = parseInt(eqMatch[1], 10);
    const baseSel = selector.replace(/:eq\(\d+\)/, '');
    elements = $(baseSel).eq(idx);
  } else {
    elements = $(selector);
  }

  const result: any[] = [];
  elements.each((_: any, el: any) => {
    result.push(cheerio.load(el));
  });
  return result;
}

function parseSinglePdfh($: any, itemStr: string): string {
  const parts = itemStr.split('&&');
  const sel = parts[0]?.trim();
  const attr = parts[1]?.trim();

  if (parts.length === 1) {
    if (sel.toLowerCase() === 'text') return $.root ? $.root().text().trim() : (typeof $.text === 'function' ? $.text().trim() : '');
    if (sel.toLowerCase() === 'html') return $.root ? $.root().html() || '' : (typeof $.html === 'function' ? $.html() || '' : '');
    return typeof $(sel)?.text === 'function' ? $(sel).text().trim() : '';
  }

  let target: any;
  if (sel === 'body') {
    target = $('body');
  } else {
    const eqMatch = sel.match(/:eq\((\d+)\)/);
    if (eqMatch) {
      const idx = parseInt(eqMatch[1], 10);
      const baseSel = sel.replace(/:eq\(\d+\)/, '');
      target = $(baseSel).eq(idx);
    } else {
      target = $(sel);
    }
  }

  if (!target || target.length === 0) return '';

  if (!attr || attr.toLowerCase() === 'text') {
    return target.text().trim();
  }
  if (attr.toLowerCase() === 'html') {
    return target.html() || '';
  }
  return target.attr(attr) || '';
}

/**
 * Parses DOM html/text/attribute based on parse string (supporting &&, :eq(n), and fallback selectors with ;)
 */
export function pdfh(html: any, parse: string): string {
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

/**
 * Parses DOM attribute and fixes relative URL against host
 */
export function pd(html: any, parse: string, host?: string): string {
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

/**
 * RC4 Decryption utility
 */
export function cyDecrypt(encryptedBase64: string, key: string): string {
  try {
    const encrypted = typeof atob === 'function' ? atob(encryptedBase64) : Buffer.from(encryptedBase64, 'base64').toString('binary');
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
      const t = (s[i] + s[j]) % 256;
      const cipherByte = encrypted.charCodeAt(k);
      decrypted += String.fromCharCode(cipherByte ^ s[t]);
    }
    return decrypted;
  } catch (_e) {
    return '';
  }
}

function decodeBufferToText(buf: Buffer | string | null | undefined, optEncoding?: string): string {
  if (!buf) return '';
  if (typeof buf === 'string') {
    // If it was already decoded as utf-8 but contains gbk html meta, try re-encoding if needed
    return buf;
  }
  const encoding = optEncoding?.toLowerCase();
  if (encoding && (encoding.includes('gbk') || encoding.includes('gb2312') || encoding.includes('gb18030'))) {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch (_e) {}
  }
  // Detect HTML charset meta in the first 2KB
  const sample = buf.subarray(0, 2048).toString('binary').toLowerCase();
  if (/charset\s*=\s*['"]?\s*(gb2312|gbk|gb18030)/i.test(sample)) {
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

/**
 * Synchronous HTTP request runner inside Node.js
 */
export function syncRequest(url: string, opt: any = {}) {
  const method = (opt.method || 'GET').toUpperCase();
  const headers = opt.headers || {};
  const timeout = opt.timeout || 12;

  // 1. First priority: curl (very fast, supports arbitrary headers, redirects, cookies)
  try {
    const args = ['-s', '-L', '--max-time', String(timeout), '-X', method];
    for (const [k, v] of Object.entries(headers)) {
      args.push('-H', `${k}: ${v}`);
    }
    if (opt.body) {
      args.push('--data', typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body));
    }
    args.push(url);
    const res = spawnSync('curl', args, { encoding: null as any, maxBuffer: 15 * 1024 * 1024 });
    if (res.status === 0 || (res.stdout && res.stdout.length > 0)) {
      const text = decodeBufferToText(res.stdout, opt.encoding);
      return {
        code: 200,
        status: 200,
        text,
        body: text,
        toString() {
          return text;
        },
      };
    }
  } catch (_err) {
    // curl failed, fallback to Node fetch
  }

  // 2. Second priority: Node.js process fallback
  try {
    const payload = JSON.stringify({ url, method, headers, body: opt.body, timeout: timeout * 1000 });
    const script = `
      const https = require('https');
      const http = require('http');
      const input = JSON.parse(process.argv[1]);
      const client = input.url.startsWith('https') ? https : http;
      const parsed = new URL(input.url);
      const req = client.request(parsed, {
        method: input.method,
        headers: input.headers,
        timeout: input.timeout,
        rejectUnauthorized: false
      }, (res) => {
        let chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          process.stdout.write(Buffer.concat(chunks));
        });
      });
      req.on('error', () => { process.exit(1); });
      req.on('timeout', () => { req.destroy(); process.exit(1); });
      if (input.body) req.write(typeof input.body === 'string' ? input.body : JSON.stringify(input.body));
      req.end();
    `;
    const res = spawnSync(process.execPath, ['-e', script, payload], { encoding: null as any, maxBuffer: 15 * 1024 * 1024 });
    const text = decodeBufferToText(res.stdout, opt.encoding);
    return {
      code: res.status === 0 ? 200 : 500,
      status: res.status === 0 ? 200 : 500,
      text,
      body: text,
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
      toString() {
        return '';
      },
    };
  }
}

/**
 * Fetch rule script content from URL or local file
 */
export async function loadRuleCode(ruleUrl: string): Promise<string> {
  const cached = ruleCache.get(ruleUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.code;
  }

  let code = '';

  // Priority 1: Check if matching local rule exists in public/rules
  const ruleName = ruleUrl.split('/').pop()?.split('?')[0];
  if (ruleName) {
    try {
      const decodedName = decodeURIComponent(ruleName);
      const localRulePath = path.join(process.cwd(), 'public', 'rules', decodedName);
      if (fs.existsSync(localRulePath)) {
        code = fs.readFileSync(localRulePath, 'utf-8');
        ruleCache.set(ruleUrl, { code, timestamp: Date.now() });
        return code;
      }
    } catch (_e) {}
  }

  if (ruleUrl.startsWith('http://') || ruleUrl.startsWith('https://')) {
    const resp = await fetch(ruleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) W-TV/1.0',
      },
      cache: 'no-store',
    });
    if (!resp.ok) {
      throw new Error(`Failed to download rule from ${ruleUrl}: HTTP ${resp.status}`);
    }
    code = await resp.text();
  } else {
    // Local file path
    const localPath = ruleUrl.startsWith('/')
      ? path.join(process.cwd(), ruleUrl.startsWith('/public') ? ruleUrl : `public${ruleUrl}`)
      : path.join(process.cwd(), 'public', 'rules', ruleUrl);

    if (fs.existsSync(localPath)) {
      code = fs.readFileSync(localPath, 'utf-8');
    } else {
      throw new Error(`Local rule file not found: ${ruleUrl}`);
    }
  }

  if (!code || code.trim().length === 0) {
    throw new Error(`Rule content is empty for ${ruleUrl}`);
  }

  ruleCache.set(ruleUrl, { code, timestamp: Date.now() });
  return code;
}

/**
 * Universal video stream sniffer
 */
export function smartSniffStreamUrl(
  targetUrl: string,
  host?: string,
  customHeaders?: any
): { url: string; headers?: Record<string, string> } | null {
  if (!targetUrl || typeof targetUrl !== 'string') return null;
  targetUrl = targetUrl.trim();

  // If already a direct stream
  if (targetUrl.includes('.m3u8') || targetUrl.includes('.mp4') || targetUrl.includes('.flv')) {
    return { url: targetUrl, headers: customHeaders };
  }

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

  // 3.4 ArtPlayer Url & Sign (e.g. qiyou, lekanzyw)
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

  // 3.5 iframe recursion (1 level depth)
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

    // Check if url=http is in query param
    const upm = ifr.match(/[?&]url=([^&]+)/i);
    if (upm) {
      const dec = decodeURIComponent(upm[1]);
      if (dec.startsWith('http') && (dec.includes('.m3u8') || dec.includes('.mp4'))) {
        return { url: dec, headers: pageHeaders };
      }
    }

    // Sniff the iframe content
    const ifRes = syncRequest(ifr, { headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': targetUrl }, timeout: 8 });
    const ifHtml = ifRes.text || '';
    if (ifHtml) {
      // direct m3u8 in iframe
      const ifDirect = ifHtml.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || ifHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
      if (ifDirect) {
        return { url: ifDirect[1].replace(/\\/g, ''), headers: { 'User-Agent': pageHeaders['User-Agent'], 'Referer': ifr } };
      }

      // ArtPlayer in iframe
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

export interface RuleExecutionParams {
  tid?: string;
  pg?: number | string;
  vid?: string;
  wd?: string;
  flag?: string;
  playUrl?: string;
  filter?: any;
  extend?: any;
}

/**
 * Executes a rule and returns standard CMS-compatible format
 */
export async function executeRule(
  ruleUrl: string,
  action: 'home' | 'category' | 'detail' | 'play' | 'search',
  params: RuleExecutionParams = {}
): Promise<any> {
  const code = await loadRuleCode(ruleUrl);

  const context: any = {
    console,
    request: syncRequest,
    req: syncRequest,
    fetchHtml: (url: string, ref?: string) => syncRequest(url, { headers: { Referer: ref } }).text,
    pdfa,
    pdfh,
    pd,
    cyDecrypt,
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
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

  // Build categories from class_name & class_url
  const categories: Array<{ type_id: string; type_name: string }> = [];
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

    // Fallback: return categories and fetch first category items
    const firstCat = categories[0]?.type_id || '1';
    let firstList: any[] = [];
    try {
      if (typeof rule.category === 'function') {
        const catRes = rule.category(firstCat, 1);
        firstList = catRes?.list || [];
      } else if (rule['一级']) {
        const catRes = parseDeclarativeYiji(rule, firstCat, 1);
        firstList = catRes?.list || [];
      }
    } catch (_err) {
      // Continue even if first category fails
    }

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
    let detailItem: any = null;

    if (typeof rule.detail === 'function') {
      try {
        detailItem = rule.detail(vid);
        // Normalize if detail returns an array or single object
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
    let candidateHeaders: any = rule.headers;

    if (typeof rule.play === 'function') {
      try {
        const playRes = rule.play(flag, playUrl);
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

    // Direct stream check
    if (candidateUrl.includes('.m3u8') || candidateUrl.includes('.mp4') || candidateUrl.includes('.flv')) {
      return { code: 1, url: candidateUrl, headers: candidateHeaders };
    }

    // Run smart sniffer on candidateUrl or original playUrl
    const sniffed =
      smartSniffStreamUrl(candidateUrl, rule.host, candidateHeaders) ||
      smartSniffStreamUrl(playUrl, rule.host, candidateHeaders);

    if (sniffed && sniffed.url) {
      return { code: 1, url: sniffed.url, headers: sniffed.headers || candidateHeaders };
    }

    // If not a direct stream and cannot be sniffed to a stream, do not return web page
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
        const list: any[] = [];

        for (const it of items) {
          const title = parts[1] ? pdfh(it, parts[1].trim()) : '';
          const img = parts[2] ? pd(it, parts[2].trim(), rule.host) : '';
          const rem = parts[3] ? pdfh(it, parts[3].trim()) : '';
          const href = parts[4] ? pd(it, parts[4].trim(), rule.host) : '';
          if (title || href) {
            list.push({
              vod_id: href,
              vod_name: title || '未知片名',
              vod_pic: img,
              vod_remarks: rem,
            });
          }
        }
        return { code: 1, page: pg, list };
      } catch (err) {
        console.error(`Rule search selector error for ${ruleUrl}:`, err);
      }
    }

    return { code: 1, list: [] };
  }

  return { code: 0, msg: `Unknown action: ${action}` };
}

function parseDeclarativeYiji(rule: any, tid: string, pg: number | string) {
  const host = rule.host || '';
  let url = rule.url || '';
  url = url.replace(/fyclass/g, tid).replace(/fypage/g, String(pg));
  if (!url.startsWith('http')) {
    url = host + (url.startsWith('/') ? '' : '/') + url;
  }
  const resp = syncRequest(url, { headers: rule.headers, timeout: 15 });
  const html = resp.text || '';
  if (!html) return { code: 1, list: [] };

  const parts = String(rule['一级']).split(';');
  const itemSel = parts[0]?.trim();
  const titleSel = parts[1]?.trim();
  const imgSel = parts[2]?.trim();
  const remSel = parts[3]?.trim();
  const hrefSel = parts[4]?.trim();

  const items = pdfa(html, itemSel);
  const list: any[] = [];
  for (const it of items) {
    const title = titleSel ? pdfh(it, titleSel) : '';
    const img = imgSel ? pd(it, imgSel, host) : '';
    const rem = remSel ? pdfh(it, remSel) : '';
    const href = hrefSel ? pd(it, hrefSel, host) : '';
    if (title || href) {
      list.push({
        vod_id: href,
        vod_name: title || '未知片名',
        vod_pic: img,
        vod_remarks: rem,
      });
    }
  }
  return { code: 1, page: parseInt(String(pg), 10), pagecount: 999, limit: list.length, total: 1000, list };
}

function parseDeclarativeErji(rule: any, vid: string) {
  const host = rule.host || '';
  let detailUrl = String(vid).trim();
  if (!detailUrl.startsWith('http')) {
    detailUrl = host + (detailUrl.startsWith('/') ? '' : '/') + detailUrl;
  }
  const resp = syncRequest(detailUrl, { headers: rule.headers, timeout: 15 });
  const html = resp.text || '';
  if (!html) return { vod_id: vid, vod_name: '', vod_play_url: '' };

  const erji = rule['二级'] || {};
  let title = erji.title ? pdfh(html, erji.title) : '';
  if (!title) {
    const rawT = pdfh(html, 'h1.detail-title&&Text;h1&&Text;meta[property="og:title"]&&content;title&&Text');
    const m = rawT.match(/《([^》]+)》/);
    title = m ? m[1] : (rawT.replace(/[-_].*$/, '').trim() || '视频详情');
  }
  let img = erji.img ? pd(html, erji.img, host) : '';
  if (!img) {
    img = pd(html, 'meta[property="og:image"]&&content;.detail-cover&&src;img&&src', host);
  }
  const desc = erji.desc ? pdfh(html, erji.desc) : pdfh(html, 'meta[name="description"]&&content;.detail-intro&&Text');
  const content = erji.content ? pdfh(html, erji.content) : desc;

  const tabs = erji.tabs ? pdfa(html, erji.tabs) : [];
  const tabNames: string[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tn = pdfh(tabs[i], 'Text');
    tabNames.push(tn || `线路${i + 1}`);
  }
  if (tabNames.length === 0) tabNames.push('默认线路');

  const playFromList: string[] = [];
  const playUrlList: string[] = [];
  const listSel = erji.lists || '';

  for (let t = 0; t < tabNames.length; t++) {
    const curSel = listSel.replace('#id', String(t));
    let items = pdfa(html, curSel);
    if ((!items || items.length === 0) && curSel.includes(':eq(')) {
      items = pdfa(html, curSel.replace(/:eq\(\d+\)/, ''));
    }
    const eps: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const epName = pdfh(it, 'Text') || `第${i + 1}集`;
      const epHref = pd(it, 'a&&href', host) || pdfh(it, 'a&&href');
      if (epHref) eps.push(`${epName.trim()}$${epHref.trim()}`);
    }
    if (eps.length > 0) {
      playFromList.push(tabNames[t]);
      playUrlList.push(eps.join('#'));
    }
  }

  return {
    vod_id: vid,
    vod_name: title,
    vod_pic: img,
    vod_remarks: desc,
    vod_content: content || desc,
    vod_play_from: playFromList.join('$$$'),
    vod_play_url: playUrlList.join('$$$'),
  };
}
