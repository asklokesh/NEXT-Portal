# OAuth Setup Guide

This guide will walk you through setting up GitHub and Google OAuth authentication for your SAAS IDP platform.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Redis server running
- GitHub account
- Google account with access to Google Cloud Console

## Quick Start

1. Copy the environment template:
   ```bash
   cp .env.local.example .env.local
   ```

2. Follow the setup instructions below for each OAuth provider you want to enable.

## GitHub OAuth Setup

### Step 1: Create GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: `SAAS IDP Platform` (or your preferred name)
   - **Homepage URL**: 
     - Development: `http://localhost:4400`
     - Production: `https://your-domain.com`
   - **Authorization callback URL**: 
     - Development: `http://localhost:4400/api/auth/github/callback`
     - Production: `https://your-domain.com/api/auth/github/callback`
   - **Application description**: `Internal Developer Platform with OAuth authentication`

4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# GitHub Admin Configuration (optional)
GITHUB_ADMIN_USERS=your_github_username,admin_user2
GITHUB_ADMIN_ORGS=your-organization,another-org

# GitHub API Token (optional, for enhanced features)
GITHUB_TOKEN=your_personal_access_token
```

### Step 3: Configure Admin Access (Optional)

- **GITHUB_ADMIN_USERS**: Comma-separated list of GitHub usernames that get admin access
- **GITHUB_ADMIN_ORGS**: Comma-separated list of GitHub organizations whose members get admin access
- **GITHUB_TOKEN**: Personal access token for GitHub API access (create at [GitHub Tokens](https://github.com/settings/tokens))

## Google OAuth Setup

### Step 1: Create Google OAuth Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - Development: `http://localhost:4400/api/auth/google/callback`
     - Production: `https://your-domain.com/api/auth/google/callback`
5. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Google Admin Configuration (optional)
GOOGLE_ADMIN_EMAILS=admin@company.com,admin2@company.com
GOOGLE_ADMIN_DOMAINS=company.com,subsidiary.com
```

### Step 3: Configure Admin Access (Optional)

- **GOOGLE_ADMIN_EMAILS**: Comma-separated list of email addresses that get admin access
- **GOOGLE_ADMIN_DOMAINS**: Comma-separated list of Google Workspace domains whose users get platform engineer access

## Required Environment Variables

Ensure these essential variables are set in your `.env.local`:

```bash
# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:4400
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/idp_wrapper

# Redis
REDIS_URL=redis://localhost:6379

# JWT & Session Secrets (generate strong random strings)
JWT_SECRET=your_super_secret_jwt_key_here
SESSION_SECRET=your_session_secret_here

# Backstage Integration
BACKSTAGE_ROOT=./backstage
BACKSTAGE_BACKEND_URL=http://localhost:7007
BACKSTAGE_FRONTEND_URL=http://localhost:3000
```

## Testing OAuth Configuration

### 1. Start the Application

```bash
npm run dev
```

### 2. Test GitHub OAuth

1. Navigate to `http://localhost:4400/login`
2. Click the GitHub login button
3. You should be redirected to GitHub for authorization
4. After authorization, you should be redirected back to the dashboard

### 3. Test Google OAuth

1. Navigate to `http://localhost:4400/login`
2. Click the Google login button
3. You should be redirected to Google for authorization
4. After authorization, you should be redirected back to the dashboard

## Troubleshooting

### Common Issues

#### 1. "OAuth credentials not configured" Error

**Symptoms**: Error message when clicking OAuth login buttons
**Solution**: 
- Verify `.env.local` file exists and contains correct OAuth credentials
- Ensure no placeholder values remain (like `your_github_client_id_here`)
- Restart the application after changing environment variables

#### 2. "Invalid redirect URI" Error

**Symptoms**: OAuth provider shows redirect URI mismatch error
**Solution**:
- Verify the callback URLs in your OAuth app settings match exactly:
  - GitHub: `http://localhost:4400/api/auth/github/callback`
  - Google: `http://localhost:4400/api/auth/google/callback`
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly in `.env.local`

#### 3. "Database connection failed" Error

**Symptoms**: Application fails to start or OAuth callback fails
**Solution**:
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` in `.env.local` is correct
- Run database migrations: `npm run db:migrate`

#### 4. "Redis connection failed" Warning

**Symptoms**: OAuth state validation warnings in logs
**Solution**:
- Ensure Redis is running
- Verify `REDIS_URL` in `.env.local` is correct
- In development, the app will continue to work but with reduced security

### Debug Mode

For detailed OAuth debugging, set the log level in your `.env.local`:

```bash
LOG_LEVEL=debug
```

This will provide detailed logs for OAuth flows, including state validation and token exchanges.

### Production Considerations

When deploying to production:

1. **Use HTTPS**: Ensure your production URLs use HTTPS
2. **Environment Variables**: Set production OAuth apps with production callback URLs
3. **Secrets**: Use secure secret management for environment variables
4. **Database**: Use managed database services with connection pooling
5. **Redis**: Use managed Redis service for session storage

### Security Best Practices

1. **Client Secrets**: Never commit OAuth client secrets to version control
2. **Callback URLs**: Only whitelist necessary callback URLs in OAuth app settings
3. **Admin Access**: Regularly review admin user/organization lists
4. **Token Rotation**: Regularly rotate GitHub personal access tokens
5. **Session Management**: Configure appropriate session timeouts

## OAuth Flow Diagram

```
1. User clicks OAuth login button
2. Application redirects to OAuth provider
3. User authorizes application
4. OAuth provider redirects back with authorization code
5. Application exchanges code for access token
6. Application fetches user profile
7. Application creates/updates user account
8. Application creates session and redirects to dashboard
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Yes | Application base URL | `http://localhost:4400` |
| `GITHUB_CLIENT_ID` | OAuth | GitHub OAuth client ID | `1234567890abcdef` |
| `GITHUB_CLIENT_SECRET` | OAuth | GitHub OAuth client secret | `secret_here` |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth client ID | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret | `secret_here` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `REDIS_URL` | Yes | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Yes | JWT signing secret | Random string (32+ chars) |
| `SESSION_SECRET` | Yes | Session cookie secret | Random string (32+ chars) |

## Support

If you encounter issues not covered in this guide:

1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure all external services (database, Redis) are running
4. Review the OAuth provider documentation for any service-specific requirements

For additional help, please refer to the main project documentation or create an issue in the project repository.