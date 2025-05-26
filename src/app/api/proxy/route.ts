
import { type NextRequest, NextResponse } from 'next/server';

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

    const response = await fetch(decodedTargetUrl, {
      headers: {
        'User-Agent': 'CinemaViewApp/1.0 (NextJS Proxy)',
        // We remove 'Accept': 'application/json' here to be more flexible
        // as some servers might not respond correctly if this header is too strict.
      },
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

    try {
      // Attempt to parse as JSON regardless of content type first
      const jsonData = JSON.parse(textData);
      return NextResponse.json(jsonData);
    } catch (jsonError) {
      // If JSON parsing fails, and it wasn't declared as JSON, then treat as nonJsonData
      if (contentType && contentType.toLowerCase().includes('application/json')) {
        // If it claimed to be JSON but failed to parse, that's an error with the source
        console.error(`Proxy: Failed to parse JSON from ${decodedTargetUrl} even though Content-Type was ${contentType}. Data: ${textData.substring(0,200)}...`);
        return NextResponse.json({ error: 'Failed to parse JSON response from target', details: textData.substring(0,500) }, { status: 500 });
      }
      // If not JSON or failed to parse, and content type wasn't application/json, return as nonJsonData
      console.warn(`Proxy: Response from ${decodedTargetUrl} was not parseable as JSON (Content-Type: ${contentType}). Returning as nonJsonData. Data: ${textData.substring(0,100)}...`);
      return NextResponse.json({ nonJsonData: textData });
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
