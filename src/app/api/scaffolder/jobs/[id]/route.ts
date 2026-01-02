
import { NextRequest, NextResponse } from 'next/server';
import { scaffolderService } from '@/services/scaffolder/ScaffolderService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const job = scaffolderService.getJob(params.id);

    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
}
