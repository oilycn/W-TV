// Test script to verify proxy handles 304 responses correctly
const testUrl = 'http://localhost:3000/api/proxy?url=https%3A%2F%2Fjson.heimuer.tv%2Fapi.php%2Fprovide%2Fvod';

async function testProxy() {
  console.log('Testing proxy with conditional headers...\n');
  
  // First request - should get full response
  console.log('1. First request (no conditional headers):');
  const firstResponse = await fetch(testUrl);
  console.log(`Status: ${firstResponse.status}`);
  console.log(`ETag: ${firstResponse.headers.get('etag')}`);
  console.log(`Last-Modified: ${firstResponse.headers.get('last-modified')}`);
  console.log(`Cache-Control: ${firstResponse.headers.get('cache-control')}\n`);
  
  const etag = firstResponse.headers.get('etag');
  const lastModified = firstResponse.headers.get('last-modified');
  
  // Second request with conditional headers
  console.log('2. Second request (with conditional headers):');
  const headers = {};
  if (etag) headers['if-none-match'] = etag;
  if (lastModified) headers['if-modified-since'] = lastModified;
  
  console.log(`Sending headers: ${JSON.stringify(headers)}`);
  
  const secondResponse = await fetch(testUrl, { headers });
  console.log(`Status: ${secondResponse.status}`);
  console.log(`ETag: ${secondResponse.headers.get('etag')}`);
  console.log(`Last-Modified: ${secondResponse.headers.get('last-modified')}`);
  console.log(`Cache-Control: ${secondResponse.headers.get('cache-control')}`);
  
  if (secondResponse.status === 304) {
    console.log('✅ SUCCESS: Proxy correctly handled 304 Not Modified response!');
  } else {
    console.log('ℹ️  INFO: No 304 response (might be expected if content changed)');
  }
}

testProxy().catch(console.error);