
import { NextRequest, NextResponse } from 'next/server';
import { scaffolderService } from '@/services/scaffolder/ScaffolderService';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { templateId, values } = body;

        if (!templateId || !values) {
            return NextResponse.json({ error: 'Missing templateId or values' }, { status: 400 });
        }

        const jobId = await scaffolderService.scaffold(templateId, values);
        return NextResponse.json({ jobId });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
