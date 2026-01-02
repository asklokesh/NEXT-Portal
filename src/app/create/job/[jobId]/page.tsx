
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function JobPage({ params }: { params: { jobId: string } }) {
    const [job, setJob] = useState<any>(null);
    const [unwrappedParams, setUnwrappedParams] = useState<{ jobId: string } | null>(null);

    useEffect(() => {
        Promise.resolve(params).then(p => setUnwrappedParams(p));
    }, [params]);

    useEffect(() => {
        if (!unwrappedParams) return;

        const interval = setInterval(() => {
            fetch(`/api/scaffolder/jobs/${unwrappedParams.jobId}`)
                .then(res => res.json())
                .then(data => {
                    setJob(data);
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(interval);
                    }
                });
        }, 1000);

        return () => clearInterval(interval);
    }, [unwrappedParams]);

    if (!job) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Scaffolding Progress
                        {job.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                        {job.status === 'completed' && <CheckCircle className="w-6 h-6 text-green-500" />}
                        {job.status === 'failed' && <XCircle className="w-6 h-6 text-red-500" />}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {job.steps.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-6 flex justify-center">
                                    {step.status === 'pending' && <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                                    {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                                    {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                </div>
                                <span className={step.status === 'pending' ? 'text-muted-foreground' : 'font-medium'}>
                                    {step.name}
                                </span>
                            </div>
                            <span className="text-xs uppercase text-muted-foreground">{step.status}</span>
                        </div>
                    ))}

                    {job.status === 'completed' && job.result && (
                        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">Success!</h3>
                            <div className="flex gap-3">
                                <Link href="/catalog" className="text-sm underline text-green-700 dark:text-green-400">
                                    View in Catalog
                                </Link>
                                {job.result.repoUrl && (
                                    <a href={job.result.repoUrl} target="_blank" rel="noreferrer" className="flex items-center text-sm underline text-green-700 dark:text-green-400">
                                        Open Repository <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    {job.status === 'completed' && (
                        <Link href="/catalog">
                            <Button>Go to Catalog</Button>
                        </Link>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
