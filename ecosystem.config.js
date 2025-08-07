module.exports = {
  apps: [
    {
      name: 'saas-idp-portal',
      script: 'npm',
      args: 'run dev',
      cwd: '/Users/lokesh/git/saas-idp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
        PORT: 4400
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4400
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Health check configuration
      health_check: {
        interval: 30000,
        timeout: 5000,
        retries: 3
      }
    },
    {
      name: 'saas-idp-proxy',
      script: './scripts/port-proxy.js',
      cwd: '/Users/lokesh/git/saas-idp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        SOURCE_PORT: 3000,
        TARGET_PORT: 4400
      },
      error_file: './logs/proxy-error.log',
      out_file: './logs/proxy-out.log',
      time: true,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '5s'
    },
    {
      name: 'saas-idp-backstage',
      script: 'yarn',
      args: 'dev',
      cwd: '/Users/lokesh/git/saas-idp/backstage',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'development',
        PORT: 7007
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 7007
      },
      error_file: '../logs/backstage-error.log',
      out_file: '../logs/backstage-out.log',
      time: true,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      exec_mode: 'fork',
      interpreter: 'none'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/saas-idp.git',
      path: '/var/www/saas-idp',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};