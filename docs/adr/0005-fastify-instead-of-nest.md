# ADR-0005: Fastify + SQL thay cho NestJS (sửa ADR-0001)

- Trạng thái: Chấp nhận (khi bắt đầu phát triển đầy đủ, sau Sprint 1)
- Bối cảnh: NestJS dựa vào `emitDecoratorMetadata`; `tsx`/esbuild/vitest không phát metadata này nếu thiếu plugin SWC. Skeleton Sprint 0 phải tránh DI constructor để chạy được.
- Quyết định: API dùng **Fastify 5** + module TypeScript thuần ("modular monolith" vẫn giữ: mỗi module một thư mục, phụ thuộc truyền qua đối tượng `AppContext`), validate bằng **zod**, truy cập DB bằng SQL tham số hoá qua giao diện `Db` mỏng.
- DB: **PostgreSQL** ở production (`pg`); **PGlite** (Postgres chạy trong tiến trình, WASM) cho dev/test, nên test chạy trigger/ràng buộc Postgres thật mà không cần Docker.
- Hệ quả: test tích hợp nhanh (`app.inject`), ít phép màu; mất hệ sinh thái Nest (guards/interceptors) – thay bằng hook Fastify và hàm `requireAuth`.
- Mật khẩu dùng `scrypt` của Node (không phụ thuộc native); có thể chuyển argon2id sau nếu cần (ADR riêng).
