// Sao chép tài sản bên thứ ba vào apps/web/public để TỰ HOST (không gọi CDN/bên thứ ba lúc chạy – ADR-0002):
// nhị phân WASM của TF.js và media của Blockly (mặc định Blockly tải sprites.png từ blockly-demo.appspot.com).
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps/web/package.json"));
const dist = join(dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")), "dist");
const out = join(root, "apps/web/public/tfjs-wasm");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dist).filter((x) => x.endsWith(".wasm"))) copyFileSync(join(dist, f), join(out, f));
console.log("copied wasm to", out);

const blocklyMedia = join(root, "apps/web/node_modules/blockly/media"); // symlink pnpm → gói blockly
const mediaOut = join(root, "apps/web/public/blockly-media");
mkdirSync(mediaOut, { recursive: true });
for (const f of readdirSync(blocklyMedia)) copyFileSync(join(blocklyMedia, f), join(mediaOut, f));
console.log("copied blockly media to", mediaOut);
