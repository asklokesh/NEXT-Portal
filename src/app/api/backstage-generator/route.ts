import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface BackstageAppRequest {
  pluginId: string;
  version?: string;
  appName?: string;
  installId: string;
}

// Generate app-config.yaml
const createAppConfig = (pluginId: string, appName: string) => {
  return `
app:
  title: ${appName}
  baseUrl: http://localhost:3000

organization:
  name: ${appName}

backend:
  # Used for enabling authentication, secret is shared by all backend plugins
  # See https://backstage.io/docs/tutorials/backend-to-backend-auth for
  # information on the format
  auth:
    keys:
      - secret: ${Buffer.from(Date.now().toString()).toString('base64')}
  baseUrl: http://localhost:7007
  listen:
    port: 7007
    # Uncomment the following host directive to bind to specific interfaces
    # host: 127.0.0.1
  csp:
    connect-src: ["'self'", 'http:', 'https:']
    # Content-Security-Policy directives follow the Helmet format: https://helmetjs.github.io/#reference
    # Default Helmet Content-Security-Policy values can be removed by setting the key to false
  cors:
    origin: http://localhost:3000
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true
  # This is for local development only, it is not recommended to use this in production
  # The production database configuration is stored in app-config.production.yaml
  database:
    client: better-sqlite3
    connection: ':memory:'
  cache:
    store: memory
  # workingDirectory: /tmp # Use this to configure a working directory for the scaffolder, defaults to the OS temp-dir

integrations:
  github:
    - host: github.com
      # This is a GitHub App integration
      apps:
        - $include: github-app-backstage-credentials.yaml

proxy:
  '/test':
    target: 'https://example.com'
    changeOrigin: true

# Reference documentation http://backstage.io/docs/features/techdocs/configuration
# Note: After experimenting with basic setup, use CI/CD to generate docs
# and an external cloud storage when deploying TechDocs for production use-case.
# https://backstage.io/docs/features/techdocs/how-to-guides#how-to-migrate-from-techdocs-basic-to-recommended-deployment-approach
techdocs:
  builder: 'local' # Alternatives - 'external'
  generator:
    runIn: 'docker' # Alternatives - 'local'
  publisher:
    type: 'local' # Alternatives - 'googleGcs' or 'awsS3'. Read documentation for using alternatives.

auth:
  # see https://backstage.io/docs/auth/ to learn about auth providers
  providers:
    # See https://backstage.io/docs/auth/guest/provider
    guest: {}

scaffolder:
  # see https://backstage.io/docs/features/software-templates/configuration for software template options

catalog:
  import:
    entityFilename: catalog-info.yaml
    pullRequestBranchName: backstage-integration
  rules:
    - allow: [Component, System, API, Resource, Location]
  locations:
    # Local example data, file locations are relative to the backend process, typically \`packages/backend\`
    - type: file
      target: ../../examples/entities.yaml

    # Local example template
    - type: file
      target: ../../examples/template/template.yaml
      rules:
        - allow: [Template]

    # Local example organizational data
    - type: file
      target: ../../examples/org.yaml
      rules:
        - allow: [User, Group]

    ## Uncomment these lines to add more example data
    # - type: url
    #   target: https://github.com/backstage/backstage/blob/master/packages/catalog-model/examples/all.yaml

    ## Uncomment these lines to add an example org
    # - type: url
    #   target: https://github.com/backstage/backstage/blob/master/packages/catalog-model/examples/acme-corp.yaml
    #   rules:
    #     - allow: [User, Group]
`;
};

// Generate package.json for root
const createRootPackageJson = (pluginId: string, version: string, appName: string) => {
  return {
    name: `backstage-app-${appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    version: '1.0.0',
    private: true,
    engines: {
      node: '18 || 20'
    },
    scripts: {
      dev: 'concurrently "yarn start" "yarn start-backend"',
      start: 'yarn workspace app start',
      'start-backend': 'yarn workspace backend start',
      build: 'backstage-cli repo build --all',
      'build-image': 'yarn workspace backend build-image',
      'tsc': 'tsc',
      'tsc:full': 'tsc --skipLibCheck false --incremental false',
      clean: 'backstage-cli repo clean',
      test: 'backstage-cli repo test',
      'test:all': 'backstage-cli repo test --coverage',
      'test:e2e': 'playwright test',
      fix: 'backstage-cli repo fix',
      lint: 'backstage-cli repo lint --since origin/master',
      'lint:all': 'backstage-cli repo lint',
      prettier: 'backstage-cli repo prettier --check',
      'prettier:fix': 'backstage-cli repo prettier --write',
      'new': 'backstage-cli create-plugin --scope internal'
    },
    workspaces: {
      packages: ['packages/*', 'plugins/*']
    },
    devDependencies: {
      '@backstage/cli': '^0.25.0',
      '@backstage/e2e-test-utils': '^0.1.0',
      '@playwright/test': '^1.32.3',
      '@spotify/prettier-config': '^15.0.0',
      'concurrently': '^8.0.0',
      'lerna': '^7.3.0',
      'node-gyp': '^9.0.0',
      'typescript': '~5.2.0'
    },
    resolutions: {
      '@types/react': '^18',
      '@types/react-dom': '^18'
    },
    prettier: '@spotify/prettier-config',
    lint: {
      extends: ['@backstage']
    }
  };
};

// Generate frontend app package.json
const createAppPackageJson = (pluginId: string, version: string) => {
  const pluginName = pluginId.replace(/[@/]/g, '').replace(/-/g, '');
  
  return {
    name: 'app',
    version: '0.0.0',
    private: true,
    bundled: true,
    backstage: {
      role: 'frontend'
    },
    scripts: {
      start: 'backstage-cli package start',
      build: 'backstage-cli package build',
      clean: 'backstage-cli package clean',
      test: 'backstage-cli package test',
      lint: 'backstage-cli package lint',
      'test:e2e': 'cross-env PORT=3001 start-server-and-test start http://localhost:3001 cy:dev',
      'test:e2e:ci': 'cross-env PORT=3001 start-server-and-test start http://localhost:3001 cy:run'
    },
    dependencies: {
      [pluginId]: version,
      '@backstage/app-defaults': '^1.4.8',
      '@backstage/catalog-model': '^1.4.3',
      '@backstage/cli': '^0.25.0',
      '@backstage/core-app-api': '^1.11.4',
      '@backstage/core-components': '^0.13.9',
      '@backstage/core-plugin-api': '^1.8.0',
      '@backstage/integration-react': '^1.1.26',
      '@backstage/plugin-api-docs': '^0.10.4',
      '@backstage/plugin-catalog': '^1.15.1',
      '@backstage/plugin-catalog-common': '^1.0.19',
      '@backstage/plugin-catalog-graph': '^0.2.42',
      '@backstage/plugin-catalog-import': '^0.10.7',
      '@backstage/plugin-catalog-react': '^1.9.3',
      '@backstage/plugin-github-actions': '^0.6.11',
      '@backstage/plugin-org': '^0.6.20',
      '@backstage/plugin-permission-react': '^0.4.16',
      '@backstage/plugin-scaffolder': '^1.17.0',
      '@backstage/plugin-search': '^1.4.5',
      '@backstage/plugin-search-react': '^1.7.5',
      '@backstage/plugin-tech-radar': '^0.6.13',
      '@backstage/plugin-techdocs': '^1.9.3',
      '@backstage/plugin-techdocs-module-addons-contrib': '^1.1.3',
      '@backstage/plugin-techdocs-react': '^1.1.16',
      '@backstage/plugin-user-settings': '^0.8.0',
      '@backstage/theme': '^0.5.0',
      '@material-ui/core': '^4.12.2',
      '@material-ui/icons': '^4.9.1',
      history: '^5.0.0',
      react: '^18.0.2',
      'react-dom': '^18.0.2',
      'react-router': '^6.3.0',
      'react-router-dom': '^6.3.0',
      'react-use': '^17.2.4'
    },
    devDependencies: {
      '@backstage/test-utils': '^1.4.8',
      '@testing-library/jest-dom': '^6.0.0',
      '@testing-library/react': '^14.0.0',
      '@testing-library/user-event': '^14.0.0',
      '@types/react-dom': '*',
      'cross-env': '^7.0.0'
    },
    browserslist: {
      production: ['>0.2%', 'not dead', 'not op_mini all'],
      development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
    },
    files: ['dist']
  };
};

// Generate backend package.json
const createBackendPackageJson = (pluginId: string, version: string) => {
  return {
    name: 'backend',
    version: '0.0.0',
    private: true,
    backstage: {
      role: 'backend'
    },
    scripts: {
      start: 'backstage-cli package start',
      build: 'backstage-cli package build',
      lint: 'backstage-cli package lint',
      test: 'backstage-cli package test',
      clean: 'backstage-cli package clean',
      'build-image': 'docker build ../.. -f Dockerfile --tag backstage'
    },
    dependencies: {
      app: 'link:../app',
      '@backstage/backend-common': '^0.20.1',
      '@backstage/backend-tasks': '^0.5.15',
      '@backstage/catalog-client': '^1.5.0',
      '@backstage/catalog-model': '^1.4.3',
      '@backstage/config': '^1.1.1',
      '@backstage/plugin-app-backend': '^0.3.58',
      '@backstage/plugin-auth-backend': '^0.20.4',
      '@backstage/plugin-auth-node': '^0.4.4',
      '@backstage/plugin-catalog-backend': '^1.15.0',
      '@backstage/plugin-catalog-backend-module-logs': '^0.0.1',
      '@backstage/plugin-permission-common': '^0.7.12',
      '@backstage/plugin-permission-node': '^0.7.21',
      '@backstage/plugin-proxy-backend': '^0.4.8',
      '@backstage/plugin-scaffolder-backend': '^1.18.0',
      '@backstage/plugin-search-backend': '^1.4.11',
      '@backstage/plugin-search-backend-module-pg': '^0.5.20',
      '@backstage/plugin-search-backend-node': '^1.2.14',
      '@backstage/plugin-techdocs-backend': '^1.9.1',
      better_sqlite3: '^8.0.0',
      dockerode: '^3.3.1',
      express: '^4.17.1',
      'express-promise-router': '^4.1.0',
      pg: '^8.3.0',
      winston: '^3.2.1'
    },
    devDependencies: {
      '@backstage/cli': '^0.25.0',
      '@types/dockerode': '^3.3.0',
      '@types/express': '^4.17.6',
      '@types/express-serve-static-core': '^4.17.5',
      '@types/luxon': '^2.0.4'
    },
    files: ['dist']
  };
};

// Generate frontend App.tsx with plugin integration
const createAppTsx = (pluginId: string) => {
  const pluginImportName = pluginId
    .split('/')
    .pop()
    ?.replace('plugin-', '')
    .replace(/-([a-z])/g, (_, char) => char.toUpperCase()) || 'customPlugin';

  return `
import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import { TechRadarPage } from '@backstage/plugin-tech-radar';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';

import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';

// Import the installed plugin
${pluginId.includes('plugin-') ? `import { ${pluginImportName}Plugin, ${pluginImportName}Page } from '${pluginId}';` : `// Plugin ${pluginId} - check plugin documentation for correct imports`}

const app = createApp({
  apis,
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(scaffolderPlugin.externalRoutes, {
      registerComponent: catalogImportPlugin.routes.importPage,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },
});

const AppProvider = app.getProvider();
const AppRouter = app.getRouter();

const App = () => (
  <AppProvider>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <Root>
        <FlatRoutes>
          <Route path="/catalog" element={<CatalogIndexPage />} />
          <Route
            path="/catalog/:namespace/:kind/:name"
            element={<CatalogEntityPage />}
          >
            {entityPage}
          </Route>
          <Route path="/docs" element={<TechDocsIndexPage />} />
          <Route
            path="/docs/:namespace/:kind/:name/*"
            element={<TechDocsReaderPage />}
          >
            <TechDocsAddons>
              <ReportIssue />
            </TechDocsAddons>
          </Route>
          <Route path="/create" element={<ScaffolderPage />} />
          <Route path="/api-docs" element={<ApiExplorerPage />} />
          <Route
            path="/tech-radar"
            element={<TechRadarPage width={1500} height={800} />}
          />
          <Route
            path="/catalog-import"
            element={
              <RequirePermission permission={catalogEntityCreatePermission}>
                <CatalogImportPage />
              </RequirePermission>
            }
          />
          <Route path="/search" element={<SearchPage />}>
            {searchPage}
          </Route>
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/catalog-graph" element={<CatalogGraphPage />} />
          ${pluginId.includes('plugin-') ? `<Route path="/${pluginImportName}" element={<${pluginImportName}Page />} />` : `{/* Add plugin route here */}`}
          <Route path="/" element={<Navigate to="catalog" />} />
        </FlatRoutes>
      </Root>
    </AppRouter>
  </AppProvider>
);

export default App;
`;
};

// Generate backend index.ts
const createBackendIndex = () => {
  return `
/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend/alpha'));
backend.add(import('@backstage/plugin-proxy-backend/alpha'));
backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend/alpha'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// permission plugin
backend.add(import('@backstage/plugin-permission-backend/alpha'));
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-catalog/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

backend.start();
`;
};

// Generate Dockerfile for the full app
const createBackstageDockerfile = () => {
  return `
# This dockerfile builds an image for the backend package.
# It should be executed with the root of the repo as docker context.
#
# Before building this image, be sure to have run the following commands in the repo root:
#
# yarn install
# yarn tsc
# yarn build:backend

FROM node:18-bookworm-slim

# Install isolate-vm dependencies, these are needed by the @backstage/plugin-scaffolder-backend.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\
    --mount=type=cache,target=/var/lib/apt,sharing=locked \\
    apt-get update && \\
    apt-get install -y --no-install-recommends python3 g++ build-essential && \\
    yarn config set python /usr/bin/python3

# Install sqlite3 dependencies. You can skip this if you don't use sqlite3 in the image,
# in which case you should also move better-sqlite3 to "devDependencies" in package.json.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \\
    --mount=type=cache,target=/var/lib/apt,sharing=locked \\
    apt-get update && \\
    apt-get install -y --no-install-recommends libsqlite3-dev

# From here on we use the least-privileged \`node\` user to run the backend.
USER node

# This should create the app dir as \`node\`.
# If it is instead created as \`root\` then the \`tar\` command below will fail: \`can't create directory 'packages/': Permission denied\`.
# If this occurs, then ensure BuildKit is enabled (\`DOCKER_BUILDKIT=1\`) so the app dir is correctly created as \`node\`.
WORKDIR /app

# This switches many Node.js dependencies to production mode.
ENV NODE_ENV production

# Copy repo skeleton first, to avoid unnecessary docker cache invalidation.
# The skeleton contains the package.json of each package in the monorepo,
# and along with yarn.lock and the root package.json, that's enough to run yarn install.
COPY --chown=node:node yarn.lock package.json packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \\
    yarn install --frozen-lockfile --production --network-timeout 300000

# Then copy the rest of the backend bundle, along with any other files we might want.
COPY --chown=node:node packages/backend/dist/bundle.tar.gz app-config*.yaml ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

CMD ["node", "packages/backend", "--config", "app-config.yaml"]
`;
};

export async function POST(request: NextRequest) {
  try {
    const { pluginId, version = 'latest', appName = 'My Backstage App', installId }: BackstageAppRequest = await request.json();

    if (!pluginId || !installId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID and install ID are required'
      }, { status: 400 });
    }

    const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
    
    // Create directory structure
    const directories = [
      'packages/app/src',
      'packages/app/src/components',
      'packages/app/src/components/catalog',
      'packages/app/src/components/search',
      'packages/backend/src',
      'examples'
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(workDir, dir), { recursive: true });
    }

    // Generate and write all configuration files
    const files = [
      // Root configuration
      { path: 'package.json', content: JSON.stringify(createRootPackageJson(pluginId, version, appName), null, 2) },
      { path: 'app-config.yaml', content: createAppConfig(pluginId, appName) },
      { path: 'yarn.lock', content: '' },
      
      // Frontend app
      { path: 'packages/app/package.json', content: JSON.stringify(createAppPackageJson(pluginId, version), null, 2) },
      { path: 'packages/app/src/App.tsx', content: createAppTsx(pluginId) },
      
      // Backend
      { path: 'packages/backend/package.json', content: JSON.stringify(createBackendPackageJson(pluginId, version), null, 2) },
      { path: 'packages/backend/src/index.ts', content: createBackendIndex() },
      
      // Docker
      { path: 'packages/backend/Dockerfile', content: createBackstageDockerfile() },
      
      // Basic APIs file
      { path: 'packages/app/src/apis.ts', content: `
import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
} from '@backstage/core-plugin-api';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
];
` },
      
      // Basic Root component
      { path: 'packages/app/src/components/Root/Root.tsx', content: `
import React, { PropsWithChildren } from 'react';
import { makeStyles } from '@material-ui/core';
import { Header, Page, Sidebar } from '@backstage/core-components';
import { NavLink } from 'react-router-dom';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';

const useStyles = makeStyles({
  root: {
    gridArea: 'pageContent',
    display: 'flex',
    flexDirection: 'column',
  },
});

export const Root = ({ children }: PropsWithChildren<{}>) => {
  const classes = useStyles();
  return (
    <Page themeId="app">
      <Header title="Backstage">
        <LogoFull />
      </Header>
      <Sidebar>
        <LogoIcon />
        {/* Navigation items */}
      </Sidebar>
      <div className={classes.root}>{children}</div>
    </Page>
  );
};
` },
    ];

    // Write all files
    for (const file of files) {
      await fs.writeFile(path.join(workDir, file.path), file.content);
    }

    return NextResponse.json({
      success: true,
      message: `Backstage app structure generated for ${pluginId}`,
      files: files.map(f => f.path),
      workDir
    });

  } catch (error) {
    console.error('Error generating Backstage app:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate Backstage app structure'
    }, { status: 500 });
  }
}