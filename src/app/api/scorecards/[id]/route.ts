
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scorecardService } from '@/services/scorecards/ScorecardService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const service = await prisma.service.findUnique({
            where: { id: params.id }
        });

        if (!service) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        const scorecard = scorecardService.calculateScore(service);
        return NextResponse.json(scorecard);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
