import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'vm';
import * as cheerio from 'cheerio';
import { spawnSync, spawn } from 'child_process';

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
    const outer = $(el).prop('outerHTML') || (typeof $.html === 'function' ? $.html(el) : '');
    result.push(outer ? cheerio.load(outer) : cheerio.load(el));
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
    if (!target || target.length === 0) {
      if (attr && attr.toLowerCase() === 'html') {
        return typeof $.html === 'function' ? $.html() : '';
      }
      if (!attr || attr.toLowerCase() === 'text') {
        return $.root ? $.root().text().trim() : (typeof $.text === 'function' ? $.text().trim() : '');
      }
      target = $.root ? $.root() : $;
    }
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
    return target.html() || (typeof $.html === 'function' ? $.html() : '');
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
  const timeout = Math.min(Number(opt.timeout) || 3, 3);

  // Directly use Node fetch for 4kcz.com to bypass SafeLine WAF instantly without curl delay
  const isSafeLineTarget = url.includes('4kcz.com') || url.includes('cz4k.com') || url.includes('czzy.top');
  let needNodeFallback = isSafeLineTarget;

  // 1. First priority: curl (very fast, supports arbitrary headers, redirects, cookies)
  if (!isSafeLineTarget) {
    try {
      const cookieJarPath = path.join(os.tmpdir(), 'wftv_curl_cookies.txt');
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '';
      const args = [
        '-s',
        '-L',
        '--connect-timeout', '2',
        '--max-time', String(timeout),
        '--retry', '0',
        '-c', cookieJarPath,
        '-b', cookieJarPath,
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
      const res = spawnSync('curl', args, { encoding: null as any, maxBuffer: 15 * 1024 * 1024 });
      
      // If curl succeeded (HTTP connected)
      if (res.status === 0 && res.stdout && res.stdout.length > 0) {
        let text = decodeBufferToText(res.stdout, opt.encoding);
        // Auto-bypass 403 cookie challenge (e.g. Set-Cookie then window.location.href reload)
        if (text && text.includes('window.location.href') && text.includes('<title></title>')) {
          const res2 = spawnSync('curl', args, { encoding: null as any, maxBuffer: 15 * 1024 * 1024 });
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
            toString() {
              return text;
            },
          };
        } else {
          needNodeFallback = true;
        }
      } else {
        // Network connection error / timeout in domestic network: fail fast, DO NOT freeze event loop with second attempt!
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
    } catch (_err) {
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

  // 2. Second priority: Modern Node.js fetch process fallback (browser-like TLS fingerprint, bypasses SafeLine WAF only)
  if (needNodeFallback) {
    try {
      const payload = JSON.stringify({ url, method, headers, body: opt.body, timeout: timeout * 1000 });
      const script = `
        (async () => {
          try {
            const input = JSON.parse(process.argv[1]);
            const controller = new AbortController();
            const timeoutMs = Math.min(Number(input.timeout) || 3000, 3000);
            const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    } catch (_e) {}
  }

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
  const workerPath = path.join(process.cwd(), 'src', 'lib', 'rule-worker.cjs');

  return new Promise((resolve) => {
    try {
      const child = spawn(process.execPath, [workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      // Generous 25s budget for multi-step handshakes without freezing Next.js
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (_e) {}
        console.warn(`[RuleWorker] Timeout (25s) for ${ruleUrl} ${action}`);
        resolve({ code: 0, msg: 'Rule execution timeout', list: [] });
      }, 25000);

      child.stdout.on('data', chunk => {
        stdout += chunk;
      });

      child.stderr.on('data', chunk => {
        stderr += chunk;
      });

      child.on('close', () => {
        clearTimeout(timer);
        if (stderr) {
          // Keep stderr non-fatal for worker debugging
        }
        try {
          const res = JSON.parse(stdout);
          resolve(res);
        } catch (err) {
          console.error(`[RuleWorker] Failed to parse worker output for ${ruleUrl} ${action}:`, err, 'Raw:', stdout.substring(0, 200));
          resolve({ code: 0, msg: 'Worker JSON parse error', list: [] });
        }
      });

      child.on('error', err => {
        clearTimeout(timer);
        console.error(`[RuleWorker] Process spawn error for ${ruleUrl} ${action}:`, err);
        resolve({ code: 0, msg: err.message, list: [] });
      });

      const payload = JSON.stringify({ code, action, params, ruleUrl });
      child.stdin.write(payload);
      child.stdin.end();
    } catch (e: any) {
      console.error(`[RuleWorker] Synchronous error launching worker for ${ruleUrl} ${action}:`, e);
      resolve({ code: 0, msg: e.message || 'Worker launch failed', list: [] });
    }
  });
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
