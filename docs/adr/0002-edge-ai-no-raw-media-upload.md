# ADR-0002: Ảnh/âm thanh thô không rời thiết bị

- Trạng thái: Chấp nhận (Sprint 0); xác nhận kỹ thuật ở Sprint 1 (xem `docs/spikes/SPRINT1_REPORT.md`)
- Quyết định: webcam/mic chỉ được xử lý trong trình duyệt (Web Worker/RAM). Server chỉ nhận metadata và tiến độ. Trọng số mô hình chỉ đồng bộ nếu được xác nhận (Q1) và DPIA cho phép.
- Cưỡng chế bằng kỹ thuật: (1) CSP `connect-src` giới hạn origin; (2) test E2E kiểm tra không có request chứa dữ liệu ảnh/âm thanh; (3) mô hình nền (MobileNet) tự host trong `/public/models`, không gọi CDN bên thứ ba lúc chạy (tránh rò rỉ IP/hành vi trẻ).
- Hệ quả: huấn luyện phải đủ nhanh trên thiết bị yếu → dùng transfer learning (embedding cố định + đầu phân loại nhỏ).
