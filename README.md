# AIBuddy

Nền tảng giúp trẻ 6–14 tuổi **hiểu AI và biết dùng AI hiệu quả, an toàn**, triển khai đầu tiên **tại nhà** (phụ huynh là chủ tài khoản).

## Tài liệu
- [`docs/PLAN.md`](docs/PLAN.md) – kế hoạch phát triển (MVP ~6 tháng, 13 sprint)
- [`docs/DESIGN.md`](docs/DESIGN.md) – thiết kế cơ bản
- [`docs/SRS_ADDENDUM.md`](docs/SRS_ADDENDUM.md) – phụ lục SRS (ADD-01…ADD-11, ưu tiên hơn SRS gốc khi xung đột)
- [`docs/LEARNING_OUTCOMES.md`](docs/LEARNING_OUTCOMES.md) – mục tiêu học tập & đánh giá
- [`docs/CURRICULUM_SOURCES.md`](docs/CURRICULUM_SOURCES.md) – nguồn giáo trình và lưu ý giấy phép
- `Thiết kế SRS App AI.docx` – SRS gốc

## Cấu trúc monorepo (pnpm workspace)
```
apps/web          Next.js (bản khung)
apps/api          NestJS (health + minh họa máy trạng thái consent)
packages/shared   logic dùng chung: tính tuổi, máy trạng thái Dual Consent (có test)
packages/content  schema (zod) cho bài học JSON + validator CLI
content/lessons   3 bài mẫu: L1-RESP-01, L2-RESP-01 (Tìm lỗi của AI), L2-LRN-01
```

## Chạy
```bash
pnpm install
pnpm typecheck && pnpm test
pnpm --filter @aibuddy/content validate     # kiểm tra bài học trong content/lessons
pnpm --filter @aibuddy/api dev              # http://localhost:3001/health
pnpm --filter @aibuddy/web dev
```

Yêu cầu: Node ≥ 20, pnpm 10. Trạng thái: **Sprint 0** – chưa có DB, OTP, ML Studio (xem plan, Sprint 1–3).
