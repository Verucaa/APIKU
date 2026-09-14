import { randomUUID } from "node:crypto";

export default {
  name: "Generator UUID",
  category: "tools",
  description: "Buat UUID v4 acak, opsional beberapa sekaligus",
  method: ["GET", "POST"],
  params: {
    count: {
      type: "number",
      required: false,
      description: "Jumlah UUID (default 1, maks 100)"
    }
  },
  execute: async ({ query, body }) => {
    const count = Math.min(Math.max(parseInt(query.count || body?.count || 1, 10) || 1, 1), 100);
    const uuids = Array.from({ length: count }, randomUUID);
    return count === 1 ? { uuid: uuids[0] } : { count, uuids };
  }
};