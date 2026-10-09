import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

// 黄果短剧等加密 CDN 的 AES 解密参数
const AES_KEY = Buffer.from('f5d965df75336270', 'utf8');
const AES_IV = Buffer.from('97b60394abc2fbe1', 'utf8');

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isIpv6Literal = normalized.includes(':');

  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    normalized.endsWith('.localhost') ||
    (isIpv6Literal && (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    )) ||
    isPrivateIpv4(normalized)
  );
}

function parseTargetUrl(rawTargetUrl: string): URL | NextResponse {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawTargetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
  }

  if (parsedUrl.username || parsedUrl.password) {
    return NextResponse.json({ error: 'URL credentials are not allowed' }, { status: 400 });
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Target host is not allowed' }, { status: 400 });
  }

  return parsedUrl;
}

/**
 * 解密 AES-128-CBC 加密图片数据
 */
function tryDecryptAesImage(buffer: Buffer): Buffer {
  // 已经是正常 JPEG、PNG、WebP、GIF 魔数，不需要解密
  if (
    (buffer[0] === 0xFF && buffer[1] === 0xD8) || // JPEG
    (buffer[0] === 0x89 && buffer[1] === 0x50) || // PNG
    (buffer[0] === 0x47 && buffer[1] === 0x49) || // GIF
    (buffer.subarray(0, 4).toString() === 'RIFF') // WebP
  ) {
    return buffer;
  }

  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    // 验证解密后是否为合法图片魔数
    if (
      (decrypted[0] === 0xFF && decrypted[1] === 0xD8) ||
      (decrypted[0] === 0x89 && decrypted[1] === 0x50) ||
      (decrypted[0] === 0x47 && decrypted[1] === 0x49) ||
      (decrypted.subarray(0, 4).toString() === 'RIFF')
    ) {
      return decrypted;
    }
  } catch (_e) {
    // 解密失败则返回原 buffer
  }
  return buffer;
}

/**
 * 通过系统 curl 抓取资源（高可靠兜底，支持代理与绕过 DNS 故障）
 */
function fetchViaCurl(targetUrl: string, referer?: string): Buffer | null {
  try {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '';
    const args = [
      '-s',
      '-L',
      '--connect-timeout', '5',
      '--max-time', '15',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ];
    if (referer) {
      args.push('-H', `Referer: ${referer}`);
    }
    if (proxy) {
      args.unshift('--proxy', proxy);
    }
    args.push(targetUrl);

    const res = spawnSync('curl', args, { encoding: null, maxBuffer: MAX_RESPONSE_BYTES });
    if (res.status === 0 && res.stdout && res.stdout.length > 0) {
      return res.stdout;
    }
  } catch (_err) {}
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Target URL is required' }, { status: 400 });
  }

  try {
    const parsedTarget = parseTargetUrl(targetUrl);

    if (parsedTarget instanceof NextResponse) {
      return parsedTarget;
    }

    const refererHeader = parsedTarget.origin + '/';
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': refererHeader,
    };

    // Forward conditional request headers
    const ifModifiedSince = request.headers.get('if-modified-since');
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifModifiedSince) forwardHeaders['if-modified-since'] = ifModifiedSince;
    if (ifNoneMatch) forwardHeaders['if-none-match'] = ifNoneMatch;

    let responseBuffer: Buffer | null = null;
    let contentType = '';
    let status = 200;

    // 是否属于已知需要特殊抓取的域名（如纯国内 CDN wirqed.cn）
    const isSpecialCdn = parsedTarget.hostname.includes('wirqed.cn');

    if (!isSpecialCdn) {
      try {
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(parsedTarget.toString(), {
          headers: forwardHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeoutTimer);

        if (response.status === 304) {
          return new NextResponse(null, { status: 304 });
        }

        if (response.ok) {
          const ab = await response.arrayBuffer();
          responseBuffer = Buffer.from(ab);
          contentType = response.headers.get('content-type') || '';
          status = response.status;
        }
      } catch (_fetchErr) {
        // fetch 失败（如 DNS 故障或超时），继续使用 curl 兜底
      }
    }

    // 若 fetch 失败或未获取到数据，使用 curl 兜底
    if (!responseBuffer || responseBuffer.length === 0) {
      responseBuffer = fetchViaCurl(parsedTarget.toString(), refererHeader);
    }

    if (!responseBuffer || responseBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch target URL via all methods' },
        { status: 502 }
      );
    }

    const isMediaOrImage =
      contentType.startsWith('image/') ||
      contentType.includes('octet-stream') ||
      isSpecialCdn ||
      /\.(jpe?g|png|webp|gif|svg|ico|bmp|avif)(\?|$)/i.test(parsedTarget.pathname);

    // 针对图片或媒体资源
    if (isMediaOrImage) {
      // 尝试对可能加密的二进制图片流进行 AES 解密
      let finalBuffer = responseBuffer;
      if (isSpecialCdn || contentType.includes('octet-stream') || !contentType.startsWith('image/')) {
        finalBuffer = tryDecryptAesImage(responseBuffer);
      }

      // 智能识别最终 Content-Type
      let finalContentType = 'image/jpeg';
      if (finalBuffer[0] === 0xFF && finalBuffer[1] === 0xD8) {
        finalContentType = 'image/jpeg';
      } else if (finalBuffer[0] === 0x89 && finalBuffer[1] === 0x50) {
        finalContentType = 'image/png';
      } else if (finalBuffer[0] === 0x47 && finalBuffer[1] === 0x49) {
        finalContentType = 'image/gif';
      } else if (finalBuffer.subarray(0, 4).toString() === 'RIFF') {
        finalContentType = 'image/webp';
      } else if (contentType && !contentType.includes('octet-stream')) {
        finalContentType = contentType;
      }

      const responseHeaders = new Headers();
      responseHeaders.set('content-type', finalContentType);
      responseHeaders.set('cache-control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000');
      responseHeaders.set('access-control-allow-origin', '*');
      responseHeaders.set('content-length', String(finalBuffer.length));

      return new NextResponse(finalBuffer, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // 非图片媒体资源：尝试返回 JSON 或文本
    const textData = responseBuffer.toString('utf8');
    const responseHeaders = new Headers();
    responseHeaders.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
    responseHeaders.set('access-control-allow-origin', '*');

    try {
      const jsonData = JSON.parse(textData);
      return NextResponse.json(jsonData, { headers: responseHeaders });
    } catch (_e) {
      return new NextResponse(textData, {
        status: status,
        headers: {
          'content-type': contentType || 'text/plain; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      });
    }

  } catch (error) {
    let errorMessage = 'Unknown proxy error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Proxy exception', message: errorMessage }, { status: 500 });
  }
}
