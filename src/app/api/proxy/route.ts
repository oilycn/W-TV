
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
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log the first 500 characters of the error text for easier debugging.
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
      // Attempt to parse as JSON 
      const jsonData = JSON.parse(textData);
      // If parsing succeeds, return the JSON data directly
      return NextResponse.json(jsonData);
    } catch (jsonError) {
      // If JSON parsing fails, it means the upstream source provided invalid JSON
      // or non-JSON data. The proxy should indicate this.
      console.warn(`Proxy: Response from ${decodedTargetUrl} was not parseable as valid JSON (Content-Type: ${contentType}). Returning as nonJsonData. Data snippet: ${textData.substring(0,200)}...`);
      // Return the raw textData wrapped in a nonJsonData field
      return NextResponse.json({ nonJsonData: textData });
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
