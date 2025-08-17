/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  DEFAULT_NAMESPACE,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { githubAuthenticator } from '@backstage/plugin-auth-backend-module-github-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

// List of GitHub usernames that should have admin access
// Replace 'admin-user' with actual GitHub usernames that should have admin access
const ADMIN_USERS = ['admin-user', 'portal-admin']; // Update with your GitHub username

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'githubProvider',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'github',
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            async signInResolver({ result: { fullProfile, accessToken } }, ctx) {
              const userId = fullProfile.username;
              const userEmail = fullProfile.email;
              const displayName = fullProfile.displayName;

              if (!userId) {
                throw new Error(
                  `GitHub user profile does not contain a username`,
                );
              }

              const userEntityRef = stringifyEntityRef({
                kind: 'User',
                name: userId,
                namespace: DEFAULT_NAMESPACE,
              });

              // Check if user is an admin
              const isAdmin = ADMIN_USERS.includes(userId);
              
              // Create admin group reference if user is admin
              const entities = [userEntityRef];
              if (isAdmin) {
                const adminGroupRef = stringifyEntityRef({
                  kind: 'Group',
                  name: 'admins',
                  namespace: DEFAULT_NAMESPACE,
                });
                entities.push(adminGroupRef);
              }

              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: entities,
                  // Include additional user info in claims
                  ...(userEmail && { email: userEmail }),
                  ...(displayName && { name: displayName }),
                  ...(isAdmin && { admin: true }),
                },
              });
            },
          }),
        });
      },
    });
  },
});