import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lesson } from "./schema.ts";

const dir = process.argv[2] ?? "content/lessons";
let failed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const r = lesson.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
  if (r.success) console.log(`ok   ${f}`);
  else {
    failed++;
    console.error(`FAIL ${f}\n${r.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
}
process.exit(failed ? 1 : 0);
