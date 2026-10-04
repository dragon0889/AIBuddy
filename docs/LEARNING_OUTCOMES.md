# Learning Outcomes & Assessment – v0.1 (bản nháp, cần chuyên gia sư phạm duyệt)

Mục đích: định nghĩa *học sinh làm được gì* sau mỗi cấp, và cách đo. Thiết kế ngược: **Outcome → Bằng chứng → Hoạt động**. Mã outcome dùng trong `content/` và bảng `outcomes`.

## 1. Sáu trụ cột
Năm Big Ideas AI4K12 (PER Perception, REP Representation & Reasoning, LRN Learning, INT Natural Interaction, SOC Societal Impact) + **RESP – AI sử dụng có trách nhiệm** (ADD-01) gồm 4 kỹ năng: **Hỏi tốt, Kiểm chứng, Dùng có đạo đức, Biết giới hạn**.

## 2. Outcome mẫu (theo Bloom; bản đầy đủ do chuyên gia hoàn thiện)

| Mã | Cấp | Học sinh có thể… | Mức Bloom | Bằng chứng |
|---|---|---|---|---|
| PER.1.1 | L1 | Nêu máy tính "nhìn" bằng camera và "nghe" bằng micro | Nhớ/Hiểu | Quiz hình ảnh |
| LRN.2.1 | L2 | Phân biệt "viết luật" với "học từ ví dụ" | Hiểu | Phân loại tình huống |
| LRN.2.3 | L2 | Giải thích vì sao thêm dữ liệu đa dạng làm model tốt hơn | Phân tích | Nhật ký "Vì sao model sai?" |
| LRN.3.2 | L3 | Đánh giá model bằng tập kiểm thử, đọc ma trận nhầm lẫn đơn giản | Đánh giá | Dự án PRJ-05 + rubric |
| SOC.2.2 | L2 | Nhận ra dữ liệu lệch có thể làm AI đối xử không công bằng | Phân tích | Tìm thiên vị trong bộ ảnh |
| RESP.1.1 | L1 | Biết AI là do người làm ra và có thể sai; biết hỏi người lớn | Hiểu | Hoạt động unplugged + quan sát |
| RESP.2.1 | L2 | Kiểm tra một câu trả lời AI bằng cách đối chiếu ít nhất một nguồn khác | Áp dụng | Hoạt động *Tìm lỗi của AI* |
| RESP.2.2 | L2 | Viết lại câu hỏi (prompt) rõ hơn để nhận câu trả lời tốt hơn | Áp dụng/Sáng tạo | Sandbox (Pha 2) / bài mô phỏng |
| RESP.2.3 | L2 | Không chia sẻ thông tin cá nhân với chatbot; nêu lý do | Hiểu/Áp dụng | Tình huống chọn-giải thích |
| RESP.3.1 | L3 | Phân biệt dùng AI để *học* với dùng AI để *làm hộ*; nêu quy tắc cho bản thân | Đánh giá | Bài luận ngắn + thảo luận |
| RESP.3.2 | L3 | Nhận biết dấu hiệu nội dung do AI tạo/deepfake và biết cách báo cáo | Phân tích | PRJ-06 / tình huống |

## 3. Đánh giá

- **Micro-quiz** cuối chủ đề (FR-003): 3–5 câu, phản hồi tức thì, không gây áp lực điểm.
- **Pre/Post test** theo cấp (ADD-11): cùng cấu trúc, 10–15 câu, đo tiến bộ theo trụ cột.
- **Khảo sát hiểu sai (misconception):** các phát biểu như "AI biết mọi thứ", "AI luôn đúng", "AI có cảm xúc", "AI tự nghĩ ra mọi thứ". Đo tỷ lệ tin sai trước/sau.
- **Rubric dự án** (4 mức × 4 tiêu chí): *Hiểu khái niệm; Thu thập & chất lượng dữ liệu; Đánh giá & cải thiện model; Cân nhắc đạo đức/an toàn*. Giáo viên chấm theo rubric (FR-009).
- **Quan sát của giáo viên:** biểu mẫu ngắn cho L1 (kỹ năng khó đo bằng máy).

## 4. Chỉ số thành công của pilot (đề xuất, cần xác nhận)

| Chỉ số | Mục tiêu tham khảo |
|---|---|
| Tăng điểm post so với pre | ≥ 20% |
| Giảm tỷ lệ tin quan niệm sai chính | ≥ 30% |
| Tỷ lệ hoàn thành bài đã giao | ≥ 70% |
| Giáo viên đánh giá "dễ dùng" | ≥ 4/5 |
| Sự cố an toàn/riêng tư | 0 |

## 5. Quy trình biên soạn nội dung
1. Chuyên gia sư phạm viết outcome và rubric → 2. Biên tập bài học (JSON) gắn outcome → 3. Duyệt nội dung & an toàn → 4. User testing với trẻ đúng độ tuổi → 5. Hiệu chỉnh → 6. Phát hành có phiên bản.

---
## Cập nhật: dữ liệu đã đưa vào hệ thống
- Danh mục outcome: `content/outcomes/outcomes.json` (28 outcome, **bản nháp**), rubric: `content/rubrics/project-rubric.json`.
- Bài đánh giá: `content/assessments/` – `pre-l1/post-l1`, `pre-l2/post-l2` (hai bản song song, **chưa kiểm định độ tin cậy/độ khó**), `micro-l2-resp`, `misconception-l2` (6 quan niệm sai). Trẻ cấp 3 dùng bộ cấp 2 (chưa có bộ riêng).
- 25 bài học: `content/lessons/` (cấp 1: 8, cấp 2: 15, cấp 3: 2). Nội dung do kỹ thuật viên soạn bằng tiếng Việt, **cần chuyên gia sư phạm và người bản ngữ duyệt** (kiểm tra sự kiện ở các bài "Tìm lỗi": lịch sử, địa lí, khoa học, toán, động vật).
- Tiêu chí chấp nhận nội dung có test tự động (ADD-01 ≥1/3 bài RESP mỗi cấp, ADD-02 ≥6 bài "Tìm lỗi" cấp 2, camera cấp 1 phải gắn cờ).

