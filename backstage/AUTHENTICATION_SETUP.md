# GitHub OAuth Authentication Setup for Backstage

This guide will help you set up GitHub OAuth authentication for your Backstage portal with admin user capabilities.

## 1. Create GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in the application details:
   - **Application name**: `Backstage SaaS IDP Portal`
   - **Homepage URL**: `http://localhost:3000`
   - **Application description**: `SaaS IDP Developer Portal`
   - **Authorization callback URL**: `http://localhost:7007/api/auth/github/handler/frame`

4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

## 2. Configure Environment Variables

Create a `.env` file in the `backstage/` directory:

```bash
# GitHub OAuth Configuration
AUTH_GITHUB_CLIENT_ID=your_github_client_id_here
AUTH_GITHUB_CLIENT_SECRET=your_github_client_secret_here

# GitHub Integration Token (optional - for repository integration)
GITHUB_TOKEN=your_github_personal_access_token

# Database Configuration (optional - uses SQLite by default)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=backstage_dev
```

## 3. Configure Admin Users

Edit `packages/backend/src/authModuleGithubProvider.ts` and update the `ADMIN_USERS` array:

```typescript
const ADMIN_USERS = ['your-github-username', 'another-admin-username'];
```

Replace `'your-github-username'` with your actual GitHub username to get admin access.

## 4. Update Organization Data

Edit `examples/org.yaml` to include your actual users:

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: your-github-username  # Your actual GitHub username
  description: Platform administrator
spec:
  profile:
    displayName: Your Display Name
    email: your-email@example.com
  memberOf: [admins]
```

## 5. Start Backstage

Use the provided startup script:

```bash
./start-with-auth.sh
```

Or start manually:

```bash
cd packages/backend
yarn start
```

## 6. Test Authentication

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Sign in with GitHub"
3. Authorize the application
4. You should be logged in with admin privileges

## Admin User Capabilities

Admin users (those listed in `ADMIN_USERS` array) have:
- Full access to all Backstage features
- Permission to create/edit/delete catalog entities
- Access to all plugins and administrative functions
- Ability to manage templates and scaffolder actions

## Regular User Access

Non-admin users have read-only access to:
- Catalog browsing
- Documentation reading
- Template viewing
- Search functionality

## Troubleshooting

### Authentication Issues
- Verify GitHub OAuth app settings
- Check callback URL: `http://localhost:7007/api/auth/github/handler/frame`
- Ensure environment variables are set correctly

### Permission Issues
- Make sure your GitHub username is in the `ADMIN_USERS` array
- Check that the user entity exists in `examples/org.yaml`
- Verify the user is a member of the `admins` group

### Backend Issues
- Check that port 7007 is available
- Verify all dependencies are installed: `yarn install`
- Check backend logs for specific error messages

## Security Notes

- Keep your GitHub Client Secret secure and never commit it to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your GitHub tokens
- Consider using GitHub Apps instead of Personal Access Tokens for production

## Production Deployment

For production deployment:
1. Update URLs in GitHub OAuth app to your production domains
2. Use environment variables for configuration
3. Set up proper SSL/TLS certificates
4. Configure proper database (PostgreSQL recommended)
5. Set up proper logging and monitoring
6. Consider using GitHub Apps for enhanced security