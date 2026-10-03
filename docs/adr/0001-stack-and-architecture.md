# ADR-0001: Stack và kiến trúc cơ sở

- Trạng thái: Chấp nhận (Sprint 0)
- Bối cảnh: đội 2–4 người, MVP ~6 tháng, ràng buộc riêng tư chặt (trẻ em), ML chạy tại trình duyệt.
- Quyết định: TypeScript full-stack; pnpm monorepo; Next.js (PWA) cho web; NestJS modular monolith cho API; PostgreSQL + Redis; nội dung bài học là JSON có schema (zod) nằm trong `content/`.
- Hệ quả: dùng chung kiểu dữ liệu/logic giữa web và API (`packages/shared`); dễ tách service sau; không dùng microservices cho MVP.
- Lựa chọn đã loại: Flutter/React Native native (chưa cần, TF.js và Scratch chạy tốt trên web); Python backend (phân mảnh ngôn ngữ).
