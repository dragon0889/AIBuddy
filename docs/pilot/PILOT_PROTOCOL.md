# Quy trình pilot (ADD-11) – bản nháp

> Pilot là bước bắt buộc trước khi mở rộng. **Chưa được thực hiện** (cần gia đình thật, người điều phối, và rà soát đạo đức/pháp lý). Tài liệu này và công cụ đo trong ứng dụng đã sẵn sàng.

## 1. Mục tiêu và câu hỏi
1. Trẻ 6–14 tuổi có hiểu AI tốt hơn và dùng AI an toàn hơn sau ≥2 tuần không (pre/post, khảo sát hiểu sai)?
2. Phụ huynh có thấy dễ dùng, có thực hiện được hoạt động "Học cùng con" không?
3. Ràng buộc kỹ thuật có đứng vững trên thiết bị thật không (huấn luyện ≤15 s, camera, offline)?
4. Có sự cố an toàn/riêng tư nào không (mục tiêu: 0)?

## 2. Đối tượng và quy mô
10–20 gia đình, trẻ 6–14 tuổi, ưu tiên cấp 1 và cấp 2 (có ít nhất 4 trẻ lớp 1–2 và 4 trẻ lớp 3–5). Đa dạng thiết bị (ít nhất: 1 máy tính cũ, 1 tablet Android tầm thấp, 1 iPad). Tuyển qua mạng lưới cá nhân/trường; **không** tuyển bằng quảng cáo nhắm trẻ em.

## 3. Đạo đức và tuân thủ (làm trước khi bắt đầu)
- Phụ huynh đọc [bản thông tin](../legal/PRIVACY_NOTICE_DRAFT.md) và ký phiếu đồng ý tham gia nghiên cứu (mẫu dưới đây); trẻ ≥7 tuổi được giải thích bằng ngôn ngữ phù hợp và có quyền từ chối bất cứ lúc nào.
- Có người chịu trách nhiệm bảo vệ dữ liệu (DPO/đầu mối) và đường dây báo sự cố.
- Rà soát pháp lý về nghiên cứu có trẻ em và NĐ 13/2023 (xem DPIA_v2); không thu thêm dữ liệu ngoài những gì ứng dụng đã thu.
- Dữ liệu phân tích lấy từ `GET /api/v1/admin/pilot-export` (mã tham gia là băm có muối; không có tên/email).

## 4. Lịch (2–3 tuần/gia đình)
| Ngày | Hoạt động |
|---|---|
| 0 | Buổi hướng dẫn 20 phút cho phụ huynh (tạo tài khoản, đồng ý, PIN, camera, giới hạn thời gian). Trẻ làm **bài đầu vào** (pre) và **khảo sát hiểu sai** trong ứng dụng. |
| 1–14 | Dùng tự do, khuyến nghị 3 buổi/tuần ~15–20 phút. Mỗi tuần: phụ huynh làm 1 hoạt động "Học cùng con". Điều phối viên gọi/nhắn hỏi thăm (không can thiệp nội dung). |
| 14–15 | Trẻ làm **bài cuối** (post) và **khảo sát hiểu sai** lần 2. Phụ huynh điền góp ý trong ứng dụng (mức dễ dùng 1–5 + ý kiến). |
| 15–17 | Phỏng vấn ngắn 15 phút với phụ huynh (nhóm câu hỏi dưới); quan sát 1 buổi dùng Xưởng dạy máy nếu được. |

## 5. Đo lường
| Chỉ số | Cách đo | Ngưỡng tham khảo (cần xác nhận) |
|---|---|---|
| Tăng điểm | trung bình (post − pre)/pre trên các trẻ làm đủ cặp | ≥ +20% (báo cả điểm tuyệt đối) |
| Giảm tin quan niệm sai | tỉ lệ tin quan niệm sai (khảo sát lần đầu vs lần cuối) | giảm ≥ 30% |
| Hoàn thành bài | bài hoàn thành / bài đã bắt đầu | ≥ 70% |
| Dễ dùng (phụ huynh) | trung bình điểm góp ý 1–5 | ≥ 4 |
| Sự cố an toàn/riêng tư | báo cáo + audit log | 0 |
| Kỹ thuật | thời gian huấn luyện, lỗi camera, thiết bị, trình duyệt (ghi tay) | huấn luyện ≤ 15 s |

`computePilotMetrics` (apps/api/src/modules/pilot.ts, có test) tính các chỉ số trên và trả `targets` (đạt/không/chưa có dữ liệu).
**Giới hạn thiết kế:** mẫu nhỏ, không có nhóm đối chứng, pre/post dùng hai bản song song nhưng chưa được kiểm định độ tin cậy/độ khó; học sinh có thể tiến bộ do làm lại. Kết quả chỉ để cải tiến sản phẩm, không dùng để kết luận nhân quả.

## 6. Câu hỏi phỏng vấn phụ huynh (gợi ý)
1. Con kể gì với bạn về những điều đã học? 2. Bạn có làm hoạt động "Học cùng con" không? Điều gì cản trở? 3. Phần nào khó dùng/khó hiểu? 4. Bạn có lo lắng gì về dữ liệu/camera? Giải thích trong ứng dụng đã đủ rõ chưa? 5. Con có dùng AI ngoài ứng dụng khác đi không? Bạn xử lý thế nào? 6. Giới hạn thời gian có phù hợp?

## 7. Quan sát trẻ (điều phối viên, có sự đồng ý)
Quan sát: con đọc/nghe được hướng dẫn không (cỡ chữ, đọc to), có bị mắc ở bước nào (kéo thả, chọn cụm), thái độ khi máy đoán sai ("vì sao máy sai"), có hiểu "ảnh chỉ ở trên máy này" không. Ghi chú ẩn danh theo mã tham gia.

## 8. Phiếu đồng ý tham gia (mẫu – cần pháp lý rà soát)
> Tôi là cha/mẹ/người giám hộ của con tên (biệt danh) ……. Tôi đã đọc bản thông tin về dự án AIBuddy. Tôi hiểu: (1) ứng dụng chỉ lưu biệt danh, tháng/năm sinh, tiến độ học và kết quả bài đánh giá; ảnh và âm thanh con ghi khi huấn luyện mô hình không rời khỏi thiết bị; (2) kết quả có thể được dùng ở dạng tổng hợp, ẩn danh để cải tiến sản phẩm; (3) tôi và con có thể dừng bất cứ lúc nào và yêu cầu xóa dữ liệu trong 72 giờ; (4) việc tham gia không ảnh hưởng đến quyền lợi nào khác. Tôi đồng ý cho con tham gia. Họ tên và chữ ký/ngày: ……

## 9. Quy tắc dừng
Dừng ngay với một gia đình hoặc toàn bộ pilot nếu: có sự cố riêng tư, trẻ bị tác động tiêu cực rõ rệt, hoặc phát hiện lỗi cho phép truy cập dữ liệu của người khác.
