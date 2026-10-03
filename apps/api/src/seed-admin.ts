// Dùng: ADMIN_EMAIL=... ADMIN_PASSWORD=... tsx src/seed-admin.ts  (cần DATABASE_URL và khóa như main.ts)
import { createPgDb } from "./db/index.ts";
import { Hasher, KeyService } from "./lib/crypto.ts";
import { createAdmin } from "./modules/admin.ts";
import { defaultConfig, type AppContext } from "./context.ts";
import { RateLimiter } from "./lib/rate-limit.ts";
import { MockOtpSender } from "./lib/otp.ts";
import { ContentStore } from "./modules/content.ts";

const { DATABASE_URL, AIBUDDY_MASTER_KEY, AIBUDDY_PEPPER, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !AIBUDDY_MASTER_KEY || !AIBUDDY_PEPPER || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("missing env");
const db = createPgDb(DATABASE_URL);
const now = () => new Date();
const ctx = { db, now, config: defaultConfig, keys: new KeyService(db, Buffer.from(AIBUDDY_MASTER_KEY, "base64"), now), hasher: new Hasher(Buffer.from(AIBUDDY_PEPPER, "base64")), rate: new RateLimiter(now), otp: new MockOtpSender(), content: {} as ContentStore } as AppContext;
const r = await createAdmin(ctx, ADMIN_EMAIL, ADMIN_PASSWORD);
console.log("Admin created. Add this TOTP to an authenticator app NOW (shown once):\n", r.otpauthUri);
await db.close();
