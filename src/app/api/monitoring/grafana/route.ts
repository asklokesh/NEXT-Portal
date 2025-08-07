import { NextRequest, NextResponse } from 'next/server';
import { createGrafanaClient, DASHBOARD_TEMPLATES, createServiceDashboard } from '@/lib/monitoring';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Request schemas
const CreateDashboardSchema = z.object({
  title: z.string().min(1),
  serviceName: z.string().optional(),
  templateKey: z.enum(['SERVICE_OVERVIEW', 'INFRASTRUCTURE_OVERVIEW', 'KUBERNETES_OVERVIEW', 'APPLICATION_PERFORMANCE', 'BUSINESS_METRICS']).optional(),
  customDashboard: z.any().optional()
});

const UpdateDashboardSchema = z.object({
  uid: z.string().min(1),
  dashboard: z.any()
});

const CreateDataSourceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  url: z.string().url(),
  access: z.enum(['proxy', 'direct']).default('proxy'),
  basicAuth: z.boolean().default(false),
  basicAuthUser: z.string().optional(),
  basicAuthPassword: z.string().optional(),
  jsonData: z.record(z.any()).default({}),
  secureJsonData: z.record(z.string()).default({})
});

const CreateAlertRuleSchema = z.object({
  title: z.string().min(1),
  condition: z.string().min(1),
  data: z.array(z.any()),
  noDataState: z.enum(['NoData', 'Alerting', 'OK']).default('NoData'),
  execErrState: z.enum(['Alerting', 'OK']).default('Alerting'),
  for: z.string().default('5m'),
  annotations: z.record(z.string()).default({}),
  labels: z.record(z.string()).default({}),
  folderUID: z.string().optional()
});

// GET - Health check and list operations
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      if (!process.env.GRAFANA_URL || !process.env.GRAFANA_API_KEY) {
        return NextResponse.json(
          { error: 'Grafana integration not configured' },
          { status: 503 }
        );
      }

      const grafana = createGrafanaClient();

      switch (action) {
        case 'health':
          const health = await grafana.healthCheck();
          logger.info('Grafana health check performed', { user: user.id, health });
          return NextResponse.json({ health });

        case 'dashboards':
          const query = searchParams.get('query') || undefined;
          const tagParam = searchParams.get('tags');
          const tags = tagParam ? tagParam.split(',') : undefined;
          const dashboards = await grafana.listDashboards(query, tags);
          logger.info('Dashboards listed', { user: user.id, count: dashboards.length });
          return NextResponse.json({ dashboards });

        case 'dashboard':
          const uid = searchParams.get('uid');
          if (!uid) {
            return NextResponse.json(
              { error: 'Dashboard UID is required' },
              { status: 400 }
            );
          }
          const dashboard = await grafana.getDashboard(uid);
          return NextResponse.json({ dashboard });

        case 'templates':
          return NextResponse.json({
            templates: Object.keys(DASHBOARD_TEMPLATES),
            available: DASHBOARD_TEMPLATES
          });

        case 'alerts':
          const alertRules = await grafana.getAlertRules();
          return NextResponse.json({ rules: alertRules });

        default:
          const status = await grafana.healthCheck();
          return NextResponse.json({
            status: 'ok',
            grafana: status,
            templates: Object.keys(DASHBOARD_TEMPLATES)
          });
      }
    } catch (error) {
      logger.error('Grafana API error', {
        error: error.message,
        user: user?.id
      });
      
      return NextResponse.json(
        { error: 'Grafana operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// POST - Create operations
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      if (!process.env.GRAFANA_URL || !process.env.GRAFANA_API_KEY) {
        return NextResponse.json(
          { error: 'Grafana integration not configured' },
          { status: 503 }
        );
      }

      const grafana = createGrafanaClient();

      switch (action) {
        case 'dashboard':
          const dashboardData = CreateDashboardSchema.parse(body);
          let dashboard;

          if (dashboardData.customDashboard) {
            dashboard = dashboardData.customDashboard;
          } else if (dashboardData.serviceName && dashboardData.templateKey) {
            dashboard = createServiceDashboard(dashboardData.serviceName, dashboardData.templateKey);
          } else if (dashboardData.templateKey) {
            dashboard = DASHBOARD_TEMPLATES[dashboardData.templateKey];
          } else {
            return NextResponse.json(
              { error: 'Either customDashboard or templateKey with optional serviceName is required' },
              { status: 400 }
            );
          }

          dashboard.title = dashboardData.title;
          const createdDashboard = await grafana.createDashboard(dashboard);
          
          logger.info('Dashboard created', {
            user: user.id,
            dashboardId: createdDashboard.id,
            title: dashboardData.title
          });

          return NextResponse.json({
            success: true,
            dashboard: createdDashboard
          });

        case 'datasource':
          const dataSourceData = CreateDataSourceSchema.parse(body);
          const createdDataSource = await grafana.createDataSource(dataSourceData);
          
          logger.info('Data source created', {
            user: user.id,
            dataSourceId: createdDataSource.id,
            name: dataSourceData.name
          });

          return NextResponse.json({
            success: true,
            dataSource: createdDataSource
          });

        case 'test-datasource':
          const testDataSourceData = CreateDataSourceSchema.parse(body);
          const testResult = await grafana.testDataSource(testDataSourceData);
          
          logger.info('Data source tested', {
            user: user.id,
            name: testDataSourceData.name,
            result: testResult.status
          });

          return NextResponse.json({
            success: true,
            test: testResult
          });

        case 'alert':
          const alertData = CreateAlertRuleSchema.parse(body);
          const createdAlert = await grafana.createAlertRule(alertData);
          
          logger.info('Alert rule created', {
            user: user.id,
            alertUID: createdAlert.uid,
            title: alertData.title
          });

          return NextResponse.json({
            success: true,
            alert: createdAlert
          });

        case 'annotation':
          const annotationData = z.object({
            dashboardUID: z.string(),
            time: z.number(),
            timeEnd: z.number().optional(),
            text: z.string(),
            tags: z.array(z.string()).optional()
          }).parse(body);

          const annotation = await grafana.addAnnotation(
            annotationData.dashboardUID,
            {
              time: annotationData.time,
              timeEnd: annotationData.timeEnd,
              text: annotationData.text,
              tags: annotationData.tags
            }
          );

          return NextResponse.json({
            success: true,
            annotation
          });

        case 'import':
          const importData = z.object({
            dashboard: z.any(),
            overwrite: z.boolean().default(false)
          }).parse(body);

          const importedDashboard = await grafana.importDashboard(
            importData.dashboard,
            importData.overwrite
          );

          logger.info('Dashboard imported', {
            user: user.id,
            dashboardId: importedDashboard.id,
            title: importData.dashboard.title
          });

          return NextResponse.json({
            success: true,
            dashboard: importedDashboard
          });

        case 'batch-create':
          const batchData = z.object({
            dashboards: z.array(z.any()),
            serviceName: z.string().optional()
          }).parse(body);

          const results = await grafana.createMultipleDashboards(batchData.dashboards);
          
          logger.info('Batch dashboards created', {
            user: user.id,
            count: results.length
          });

          return NextResponse.json({
            success: true,
            results,
            created: results.length
          });

        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } catch (error) {
      logger.error('Grafana POST operation failed', {
        error: error.message,
        user: user?.id,
        action: new URL(request.url).searchParams.get('action')
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Operation failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// PUT - Update operations
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const updateData = UpdateDashboardSchema.parse(body);

      if (!process.env.GRAFANA_URL || !process.env.GRAFANA_API_KEY) {
        return NextResponse.json(
          { error: 'Grafana integration not configured' },
          { status: 503 }
        );
      }

      const grafana = createGrafanaClient();
      const updatedDashboard = await grafana.updateDashboard(
        updateData.uid,
        updateData.dashboard
      );
      
      logger.info('Dashboard updated', {
        user: user.id,
        dashboardId: updatedDashboard.id,
        uid: updateData.uid
      });

      return NextResponse.json({
        success: true,
        dashboard: updatedDashboard
      });
    } catch (error) {
      logger.error('Grafana PUT operation failed', {
        error: error.message,
        user: user?.id
      });

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Update failed', details: error.message },
        { status: 500 }
      );
    }
  });
}

// DELETE - Delete operations
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const uid = searchParams.get('uid');

      if (!uid) {
        return NextResponse.json(
          { error: 'Dashboard UID is required' },
          { status: 400 }
        );
      }

      if (!process.env.GRAFANA_URL || !process.env.GRAFANA_API_KEY) {
        return NextResponse.json(
          { error: 'Grafana integration not configured' },
          { status: 503 }
        );
      }

      const grafana = createGrafanaClient();
      await grafana.deleteDashboard(uid);
      
      logger.info('Dashboard deleted', {
        user: user.id,
        uid
      });

      return NextResponse.json({
        success: true,
        message: 'Dashboard deleted successfully'
      });
    } catch (error) {
      logger.error('Grafana DELETE operation failed', {
        error: error.message,
        user: user?.id
      });

      return NextResponse.json(
        { error: 'Delete failed', details: error.message },
        { status: 500 }
      );
    }
  });
}