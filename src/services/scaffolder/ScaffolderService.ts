
import { prisma } from '@/lib/prisma';
import { ServiceType, Lifecycle } from '@prisma/client';

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    owner: string;
    parameters: {
        name: string;
        label: string;
        description?: string;
        type: 'string' | 'boolean' | 'select';
        options?: string[];
        required?: boolean;
        default?: any;
    }[];
}

export interface ScaffoldJob {
    id: string;
    templateId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    steps: {
        name: string;
        status: 'pending' | 'running' | 'completed' | 'failed';
        message?: string;
    }[];
    result?: {
        entityRef: string;
        repoUrl: string;
    };
}

class ScaffolderService {
    private templates: Template[] = [
        {
            id: 'react-app-template',
            name: 'React Web Application',
            description: 'Create a new React application with TypeScript and Vite.',
            icon: 'react',
            tags: ['react', 'frontend', 'vite'],
            owner: 'team-frontend',
            parameters: [
                { name: 'name', label: 'Name', type: 'string', required: true, description: 'Unique name of the component' },
                { name: 'description', label: 'Description', type: 'string', required: true },
                { name: 'owner', label: 'Owner', type: 'select', options: ['team-frontend', 'team-backend', 'team-ops'], default: 'team-frontend' }
            ]
        },
        {
            id: 'springboot-service-template',
            name: 'Spring Boot Service',
            description: 'Scaffold a Java Spring Boot microservice with DB connection.',
            icon: 'java',
            tags: ['java', 'backend', 'spring'],
            owner: 'team-backend',
            parameters: [
                { name: 'name', label: 'Name', type: 'string', required: true },
                { name: 'javaVersion', label: 'Java Version', type: 'select', options: ['17', '21'], default: '17' },
                { name: 'dbType', label: 'Database', type: 'select', options: ['PostgreSQL', 'MySQL', 'None'], default: 'PostgreSQL' }
            ]
        }
    ];

    private jobs: Map<string, ScaffoldJob> = new Map();

    getTemplates(): Template[] {
        return this.templates;
    }

    getTemplate(id: string): Template | undefined {
        return this.templates.find(t => t.id === id);
    }

    async scaffold(templateId: string, values: any): Promise<string> {
        const jobId = `job-${Date.now()}`;
        const job: ScaffoldJob = {
            id: jobId,
            templateId,
            status: 'running',
            steps: [
                { name: 'Validate Inputs', status: 'pending' },
                { name: 'Create Repository', status: 'pending' },
                { name: 'Templating Code', status: 'pending' },
                { name: 'Publishing to Catalog', status: 'pending' }
            ]
        };
        this.jobs.set(jobId, job);

        // Mock Async Process
        this.runJob(jobId, values);

        return jobId;
    }

    getJob(jobId: string): ScaffoldJob | undefined {
        return this.jobs.get(jobId);
    }

    private async runJob(jobId: string, values: any) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        try {
            // Step 1: Validate
            job.steps[0].status = 'running';
            await delay(1000);
            job.steps[0].status = 'completed';

            // Step 2: Create Repo
            job.steps[1].status = 'running';
            await delay(1500);
            job.steps[1].status = 'completed';

            // Step 3: Templating
            job.steps[2].status = 'running';
            await delay(2000);
            job.steps[2].status = 'completed';

            // Step 4: Publish (Create in DB)
            job.steps[3].status = 'running';

            await prisma.service.create({
                data: {
                    name: values.name,
                    displayName: values.name,
                    description: values.description || `Scaffolding from ${job.templateId}`,
                    type: ServiceType.SERVICE,
                    lifecycle: Lifecycle.EXPERIMENTAL,
                    ownerId: values.owner || 'unknown',
                    tags: [job.templateId, 'scaffolded'],
                    isActive: true
                }
            });

            job.steps[3].status = 'completed';

            job.status = 'completed';
            job.result = {
                entityRef: `component:default/${values.name}`,
                repoUrl: `https://github.com/my-org/${values.name}`
            };

        } catch (error) {
            job.status = 'failed';
            console.error('Scaffolding failed', error);
        }
    }
}

export const scaffolderService = new ScaffolderService();
