
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Grid, Code, Server, Box } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
}

export default function CreatePage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/scaffolder/templates')
            .then(res => res.json())
            .then(data => {
                setTemplates(data);
                setLoading(false);
            });
    }, []);

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'react': return <Code className="w-8 h-8 text-blue-500" />;
            case 'java': return <Server className="w-8 h-8 text-orange-500" />;
            default: return <Box className="w-8 h-8 text-gray-500" />;
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Create New Component</h1>
                <p className="text-muted-foreground mt-2">Choose a template to scaffold a new service, website, or library.</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(template => (
                        <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col">
                            <CardHeader className="flex-row gap-4 items-start space-y-0 pb-2">
                                <div className="p-2 bg-muted rounded-lg">
                                    {getIcon(template.icon)}
                                </div>
                                <div>
                                    <CardTitle className="text-lg">{template.name}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <CardDescription className="text-sm line-clamp-2 min-h-[40px]">
                                    {template.description}
                                </CardDescription>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {template.tags.map(tag => (
                                        <span key={tag} className="text-xs px-2 py-1 bg-secondary rounded-full text-secondary-foreground">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2">
                                <Link href={`/create/${template.id}`} className="w-full">
                                    <Button className="w-full">
                                        Choose <PlusCircle className="ml-2 w-4 h-4" />
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}