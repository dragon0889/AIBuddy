# AIBuddy

Nền tảng giúp trẻ 6–14 tuổi **hiểu AI và biết dùng AI hiệu quả, an toàn**, triển khai đầu tiên **tại nhà** (phụ huynh là chủ tài khoản).

## Tài liệu
- [`docs/PLAN.md`](docs/PLAN.md) – kế hoạch phát triển (MVP ~6 tháng, 13 sprint)
- [`docs/DESIGN.md`](docs/DESIGN.md) – thiết kế cơ bản
- [`docs/SRS_ADDENDUM.md`](docs/SRS_ADDENDUM.md) – phụ lục SRS (ADD-01…ADD-11, ưu tiên hơn SRS gốc khi xung đột)
- [`docs/LEARNING_OUTCOMES.md`](docs/LEARNING_OUTCOMES.md) – mục tiêu học tập & đánh giá
- [`docs/CURRICULUM_SOURCES.md`](docs/CURRICULUM_SOURCES.md) – nguồn giáo trình và lưu ý giấy phép
- [`docs/BACKLOG.md`](docs/BACKLOG.md) – backlog Sprint 2–13; [`docs/adr/`](docs/adr), [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md), [`docs/compliance/DPIA_v1.md`](docs/compliance/DPIA_v1.md)
- [`docs/spikes/SPRINT1_REPORT.md`](docs/spikes/SPRINT1_REPORT.md) – kết quả spike TF.js và Scratch Blocks
- `Thiết kế SRS App AI.docx` – SRS gốc

## Cấu trúc monorepo (pnpm workspace)
```
apps/web          Next.js (bản khung)
apps/api          NestJS (health + minh họa máy trạng thái consent)
packages/shared   logic dùng chung: tính tuổi, máy trạng thái Dual Consent (có test)
packages/content  schema (zod) cho bài học/outcome/rubric + validator CLI
packages/ml-core  trích embedding (MobileNet) + huấn luyện đầu phân loại (TF.js), test rò rỉ tensor
packages/ui       design tokens theo cấp độ (test WCAG, cỡ chữ, vùng chạm)
content/lessons   3 bài mẫu: L1-RESP-01, L2-RESP-01 (Tìm lỗi của AI), L2-LRN-01
content/outcomes  28 outcome (bản nháp, chờ chuyên gia sư phạm duyệt); content/rubrics: rubric dự án
```

## Chạy
```bash
pnpm install
pnpm typecheck && pnpm test
pnpm --filter @aibuddy/content validate     # kiểm tra bài học trong content/lessons
pnpm --filter @aibuddy/api dev              # http://localhost:3001/health
pnpm --filter @aibuddy/web dev              # /spike/ml và /spike/blocks là trang spike Sprint 1
pnpm e2e                                    # build web + E2E khối lệnh (cần Chromium)
pnpm bench:ml                               # benchmark ML (cpu/wasm/webgl, giả lập CPU chậm)
```

Yêu cầu: Node ≥ 20, pnpm 10. Trạng thái: **Sprint 0 xong, Sprint 1 xong một phần** (chưa đo trên thiết bị/webcam thật). Chưa có DB, OTP, ML Studio hoàn chỉnh (Sprint 2–7).
