# Thông báo quyền riêng tư (BẢN NHÁP – cần luật sư/DPO rà soát trước khi sử dụng)

> Văn bản này do kỹ thuật viên soạn để khớp với hành vi thực tế của phần mềm. **Không phải tư vấn pháp lý.** Phiên bản điều khoản trong phần mềm: `2026-10` (`config.termsVersion`); khi sửa nội dung có ý nghĩa pháp lý phải tăng phiên bản để thu thập lại đồng ý.

## 1. Chúng tôi là ai
[Tên pháp nhân, địa chỉ, đầu mối bảo vệ dữ liệu, email liên hệ – CHƯA CÓ]

## 2. Chúng tôi thu thập gì
| Dữ liệu | Về ai | Mục đích | Lưu ở đâu |
|---|---|---|---|
| Email (và số điện thoại nếu bạn cung cấp) | Phụ huynh | Xác minh, gửi mã OTP, liên lạc | Máy chủ, mã hóa theo trường |
| Biệt danh, tháng/năm sinh, hình đại diện, PIN (băm) | Trẻ | Tạo hồ sơ, xác định cấp độ nội dung | Máy chủ, mã hóa theo trường |
| Tiến độ học, điểm, huy hiệu, kết quả bài đánh giá, thời gian dùng | Trẻ | Học, báo cáo cho phụ huynh, cải tiến | Máy chủ |
| Bằng chứng đồng ý (thời điểm, loại, phiên bản điều khoản; không kèm danh tính) | Phụ huynh/Trẻ | Chứng minh tuân thủ | Máy chủ (giữ sau khi xóa, không có thông tin nhận dạng trực tiếp) |
| **Ảnh/âm thanh khi huấn luyện mô hình** | Trẻ | Dạy máy nhận diện | **Chỉ trên thiết bị**, không gửi lên mạng; xóa sau khi huấn luyện |
| Mô hình đã huấn luyện (các con số) | Trẻ | Chơi với khối lệnh | **Chỉ trên thiết bị** (IndexedDB), xóa khi thoát hồ sơ |
| Góp ý của phụ huynh (điểm 1–5, ý kiến) | Phụ huynh | Cải tiến | Máy chủ |

Chúng tôi **không** thu thập vị trí, không có quảng cáo, không có công cụ theo dõi của bên thứ ba, không cho trẻ nhắn tin riêng hay công khai hồ sơ.

## 3. Cơ sở và đồng ý
Chúng tôi xử lý dữ liệu của trẻ khi cha mẹ/người giám hộ đồng ý (xác minh bằng mã OTP gửi tới email/SMS), và – với trẻ từ đủ 7 tuổi – khi trẻ cũng đồng ý bằng ngôn ngữ phù hợp lứa tuổi. [Cơ sở pháp lý chi tiết theo NĐ 13/2023/NĐ-CP, Luật Bảo vệ dữ liệu cá nhân và Luật Trẻ em – pháp lý bổ sung.]
*Lưu ý kỹ thuật cần công khai:* phần mềm không thể chứng minh ai bấm nút "Con đồng ý" trên thiết bị của phụ huynh.

## 4. Quyền của bạn và của con
Xem, chỉnh sửa, giới hạn thời gian dùng, bật/tắt camera, **rút đồng ý và yêu cầu xóa** ngay trong ứng dụng (mục Cài đặt hoặc "Xóa toàn bộ tài khoản"). Dữ liệu được xóa trong tối đa **72 giờ** (thực tế: ngay khi xử lý yêu cầu), bằng cách xóa bản ghi và hủy khóa mã hóa riêng của trẻ.

## 5. Chia sẻ dữ liệu
Với nhà cung cấp gửi email/SMS (chỉ nhận email/số điện thoại và mã OTP), nhà cung cấp lưu trữ/hạ tầng (dữ liệu đã mã hóa theo trường). [Danh sách nhà cung cấp, quốc gia đặt máy chủ – CHƯA CÓ.]

## 6. Thời hạn lưu
Dữ liệu tài khoản: đến khi bạn xóa. Hồ sơ chờ đồng ý quá 7 ngày: tự xóa. Nhật ký kiểm toán và bằng chứng đồng ý: [thời hạn – pháp lý xác định; đề xuất ≥12 tháng].

## 7. Với trẻ (đã có trong ứng dụng)
"Bud sẽ lưu tên biệt danh và những bài con đã học. Ảnh con chụp chỉ ở trên máy này. Con đồng ý chơi cùng Bud chứ?"
