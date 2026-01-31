module.exports = {
  apps: [
    {
      name: 'sirius-dz-backend',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005
      },
    },
  ],
};
