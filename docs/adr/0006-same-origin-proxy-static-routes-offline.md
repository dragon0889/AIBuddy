# ADR-0006: Proxy cùng origin, route tĩnh theo query, offline qua Service Worker

- Trạng thái: Chấp nhận (khi triển khai ứng dụng web)
- Quyết định:
  1. Web gọi API qua **route handler `/api/*` của Next.js** (đọc `API_URL` lúc chạy) → cookie phiên HttpOnly là first-party, CSP `connect-src 'self'`. (Thử `rewrites` trước nhưng đích bị đóng cứng lúc build; và `localhost` phân giải IPv6 gây lỗi 500 → dùng `127.0.0.1`.)
  2. Trang theo tham số dùng **query string** (`/play/lesson?id=…`) thay vì segment động `[id]`, để trang được dựng sẵn (tĩnh) → Service Worker lưu được HTML/RSC và điều hướng phía client hoạt động khi mất mạng.
  3. **Service Worker** chỉ cache: tài nguyên tĩnh, mô hình/WASM, media Blockly, HTML các trang `/play/*`, và **nội dung từng bài học** (`GET /api/v1/child/lessons/:id`, không chứa dữ liệu cá nhân). **Không** cache API khác. Xóa cache bài khi thoát hồ sơ.
  4. Mất mạng: trẻ vẫn học bài đã tải trước; câu trả lời được chấm tại máy để phản hồi tức thì và **xếp hàng** (localStorage, theo hồ sơ) để gửi lại; máy chủ chấm lại và tính điểm khi có mạng (không tin chấm phía máy).
- Hệ quả/đánh đổi: điểm/huy hiệu chỉ cập nhật sau khi đồng bộ; hàng đợi chứa mã bước/đáp án (không nhạy cảm) và bị giữ lại khi thoát hồ sơ; cache lỗi thời của bài đã được CMS sửa có thể hiện tối đa tới lần tải kế tiếp (stale-while-revalidate).
