# Báo cáo Sprint 1 – Spike kỹ thuật (TF.js + Scratch Blocks)

Ngày chạy: 2026-10-03. Mã: `packages/ml-core`, `apps/web/app/spike/{ml,blocks}`, `scripts/bench-ml.mjs`, `scripts/e2e-blocks.mjs`. Số liệu thô: [`bench-results.json`](bench-results.json). Ảnh: [`blocks-spike.png`](blocks-spike.png).

## 0. Giới hạn của phép đo (đọc trước)
- Đo trong **Chromium headless trên máy cloud**, không có GPU thật (WebGL chạy bằng SwiftShader – phần mềm) và không có webcam thật (ảnh tổng hợp vẽ trên canvas).
- "Thiết bị yếu" được **mô phỏng** bằng `Emulation.setCPUThrottlingRate` ×4. Đây là xấp xỉ thô, không thay thế đo trên máy thật (Chromebook, tablet Android tầm thấp, iPad cũ).
- Dữ liệu tổng hợp rất dễ phân loại → độ chính xác 100% **không** nói lên chất lượng với ảnh thật của trẻ. Chỉ số thời gian và rò rỉ bộ nhớ là kết quả có ý nghĩa; độ chính xác thì chưa.
- Kết luận về **ngân sách ≤15s** vì vậy là *tạm thời* cho tới khi đo trên thiết bị thật (việc còn lại ở mục 5).

## 1. Kết quả benchmark ML (90 khung = 3 lớp × 30; 20 lần học)

Quy trình: ảnh → MobileNet v1 α=0.25 (2 MB, tự host) → vector 256 chiều → đầu phân loại 2 lớp dense (Adam).

| Backend | CPU | Trích đặc trưng 90 khung | Huấn luyện đầu phân loại | **Tổng chờ** | Tensor rò rỉ |
|---|---|---|---|---|---|
| cpu | ×1 | 15,25 s | 0,56 s | **15,8 s** | 0 |
| cpu | ×4 | 67,4 s | 2,59 s | **70,0 s** | 0 |
| **wasm** | ×1 | 1,87 s | 0,29 s | **2,2 s** | 0 |
| **wasm** | ×4 | 8,53 s | 1,21 s | **9,7 s** | 0 |
| webgl (SwiftShader) | ×1 | 6,71 s | 3,30 s | 10,0 s | 0 |
| webgl (SwiftShader) | ×4 | 11,17 s | 4,43 s | 15,6 s | 0 |

Phát hiện:
1. **Chi phí chính là trích đặc trưng (embedding), không phải huấn luyện.** Đầu phân loại huấn luyện dưới 1,3 s với WASM ngay cả khi CPU chậm ×4.
2. **WASM (SIMD) là mặc định tốt nhất** trong môi trường này; **CPU thuần không đạt** ngân sách (70 s ở ×4). WebGL ở đây là phần mềm nên không phản ánh GPU thật – cần đo lại trên GPU thực.
3. Mọi lần chạy: **0 yêu cầu tới bên ngoài**, **0 yêu cầu không phải GET**, tensor về đúng mức nền sau khi giải phóng (SRS 7.2 bước 4).
4. Thiết kế rút ra: **trích embedding ngay lúc chụp mẫu** (rải đều trong lúc học sinh chụp), để thời gian chờ sau khi bấm "Học" chỉ còn huấn luyện đầu phân loại (≈0,3–1,3 s ở WASM). Như vậy ngân sách 15 s đạt với biên rộng, kể cả thiết bị chậm hơn nhiều.

## 2. Lỗi thật mà spike bắt được
| Lỗi | Biểu hiện | Xử lý |
|---|---|---|
| Rò rỉ tensor: `tf.oneHot(tf.tensor1d(...))` để lại tensor trung gian | Test rò rỉ báo thừa 1 tensor | Bọc `tf.tidy` (đã sửa + test) |
| `model.dispose()` không giải phóng trạng thái optimizer (Adam) | Biến optimizer còn tồn tại | Hàm `disposeModel()` giải phóng cả optimizer |
| `trunk.dispose()` rồi `base.dispose()` → lỗi "Layer already disposed" | Crash khi dọn | Chỉ giải phóng một lần (layer dùng chung) |
| `tf.setBackend("wasm")` **trả `false` thay vì ném lỗi** khi không khởi tạo được, và TF.js im lặng dùng WebGL | Kết quả "wasm" thực ra là webgl (đo sai) | Kiểm tra giá trị trả về + `getBackend()`, ném lỗi nếu khác yêu cầu |
| Sao chép tài sản WASM đặt sai thư mục (dùng `process.cwd()`) | wasm không tải được | Dùng đường dẫn tính từ vị trí script |

## 3. Quyền riêng tư (ADR-0002) – kiểm chứng
- Mô hình MobileNet và nhị phân WASM **tự host** (`/models`, `/tfjs-wasm`).
- **Phát hiện:** Blockly mặc định tải `sprites.png` từ `blockly-demo.appspot.com` (bên thứ ba). CSP `img-src 'self'` đã chặn và làm lộ vấn đề. Khắc phục: đặt `media: "/blockly-media/"` và tự host media. E2E hiện khẳng định **không có request tới bên ngoài** trên trang khối lệnh.
- Trang spike đặt CSP `connect-src 'self'` và `Permissions-Policy: camera=(self), microphone=(self)`.
- Còn lại: kiểm tra với webcam thật và luồng chụp/gán nhãn thật (Sprint 6); chưa có test chặn `sendBeacon`/WebSocket ở mức trang (Playwright đã ghi mọi request mức trình duyệt nên đã gián tiếp bao phủ).

## 4. Kết quả spike khối lệnh (Scratch Blocks)
- **Chạy được:** `scratch-blocks@2.1.26` (Apache-2.0, dựa trên Blockly 12) render tốt trong Next.js, **giao diện tiếng Việt** (`ScratchMsgs.setLocale("vi")`), thanh công cụ theo danh mục, thả khối, khối ML tùy chỉnh (`ml_whenclassified`, `ml_isclass`, `ml_confidence`) dùng chung extension màu/hình dạng của Scratch. Nạp chương trình từ JSON và chạy trình thông dịch tối thiểu: nhãn khớp mới chạy chồng khối (E2E xanh).
- **Những điều phải tự làm (không có sẵn):**
  1. Theme màu: scratch-blocks 2.x **không kèm theme**; host phải cung cấp `blockStyles` (nếu không: lỗi "Invalid colour"). Không dùng `base: Classic` (dùng chỉ số màu "20", "260" gây lỗi).
  2. Bắt buộc gọi `ScratchMsgs.setLocale(...)`, nếu không `jsonInit` lỗi "args0 must have a corresponding message".
  3. Tự host `media` (xem mục 3).
  4. Tự viết trình thông dịch khối (hoặc dùng `scratch-vm`).
- **Giấy phép – rủi ro cần quyết định:** `scratch-blocks` là Apache-2.0, nhưng `scratch-vm` và `scratch-gui` (theo hiểu biết của tôi, **chưa xác minh trong repo gốc**) dùng **AGPL-3.0**, buộc công khai mã nguồn của sản phẩm nếu dùng. Đề xuất: **không dùng scratch-vm/gui**, tự viết trình thông dịch nhỏ cho tập khối giới hạn (đủ cho sân chơi trẻ em). Cần xác minh giấy phép từng gói trước khi chốt.
- **Trợ năng (cần sửa ở Sprint 8):** chữ trắng trên màu khối Scratch **không đạt WCAG AA**: Event 1,65:1; Control 1,89:1; Operators 2,31:1; Sensing 2,41:1; Motion 2,93:1 (yêu cầu ≥4,5:1). Cần bảng màu khối riêng tối hơn hoặc chữ tối; áp dụng cả cho `packages/ui`.
- **Chưa kiểm:** kéo-thả bằng cảm ứng trên tablet, cỡ khối cho L2 (vùng chạm ≥48 px), hiệu năng workspace lớn, lưu/nạp chương trình học sinh, bàn phím/đọc màn hình.

## 5. Quyết định đề xuất và việc còn lại

| # | Quyết định | Trạng thái |
|---|---|---|
| D1 | Mặc định backend **WASM (SIMD)**; tự đo nhanh lúc đầu và chỉ dùng WebGL nếu có GPU thật nhanh hơn; CPU thuần chỉ là phương án cuối kèm cảnh báo | Đề xuất (chờ đo thiết bị thật) |
| D2 | **Trích embedding lúc chụp**, huấn luyện đầu phân loại khi bấm "Học" | Đề xuất |
| D3 | Mô hình nền MobileNet v1 α=0.25 (2 MB) – nhẹ; cân nhắc α lớn hơn nếu độ chính xác với ảnh thật chưa đủ | Chờ dữ liệu ảnh thật |
| D4 | Tự host mọi tài sản (model, wasm, blockly media); CSP `connect-src 'self'` trên trang ML/khối lệnh | Đã làm trong spike |
| D5 | Khối lệnh: dùng scratch-blocks + trình thông dịch tự viết, **không** dùng scratch-vm/gui | Chờ xác minh giấy phép |
| D6 | Bảng màu khối đạt WCAG AA | Việc Sprint 8 |

**Việc còn lại để đóng Sprint 1 (cần thiết bị/dữ liệu thật):**
- [ ] Đo trên ≥3 thiết bị thật (laptop phổ thông, Chromebook/tablet Android tầm thấp, iPad) và với webcam thật (ảnh thật 3–5 lớp: bàn tay, đồ vật). Ghi độ chính xác với ảnh thật.
- [ ] Thử WASM threaded (cần cross-origin isolation – COOP/COEP) có đáng không; hiện chưa dùng.
- [ ] Đo kích thước tải ban đầu và thời gian khởi động trên mạng 3G/4G giả lập; cache bằng Service Worker.
- [ ] Xác minh giấy phép scratch-blocks/scratch-vm/scratch-gui và mô hình MobileNet từ nguồn gốc.
- [ ] Thử mic + spectrogram (Pha 2).

## 6. Cách chạy lại
```bash
pnpm install && cd apps/web && pnpm build && cd ../..
node scripts/bench-ml.mjs                    # ghi docs/spikes/bench-results.json
node scripts/e2e-blocks.mjs                  # kiểm tra khối lệnh + không request bên ngoài
pnpm test                                    # gồm test ml-core (rò rỉ tensor, độ chính xác trên dữ liệu tổng hợp)
```
