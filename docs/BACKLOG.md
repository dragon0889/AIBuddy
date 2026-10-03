# Backlog MVP (Sprint 2–13)

Ước lượng theo điểm tương đối (S=1–2 ngày, M=3–5 ngày, L=1–2 tuần). Tổng hợp từ `PLAN.md`. Mỗi story gắn mã yêu cầu; Definition of Done chung ở cuối.

| Sprint | Epic | Story | Mã | Cỡ |
|---|---|---|---|---|
| 2 | Nền tảng | Schema DB + migration (users, guardianships, consent_events, progress, audit) | FR-010 | M |
| 2 | Nền tảng | Auth phụ huynh (email+mật khẩu argon2id), phiên, đăng xuất | FR-010 | M |
| 2 | Nền tảng | RBAC + kiểm tra quan hệ guardian→child (test IDOR) | NFR | M |
| 2 | Nền tảng | 2FA bắt buộc cho Admin, audit log append-only | 2.2 | M |
| 2 | Nền tảng | i18n vi/en, security headers (CSP, Permissions-Policy) | 5.1, ADD-10 | S |
| 3 | Dual Consent | Tạo hồ sơ con (tháng/năm sinh), máy trạng thái lưu DB | FR-010 | M |
| 3 | Dual Consent | OTP email + SMS (mock provider ở dev), rate-limit | FR-010 | L |
| 3 | Dual Consent | UI trẻ "Con đồng ý" bằng hình ảnh (từ 7 tuổi), UI phụ huynh đọc điều khoản | FR-010 | M |
| 3 | Dual Consent | Privacy by Default, tự hết hạn sau 7 ngày | 6.2 | S |
| 4 | Lesson Engine | Renderer cho story, choice, drag_drop, short_text, discussion, unplugged | FR-001 | L |
| 4 | Lesson Engine | TTS đọc to (Web Speech API), Mascot | ADD-10 | M |
| 4 | Lesson Engine | Nạp bài từ `content/` + API content | FR-001 | M |
| 4 | Kiểm thử | User testing vòng 1 (3–5 trẻ mỗi cấp) | ADD-11 | M |
| 5 | Gamification | XP theo quá trình, huy hiệu theo outcome, không streak L1 | ADD-05 | M |
| 5 | CMS | CMS tối thiểu cho Admin (duyệt 2 bước, phiên bản) | 2.2 | L |
| 5 | Nội dung | 4–6 bài Level 1 (có bài RESP unplugged) | ADD-01, ADD-09 | L |
| 6 | Data Studio | Webcam capture, gán nhãn, đèn báo, hủy buffer | FR-004 | L |
| 6 | Data Studio | Test E2E: không có request chứa ảnh thô | T1 | M |
| 7 | ML Trainer | Huấn luyện + biểu đồ Accuracy/Loss, việt hóa, ≤15s | FR-005 | L |
| 7 | ML Trainer | "Vì sao mô hình sai?" – xem mẫu sai, thêm dữ liệu | ADD-05, LRN.2.3 | M |
| 8 | Block coding | Scratch Blocks + khối ML, sân chơi nhân vật | FR-006 | L |
| 8 | Dự án | PRJ-01 hoàn chỉnh | PRJ-01 | M |
| 9 | Dự án | PRJ-02 Oẳn tù tì AI | PRJ-02 | L |
| 9 | Đánh giá | Micro-quiz + gợi ý bài bổ trợ cơ bản | FR-003 | M |
| 9 | Nội dung | "Tìm lỗi của AI" ≥6 bài; bài nhận biết nội dung AI tạo | ADD-02, ADD-08 | L |
| 10 | Phụ huynh | Dashboard, nhiều hồ sơ con, chuyển hồ sơ (biểu tượng+PIN) | FR-008, ADD-07 | L |
| 10 | Phụ huynh | Giới hạn thời gian, báo cáo outcome/tuần, thu hồi đồng ý | FR-008 | M |
| 10 | Phụ huynh | Hướng dẫn "nói chuyện với con về AI", Học cùng con | ADD-07 | M |
| 11 | Compliance | Erasure ≤72h (crypto-shredding), chứng từ xóa | FR-011 | L |
| 11 | Onboarding | Luồng phụ huynh→con, pre-test, email tóm tắt tuần | ADD-04, ADD-07 | M |
| 12 | Hiệu năng | Offline cache bài lý thuyết, tải trang ≤2s | 6.1 | M |
| 12 | Bảo mật | Mã hóa at-rest/in-transit, pen-test cơ bản, `pnpm audit` | 6.2 | M |
| 12 | Hiệu năng | Load test 5k CCU | 6.1 | M |
| 13 | Pilot | 10–20 gia đình, pre/post, khảo sát hiểu sai, báo cáo | ADD-11 | L |
| 13 | Compliance | Báo cáo tuân thủ NĐ13, DPIA v2 | 6.2 | M |

## Definition of Done (mọi story)
- Có test tự động (unit/integration, E2E khi chạm luồng chính); `pnpm typecheck && pnpm test` xanh.
- Không phát sinh dữ liệu cá nhân mới mà chưa ghi trong DPIA; log không chứa PII.
- Nội dung/giao diện cho trẻ: đúng cỡ chữ, vùng chạm, tương phản, có đọc to (L1–L2).
- Bài học mới gắn outcome hợp lệ và có `parentGuide` (schema ép).
- Cập nhật tài liệu liên quan (`DESIGN.md`, ADR nếu có quyết định mới).
