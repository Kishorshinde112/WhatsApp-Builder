module.exports = {
  apps: [
    {
      name: "whatsapp-api",
      cwd: "./artifacts/api-server",
      script: "dist/index.mjs",
      node_args: "--enable-source-maps",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 8080,
      },
    },
    {
      name: "whatsapp-dashboard",
      cwd: "./artifacts/dashboard",
      script: "../../node_modules/.bin/vite",
      args: "preview --port 3000 --host 0.0.0.0",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BASE_PATH: "/",
      },
    },
  ],
};
