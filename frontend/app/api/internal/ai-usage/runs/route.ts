import { NextRequest, NextResponse } from 'next/server';
import {
  ensureAiUsageAuth,
  getMergedRuns,
  toApiErrorResponse,
} from '@/lib/server/ai-usage-admin';

export async function GET(request: NextRequest) {
  try {
    await ensureAiUsageAuth(request);
    const data = await getMergedRuns(request.nextUrl.searchParams);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
