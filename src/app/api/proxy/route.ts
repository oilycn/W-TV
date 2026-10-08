import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

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

    // Forward conditional request headers for proper caching
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': parsedTarget.origin + '/',
    };
    
    // Forward conditional request headers
    const ifModifiedSince = request.headers.get('if-modified-since');
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifModifiedSince) {
      forwardHeaders['if-modified-since'] = ifModifiedSince;
    }
    if (ifNoneMatch) {
      forwardHeaders['if-none-match'] = ifNoneMatch;
    }

    const response = await fetch(parsedTarget.toString(), {
      headers: forwardHeaders,
      signal: request.signal,
    });

    // Handle 304 Not Modified response
    if (response.status === 304) {
      // Forward the 304 response with appropriate headers
      const headers = new Headers();
      
      // Forward cache-related headers
      const cacheControl = response.headers.get('cache-control');
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      const expires = response.headers.get('expires');
      
      if (cacheControl) headers.set('cache-control', cacheControl);
      if (etag) headers.set('etag', etag);
      if (lastModified) headers.set('last-modified', lastModified);
      if (expires) headers.set('expires', expires);
      
      return new NextResponse(null, {
        status: 304,
        headers: headers,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      // Log the first 500 characters of the error text for easier debugging.
      console.error(`Proxy: Error fetching ${parsedTarget.toString()}: ${response.status} ${response.statusText}`, errorText.substring(0, 500));
      return NextResponse.json(
        { error: `Failed to fetch from target: ${response.status} ${response.statusText}`, details: errorText.substring(0, 500) },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const isImageOrMedia = 
      contentType.startsWith('image/') ||
      contentType.includes('octet-stream') ||
      /\.(jpe?g|png|webp|gif|svg|ico|bmp|avif)(\?|$)/i.test(parsedTarget.pathname);

    // Prepare cache-related and CORS headers to forward
    const responseHeaders = new Headers();
    const cacheControl = response.headers.get('cache-control') || 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const expires = response.headers.get('expires');
    
    responseHeaders.set('cache-control', cacheControl);
    responseHeaders.set('access-control-allow-origin', '*');
    if (etag) responseHeaders.set('etag', etag);
    if (lastModified) responseHeaders.set('last-modified', lastModified);
    if (expires) responseHeaders.set('expires', expires);

    // If target is an image or media stream, stream response.body directly with correct image content-type
    if (isImageOrMedia) {
      let finalContentType = contentType;
      if (!finalContentType || finalContentType.includes('octet-stream')) {
        const lowerPath = parsedTarget.pathname.toLowerCase();
        if (lowerPath.endsWith('.png')) finalContentType = 'image/png';
        else if (lowerPath.endsWith('.webp')) finalContentType = 'image/webp';
        else if (lowerPath.endsWith('.gif')) finalContentType = 'image/gif';
        else if (lowerPath.endsWith('.svg')) finalContentType = 'image/svg+xml';
        else finalContentType = 'image/jpeg';
      }
      responseHeaders.set('content-type', finalContentType);
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Try to get the raw text first to attempt JSON parsing
    const textData = await response.text();
    if (new TextEncoder().encode(textData).byteLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Target response is too large' }, { status: 413 });
    }

    try {
      // Attempt to parse as JSON 
      const jsonData = JSON.parse(textData);
      return NextResponse.json(jsonData, {
        headers: responseHeaders,
      });
    } catch (_jsonError) {
      return NextResponse.json({ nonJsonData: textData }, {
        headers: responseHeaders,
      });
    }

  } catch (error) {
    // This catches errors from the fetch operation itself (e.g., network issues to the target)
    console.error(`Proxy: Exception fetching ${targetUrl}:`, error);
    let errorMessage = 'Unknown proxy error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Proxy failed to fetch target URL', message: errorMessage }, { status: 500 });
  }
}
