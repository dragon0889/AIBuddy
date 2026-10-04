# Runbook vận hành (bản nháp)

## 1. Thành phần & bí mật
| Thành phần | Ghi chú |
|---|---|
| web (Next.js) | Proxy `/api/*` tới API qua route handler (`API_URL` đọc lúc chạy). TLS 1.3 kết thúc ở reverse proxy/LB phía trước. |
| api (Fastify) | Cần `DATABASE_URL`, `AIBUDDY_MASTER_KEY` (32 byte base64), `AIBUDDY_PEPPER` (32 byte base64), `ALLOWED_ORIGIN`, **`OTP_WEBHOOK_URL`+`OTP_WEBHOOK_TOKEN`** (production từ chối khởi động nếu thiếu). |
| PostgreSQL 16 | Mã hóa đĩa (at-rest) ở tầng hạ tầng; PII trong cột đã mã hóa theo trường (AES-256-GCM, khóa theo chủ thể). |

Sinh khóa: `head -c32 /dev/urandom | base64`. **Mất `AIBUDDY_MASTER_KEY` = mất toàn bộ dữ liệu mã hóa.** Lưu trong KMS/Secret Manager, sao lưu riêng, tách khỏi sao lưu DB.
**Chưa có quy trình xoay khóa chủ (KEK rotation)** – việc cần làm trước production (bọc lại DEK bằng KEK mới; DEK không đổi nên không phải mã hóa lại dữ liệu).
Đổi `AIBUDDY_PEPPER` làm mất khả năng tra cứu email → không đổi sau khi đã có dữ liệu.

## 2. Khởi tạo
1. Chạy API một lần để tự migrate (`schema_migrations`).
2. Tạo ≥2 tài khoản Admin (cần 2 người cho duyệt nội dung):
   `ADMIN_EMAIL=… ADMIN_PASSWORD=… DATABASE_URL=… AIBUDDY_MASTER_KEY=… AIBUDDY_PEPPER=… pnpm --filter @aibuddy/api exec tsx src/seed-admin.ts` → quét mã TOTP in ra **ngay** (chỉ hiện một lần).
3. Kiểm tra `GET /health`; đăng nhập `/admin` bằng mật khẩu + mã 2FA.

## 3. Vận hành hằng ngày
- **Job bảo trì** chạy mỗi 10 phút trong tiến trình API (`runMaintenance`): hết hạn hồ sơ chờ đồng ý (>7 ngày → xóa), xử lý yêu cầu xóa, dọn phiên. Nếu chạy nhiều nút, mỗi nút chạy job (an toàn vì thao tác idempotent, nhưng nên chuyển sang cron/lock).
- **SLA xóa dữ liệu 72 giờ:** theo dõi `GET /api/v1/admin/compliance-report` → `erasure.openOverdue` phải = 0; cảnh báo nếu >0 hoặc `completedLate` >0.
- **Sao lưu:** sao lưu DB định kỳ (SRS: 6 giờ/lần, 2 trung tâm dữ liệu). Nhờ crypto-shredding, bản sao lưu chứa dữ liệu đã xóa không đọc được **miễn là khóa chủ thể đã bị hủy trong DB hiện hành và không khôi phục lại bảng `subject_keys` cũ**. **Quy tắc khôi phục:** sau khi restore, phải chạy lại mọi `erasure_requests` đã hoàn tất (xóa lại khóa/hàng) trước khi mở dịch vụ.
- **Nhật ký:** `audit_logs` và `consent_events` bất biến (trigger DB). Không chứa PII (chỉ tham chiếu băm).

## 4. Sự cố
| Tình huống | Hành động |
|---|---|
| Nghi lộ dữ liệu/khóa | Cô lập; thu hồi khóa/secret; đánh giá phạm vi bằng audit log; thông báo theo quy định (NĐ 13/2023: báo cáo vi phạm – xác nhận với pháp lý). |
| OTP không tới | Kiểm tra webhook nhà cung cấp (API trả 502 `otp_delivery_failed`); hạn mức SMS. |
| Phụ huynh báo con thấy nội dung không phù hợp | Gỡ bài qua CMS (soạn bản mới + duyệt 2 người), ghi nhận, rà soát nội dung tương tự. |
| Hết giờ chơi nhầm | Phụ huynh tăng giới hạn trong Cài đặt (ghi audit). |

## 5. Giới hạn đã biết (cần xử lý trước khi mở rộng)
Rate limit trong bộ nhớ; phiên lưu PostgreSQL; chưa có xoay khóa chủ; Dockerfile/compose **chưa được build thử**; chưa có giám sát/cảnh báo tự động (chỉ có báo cáo tuân thủ); chưa có bản sao lưu tự động trong repo.
