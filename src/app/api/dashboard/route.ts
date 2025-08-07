
import { NextResponse } from 'next/server';
import { DashboardService } from '@/services/dashboard/dashboard-service';
import { getRootLogger } from '@backstage/backend-common';

const logger = getRootLogger();
const dashboardService = new DashboardService(logger);
dashboardService.initialize();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const dashboard = await dashboardService.getDashboard(userId!);
  return NextResponse.json({ dashboard });
}

export async function POST(request: Request) {
  const { userId, layout } = await request.json();
  await dashboardService.saveDashboard(userId, layout);
  return NextResponse.json({ message: 'Dashboard saved' });
}
