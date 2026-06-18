// EdgeOne专用版本 - 不使用Edge Runtime
import { type NextRequest, NextResponse } from 'next/server';

// 注意：EdgeOne版本不使用 export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Target URL is required' }, { status: 400 });
  }

  try {
    const decodedTargetUrl = decodeURIComponent(targetUrl);
    
    if (!decodedTargetUrl.startsWith('http://') && !decodedTargetUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
    }

    // EdgeOne特殊处理：添加强制刷新头部以避免304问题
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'CinemaViewApp/1.0 (NextJS Proxy)',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };
    
    // 对于EdgeOne，我们不转发条件请求头以避免304问题
    // const ifModifiedSince = request.headers.get('if-modified-since');
    // const ifNoneMatch = request.headers.get('if-none-match');

    const response = await fetch(decodedTargetUrl, {
      headers: forwardHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Proxy: Error fetching ${decodedTargetUrl}: ${response.status} ${response.statusText}`, errorText.substring(0, 500));
      return NextResponse.json(
        { error: `Failed to fetch from target: ${response.status} ${response.statusText}`, details: errorText.substring(0, 500) },
        { status: response.status }
      );
    }

    // Try to get the raw text first to attempt JSON parsing
    const textData = await response.text();
    const contentType = response.headers.get('content-type');

    // 为EdgeOne添加防缓存头部
    const responseHeaders = new Headers();
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');

    try {
      // Attempt to parse as JSON 
      const jsonData = JSON.parse(textData);
      return NextResponse.json(jsonData, {
        headers: responseHeaders,
      });
    } catch (_jsonError) {
      console.warn(`Proxy: Response from ${decodedTargetUrl} was not parseable as valid JSON (Content-Type: ${contentType}). Returning as nonJsonData. Data snippet: ${textData.substring(0,200)}...`);
      return NextResponse.json({ nonJsonData: textData }, {
        headers: responseHeaders,
      });
    }

  } catch (error) {
    console.error(`Proxy: Exception fetching ${targetUrl}:`, error);
    let errorMessage = 'Unknown proxy error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Proxy failed to fetch target URL', message: errorMessage }, { status: 500 });
  }
}
