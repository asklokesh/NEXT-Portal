
import { NextResponse } from 'next/server';
import { scaffolderService } from '@/services/scaffolder/ScaffolderService';

export async function GET() {
    const templates = scaffolderService.getTemplates();
    return NextResponse.json(templates);
}
