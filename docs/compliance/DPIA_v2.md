# DPIA v2 – cập nhật theo phần mềm đã xây dựng (bản nháp kỹ thuật)

> **Không phải tư vấn pháp lý.** Cần DPO/luật sư rà soát. v1: [`DPIA_v1.md`](DPIA_v1.md). Chỉ ghi các thay đổi/bổ sung so với v1, dựa trên **hành vi thực tế đã kiểm thử** (kèm test).

## 1. Dữ liệu thực tế đang xử lý
| Dữ liệu | Nơi | Mã hóa/biện pháp | Kiểm chứng |
|---|---|---|---|
| email, SĐT phụ huynh | `users.email_enc`, `phone_enc` | AES-256-GCM, khóa theo chủ thể; tra cứu bằng HMAC có pepper | `auth.test.ts` (không có email dạng rõ trong DB) |
| biệt danh, tháng/năm sinh trẻ | `children.*_enc` | như trên; chỉ giữ `level`, `age_at_creation` ở dạng rõ | `family.test.ts` |
| PIN trẻ, mật khẩu | `pin_hash`, `password_hash` | scrypt (N=16384) | `auth.test.ts`, `family.test.ts` |
| Tiến độ, XP, huy hiệu, đánh giá | bảng học tập | khóa ngoại + `ON DELETE CASCADE` | `family.test.ts` (xóa) |
| Bằng chứng đồng ý | `consent_events` | `child_ref` = HMAC; bất biến bằng trigger | `family.test.ts` |
| Nhật ký kiểm toán | `audit_logs` | tham chiếu băm; bất biến | `family.test.ts` |
| Kết quả dự án ML | `project_events` | **chỉ số liệu** (độ chính xác, số mẫu, cờ cải thiện) | `learning.test.ts` (kiểm tra danh sách cột) |
| Góp ý phụ huynh | `parent_feedback` | `parent_ref` băm; ý kiến tự do ≤500 ký tự (**rủi ro: người dùng có thể nhập PII** – đã cảnh báo trên form) | `pilot.test.ts` |
| Ảnh/âm thanh thô | **không rời trình duyệt** | không có API nhận dữ liệu media; CSP `connect-src 'self'`; model tự host | `e2e-app.mjs`: không request ngoài, không POST có ảnh/base64 |
| Mô hình huấn luyện (trọng số) | IndexedDB cục bộ | xóa khi thoát hồ sơ (`clearLocalModels`) | thiết kế; test thủ công cần bổ sung |
| Hàng đợi đồng bộ, cache hồ sơ | `localStorage`, `sessionStorage` | chỉ mã bước/đáp án; hồ sơ hiển thị | thiết kế |

## 2. Quyết định đã chốt (trả lời các câu hỏi v1)
- **Q1 (đồng bộ mô hình lên máy chủ):** *không* – chỉ lưu cục bộ (an toàn mặc định). Hệ quả: không dùng nhiều thiết bị cho mô hình; giáo viên (Pha 2) không xem được mô hình.
- **Xóa dữ liệu:** thực hiện ngay khi xử lý yêu cầu; SLA 72 giờ được ghi `due_at` và theo dõi bằng báo cáo tuân thủ. Crypto-shredding hủy khóa chủ thể; quy tắc khôi phục sao lưu ở `RUNBOOK.md`.
- **Hồ sơ chờ đồng ý >7 ngày:** tự động xóa.

## 3. Rủi ro còn lại / hạn chế mới nhận diện
| # | Vấn đề | Đánh giá | Biện pháp đề xuất |
|---|---|---|---|
| 1 | **Không chứng minh được ai bấm "Con đồng ý"** (phụ huynh cầm máy) | Trung bình – tính hợp lệ của đồng ý trẻ 7+ | Công khai hạn chế; pháp lý xác định đủ chưa; cân nhắc xác nhận bổ sung |
| 2 | Xác minh phụ huynh chỉ bằng OTP email/SMS (chưa eKYC) | Trung bình | eKYC ở Pha 2 nếu pháp lý yêu cầu |
| 3 | Khóa chủ (KEK) chưa có quy trình xoay | Cao nếu lộ khóa | Làm trước production (RUNBOOK) |
| 4 | Pepper dùng cho tra cứu email: đổi = mất tra cứu | Thấp (vận hành) | Quy trình quản lý khóa |
| 5 | `consent_events`/`audit_logs` giữ sau khi xóa (không có PII trực tiếp nhưng là tham chiếu băm của id đã xóa) | Thấp | Pháp lý xác nhận thời hạn lưu |
| 6 | Vector đặc trưng (embedding) khuôn mặt trong RAM trình duyệt trong lúc học | Thấp (không rời máy, xóa khi xong/rời trang) | Đã có `wipe()`; thêm test tự động kiểm tra giải phóng (hiện kiểm thử rò rỉ tensor ở `ml-core`) |
| 7 | Nhà cung cấp OTP chưa chọn → dữ liệu liên lạc đi qua bên thứ ba | Trung bình | Chọn nhà cung cấp có hợp đồng xử lý dữ liệu; chỉ gửi mã + địa chỉ |
| 8 | Lưu trữ trong nước (Q3) chưa quyết | Chưa rõ | Pháp lý xác định yêu cầu; chọn hạ tầng |
| 9 | Pilot dùng dữ liệu thật của trẻ | Trung bình | Phiếu đồng ý nghiên cứu, ẩn danh khi xuất, quy tắc dừng (`pilot/PILOT_PROTOCOL.md`) |

## 4. Đề nghị rà soát
Trước pilot: pháp lý/DPO duyệt `legal/PRIVACY_NOTICE_DRAFT.md`, mục 3 (hạn chế), thời hạn lưu, nhà cung cấp, và cách nộp hồ sơ đánh giá tác động theo NĐ 13/2023. Trước Pha 2 (chatbot sandbox): DPIA riêng.
