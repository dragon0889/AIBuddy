# ADR-0003: MVP không gọi LLM trực tiếp

- Trạng thái: Chấp nhận (Sprint 0)
- Quyết định: MVP dùng câu trả lời AI soạn sẵn (hoạt động "Tìm lỗi của AI") và classifier chạy tại client. Sandbox chatbot qua Safety Proxy ở Pha 2 (ADD-03) sau khi có DPIA riêng, red-team ≥200 prompt, và quyết định nhà cung cấp.
- Lý do: giảm rủi ro an toàn nội dung và dữ liệu trẻ em khi chưa có đội kiểm duyệt.
