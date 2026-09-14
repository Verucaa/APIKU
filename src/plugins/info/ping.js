export default {
  name: "Server Status",
  category: "info",
  description: "Kesehatan server: uptime, memori, dan versi Node",
  method: ["GET"],
  params: {},
  execute: async () => ({
    uptime: `${process.uptime().toFixed(0)}s`,
    memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
    node: process.version,
    timestamp: new Date().toISOString()
  })
};