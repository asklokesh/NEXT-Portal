
import { NextResponse } from 'next/server';
import { CodeReviewService } from '@/services/code-review/code-review';
import { getRootLogger } from '@backstage/backend-common';

const logger = getRootLogger();
const codeReviewService = new CodeReviewService(logger);
codeReviewService.initialize();

export async function POST(request: Request) {
  const pullRequest = await request.json();
  await codeReviewService.reviewPullRequest(pullRequest);
  return NextResponse.json({ message: 'Pull request received' });
}
