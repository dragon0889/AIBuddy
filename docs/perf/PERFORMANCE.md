# Hiệu năng & khả năng mở rộng – kết quả đo (2026-10-03/04)

> Đo trên **một máy cloud 4 vCPU, 16 GB RAM**, nơi API, PostgreSQL và công cụ tạo tải **cùng chạy chung**. Đây là số liệu cơ sở cho thiết kế, **không phải bằng chứng đạt NFR 6.1 (50.000 CCU)**.

## 1. Tải trang (SRS 6.1: trang lý thuyết ≤ 2,0 s) – `scripts/perf-pages.mjs`, `docs/perf/page-load.json`
Bản build production, **cache lạnh**, mạng giả lập bằng CDP, trung vị 3 lần, từ lúc điều hướng tới khi nội dung bài hiện ra:

| Mạng giả lập | `/play/home` | `/play/lesson?id=…` | Dung lượng tải (≈) |
|---|---|---|---|
| Băng thông rộng (10 Mbps, RTT 40 ms) | 0,42 s | 0,37 s | 131–140 KB |
| 4G chậm (1,6 Mbps, RTT 150 ms) | 1,50 s | 1,48 s | 131–137 KB |

→ **Đạt ngân sách 2,0 s** ở cả hai cấu hình trên cho trang bài học/trang chủ của trẻ (chưa tính Xưởng dạy máy: tải thêm TF.js + mô hình ~2 MB khi vào trang đó). Chưa đo trên thiết bị thật, chưa đo từ mạng Việt Nam.

## 2. API – `scripts/load-api.mjs` (autocannon, 100 kết nối, 10 s, có phiên trẻ hợp lệ)
**PostgreSQL 16 (thật):**

| Endpoint | req/s | p50 | p99 | Lỗi |
|---|---|---|---|---|
| GET /api/v1/child/lessons | ≈2.570 | 37 ms | 73 ms | 0 |
| GET /api/v1/child/lessons/:id | ≈2.740 | 35 ms | 46 ms | 0 |
| POST /api/v1/child/heartbeat | ≈5.300 | 17 ms | 42 ms | 0 lỗi mạng* |

\* Phần lớn phản hồi là 403 `screen_time_exceeded` vì hồ sơ thử đã hết giới hạn ngày sau vài giây tải – con số req/s của heartbeat vì vậy **không đại diện** cho đường ghi thành công.
PGlite (một tiến trình, chỉ dev) chỉ đạt 350–620 req/s: **không dùng để đánh giá năng lực**.

## 3. Ước lượng (giả định, chưa kiểm chứng)
- 50.000 CCU, nhịp tim 30 s ⇒ ≈1.700 ghi/giây + tải trang. Một nút API + một PostgreSQL đã vượt mức đó trên máy dev ở đường đọc; **cần thử tải trên hạ tầng thật** (nhiều nút API, PostgreSQL có replica/pool, Redis) để xác nhận.
- Đã giảm ghi DB: cập nhật `last_seen` phiên tối đa mỗi 30 s (giảm ghi ≈35–70% trong thử nghiệm).
- Điểm nghẽn dự kiến: bảng `sessions`/`usage_days` (ghi liên tục). Khi mở rộng: chuyển phiên sang Redis, gom nhịp tim (batch), partition `usage_days`.
- Rate limiter hiện nằm trong bộ nhớ từng tiến trình (xem `lib/rate-limit.ts`): chạy nhiều nút cần chuyển sang Redis, nếu không giới hạn đăng nhập/OTP bị nhân theo số nút.

## 4. Chưa đo
Độ trễ end-to-end qua reverse proxy/TLS 1.3; tải kéo dài (soak); độ trễ khởi động lạnh; thử tải ≥5.000 CCU (mục tiêu MVP, Sprint 12) và 50.000 CCU (Pha 3); tải của Xưởng dạy máy trên thiết bị yếu (đã có benchmark Sprint 1, chưa có thiết bị thật).
