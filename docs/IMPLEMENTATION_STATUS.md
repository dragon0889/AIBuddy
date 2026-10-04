# Trạng thái triển khai MVP (cập nhật 2026-10-04)

Ký hiệu: ✔ đủ theo phạm vi MVP · ◐ một phần · ✘ chưa làm. "Bằng chứng" là test/kiểm thử tự động trong repo trừ khi nói khác.
**Tóm tắt trung thực:** phần mềm MVP (Sprint 2–12) đã được xây dựng và kiểm thử tự động; **chưa làm** các việc cần người/thiết bị/hạ tầng thật: pilot (Sprint 13), đo trên thiết bị và webcam thật, thử tải 5.000/50.000 CCU, triển khai production (TLS, sao lưu, giám sát), nhà cung cấp OTP, rà soát pháp lý, duyệt nội dung bởi chuyên gia sư phạm.

## 1. Yêu cầu chức năng (SRS gốc)
| FR | Trạng thái | Triển khai | Ghi chú / giới hạn |
|---|---|---|---|
| FR-001 Bài học kể chuyện | ◐ | 9 loại bước (`apps/web/components/steps.tsx`), Mascot, đọc to (TTS), chấm ở máy chủ | Mascot chưa có giọng nói riêng (chỉ đọc to văn bản); 25 bài mẫu (L1: 8, L2: 15, L3: 2) cần chuyên gia duyệt |
| FR-002 Điểm & huy hiệu | ✔ (thiết kế lại – ADD-05) | `learning.ts`: XP theo quá trình, 6 huy hiệu, không streak ở cấp 1 | Khác SRS gốc có chủ đích (thưởng quá trình thay vì độ chính xác >80%) |
| FR-003 Đánh giá & thích ứng | ◐ | pre/post/micro/khảo sát; gợi ý bài ôn ở trụ cột yếu (`nextLesson`) | Luật đơn giản, không phải mô hình thích ứng đầy đủ |
| FR-004 Thu thập dữ liệu đa phương thức | ◐ | Webcam (ảnh, nhãn tùy chọn trong bài, trích đặc trưng lúc chụp) | Âm thanh/văn bản: Pha 2 |
| FR-005 Trình huấn luyện trực quan | ✔/◐ | Biểu đồ Accuracy/Loss thời gian thực, "Số lần học tập" chỉnh được, bước "vì sao máy sai" | "Kích thước nhóm mẫu" chưa hiển thị; ≤15 s đo ở Sprint 1 (dữ liệu tổng hợp) – chưa đo trên thiết bị thật |
| FR-006 Lập trình khối + ML | ◐ | Scratch Blocks, khối "khi mô hình nhận ra", chuyển động/hiển thị, camera trực tiếp | Trình thông dịch tối giản (không lặp/điều kiện/biến); chưa thử cảm ứng trên tablet |
| FR-007 Python sandbox | ✘ | – | Pha 2 |
| FR-008 Bảng điều khiển phụ huynh | ✔ | Hồ sơ nhiều con, giới hạn thời gian, camera, báo cáo tuần, Học cùng con, thu hồi/xóa | |
| FR-009 Cổng giáo viên | ✘ | – | Lùi sang Pha 2 (triển khai tại nhà) |
| FR-010 Dual Consent | ✔ | `family.ts`, `@aibuddy/shared` | Hạn chế: không chứng minh ai bấm "Con đồng ý"; chưa eKYC |
| FR-011 Xóa dữ liệu ≤72 h | ✔ | `erasure.ts` (crypto-shredding), báo cáo SLA | Quy tắc khôi phục sao lưu ở RUNBOOK |
| PRJ-01, PRJ-02 | ✔ | Studio + bài `L1-LRN-02`, `L2-LRN-02/03` | PRJ-03…06: Pha 2–3 |

## 2. Bổ sung ADD
| ADD | Trạng thái | Bằng chứng |
|---|---|---|
| 01 Trụ cột "AI có trách nhiệm" | ✔ | Test: ≥1/3 bài mỗi cấp thuộc RESP (`outcomes.test.ts`) |
| 02 "Tìm lỗi của AI" | ✔ | 6 bài cấp 2 (RESP-01, 05–09); chấm ở máy chủ |
| 03 Sandbox chatbot | ✘ | Pha 2 (ADR-0003) |
| 04 Outcomes & đánh giá | ◐ | 28 outcome, rubric, 6 bài đánh giá, đo pre/post; rubric chưa dùng trong UI (chưa có giáo viên chấm) |
| 05 Gamification thiết kế lại | ✔ | Test XP idempotent, chấm phía máy chủ, không streak L1 |
| 06 Hỗ trợ giáo viên | ✘ | Pha 2 |
| 07 Đồng hành phụ huynh | ◐ | Hướng dẫn, Học cùng con, báo cáo tuần; chưa đo "onboarding <5 phút" |
| 08 An toàn nội dung số sớm | ◐ | Bài RESP-04 (cấp 2), L3-RESP-02; PRJ-06 chưa có |
| 09 Cấp 1 tối giản công nghệ | ✔ | Camera mặc định tắt, cần phụ huynh bật + xác nhận người lớn, bài cấp 1 không gõ/code (schema) |
| 10 Tiếp cận & công bằng | ◐ | Đọc to, chế độ dễ đọc, tương phản AA, axe (0 lỗi nghiêm trọng ở 6 màn hình), chuyển hồ sơ PIN | Chưa kiểm với trình đọc màn hình thật/thiết bị yếu; chưa có phụ đề (chưa có video/âm thanh) |
| 11 Pilot & đo | ◐ | Công cụ: xuất ẩn danh, tính chỉ số, góp ý phụ huynh, quy trình | **Pilot chưa chạy** |

## 3. Phi chức năng
| Hạng mục | Trạng thái | Chi tiết |
|---|---|---|
| Tải trang ≤2 s | ✔ (đo giả lập) | 0,4 s / 1,5 s (xem `perf/PERFORMANCE.md`) |
| 50.000 CCU | ✘ | Chưa thử; số liệu cơ sở trên 1 máy |
| 5.000 CCU (mục tiêu MVP) | ✘ | Chưa thử tải ở quy mô này |
| AES-256 at rest | ◐ | Mã hóa theo trường (PII) trong ứng dụng; mã hóa đĩa là việc hạ tầng |
| TLS 1.3 | ✘ (hạ tầng) | Kết thúc TLS ở reverse proxy – chưa có cấu hình trong repo |
| Privacy by Default | ✔ | Camera tắt, không định vị/nhắn tin/hồ sơ công khai (không có chức năng đó), giới hạn thời gian mặc định |
| Dữ liệu sinh trắc không rời thiết bị | ✔ (đã kiểm với camera giả) | E2E; *chưa kiểm với webcam thật* |
| Sao lưu 6 giờ, 2 DC Tier III, uptime | ✘ | Việc hạ tầng |
| Offline cho bài lý thuyết | ◐ | SW + hàng đợi đồng bộ, E2E xanh; phụ thuộc đã mở trang chủ khi có mạng |
| Song ngữ Việt/Anh | ◐ | Khung giao diện song ngữ; **nội dung bài chỉ tiếng Việt** |
| WCAG 2.1 AA | ◐ | Kiểm tra tự động (axe) – chưa kiểm thủ công |

## 4. Chất lượng mã
| Gói | Test |
|---|---|
| `@aibuddy/shared` | 6 |
| `@aibuddy/content` | 35 (schema, outcome, tiêu chí chấp nhận nội dung) |
| `@aibuddy/ui` | 5 |
| `@aibuddy/ml-core` | 2 (rò rỉ tensor, học cụm tổng hợp) |
| `@aibuddy/api` | 41 – chạy trên **PGlite và PostgreSQL 16 thật** (`pnpm test:pg`) |
| E2E (`scripts/e2e-app.mjs`) | 1 luồng đầy đủ + kiểm tra quyền riêng tư + axe |
CI: typecheck, test, `pnpm audit --prod`, E2E (workflow `ci.yml`; chưa thấy chạy trên GitHub).
Chưa có: kiểm thử nhiều trình duyệt (chỉ Chromium), kiểm thử thiết bị di động, pen-test, quét SAST.

## 5. Việc cần người/thiết bị/hạ tầng (không thể làm trong môi trường phát triển)
1. Đo benchmark ML và chạy thử Xưởng dạy máy trên ≥3 thiết bị thật + webcam thật (hướng dẫn: `spikes/SPRINT1_REPORT.md`).
2. Chọn nhà cung cấp OTP (Q4) và hosting/vị trí dữ liệu (Q3); dựng staging/production (Dockerfile/compose mẫu **chưa build thử**), TLS, sao lưu, giám sát, xoay khóa chủ.
3. Pháp lý: duyệt thông báo quyền riêng tư/điều khoản, DPIA, thời hạn lưu, hồ sơ NĐ 13/2023, xác minh số hiệu Luật BVDLCN 2025.
4. Chuyên gia sư phạm: duyệt outcome, rubric, 25 bài, bài đánh giá (độ tin cậy/độ khó của pre/post), nội dung tiếng Anh nếu cần.
5. Thử người dùng với trẻ từng độ tuổi (Sprint 4/9) và pilot 10–20 gia đình (`pilot/PILOT_PROTOCOL.md`).
6. Thử tải 5.000/50.000 CCU trên hạ tầng thật; pen-test; kiểm tra trợ năng thủ công.
