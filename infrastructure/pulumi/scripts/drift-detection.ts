#!/usr/bin/env ts-node

import * as pulumi from '@pulumi/pulumi';
import { LocalWorkspace, Stack } from '@pulumi/pulumi/automation';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface DriftDetectionOptions {
  stack?: string;
  allStacks?: boolean;
  outputFormat?: 'json' | 'markdown' | 'html';
  notifySlack?: boolean;
  notifyEmail?: boolean;
  autoReconcile?: boolean;
}

interface DriftReport {
  stack: string;
  timestamp: string;
  hasDrift: boolean;
  driftedResources: Array<{
    urn: string;
    type: string;
    name: string;
    properties: any;
    differences: any;
  }>;
  summary: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArguments(args);

  console.log('🔍 Starting drift detection...');

  try {
    const stacks = await getStacksToCheck(options);
    const reports: DriftReport[] = [];

    for (const stackName of stacks) {
      console.log(`\n📊 Checking stack: ${stackName}`);
      const report = await detectDrift(stackName);
      reports.push(report);

      if (report.hasDrift) {
        console.log(`⚠️  Drift detected in ${stackName}!`);
        console.log(`   Total drifted resources: ${report.driftedResources.length}`);
        
        if (options.autoReconcile) {
          console.log(`🔧 Auto-reconciling drift in ${stackName}...`);
          await reconcileDrift(stackName);
        }
      } else {
        console.log(`✅ No drift detected in ${stackName}`);
      }
    }

    // Generate report
    const output = generateReport(reports, options.outputFormat || 'markdown');
    
    // Save report to file
    const reportPath = path.join(process.cwd(), `drift-report-${Date.now()}.${options.outputFormat || 'md'}`);
    fs.writeFileSync(reportPath, output);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Send notifications
    if (options.notifySlack) {
      await sendSlackNotification(reports);
    }
    
    if (options.notifyEmail) {
      await sendEmailNotification(reports);
    }

    // Exit with error if drift detected
    const hasDrift = reports.some(r => r.hasDrift);
    process.exit(hasDrift ? 1 : 0);

  } catch (error) {
    console.error('❌ Drift detection failed:', error);
    process.exit(1);
  }
}

function parseArguments(args: string[]): DriftDetectionOptions {
  const options: DriftDetectionOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stack':
        options.stack = args[++i];
        break;
      case '--all':
        options.allStacks = true;
        break;
      case '--format':
        options.outputFormat = args[++i] as 'json' | 'markdown' | 'html';
        break;
      case '--notify-slack':
        options.notifySlack = true;
        break;
      case '--notify-email':
        options.notifyEmail = true;
        break;
      case '--auto-reconcile':
        options.autoReconcile = true;
        break;
    }
  }
  
  return options;
}

async function getStacksToCheck(options: DriftDetectionOptions): Promise<string[]> {
  if (options.stack) {
    return [options.stack];
  }
  
  if (options.allStacks) {
    const workspace = await LocalWorkspace.create({
      workDir: process.cwd(),
    });
    
    const stacks = await workspace.listStacks();
    return stacks.map(s => s.name);
  }
  
  // Default to current stack
  const workspace = await LocalWorkspace.create({
    workDir: process.cwd(),
  });
  
  const currentStack = await workspace.stack();
  return [currentStack.name];
}

async function detectDrift(stackName: string): Promise<DriftReport> {
  const workspace = await LocalWorkspace.create({
    stackName,
    workDir: process.cwd(),
  });

  const stack = await Stack.select(stackName, workspace);
  
  // Perform refresh to detect drift
  const refreshResult = await stack.refresh({ 
    onOutput: (msg) => {
      if (process.env.VERBOSE) {
        console.log(msg);
      }
    }
  });

  const driftedResources: DriftReport['driftedResources'] = [];
  let created = 0, updated = 0, deleted = 0;

  // Parse the refresh result to identify drift
  if (refreshResult.summary.resourceChanges) {
    for (const [urn, changes] of Object.entries(refreshResult.summary.resourceChanges)) {
      if (changes.create) created++;
      if (changes.update) updated++;
      if (changes.delete) deleted++;
      
      if (changes.create || changes.update || changes.delete) {
        const resource = await getResourceDetails(stack, urn);
        driftedResources.push({
          urn,
          type: resource.type,
          name: resource.name,
          properties: resource.properties,
          differences: changes
        });
      }
    }
  }

  return {
    stack: stackName,
    timestamp: new Date().toISOString(),
    hasDrift: driftedResources.length > 0,
    driftedResources,
    summary: {
      total: driftedResources.length,
      created,
      updated,
      deleted
    }
  };
}

async function getResourceDetails(stack: Stack, urn: string): Promise<any> {
  const exportedStack = await stack.exportStack();
  const resources = exportedStack.deployment.resources || [];
  
  const resource = resources.find((r: any) => r.urn === urn);
  if (!resource) {
    return { type: 'unknown', name: 'unknown', properties: {} };
  }
  
  return {
    type: resource.type,
    name: resource.id,
    properties: resource.outputs || {}
  };
}

async function reconcileDrift(stackName: string): Promise<void> {
  const workspace = await LocalWorkspace.create({
    stackName,
    workDir: process.cwd(),
  });

  const stack = await Stack.select(stackName, workspace);
  
  console.log(`   Applying infrastructure updates...`);
  const upResult = await stack.up({
    onOutput: (msg) => {
      if (process.env.VERBOSE) {
        console.log(msg);
      }
    }
  });

  console.log(`   ✅ Reconciliation complete`);
  console.log(`   Resources updated: ${upResult.summary.resourceChanges}`);
}

function generateReport(reports: DriftReport[], format: 'json' | 'markdown' | 'html'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(reports, null, 2);
    
    case 'html':
      return generateHTMLReport(reports);
    
    case 'markdown':
    default:
      return generateMarkdownReport(reports);
  }
}

function generateMarkdownReport(reports: DriftReport[]): string {
  let markdown = '# Infrastructure Drift Report\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  for (const report of reports) {
    markdown += `## Stack: ${report.stack}\n\n`;
    
    if (!report.hasDrift) {
      markdown += '✅ **No drift detected**\n\n';
      continue;
    }
    
    markdown += `⚠️ **Drift detected**\n\n`;
    markdown += `### Summary\n`;
    markdown += `- Total drifted resources: ${report.summary.total}\n`;
    markdown += `- Resources to create: ${report.summary.created}\n`;
    markdown += `- Resources to update: ${report.summary.updated}\n`;
    markdown += `- Resources to delete: ${report.summary.deleted}\n\n`;
    
    markdown += `### Drifted Resources\n\n`;
    for (const resource of report.driftedResources) {
      markdown += `#### ${resource.name} (${resource.type})\n`;
      markdown += `- URN: \`${resource.urn}\`\n`;
      markdown += `- Changes: ${JSON.stringify(resource.differences, null, 2)}\n\n`;
    }
  }
  
  return markdown;
}

function generateHTMLReport(reports: DriftReport[]): string {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Infrastructure Drift Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .no-drift { color: green; }
    .has-drift { color: orange; }
    .resource { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .urn { font-family: monospace; font-size: 0.9em; color: #666; }
    pre { background: #f0f0f0; padding: 10px; border-radius: 3px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Infrastructure Drift Report</h1>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
`;

  for (const report of reports) {
    html += `<h2>Stack: ${report.stack}</h2>`;
    
    if (!report.hasDrift) {
      html += '<p class="no-drift">✅ No drift detected</p>';
      continue;
    }
    
    html += '<p class="has-drift">⚠️ Drift detected</p>';
    html += '<h3>Summary</h3>';
    html += '<ul>';
    html += `<li>Total drifted resources: ${report.summary.total}</li>`;
    html += `<li>Resources to create: ${report.summary.created}</li>`;
    html += `<li>Resources to update: ${report.summary.updated}</li>`;
    html += `<li>Resources to delete: ${report.summary.deleted}</li>`;
    html += '</ul>';
    
    html += '<h3>Drifted Resources</h3>';
    for (const resource of report.driftedResources) {
      html += '<div class="resource">';
      html += `<h4>${resource.name} (${resource.type})</h4>`;
      html += `<p class="urn">URN: ${resource.urn}</p>`;
      html += `<pre>${JSON.stringify(resource.differences, null, 2)}</pre>`;
      html += '</div>';
    }
  }
  
  html += '</body></html>';
  return html;
}

async function sendSlackNotification(reports: DriftReport[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('⚠️  SLACK_WEBHOOK_URL not set, skipping Slack notification');
    return;
  }

  const driftedStacks = reports.filter(r => r.hasDrift);
  if (driftedStacks.length === 0) {
    return;
  }

  const message = {
    text: '⚠️ Infrastructure Drift Detected',
    attachments: driftedStacks.map(report => ({
      color: 'warning',
      title: `Stack: ${report.stack}`,
      fields: [
        {
          title: 'Total Drifted Resources',
          value: report.summary.total.toString(),
          short: true
        },
        {
          title: 'Changes',
          value: `Create: ${report.summary.created}, Update: ${report.summary.updated}, Delete: ${report.summary.deleted}`,
          short: true
        }
      ],
      footer: 'Pulumi Drift Detection',
      ts: Math.floor(Date.now() / 1000)
    }))
  };

  try {
    await axios.post(webhookUrl, message);
    console.log('✅ Slack notification sent');
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error);
  }
}

async function sendEmailNotification(reports: DriftReport[]): Promise<void> {
  // Implementation would depend on your email service
  console.log('📧 Email notification would be sent here');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}