
import { NextRequest, NextResponse } from 'next/server';
import { metricsService } from '@/services/dashboard/metrics';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { widgetType, config } = body;

        if (!widgetType) {
            return NextResponse.json({ error: 'Widget type required' }, { status: 400 });
        }

        const data = await metricsService.getWidgetData(widgetType, config || {});
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Widget data fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch widget data', details: error.message },
            { status: 500 }
        );
    }
}
