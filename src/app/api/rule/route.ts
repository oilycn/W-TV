import { NextRequest, NextResponse } from 'next/server';
import { executeRule } from '@/lib/rule-runner';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ruleUrl = searchParams.get('rule');

  if (!ruleUrl) {
    return NextResponse.json({ code: 0, msg: 'Missing "rule" parameter' }, { status: 400 });
  }

  const ac = searchParams.get('ac') || '';
  const tid = searchParams.get('t') || '';
  const pg = searchParams.get('pg') || '1';
  const ids = searchParams.get('ids') || searchParams.get('id') || searchParams.get('vid') || '';
  const wd = searchParams.get('wd') || '';
  const playUrl = searchParams.get('url') || searchParams.get('play') || '';
  const flag = searchParams.get('flag') || '';

  try {
    // 1. Detail request by ID
    if (ids || (ac === 'detail' && ids)) {
      const result = await executeRule(ruleUrl, 'detail', { vid: ids });
      return NextResponse.json(result);
    }

    // 2. Play resolving request
    if (ac === 'play' || (ac === 'detail' && playUrl)) {
      const result = await executeRule(ruleUrl, 'play', { playUrl: playUrl || ids, flag });
      return NextResponse.json(result);
    }

    // 3. Search request
    if (wd || (ac === 'detail' && wd)) {
      const result = await executeRule(ruleUrl, 'search', { wd, pg });
      return NextResponse.json(result);
    }

    // 4. Category list request (when explicit category tid is provided)
    if (tid && tid !== '0' && tid !== 'all') {
      const result = await executeRule(ruleUrl, 'category', { tid, pg });
      return NextResponse.json(result);
    }

    // 5. Default / Home request (for "all" categories or initial home)
    const result = await executeRule(ruleUrl, 'home', { pg });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`Error in /api/rule for ${ruleUrl}:`, error);
    return NextResponse.json(
      { code: 0, msg: error.message || 'Internal rule execution error', list: [] },
      { status: 500 }
    );
  }
}
