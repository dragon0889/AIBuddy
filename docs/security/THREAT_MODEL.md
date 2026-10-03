# Threat model v1 (STRIDE rút gọn) – MVP

Phạm vi: web PWA, API, DB, ML Studio tại trình duyệt, luồng Dual Consent. Mức độ rủi ro: **C**ao / **T**B / **Th**ấp. Đây là bản đầu cho Sprint 0, cần rà soát lại sau Sprint 3 và trước pilot.

## Tài sản cần bảo vệ
1. Dữ liệu cá nhân trẻ em (tháng/năm sinh, tên hiển thị, tiến độ, kết quả đánh giá).
2. Dữ liệu sinh trắc thô (khung hình webcam, âm thanh): **không được rời thiết bị**.
3. Thông tin liên hệ phụ huynh (email/SĐT), bằng chứng đồng ý.
4. Tài khoản phụ huynh/admin; khóa mã hóa.

## Ranh giới tin cậy
Trẻ/phụ huynh (trình duyệt) ⇄ API ⇄ DB/Redis ⇄ nhà cung cấp Email/SMS. Trình duyệt là nơi duy nhất xử lý ảnh/âm thanh thô.

## Mối đe dọa & biện pháp

| # | Mối đe dọa | Loại | Mức | Biện pháp | Kiểm chứng |
|---|---|---|---|---|---|
| T1 | Ảnh/âm thanh thô bị gửi lên server hoặc bên thứ ba (lỗi mã, thư viện, extension) | Info disclosure | C | ADR-0002: CSP `connect-src 'self'`, model tự host, không analytics bên thứ ba trên trang ML; Worker không có quyền fetch ngoài; test Playwright chặn mọi request có body ảnh/blob | Test E2E mỗi lần CI (Sprint 6) |
| T2 | Giả mạo phụ huynh để cấp đồng ý thay | Spoofing | C | OTP email/SMS có hạn 10 phút, 5 lần thử, rate-limit; liên kết dùng một lần; ghi `consent_events` append-only; (Pha 2) eKYC | Test luồng OTP, thử brute-force |
| T3 | Trẻ tự đăng ký bằng thông tin người lớn | Spoofing | T | Hồ sơ con chỉ tạo bởi phụ huynh đã xác thực; không có đăng ký con độc lập trong MVP | Thiết kế |
| T4 | Chiếm hồ sơ con trên thiết bị dùng chung | Elevation | T | PIN do phụ huynh đặt, khóa khi hết giờ/idle, giới hạn thử PIN | Test |
| T5 | IDOR: phụ huynh/giáo viên xem dữ liệu con người khác | Info disclosure | C | RBAC + kiểm tra quan hệ (guardianship) trên mọi truy vấn; test phân quyền tự động | Test API (Sprint 2) |
| T6 | Rò rỉ PII qua log/analytics | Info disclosure | C | Log không chứa PII; lọc trường nhạy cảm; không dùng analytics bên thứ ba cho trẻ | Review + test log |
| T7 | Yêu cầu xóa không hoàn tất (kể cả bản sao lưu) | Repudiation/Compliance | C | Crypto-shredding (khóa dữ liệu riêng từng người), SLA 72h, chứng từ xóa | Test Sprint 11 |
| T8 | Tấn công XSS làm lộ phiên hoặc kích hoạt webcam trái phép | Tampering/Elevation | C | CSP nghiêm, không `dangerouslySetInnerHTML`, nội dung bài render từ schema (không HTML tùy ý), `Permissions-Policy` camera/mic chỉ cho origin | Scan + test |
| T9 | Nội dung bài học độc hại/sai (CMS bị chiếm) | Tampering | T | 2FA admin bắt buộc, duyệt nội dung 2 bước, phiên bản & audit log | Review |
| T10 | Prompt injection/nội dung không phù hợp khi có LLM (Pha 2) | Tampering | C | ADR-0003; Safety Proxy; red-team; log đã loại PII | Trước Pha 2 |
| T11 | Từ chối dịch vụ giờ cao điểm | DoS | T | CDN, cache, autoscale, rate-limit, load test 5k CCU | Sprint 12 |
| T12 | Lạm dụng OTP (SMS pumping, spam) | Abuse | T | Rate-limit theo IP/liên hệ, CAPTCHA thân thiện khi nghi ngờ, ngân sách SMS | Test |
| T13 | Thiết bị bị mất/nhiều người dùng chung dữ liệu IndexedDB | Info disclosure | Th | Xóa dữ liệu mẫu tạm sau huấn luyện; đăng xuất xóa cache hồ sơ | Test |
| T14 | Rủi ro chuỗi cung ứng (npm, mô hình) | Tampering | T | Khóa lockfile, `pnpm audit` trong CI, mô hình tự host kèm hash, nhà cung cấp tối thiểu | CI |

## Việc cần làm tiếp
- [ ] Thêm `pnpm audit` và kiểm tra giấy phép vào CI.
- [ ] Thêm header bảo mật (CSP, Permissions-Policy) khi có app thật (Sprint 2).
- [ ] Pen-test cơ bản ở Sprint 12; rà soát lại bản này sau Sprint 3.
