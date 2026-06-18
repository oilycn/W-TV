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
      'User-Agent': 'CinemaViewApp/1.0 (NextJS Proxy)',
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

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Target response is too large' }, { status: 413 });
    }

    // Try to get the raw text first to attempt JSON parsing
    const textData = await response.text();
    if (new TextEncoder().encode(textData).byteLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Target response is too large' }, { status: 413 });
    }

    const contentType = response.headers.get('content-type');

    // Prepare cache-related headers to forward
    const responseHeaders = new Headers();
    const cacheControl = response.headers.get('cache-control');
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const expires = response.headers.get('expires');
    
    if (cacheControl) responseHeaders.set('cache-control', cacheControl);
    if (etag) responseHeaders.set('etag', etag);
    if (lastModified) responseHeaders.set('last-modified', lastModified);
    if (expires) responseHeaders.set('expires', expires);

    try {
      // Attempt to parse as JSON 
      const jsonData = JSON.parse(textData);
      // If parsing succeeds, return the JSON data directly
      return NextResponse.json(jsonData, {
        headers: responseHeaders,
      });
    } catch (_jsonError) {
      // If JSON parsing fails, it means the upstream source provided invalid JSON
      // or non-JSON data. The proxy should indicate this.
      console.warn(`Proxy: Response from ${parsedTarget.toString()} was not parseable as valid JSON (Content-Type: ${contentType}). Returning as nonJsonData. Data snippet: ${textData.substring(0,200)}...`);
      // Return the raw textData wrapped in a nonJsonData field
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
