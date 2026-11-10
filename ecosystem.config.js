module.exports = {
  apps: [{
    name: 'myticket',
    script: 'dist/src/main.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    time: true,
    exp_backoff_restart_delay: 1000,
  }],
};
