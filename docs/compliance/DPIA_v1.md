# DPIA v1 – Đánh giá tác động xử lý dữ liệu cá nhân (bản nháp Sprint 0)

> **Bản nháp kỹ thuật**, không phải tư vấn pháp lý. Cần luật sư/DPO rà soát, đặc biệt: số hiệu và hiệu lực Luật BVDLCN 2025, thủ tục hồ sơ đánh giá tác động theo NĐ 13/2023/NĐ-CP, và nghĩa vụ lưu trữ trong nước.

## 1. Mô tả xử lý
- **Chủ thể:** trẻ 6–14 tuổi (dữ liệu của trẻ em), phụ huynh/người giám hộ.
- **Mục đích:** giáo dục AI; theo dõi tiến độ; báo cáo cho phụ huynh; cải thiện nội dung.
- **Cơ sở pháp lý:** sự đồng ý của phụ huynh, kèm đồng ý của trẻ từ đủ 7 tuổi (NĐ 13/2023 Điều 20; xác minh với pháp lý).

## 2. Kiểm kê dữ liệu

| Nhóm dữ liệu | Ví dụ | Nơi lưu | Thời hạn | Ghi chú |
|---|---|---|---|---|
| Danh tính phụ huynh | email/SĐT (đã xác thực) | Server (mã hóa) | Đến khi xóa tài khoản | Tối thiểu hóa |
| Hồ sơ con | biệt danh, tháng/năm sinh | Server (mã hóa theo khóa riêng) | Đến khi xóa | Không lưu ngày sinh đầy đủ, không lưu họ tên thật bắt buộc |
| Bằng chứng đồng ý | sự kiện, phiên bản điều khoản, thời điểm | Server, append-only | Theo quy định lưu hồ sơ | Không chứa nội dung nhạy cảm |
| Tiến độ & đánh giá | bài hoàn thành, điểm, pre/post | Server | Đến khi xóa | Dùng cho báo cáo phụ huynh; dữ liệu nghiên cứu phải ẩn danh |
| Ảnh/âm thanh thô | khung hình webcam | **Chỉ RAM trình duyệt** | Hủy ngay sau huấn luyện | Không bao giờ gửi lên mạng (ADR-0002) |
| Mô hình huấn luyện (trọng số) | JSON/binary nhỏ | IndexedDB (cục bộ); server **chỉ nếu** Q1=có | Xóa theo yêu cầu | Trọng số có thể gián tiếp mã hóa đặc trưng mặt → đánh giá riêng nếu đồng bộ |
| Nhật ký chat (Pha 2) | hội thoại đã loại PII | Server, ngắn hạn | ≤ 30 ngày (đề xuất) | DPIA riêng bắt buộc |
| Log hệ thống/audit | hành động, mã đối tượng | Server | ≥ 12 tháng (đề xuất) | Không chứa PII thừa |

## 3. Đánh giá rủi ro cho trẻ

| Rủi ro | Khả năng | Tác động | Biện pháp | Rủi ro còn lại |
|---|---|---|---|---|
| Lộ dữ liệu sinh trắc | Thấp | Rất cao | Edge AI, CSP, test mạng | Thấp |
| Thu thập quá mức | TB | Cao | Tối thiểu hóa dữ liệu, đánh giá từng tính năng | Thấp |
| Đồng ý không hợp lệ (trẻ tự đồng ý) | TB | Cao | Phụ huynh xác thực OTP trước; nhật ký đồng ý | Thấp–TB (eKYC ở Pha 2) |
| Hồ sơ hóa/quảng cáo nhắm mục tiêu | Thấp | Cao | Không quảng cáo, không SDK theo dõi | Thấp |
| Thiết kế gây nghiện/áp lực | TB | TB | ADD-05, giới hạn thời gian | Thấp |
| Xóa không triệt để | TB | Cao | Crypto-shredding, SLA 72h | Thấp |
| Chia sẻ dữ liệu với bên thứ ba (email/SMS, hosting) | TB | TB | Hợp đồng xử lý dữ liệu, tối thiểu dữ liệu gửi | Thấp–TB |

## 4. Quyền của chủ thể
Truy cập, chỉnh sửa, rút đồng ý, xóa (≤72h), hạn chế xử lý: do phụ huynh thực hiện qua dashboard (FR-008/FR-011). Trẻ ≥7 tuổi được hiển thị thông tin riêng tư dạng hình ảnh.

## 5. Quyết định còn mở
Q1 (đồng bộ mô hình lên server), Q3 (vị trí lưu trữ), nhà cung cấp Email/SMS, thời hạn lưu từng loại dữ liệu, cách lưu bằng chứng đồng ý; tuyên bố vai trò (bên kiểm soát/xử lý).

## 6. Lịch rà soát
Sau Sprint 3 (Dual Consent), trước pilot (Sprint 13), và trước Pha 2 (chatbot sandbox – DPIA riêng).
