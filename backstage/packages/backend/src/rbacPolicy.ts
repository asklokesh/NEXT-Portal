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
  PolicyDecision,
  AuthorizeResult,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';
import {
  policyExtensionPoint,
} from '@backstage/plugin-permission-backend';

class AdminRBACPolicy implements PermissionPolicy {
  async handle(request: PolicyQuery): Promise<PolicyDecision> {
    const { permission } = request;

    // Check if user has admin role from their JWT claims
    const isAdmin = request.identity?.claims?.admin === true;
    
    // Check if user is in admin group
    const isInAdminGroup = request.identity?.claims?.ent?.some(
      (entity: string) => entity.includes('group:default/admins')
    );

    // Admin users get full access to everything
    if (isAdmin || isInAdminGroup) {
      return {
        result: AuthorizeResult.ALLOW,
      };
    }

    // Allow basic catalog read access for all authenticated users
    if (permission.name === 'catalog.entity.read') {
      return {
        result: AuthorizeResult.ALLOW,
      };
    }

    // Allow scaffolder template reading for all users
    if (permission.name === 'scaffolder.template.read') {
      return {
        result: AuthorizeResult.ALLOW,
      };
    }

    // Allow search for all users
    if (permission.name.startsWith('search.')) {
      return {
        result: AuthorizeResult.ALLOW,
      };
    }

    // Allow TechDocs reading for all users
    if (permission.name.startsWith('techdocs.')) {
      return {
        result: AuthorizeResult.ALLOW,
      };
    }

    // Default to deny for everything else
    return {
      result: AuthorizeResult.DENY,
    };
  }
}

export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'adminRBACPolicy',
  register(reg) {
    reg.registerInit({
      deps: {
        policy: policyExtensionPoint,
      },
      async init({ policy }) {
        policy.setPolicy(new AdminRBACPolicy());
      },
    });
  },
});