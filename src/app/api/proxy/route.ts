
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Target URL is required' }, { status: 400 });
  }

  try {
    // Validate the URL to prevent potential SSRF vulnerabilities, though decodeURIComponent is a good first step.
    // For more security, you might want to whitelist allowed domains or protocols.
    const decodedTargetUrl = decodeURIComponent(targetUrl);
    
    // Basic check for http/https scheme
    if (!decodedTargetUrl.startsWith('http://') && !decodedTargetUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
    }

    const response = await fetch(decodedTargetUrl, {
      headers: {
        // Some APIs might require a specific User-Agent.
        'User-Agent': 'CinemaViewApp/1.0 (NextJS Proxy)',
        'Accept': 'application/json', // Assuming we expect JSON
      },
      // It's good to set a timeout for external requests.
      // Note: AbortSignal is the standard way, but for simplicity in this example:
      // consider packages like 'node-fetch' with timeout options if running in a Node.js server environment
      // or handle timeouts with AbortController.
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Proxy: Error fetching ${decodedTargetUrl}: ${response.status} ${response.statusText}`, errorText.substring(0, 500)); // Log snippet of error
      return NextResponse.json(
        { error: `Failed to fetch from target: ${response.status} ${response.statusText}`, details: errorText.substring(0, 500) },
        { status: response.status }
      );
    }

    // Check content type before trying to parse as JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return NextResponse.json(data);
    } else {
        // If not JSON, return as text or handle appropriately
        const textData = await response.text();
        console.warn(`Proxy: Response from ${decodedTargetUrl} was not JSON. Content-Type: ${contentType}. Returning as text.`);
        // For simplicity, we'll still try to return it in a JSON structure if the client expects it,
        // or you might want to return a different response type.
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
