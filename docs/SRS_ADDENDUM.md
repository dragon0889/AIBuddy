# Phụ lục SRS – Bổ sung ADD-01…ADD-11 (v1.0, đã chấp thuận)

Phụ lục này sửa/bổ sung `Thiết kế SRS App AI.docx` (SRS gốc giữ nguyên). Khi xung đột, **phụ lục này được ưu tiên**. Bối cảnh: triển khai đầu tiên **tại nhà**, phụ huynh là chủ tài khoản. Mã yêu cầu tiếp nối SRS gốc (FR-0xx) bằng tiền tố `ADD-`.

## 0. Thay đổi phạm vi so với SRS gốc

| SRS gốc | Thay đổi |
|---|---|
| 1.2 Ranh giới | Mục tiêu kép: *hiểu AI* và *dùng AI hiệu quả, an toàn* (AI fluency) |
| 2.2 Người dùng | Phụ huynh là chủ tài khoản và tạo hồ sơ con; Giáo viên chuyển sang Pha 2 |
| FR-002 | Thay bằng ADD-05 |
| FR-009 | Lùi sang Pha 2 |
| 5.3 LLM | Từ MVP không dùng LLM trực tiếp; sandbox chatbot ở Pha 2 (ADD-03) |

## 1. Yêu cầu bổ sung

**ADD-01 – Trụ cột 6: AI sử dụng có trách nhiệm.**
Chương trình bổ sung trụ cột thứ sáu gồm 4 kỹ năng: *Hỏi tốt, Kiểm chứng, Dùng có đạo đức, Biết giới hạn*. Mỗi cấp độ có ít nhất 1/3 số bài thuộc trụ cột này. Level 1 dạng unplugged.
*Tiêu chí chấp nhận:* mỗi bài có ≥1 outcome mã RESP.x.y; có bài đánh giá đo kỹ năng.

**ADD-02 – Hoạt động "Tìm lỗi của AI".**
Học sinh đối chiếu câu trả lời AI soạn sẵn (có lỗi/bịa) với dữ kiện và đánh dấu phần sai.
*Chấp nhận:* ≥6 bài ở Level 2 trong MVP; phản hồi giải thích vì sao sai; không gọi LLM trực tiếp.

**ADD-03 – Sandbox chatbot an toàn (Pha 2).**
Trẻ Level 2–3 trò chuyện với LLM qua Safety Moderation Proxy trong bài có hướng dẫn. Bắt buộc: lọc đầu vào (PII, prompt injection, chủ đề cấm), lọc đầu ra, giới hạn lượt/độ dài/chủ đề, nhật ký đã loại PII cho phụ huynh, không lưu dài hạn, DPIA riêng, phụ huynh bật/tắt.
*Chấp nhận:* kiểm thử đối kháng (red team) với bộ ≥200 prompt không phù hợp; 0 vi phạm nghiêm trọng trước khi mở.

**ADD-04 – Learning Outcomes & Assessment.**
Mọi bài học khai báo outcome (Bloom). Hệ thống có micro-quiz, pre/post test, khảo sát hiểu sai (misconception), rubric dự án. Chi tiết: `LEARNING_OUTCOMES.md`.
*Chấp nhận:* 100% bài có outcome; dữ liệu pre/post xuất được theo hồ sơ trẻ ở dạng ẩn danh cho phân tích.

**ADD-05 – Gamification thiết kế lại (thay FR-002).**
XP thưởng *quá trình* (tìm lỗi AI, đặt câu hỏi, cải thiện model sau khi phân tích sai, hoàn thành bài). Không streak ở Level 1; từ Level 2 streak tùy chọn có "ngày nghỉ". Không xếp hạng công khai giữa trẻ, không đếm ngược gây áp lực, không dark pattern. Giới hạn thời gian mặc định do phụ huynh đặt.
*Chấp nhận:* đánh giá thiết kế theo checklist không-dark-pattern; không có thông báo đẩy ép buộc.

**ADD-06 – Hỗ trợ giáo viên (Pha 2).**
Cổng giáo viên (FR-009), giáo án theo chương trình GDPT 2018/môn Tin học, hoạt động offline, gợi ý học sinh tụt lại. MVP chỉ đảm bảo cấu trúc nội dung dùng lại được.

**ADD-07 – Đồng hành của phụ huynh (MVP, trọng tâm).**
Phụ huynh tạo nhiều hồ sơ con; xem báo cáo outcome theo tuần; đặt giới hạn thời gian; nhận hướng dẫn "nói chuyện với con về AI"; hoạt động *Học cùng con* với câu hỏi gợi mở sau mỗi bài; hướng dẫn xử lý khi con dùng AI ngoài ứng dụng.
*Chấp nhận:* mỗi bài có ≥1 gợi ý hoạt động cho phụ huynh; phụ huynh hoàn thành onboarding dưới 5 phút (đo trong pilot).

**ADD-08 – An toàn nội dung số sớm.**
Từ Level 2: nhận biết nội dung AI tạo, deepfake, ảnh ghép, cách báo cáo và nhờ người lớn. PRJ-06 giữ ở Level 3, phân tích hoàn toàn tại client và chỉ dùng ảnh mẫu được cấp phép.

**ADD-09 – Level 1 tối giản công nghệ.**
Lớp 1–2: ưu tiên unplugged và chạm/kéo thả; webcam/mic chỉ bật khi phụ huynh cho phép và có người lớn bên cạnh (xác nhận trong phiên).

**ADD-10 – Khả năng tiếp cận & công bằng.**
Đọc to văn bản, phụ đề, font dễ đọc cho dyslexia, giảm chuyển động, hoạt động trên thiết bị yếu/mạng chậm; thiết bị dùng chung trong gia đình: chuyển hồ sơ bằng biểu tượng + PIN do phụ huynh đặt, khóa hồ sơ khi hết giờ.
*Chấp nhận:* WCAG 2.1 AA; huấn luyện ≤15 giây trên thiết bị tham chiếu thấp (xác định ở Sprint 1).

**ADD-11 – Pilot & đo hiệu quả.**
Pilot 10–20 gia đình (trẻ 6–14 tuổi), user testing theo độ tuổi từ Sprint 4, đo pre/post và misconception. Chỉ số tham khảo: điểm post ≥ +20% so với pre; giảm tin quan niệm sai chính ≥30%; hoàn thành bài ≥70%; phụ huynh đánh giá "dễ dùng" ≥4/5; 0 sự cố an toàn/riêng tư.

## 2. Ánh xạ sang yêu cầu gốc

| Phụ lục | Ảnh hưởng đến | Tài liệu liên quan |
|---|---|---|
| ADD-01/02/04 | Mục 3 (Khung chương trình), FR-001, FR-003 | `LEARNING_OUTCOMES.md` |
| ADD-05 | FR-002 (thay thế) | `DESIGN.md` §3.4 |
| ADD-07/10 | FR-008, mục 5.1 | `DESIGN.md` §3.5, §6 |
| ADD-03/08 | Mục 5.3, PRJ-04, PRJ-06 | `DESIGN.md` §3.7 |
| ADD-06 | FR-009 | `PLAN.md` §5 |
| ADD-11 | Mục 8 (Kết luận/triển khai) | `PLAN.md` Sprint 13 |
