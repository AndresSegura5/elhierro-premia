import test from "node:test";
import assert from "node:assert/strict";
import { serializePostgres } from "../lib/serialized-postgres.ts";

test("concurrent reads never pipeline and preserve their parameters and results", async () => {
  let active = 0;
  let maxActive = 0;
  const client = async (template, value) => {
    assert.equal(template[0], "SELECT ");
    maxActive = Math.max(maxActive, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return [{ value }];
  };
  const sql = serializePostgres(client);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => sql`SELECT ${i}`));
  assert.equal(maxActive, 1);
  assert.deepEqual(results.map(([row]) => row.value), Array.from({ length: 30 }, (_, i) => i));
});

test("a failed query does not block the queue", async () => {
  const sql = serializePostgres(async (_template, value) => {
    if (value === "fail") throw new Error("query failed");
    return [{ value }];
  });
  const results = await Promise.allSettled([sql`SELECT ${"fail"}`, sql`SELECT ${"ok"}`]);
  assert.equal(results[0].status, "rejected");
  assert.deepEqual(results[1].value, [{ value: "ok" }]);
});

test("transactions retain exclusive access until commit or rollback finishes", async () => {
  const events = [];
  const client = async () => { events.push("read"); return []; };
  client.begin = async (operation) => {
    events.push("begin");
    try {
      const result = await operation(async () => { events.push("write"); return []; });
      events.push("commit");
      return result;
    } catch (error) {
      events.push("rollback");
      throw error;
    }
  };
  const sql = serializePostgres(client);
  await Promise.all([
    sql.begin(async (tx) => { await tx`UPDATE example`; return 42; }),
    sql`SELECT example`,
  ]);
  assert.deepEqual(events, ["begin", "write", "commit", "read"]);
  events.length = 0;
  const results = await Promise.allSettled([
    sql.begin(async () => { throw new Error("rollback"); }),
    sql`SELECT example`,
  ]);
  assert.equal(results[0].status, "rejected");
  assert.deepEqual(events, ["begin", "rollback", "read"]);
});
