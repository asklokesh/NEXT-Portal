import * as yaml from 'js-yaml';
import {
  DeploymentConfig,
  CanaryConfig,
  BlueGreenConfig,
  ABTestingConfig,
} from './deployment-config';

export class PipelineAutomation {
  generateGitHubWorkflow(config: DeploymentConfig): string {
    const workflow = {
      name: `Deploy ${config.name}`,
      on: {
        push: {
          branches: ['main'],
        },
        workflow_dispatch: {
          inputs: {
            environment: {
              description: 'Environment to deploy to',
              required: true,
              default: 'staging',
              type: 'choice',
              options: ['staging', 'production'],
            },
          },
        },
      },
      env: {
        REGISTRY: 'ghcr.io',
        IMAGE_NAME: `${config.name}`,
      },
      jobs: this.generateJobs(config),
    };

    return yaml.dump(workflow);
  }

  private generateJobs(config: DeploymentConfig): any {
    const jobs: any = {
      'build-and-push': {
        'runs-on': 'ubuntu-latest',
        permissions: {
          contents: 'read',
          packages: 'write',
        },
        outputs: {
          'image-tag': `${{ steps.meta.outputs.tags }}`,
          'image-digest': `${{ steps.build.outputs.digest }}`,
        },
        steps: [
          {
            name: 'Checkout code',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Set up Docker Buildx',
            uses: 'docker/setup-buildx-action@v3',
          },
          {
            name: 'Log in to Container Registry',
            uses: 'docker/login-action@v3',
            with: {
              registry: `${{ env.REGISTRY }}`,
              username: `${{ github.actor }}`,
              password: `${{ secrets.GITHUB_TOKEN }}`,
            },
          },
          {
            id: 'meta',
            name: 'Extract metadata',
            uses: 'docker/metadata-action@v5',
            with: {
              images: `${{ env.REGISTRY }}/${config.name}`,
              tags: [
                'type=ref,event=branch',
                'type=ref,event=pr',
                'type=semver,pattern={{version}}',
                'type=semver,pattern={{major}}.{{minor}}',
                `type=sha,prefix={{branch}}-`,
                'type=raw,value=latest,enable={{is_default_branch}}',
              ].join('\n'),
            },
          },
          {
            id: 'build',
            name: 'Build and push Docker image',
            uses: 'docker/build-push-action@v5',
            with: {
              context: '.',
              file: './Dockerfile.production',
              push: true,
              tags: `${{ steps.meta.outputs.tags }}`,
              labels: `${{ steps.meta.outputs.labels }}`,
              'cache-from': 'type=gha',
              'cache-to': 'type=gha,mode=max',
              'build-args': [
                `BUILD_DATE=${{ github.event.repository.updated_at }}`,
                `VCS_REF=${{ github.sha }}`,
                `VERSION=${{ github.ref_name }}`,
              ].join('\n'),
            },
          },
        ],
      },
    };

    jobs['deploy-staging'] = this.generateStagingJob(config);
    jobs['deploy-production'] = this.generateProductionJob(config);
    jobs['rollback'] = this.generateRollbackJob(config);


    return jobs;
  }

  private generateStagingJob(config: DeploymentConfig): any {
    return {
      needs: 'build-and-push',
      'runs-on': 'ubuntu-latest',
      if: `github.event_name == 'push' || github.event.inputs.environment == 'staging'`, 
      environment: {
        name: 'staging',
        url: `https://staging.${config.name}.example.com`,
      },
      steps: [
        {
          name: 'Checkout code',
          uses: 'actions/checkout@v4',
        },
        {
          name: 'Setup kubectl',
          uses: 'azure/setup-kubectl@v3',
          with: {
            version: 'latest',
          },
        },
        {
          name: 'Configure kubectl',
          run: ""
echo "${{ secrets.STAGING_KUBECONFIG }}" | base64 -d > kubeconfig
echo \"KUBECONFIG=$(pwd)/kubeconfig\" >> $GITHUB_ENV
          ",
        },
        {
          name: 'Update image in Kubernetes',
          run: ""
            kubectl set image deployment/${config.name} \
              app=${{ needs.build-and-push.outputs.image-tag }} \
              -n ${config.name}-staging
          ",
        },
        {
          name: 'Wait for rollout',
          run: ""
            kubectl rollout status deployment/${config.name} \
              -n ${config.name}-staging \
              --timeout=10m
          ",
        },
        {
          name: 'Run smoke tests',
          run: ""
            STAGING_URL=\"https://staging.${config.name}.example.com\"
            
            # Health check
            curl -f 
STAGING_URL
/api/health || exit 1
            
            # Ready check
            curl -f 
STAGING_URL
/api/health/ready || exit 1
            
            echo \"Smoke tests passed!\"
          ",
        },
      ],
    };
  }

  private generateProductionJob(config: DeploymentConfig): any {
    const steps = [
      {
        name: 'Checkout code',
        uses: 'actions/checkout@v4',
      },
      {
        name: 'Setup kubectl',
        uses: 'azure/setup-kubectl@v3',
        with: {
          version: 'latest',
        },
      },
      {
        name: 'Configure kubectl',
        run: ""
          echo "${{ secrets.PRODUCTION_KUBECONFIG }}" | base64 -d > kubeconfig
          echo \"KUBECONFIG=$(pwd)/kubeconfig\" >> $GITHUB_ENV
          ",
      },
      {
        name: 'Create backup',
        run: ""
          # Backup current deployment
          kubectl get deployment ${config.name} -n ${config.name} -o yaml > backup-deployment.yaml
          
          # Backup database (example with pg_dump)
          kubectl exec -n ${config.name} postgres-0 -- pg_dump -U backstage_user backstage_idp > backup-$(date +%Y%m%d-%H%M%S).sql
          ",
      },
    ];

    if (config.strategy === 'canary') {
      steps.push(...this.generateCanarySteps(config));
    } else {
      steps.push(...this.generateStandardProductionSteps(config));
    }
    
    steps.push({
        name: 'Post-deployment verification',
        run: ""
          # Verify all pods are running
          kubectl get pods -n ${config.name} -l app=${config.name}
          
          # Check metrics
          curl -H \"Authorization: Bearer ${{ secrets.METRICS_TOKEN }}\" \
            https://{config.name}.example.com/api/metrics
          ",
      },
      {
        name: 'Notify deployment',
        if: 'always()',
        uses: '8398a7/action-slack@v3',
        with: {
          status: `${{ job.status }}`,
          text: ""
            Production deployment ${{ job.status }}
            Version: ${{ needs.build-and-push.outputs.image-tag }}
            Actor: ${{ github.actor }}
          ",
          env: {
            SLACK_WEBHOOK_URL: `${{ secrets.SLACK_WEBHOOK }}`,
          },
        },
      },
    );

    return {
      needs: ['build-and-push', 'deploy-staging'],
      'runs-on': 'ubuntu-latest',
      if: `github.event.inputs.environment == 'production'`, 
      environment: {
        name: 'production',
        url: `https://${config.name}.example.com`,
      },
      steps,
    };
  }
  
  private generateCanarySteps(config: DeploymentConfig): any[] {
    const canaryConfig = config.progressiveDelivery as CanaryConfig;
    const steps = [];

    for (const step of canaryConfig.steps) {
      steps.push({
        name: `Canary: ${step.setWeight}% traffic`,
        run: ""
          kubectl set image deployment/${config.name}-canary \
            app=${{ needs.build-and-push.outputs.image-tag }} \
            -n ${config.name}
          # Logic to set traffic weight to ${step.setWeight}%
          # This would typically involve updating a service mesh (e.g., Istio) or an ingress controller
          ",
      });

      if (step.pause?.duration) {
        steps.push({
          name: `Canary: Pause for ${step.pause.duration} minutes`,
          run: `sleep ${step.pause.duration * 60}`,
        });
      }
    }
    
    steps.push({
        name: 'Promote to production',
        run: ""
          # Update main deployment
          kubectl set image deployment/${config.name} \
            app=${{ needs.build-and-push.outputs.image-tag }} \
            -n ${config.name}
          
          # Wait for rollout
          kubectl rollout status deployment/${config.name} \
            -n ${config.name} \
            --timeout=15m
          ",
      });

    return steps;
  }
  
  private generateStandardProductionSteps(config: DeploymentConfig): any[] {
    return [
        {
            name: 'Update image in Kubernetes',
            run: ""
              kubectl set image deployment/${config.name} \
                app=${{ needs.build-and-push.outputs.image-tag }} \
                -n ${config.name}
              ",
        },
        {
            name: 'Wait for rollout',
            run: ""
              kubectl rollout status deployment/${config.name} \
                -n ${config.name} \
                --timeout=10m
              ",
        },
    ]
  }

  private generateRollbackJob(config: DeploymentConfig): any {
    return {
      needs: 'deploy-production',
      'runs-on': 'ubuntu-latest',
      if: 'failure()',
      environment: 'production',
      steps: [
        {
          name: 'Configure kubectl',
          run: ""
            echo "${{ secrets.PRODUCTION_KUBECONFIG }}" | base64 -d > kubeconfig
            echo \"KUBECONFIG=$(pwd)/kubeconfig\" >> $GITHUB_ENV
            ",
        },
        {
          name: 'Rollback deployment',
          run: ""
            kubectl rollout undo deployment/${config.name} -n ${config.name}
            kubectl rollout status deployment/${config.name} -n ${config.name}
            ",
        },
        {
          name: 'Notify rollback',
          uses: '8398a7/action-slack@v3',
          with: {
            status: 'custom',
            'custom_payload': ""
              {
                text: \"Production deployment rolled back\",
                attachments: [{
                  color: 'warning',
                  text: 'Automatic rollback triggered due to deployment failure'
                }]
              }
            ",
            env: {
              SLACK_WEBHOOK_URL: `${{ secrets.SLACK_WEBHOOK }}`,
            },
          },
        },
      ],
    };
  }
}
