module.exports = {
  apps: [

    // 🔹 API SERVER
    // {
    //   name: "console-api",
    //   cwd: "C:\\Users\\Administrator\\Desktop\\Incoming_wa_dashboard",

    //   script: "dist/src/server.js",
    //   exec_mode: "fork",
    //   instances: 1,

    //   node_args: "-r dotenv/config",

    //   env: {
    //     NODE_ENV: "production",
    //     PORT: 5000,
    //   },

    //   autorestart: true,
    //   watch: false,
    //   max_restarts: 5,
    //   restart_delay: 3000,
    // },

    // 🔹 WORKER
    // {
    //   name: "console-worker",
    //   cwd: "C:\\Users\\Administrator\\Desktop\\Incoming_wa_dashboard",

    //   script: "dist/src/workers/index.js",
    //   exec_mode: "fork",
    //   instances: 1,

    //   env: {
    //     NODE_ENV: "production",
    //     WORKER_MODE: "true",
    //   },

    //   autorestart: true,
    //   watch: false,
    //   max_restarts: 5,
    //   restart_delay: 5000,
    // },

//     {
//   name: "console-worker",
//   cwd: "C:\\Users\\Administrator\\Desktop\\Incoming_wa_dashboard",
//   script: "dist/src/workers/index.js",

//   node_args: "-r dotenv/config",

//   exec_mode: "fork",
//   instances: 1,

//   env: {
//     NODE_ENV: "production",
//     WORKER_MODE: "true",
//     DOTENV_CONFIG_PATH:
//       "C:\\Users\\Administrator\\Desktop\\Incoming_wa_dashboard\\.env",
//   },

//   autorestart: true,
//   watch: false,
//   max_restarts: 5,
//   restart_delay: 5000,
//   max_memory_restart: "1G",
// },

    // 🔹 USER UI (3000)
    {
      name: "soft7-user",
      cwd: "C:\\Users\\Administrator\\Desktop\\WA_Dashboard",

      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",

      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
      },

      autorestart: true,
      watch: false,
    },

    // 🔹 ADMIN UI (3001)
    {
      name: "soft7-admin",
      cwd: "C:\\Users\\Administrator\\Desktop\\WA_Admin",

      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",

      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOST: "0.0.0.0",
      },

      autorestart: true,
      watch: false,
    },

        // 🔹 SUPER ADMIN UI (5555)
    // {
    //   name: "superadmin",
    //   cwd: "C:\\Users\\Administrator\\Desktop\\Super_Admin_Soft7",

    //   script: "node_modules/next/dist/bin/next",
    //   args: "start -p 5555",

    //   exec_mode: "fork",

    //   env: {
    //     NODE_ENV: "production",
    //     PORT: 5555,
    //     HOST: "0.0.0.0",
    //   },

    //   autorestart: true,
    //   watch: false,
    // },

        // 🔹 SUPER ADMIN UI (5555)
    // {
    //   name: "testing-api",
    //   cwd: "C:\\Users\\Administrator\\Desktop\\testing folder\\Incoming_wa_dashboard",

    //   script: "dist/src/server.js",
    //   exec_mode: "fork",
    //   instances: 1,

    //   node_args: "-r dotenv/config",

    //   env: {
    //     NODE_ENV: "production",
    //     PORT: 5001,
    //   },

    //   autorestart: true,
    //   watch: false,
    //   max_restarts: 5,
    //   restart_delay: 3000,
    // },

  ]
};