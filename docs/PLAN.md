# Kế hoạch phát triển – Nền tảng Giáo dục AI cho học sinh Tiểu học & THCS

> Nguồn: `Thiết kế SRS App AI.docx` (IEEE 830 / ISO 29148). Tài liệu này phân tích SRS và đề xuất kế hoạch triển khai.
> Trạng thái: **v0.4 – Sprint 0 xong, Sprint 1 xong một phần** (xem `docs/spikes/SPRINT1_REPORT.md`) – trước đó v0.3 – triển khai **tại nhà (phụ huynh là kênh chính)**; đã bổ sung các khoảng trống sư phạm (mục 3A); nguồn giáo trình: [`CURRICULUM_SOURCES.md`](CURRICULUM_SOURCES.md); phụ lục SRS: [`SRS_ADDENDUM.md`](SRS_ADDENDUM.md). Thiết kế cơ bản: [`DESIGN.md`](DESIGN.md); mục tiêu học tập & đánh giá: [`LEARNING_OUTCOMES.md`](LEARNING_OUTCOMES.md).
> Cần xác nhận các mục ở phần 8 trước khi bắt đầu Sprint 0.

## 1. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Phạm vi | **MVP trước**, mở rộng theo pha |
| Stack | TypeScript full-stack: Next.js (React, PWA) + NestJS + PostgreSQL + Redis |
| Đội ngũ / thời gian | 2–4 người, ~6 tháng cho MVP (sprint 2 tuần, ~13 sprint) |
| Ngôn ngữ giao diện | Tiếng Việt mặc định, Tiếng Anh (i18n từ đầu) |
| Mobile | PWA trước (có thể đóng gói Capacitor sau MVP) |

## 2. Tóm tắt SRS

**Sản phẩm:** nền tảng EdTech (web + tablet) dạy AI cho học sinh lớp 1–9, kết hợp bài học game hóa, No-Code ML Studio (webcam/mic/văn bản), lập trình khối Scratch, Python sandbox; theo khung AI4K12 (5 Big Ideas) và tuân thủ NĐ 13/2023/NĐ-CP.

**Người dùng:** Học sinh, Phụ huynh, Giáo viên, Quản trị viên (2FA bắt buộc, audit log).

**3 cấp độ:** L1 Explorer (lớp 1–2, unplugged), L2 Creator (lớp 3–5, no-code ML + block), L3 Innovator (lớp 6–9, Python/NLP/đạo đức AI).

**11 yêu cầu chức năng:** FR-001 bài học kể chuyện, FR-002 XP/huy hiệu/streak, FR-003 micro-quiz & lộ trình thích ứng, FR-004 thu thập dữ liệu đa phương thức, FR-005 trình huấn luyện trực quan, FR-006 lập trình khối + ML extension, FR-007 Python sandbox, FR-008 dashboard phụ huynh, FR-009 cổng giáo viên, FR-010 Dual Consent, FR-011 xóa dữ liệu ≤72h.

**6 dự án thực hành:** PRJ-01…06 (cử chỉ, oẳn tù tì, phân loại rác, chatbot lớp học, spam, deepfake).

**Ràng buộc then chốt (quyết định kiến trúc):**
1. Ảnh/âm thanh thô **không bao giờ rời trình duyệt**; trích xuất đặc trưng và huấn luyện bằng TensorFlow.js/WASM; giải phóng RAM sau huấn luyện.
2. Huấn luyện ≤ 15s; tải trang ≤ 2s; 50.000 CCU; offline cache cho bài lý thuyết.
3. AES-256 at rest, TLS 1.3, Privacy by Default cho <16 tuổi.
4. LLM chỉ qua API Gateway + Safety Moderation Proxy; LTI 1.3 cho LMS.

## 3. Phân tích rủi ro & điểm mâu thuẫn/thiếu trong SRS

| # | Vấn đề | Đề xuất xử lý |
|---|---|---|
| R1 | **FR-011 xóa ≤72h vs sao lưu 6h/lần (6.3)** – bản sao lưu chứa dữ liệu cần xóa | Crypto-shredding: mã hóa dữ liệu mỗi người dùng bằng khóa riêng, xóa khóa = xóa không khôi phục; bản sao lưu hết hạn ngắn |
| R2 | **PRJ-06 Deepfake** cần ảnh/video khuôn mặt, trong khi SRS cấm gửi dữ liệu thô lên server | Dùng bộ ảnh mẫu đã cấp phép, phân tích hoàn toàn client-side; không cho upload ảnh khuôn mặt thật của học sinh |
| R3 | **Model "JSON" và dữ liệu huấn luyện lưu ở đâu?** SRS chỉ nói ảnh thô không lên server | Lưu model (trọng số) trong IndexedDB; chỉ đồng bộ metadata/model nếu DPIA cho phép (xem câu hỏi Q3) |
| R4 | **Dual Consent:** ngưỡng "<16 tuổi" cần cha mẹ, nhưng đồng ý của trẻ chỉ từ 7 tuổi; trẻ 6 tuổi (lớp 1) xử lý thế nào | Trẻ <7 tuổi: chỉ cha mẹ đồng ý; UI trẻ vẫn hiển thị thông báo quyền riêng tư |
| R5 | **eKYC phụ huynh** (2.2) không có FR/chi tiết; chi phí và nhà cung cấp | MVP: Email OTP + SMS OTP; eKYC để pha sau |
| R6 | **50.000 CCU** là quá lớn so với đội 2–4 người | Thiết kế stateless + CDN + autoscale, load test ở mức 5.000 CCU cho MVP, mục tiêu 50k ở pha 3 |
| R7 | **Tier III tại Việt Nam, 2 DC độc lập** | Chọn nhà cung cấp cloud VN (Viettel/VNPT/FPT) hoặc cloud quốc tế có region VN; kiểm tra yêu cầu lưu trữ dữ liệu trong nước |
| R8 | **Python sandbox cho trẻ em**: rủi ro thực thi mã | Pyodide chạy trong Web Worker, không mạng, giới hạn thời gian/RAM; không chạy mã phía server |
| R9 | **Chatbot/LLM cho trẻ em** (5.3, PRJ-04): kiểm duyệt nội dung, prompt injection | MVP: không LLM trực tiếp, dùng câu trả lời AI soạn sẵn (ADD-02) và PRJ-04 bằng classifier tại client. Pha 2: sandbox chatbot (ADD-03) qua Safety Proxy, chặn PII, log cho người lớn, DPIA riêng |
| R10 | **Thiếu số liệu** trong SRS: kích thước nút tối thiểu, % availability bị trống | Điền giá trị đề xuất: nút ≥ 44×44 px (WCAG/Apple HIG), availability 99,5% (MVP) – cần xác nhận |
| R11 | Chuẩn pháp lý: SRS trích "Luật BVDLCN số 91/2025/QH15" | Nhờ tư vấn pháp lý xác minh số hiệu, hiệu lực và thay đổi so với NĐ 13/2023 |
| R12 | Tên "Bào Ngư Nhận Diện Cử Chỉ" (PRJ-01) có vẻ lỗi chính tả | Hỏi chủ sản phẩm |
| R13 | Thiết bị cấu hình thấp + huấn luyện ≤15s | Dùng transfer learning (MobileNet embeddings + KNN/đầu phân loại nhỏ), backend WebGL → WASM fallback; benchmark sớm ở Sprint 1 |

## 3A. Bổ sung sau đánh giá sư phạm (SRS chưa đủ cho mục tiêu "dùng AI hiệu quả")

SRS gốc dạy *AI hoạt động thế nào* (AI literacy) nhưng chưa dạy *dùng AI thế nào* (AI fluency). Các bổ sung sau trở thành yêu cầu của dự án (ký hiệu **ADD-xx**, ngoài SRS gốc, cần chủ sản phẩm chấp thuận để cập nhật SRS):

| Mã | Bổ sung | Mô tả | Pha |
|---|---|---|---|
| ADD-01 | **Trụ cột 6: AI sử dụng có trách nhiệm** | 4 kỹ năng: *Hỏi tốt* (prompt), *Kiểm chứng* (hallucination, đối chiếu nguồn), *Dùng có đạo đức* (không nhờ AI làm hộ bài, quyền riêng tư với chatbot), *Biết giới hạn* (khi nào không dùng AI). Bài học theo độ tuổi, bắt đầu từ Level 1 (dạng unplugged) | MVP (nội dung) |
| ADD-02 | **"Tìm lỗi của AI" (Spot the AI Mistake)** | Hoạt động dùng câu trả lời AI soạn sẵn có chứa lỗi/bịa để học sinh kiểm chứng. Không cần LLM trực tiếp | MVP |
| ADD-03 | **Sandbox chatbot an toàn** | Học sinh Level 2–3 trò chuyện với LLM qua Safety Moderation Proxy trong bài tập có hướng dẫn (so sánh câu trả lời, sửa prompt, tìm lỗi). Có nhật ký cho giáo viên/phụ huynh, giới hạn chủ đề & độ dài, chặn PII | Pha 2 (đầu) |
| ADD-04 | **Learning Outcomes & Assessment** | Mục tiêu học tập đo được (Bloom) cho từng bài, rubric dự án, bài kiểm tra đầu/cuối (pre/post), chỉ số hiểu sai (misconception) | MVP |
| ADD-05 | **Gamification thiết kế lại (sửa FR-002)** | Thưởng *quá trình* (đặt câu hỏi, tìm lỗi mô hình, cải thiện dữ liệu thiên lệch), không chỉ "accuracy >80%". Bỏ streak ở Level 1; không dark pattern/FOMO; giới hạn thời gian mặc định | MVP |
| ADD-06 | **Hỗ trợ giáo viên** | Giáo án theo chương trình 2018/môn Tin học, hoạt động offline, câu hỏi thảo luận, gợi ý học sinh tụt lại, tài liệu tập huấn | **Pha 2** (do triển khai tại nhà trước; MVP chỉ giữ cấu trúc nội dung tái sử dụng được) |
| ADD-07 | **Đồng hành của phụ huynh (trọng tâm)** | Phụ huynh là chủ tài khoản; hướng dẫn "nói chuyện với con về AI", hoạt động *Học cùng con*, gợi ý câu hỏi sau mỗi bài, cách xử lý khi con dùng AI ngoài app, tóm tắt tuần | **MVP** |
| ADD-08 | **An toàn nội dung số sớm** | Nhận biết nội dung AI tạo, deepfake, ảnh ghép, cách báo cáo/nhờ người lớn – dạng phù hợp tuổi, đưa vào từ Level 2 (PRJ-06 vẫn ở Level 3) | MVP (bài học) |
| ADD-09 | **Level 1 tối giản công nghệ** | Lớp 1–2 ưu tiên unplugged và chạm/kéo thả; webcam/mic chỉ có khi phụ huynh bật và có người lớn cạnh | MVP |
| ADD-10 | **Khả năng tiếp cận & công bằng** | Hỗ trợ khiếm thị/khiếm thính/dyslexia (đọc to, font dễ đọc, phụ đề), thiết bị yếu/mạng chậm, nhiều con dùng chung một thiết bị gia đình (chuyển hồ sơ bằng biểu tượng + PIN do phụ huynh đặt) | MVP → Pha 2 |
| ADD-11 | **Pilot & đo hiệu quả** | Pilot **10–20 gia đình** (trẻ 6–14 tuổi), user testing theo từng độ tuổi từ Sprint 4, đo pre/post và misconception trước khi mở rộng | MVP (Sprint 13) |

**Đối tượng triển khai đầu tiên (đã chốt):** *học tại nhà*. Hệ quả thiết kế:
- Phụ huynh đăng ký trước, xác thực rồi **tạo hồ sơ con** (đơn giản hóa Dual Consent; trẻ vẫn bấm "Con đồng ý" từ 7 tuổi).
- Cổng giáo viên/mã lớp (FR-009) và đăng nhập theo lớp lùi sang **Pha 2**; CMS và cấu trúc nội dung vẫn thiết kế để dùng lại cho lớp học.
- Không có giáo viên để hỗ trợ → nội dung phải *tự đủ*: hướng dẫn phụ huynh ngắn gọn, hoạt động làm cùng con, phản hồi tự động rõ ràng.
- Thiết bị thường dùng chung trong gia đình → chuyển hồ sơ nhanh (biểu tượng + PIN), phiên ngắn, khóa hồ sơ khi hết giờ.
- Động lực học tự giác → gamification nhẹ nhàng, phần thưởng quá trình, không gây nghiện (ADD-05).

## 4. Kiến trúc đề xuất

```
┌───────────────────── Client (Next.js PWA, Service Worker) ─────────────────────┐
│ UI trẻ em (i18n vi/en)  │  Lesson Engine  │  ML Studio (TF.js/WASM, Web Worker) │
│ Scratch Blocks + ML ext │  Pyodide sandbox│  IndexedDB (model, cache offline)   │
└───────────────┬────────────────────────────────────────────────────────────────┘
                │ HTTPS/TLS 1.3 (chỉ metadata, tiến độ, model nếu được phép)
┌───────────────▼──────────── API Gateway / BFF (NestJS) ────────────────────────┐
│ Auth & Consent │ Content │ Progress & Gamification │ Family │ Admin │ (Pha 2: Classroom) │
│ Audit log │ Erasure engine │ (sau MVP) LLM Moderation Proxy, LTI 1.3            │
└───────┬──────────────────┬──────────────────┬────────────────────┬─────────────┘
   PostgreSQL           Redis (cache/queue)  Object storage (nội dung)  Email/SMS provider
```

**Nguyên tắc:** modular monolith (NestJS modules) cho MVP thay vì microservices; monorepo (pnpm + Turborepo) với `apps/web`, `apps/api`, `packages/{ui,ml-core,blocks-ext,i18n,shared-types}`; IaC (Terraform), CI/CD (GitHub Actions), observability (OpenTelemetry + log không chứa PII).

## 5. Phân pha & phạm vi

| Pha | Mục tiêu | Thời gian | Nội dung |
|---|---|---|---|
| **MVP** | Vòng khép kín: đăng ký hợp pháp → học → huấn luyện ML → tiến độ | Tháng 1–6 | Xem mục 6 |
| **Pha 2** | Mở rộng nội dung & lớp học | Tháng 7–9 | **Sandbox chatbot an toàn (ADD-03, đầu pha)**, hỗ trợ phụ huynh (ADD-07), âm thanh/văn bản ML, Python sandbox (FR-007), PRJ-03…05, LTI 1.3, adaptive learning đầy đủ, eKYC |
| **Pha 3** | Quy mô & mở rộng | Tháng 10–12 | PRJ-06, mở rộng nội dung Level 3, load test 50k CCU, app đóng gói, DPIA định kỳ, đánh giá hiệu quả học tập sau pilot |

**MVP gồm:** FR-010, FR-011, FR-001, FR-002 (bản thiết kế lại – ADD-05), FR-004 (ảnh), FR-005, FR-006, FR-008 (mở rộng thành trọng tâm – Family: ADD-07), Admin tối thiểu; ADD-01/02/04/07/08/09/10; dự án PRJ-01, PRJ-02; Level 1 + Level 2 (lớp 1–5) với 10–14 bài học mẫu, trong đó ít nhất 1/3 thuộc trụ cột AI có trách nhiệm.
**Chưa trong MVP:** FR-007, FR-003 đầy đủ (chỉ micro-quiz + gợi ý đơn giản), âm thanh/văn bản, chatbot LLM trực tiếp (ADD-03), LTI, eKYC, PRJ-03…06.

## 6. Lộ trình MVP (13 sprint × 2 tuần)

| Sprint | Trọng tâm | Kết quả bàn giao (Definition of Done) |
|---|---|---|
| **0** (tuần 1–2) | Khởi động | Chốt câu hỏi mở (phần 8), monorepo, CI, môi trường dev/staging, design tokens thân thiện trẻ em, threat model & DPIA v1, **Learning Outcomes v1 + rubric (ADD-04)** cùng cố vấn sư phạm, backlog chi tiết | **✔ Xong** – xem `docs/adr/`, `docs/security/`, `docs/compliance/`, `docs/BACKLOG.md`, `content/outcomes/`, `packages/ui` |
| **1** | Spike kỹ thuật | PoC TF.js: chụp webcam → embedding → huấn luyện ≤15s trên thiết bị thấp; PoC Scratch Blocks + extension; quyết định WebGL/WASM. Báo cáo benchmark | **◐ Xong phần làm được trong cloud** (ML + khối lệnh chạy được; **chưa đo trên thiết bị/webcam thật**) – xem `docs/spikes/SPRINT1_REPORT.md` |
| **2** | Nền tảng & Auth | Mô hình dữ liệu, đăng ký/đăng nhập 4 vai trò, RBAC, 2FA admin, audit log, i18n |
| **3** | **FR-010 Dual Consent** | Luồng 7.1 đầy đủ (DOB → PENDING_PARENT_CONSENT → OTP email/SMS → ACTIVE), Privacy by Default, test pháp lý |
| **4** | Lesson Engine (FR-001) | Định dạng nội dung bài học (JSON schema, gắn mã outcome), renderer: trắc nghiệm, kéo thả, nhập ngắn, Mascot, TTS; **user testing vòng 1 với trẻ (ADD-11)** |
| **5** | Gamification (ADD-05) + Content CMS | XP theo quá trình, huy hiệu (không streak ở L1), CMS nội dung, 4–6 bài Level 1 gồm bài *AI có trách nhiệm* mức unplugged (ADD-01, ADD-09) |
| **6** | **Data Collection Studio (FR-004, ảnh)** | Webcam, gán nhãn, lưu RAM/IndexedDB, đèn báo quay, xóa bộ đệm; kiểm chứng *không có ảnh thô trong network log* |
| **7** | **ML Trainer (FR-005)** | Huấn luyện + biểu đồ Accuracy/Loss, việt hóa thuật ngữ, ≤15s, thử nghiệm mô hình trực tiếp |
| **8** | **Block Coding (FR-006)** | Scratch Blocks + khối ML, sân chơi nhân vật; PRJ-01 hoàn chỉnh |
| **9** | PRJ-02 + Micro-quiz (FR-003 cơ bản) + Tìm lỗi AI | Pose/Pattern, Oẳn Tù Tì tự học; micro-quiz, gợi ý bài bổ trợ; hoạt động *Tìm lỗi của AI* (ADD-02); bài nhận biết nội dung AI tạo (ADD-08); 4–6 bài Level 2 |
| **10** | Phụ huynh (FR-008, ADD-07) | Dashboard phụ huynh, hồ sơ nhiều con + chuyển hồ sơ (biểu tượng + PIN), giới hạn thời gian, báo cáo năng lực/tuần, thu hồi đồng ý, hướng dẫn "nói chuyện với con về AI", hoạt động *Học cùng con* |
| **11** | **FR-011 Erasure** + Onboarding gia đình | Xóa ≤72h (crypto-shredding), job & kiểm chứng; luồng onboarding phụ huynh→con, bài kiểm tra đầu vào (pre-test), email tóm tắt tuần, thông báo nhắc dịu nhẹ |
| **12** | Offline & hiệu năng & bảo mật | Service Worker cache bài lý thuyết, tải trang ≤2s, mã hóa AES-256/TLS 1.3, pen-test cơ bản, load test 5k CCU |
| **13** | Ổn định & pilot | **Pilot 10–20 gia đình, pre/post test + misconception survey (ADD-11)**, sửa lỗi, tài liệu vận hành, báo cáo tuân thủ NĐ13, báo cáo hiệu quả học tập |

**Phân công gợi ý (3 người):** (A) Tech lead/backend + compliance; (B) frontend + lesson/gamification; (C) ML/Edge AI + block coding. Người thứ 4 (nếu có): UI/UX + nội dung sư phạm. Cần cố vấn sư phạm AI4K12 và pháp lý bán thời gian.

## 7. Chiến lược kiểm thử & tuân thủ

- **Unit/Integration:** Vitest/Jest, Supertest; **E2E:** Playwright (chạy cả luồng webcam bằng fake media stream).
- **Test then chốt:** (1) tự động kiểm tra không có request chứa ảnh/âm thanh thô; (2) luồng Dual Consent mọi nhánh tuổi (6, 7, 15, 16); (3) xóa dữ liệu ≤72h kể cả backup; (4) hiệu năng huấn luyện trên thiết bị mục tiêu; (5) WCAG 2.1 AA, cỡ chữ ≥16pt (tiểu học)/14pt (THCS).
- **Tuân thủ:** DPIA từng tính năng AI, Privacy by Design checklist trong Definition of Done, nhật ký kiểm toán không lưu PII thừa, hồ sơ thông báo xử lý dữ liệu theo NĐ13.
- **Truy xuất nguồn gốc:** mỗi issue gắn mã FR/NFR; ma trận FR → Sprint dưới đây.

| FR | Nội dung | MVP | Sprint |
|---|---|---|---|
| FR-001 | Bài học kể chuyện | ✔ | 4 |
| FR-002 | XP/huy hiệu | ✔ | 5 |
| FR-003 | Adaptive | một phần | 9 (đầy đủ ở Pha 2) |
| FR-004 | Thu thập dữ liệu | ảnh | 6 (âm thanh/văn bản ở Pha 2) |
| FR-005 | Trainer | ✔ | 7 |
| FR-006 | Block coding | ✔ | 8 |
| FR-007 | Python sandbox | ✘ | Pha 2 |
| FR-008 | Dashboard phụ huynh | cơ bản | 10 |
| FR-009 | Cổng giáo viên | ✘ | Pha 2 (lùi do triển khai tại nhà) |
| FR-010 | Dual Consent | ✔ | 3 |
| FR-011 | Xóa dữ liệu | ✔ | 11 |

## 8. Câu hỏi mở cần xác nhận

1. **Model ML của học sinh** có được đồng bộ lên server (để dùng nhiều thiết bị/giáo viên chấm) không, hay chỉ lưu cục bộ? (R3)
2. **Phụ huynh <7 tuổi:** xác nhận quy tắc chỉ cần đồng ý của cha mẹ. (R4)
3. **Hosting:** có bắt buộc đặt dữ liệu tại Việt Nam / nhà cung cấp cụ thể nào? (R7)
4. **Nhà cung cấp SMS/Email OTP** và ngân sách? (R5)
5. **Nội dung bài học:** ai soạn (đội/giáo viên)? Có sẵn tài nguyên hoạt hình, Mascot, giọng đọc tiếng Việt?
6. **Điền số liệu còn trống** trong SRS: availability %, kích thước nút tối thiểu (đề xuất 44×44 px). (R10)
7. **Xác minh pháp lý** số hiệu luật BVDLCN 2025 (R11) và tên PRJ-01 (R12).
8. **Giáo viên:** tài khoản do nhà trường cấp thế nào ở MVP (mời qua email tên miền giáo dục, hay Admin duyệt thủ công)?

9. ~~Đối tượng triển khai~~ → **Đã chốt: tại nhà.**
10. ~~Chuyên gia sư phạm~~ → **Đã chốt: triển khai dần; trước mắt dùng giáo trình mở có sẵn** ([`CURRICULUM_SOURCES.md`](CURRICULUM_SOURCES.md)). Cần kiểm tra giấy phép (nhiều nguồn CC BY-NC/ND) trước khi tái sử dụng.
11. ~~Bổ sung ADD~~ → **Đã chấp thuận**, xem [`SRS_ADDENDUM.md`](SRS_ADDENDUM.md).
12. **Mô hình kinh doanh** (miễn phí/thuê bao/B2C) – ảnh hưởng đến thanh toán và giới hạn nội dung; chưa quyết.
13. **Thiết bị mục tiêu của gia đình** (điện thoại, tablet, laptop?) – ảnh hưởng PWA/webcam/hiệu năng.

## 9. Bước tiếp theo

1. Xác nhận phần 8 còn lại (Q1–Q8, Q12–Q13) và các giả định mục 5. Monorepo đã được khởi tạo (Sprint 0, xem `README.md`).
2. Bắt đầu Sprint 0: khởi tạo monorepo, CI, và spike TF.js (Sprint 1) để giảm rủi ro kỹ thuật lớn nhất (huấn luyện ≤15s trên thiết bị yếu).
