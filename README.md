# AIBuddy

Nền tảng giúp trẻ 6–15 tuổi **hiểu AI và biết dùng AI hiệu quả, an toàn**, triển khai đầu tiên **tại nhà** (phụ huynh là chủ tài khoản). Ảnh/âm thanh của trẻ **không rời thiết bị**.

> **Trạng thái:** phần mềm MVP (Sprint 0–12) đã xây dựng và kiểm thử tự động. **Chưa làm:** pilot với gia đình thật, đo trên thiết bị/webcam thật, thử tải quy mô, triển khai production, duyệt pháp lý và sư phạm. Chi tiết trung thực: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

## Tài liệu
- Kế hoạch & thiết kế: [`docs/PLAN.md`](docs/PLAN.md) · [`docs/DESIGN.md`](docs/DESIGN.md) · [`docs/BACKLOG.md`](docs/BACKLOG.md) · [`docs/adr/`](docs/adr)
- Yêu cầu: `Thiết kế SRS App AI.docx` (gốc) + [`docs/SRS_ADDENDUM.md`](docs/SRS_ADDENDUM.md) (ADD-01…11, ưu tiên khi xung đột)
- Sư phạm: [`docs/LEARNING_OUTCOMES.md`](docs/LEARNING_OUTCOMES.md) · [`docs/CURRICULUM_SOURCES.md`](docs/CURRICULUM_SOURCES.md)
- Bảo mật/tuân thủ: [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) · [`docs/compliance/DPIA_v2.md`](docs/compliance/DPIA_v2.md) · [`docs/legal/PRIVACY_NOTICE_DRAFT.md`](docs/legal/PRIVACY_NOTICE_DRAFT.md)
- Vận hành & đo đạc: [`docs/RUNBOOK.md`](docs/RUNBOOK.md) · [`docs/perf/PERFORMANCE.md`](docs/perf/PERFORMANCE.md) · [`docs/spikes/SPRINT1_REPORT.md`](docs/spikes/SPRINT1_REPORT.md) · [`docs/pilot/PILOT_PROTOCOL.md`](docs/pilot/PILOT_PROTOCOL.md)

## Cấu trúc monorepo (pnpm)
```
apps/api          Fastify + PostgreSQL (PGlite khi dev/test): auth, đồng ý kép, học tập, xóa dữ liệu, CMS, báo cáo
apps/web          Next.js PWA: phụ huynh, trẻ (bài học, đánh giá, Xưởng dạy máy, khối lệnh), admin
packages/shared   tính tuổi, máy trạng thái Dual Consent
packages/content  schema bài học/outcome/đánh giá/rubric (zod) + validator
packages/ml-core  trích embedding MobileNet + huấn luyện đầu phân loại (TF.js)
packages/ui       design tokens (WCAG AA, cỡ chữ theo cấp, màu khối đạt AA)
content/          25 bài, 28 outcome, 6 bài đánh giá, rubric, hướng dẫn phụ huynh (bản nháp chờ duyệt sư phạm)
scripts/          e2e-app, e2e-blocks, bench-ml, perf-pages, load-api, copy-assets
```

## Chạy thử (dev)
```bash
pnpm install
pnpm --filter @aibuddy/api dev      # :3001, PGlite trong bộ nhớ (dữ liệu mất khi tắt); OTP in ở GET /api/v1/dev/outbox
pnpm --filter @aibuddy/web dev      # :3000 (đặt API_URL nếu API ở nơi khác)
```
Đăng ký phụ huynh → lấy mã OTP từ `http://127.0.0.1:3001/api/v1/dev/outbox` (chỉ dev) → tạo hồ sơ con → đồng ý kép → “Cho con chơi”.

## Kiểm thử
```bash
pnpm typecheck && pnpm test                  # 89 test đơn vị/tích hợp (PGlite)
TEST_DATABASE_URL=postgres://… pnpm --filter @aibuddy/api test:pg   # cùng bộ test trên PostgreSQL thật
pnpm --filter @aibuddy/web build && node scripts/e2e-app.mjs        # E2E toàn luồng: camera giả, offline, riêng tư, axe (cần Chromium)
node scripts/perf-pages.mjs ; node scripts/load-api.mjs             # đo tải trang / API
pnpm audit --prod
```
Production: xem [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (bắt buộc đặt `AIBUDDY_MASTER_KEY`, `AIBUDDY_PEPPER`, `OTP_WEBHOOK_URL`…). Dockerfile/compose mẫu **chưa build thử**.
