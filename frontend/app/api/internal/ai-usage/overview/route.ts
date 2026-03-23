import { NextRequest, NextResponse } from 'next/server';
import {
  ensureAiUsageAuth,
  getMergedOverview,
  toApiErrorResponse,
} from '@/lib/server/ai-usage-admin';

export async function GET(request: NextRequest) {
  try {
    await ensureAiUsageAuth(request);
    const data = await getMergedOverview(request.nextUrl.searchParams);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
