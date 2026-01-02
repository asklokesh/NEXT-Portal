
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function TemplateWizardPage({ params }: { params: { templateId: string } }) {
    const router = useRouter();
    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const { templateId } = params; // In Next 15 this needs to be awaited if accessing async, but client component params behavior varies. Assuming direct access for now, will fix if needed.

    // Unwrap params if necessary (Next.js 15 breaking change potentially)
    const [unwrappedParams, setUnwrappedParams] = useState<{ templateId: string } | null>(null);

    useEffect(() => {
        // Handling param unwrapping for safety
        Promise.resolve(params).then(p => setUnwrappedParams(p));
    }, [params]);


    useEffect(() => {
        if (!unwrappedParams) return;

        fetch('/api/scaffolder/templates')
            .then(res => res.json())
            .then((data: any[]) => {
                const found = data.find(t => t.id === unwrappedParams.templateId);
                setTemplate(found);

                // Initialize defaults
                if (found) {
                    const defaults: any = {};
                    found.parameters.forEach((p: any) => {
                        if (p.default) defaults[p.name] = p.default;
                    });
                    setFormData(defaults);
                }
                setLoading(false);
            });
    }, [unwrappedParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/scaffolder/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: unwrappedParams?.templateId,
                    values: formData
                })
            });

            const data = await res.json();
            if (data.jobId) {
                router.push(`/create/job/${data.jobId}`);
            }
        } catch (err) {
            console.error('Failed to start job', err);
            setSubmitting(false);
        }
    };

    const handleChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (loading || !unwrappedParams) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    if (!template) return <div className="p-8">Template not found</div>;

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Templates
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>Configure {template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        {template.parameters.map((param: any) => (
                            <div key={param.name} className="space-y-2">
                                <Label htmlFor={param.name}>
                                    {param.label} {param.required && <span className="text-red-500">*</span>}
                                </Label>
                                {param.type === 'select' ? (
                                    <select
                                        id={param.name}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData[param.name] || ''}
                                        onChange={e => handleChange(param.name, e.target.value)}
                                        required={param.required}
                                    >
                                        {param.options?.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        id={param.name}
                                        value={formData[param.name] || ''}
                                        onChange={e => handleChange(param.name, e.target.value)}
                                        required={param.required}
                                        placeholder={param.description}
                                    />
                                )}
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
