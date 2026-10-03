# Thiết kế cơ bản hệ thống (Basic Design) – v0.1

Phụ thuộc: [`PLAN.md`](PLAN.md), SRS gốc, [`SRS_ADDENDUM.md`](SRS_ADDENDUM.md) (ADD-01…ADD-11). Triển khai đầu tiên: **tại nhà**. Phạm vi: **MVP**, có chỗ chừa cho Pha 2–3.

## 1. Nguyên tắc thiết kế

1. **Privacy by Design:** dữ liệu sinh trắc (ảnh/âm thanh) không rời trình duyệt; server chỉ nhận metadata, tiến độ, và (nếu được chấp thuận – Q1) trọng số model.
2. **Sư phạm trước tính năng:** mỗi hoạt động gắn với một *learning outcome* (xem `LEARNING_OUTCOMES.md`); gamification thưởng quá trình.
3. **Modular monolith:** tách module rõ ràng để sau này cắt service (Chatbot Proxy, Analytics) khi cần.
4. **Content as data:** bài học là JSON có schema, nạp qua CMS, không hard-code trong UI.
5. **Mặc định an toàn:** tài khoản <16 tuổi: tắt định vị, hồ sơ riêng tư, không nhắn tin riêng, giới hạn thời gian.

## 2. Kiến trúc tổng thể

```
Client (Next.js PWA)
 ├─ App shell, i18n (vi/en), theme theo cấp độ (L1/L2/L3)
 ├─ Lesson Runtime        – render bài học từ JSON
 ├─ ML Studio (Web Worker) – webcam → TF.js embedding → head classifier → model
 ├─ Block Playground      – Scratch Blocks + ML extension
 ├─ Service Worker        – cache bài lý thuyết (offline)
 └─ IndexedDB             – dữ liệu mẫu tạm, model, hàng đợi đồng bộ tiến độ
        │ HTTPS (TLS 1.3) – chỉ JSON metadata
API (NestJS, modular monolith)
 ├─ identity     đăng ký, đăng nhập, RBAC, 2FA admin, đăng nhập lớp học bằng mã + biểu tượng
 ├─ consent      Dual Consent state machine, OTP, nhật ký đồng ý
 ├─ content      khóa học, bài học, outcome, CMS, phiên bản nội dung
 ├─ progress     tiến độ, XP, huy hiệu, micro-quiz, pre/post test
 ├─ classroom    lớp, mã lớp, duyệt học sinh, bài giao, chấm theo rubric
 ├─ family       dashboard phụ huynh, giới hạn thời gian, thu hồi đồng ý
 ├─ erasure      yêu cầu xóa, crypto-shredding, job ≤72h
 ├─ audit        audit log bất biến (không PII thừa)
 └─ (Pha 2) ai-gateway  Safety Moderation Proxy → LLM provider
Data: PostgreSQL (chính), Redis (cache, hàng đợi OTP/job), Object storage (media bài học)
Hạ tầng ngoài: Email/SMS provider, CDN, KMS (khóa mã hóa)
```

## 3. Thiết kế phân hệ chính

### 3.1 Dual Consent (FR-010) – máy trạng thái tài khoản

```
Phụ huynh: REGISTERED ──(Email/SMS OTP)──► GUARDIAN_VERIFIED
Hồ sơ con (do phụ huynh tạo, nhập tháng/năm sinh):
   age ≥ 16 ──► (tài khoản độc lập, ngoài trọng tâm MVP) ──► ACTIVE
   age < 16 ──► PENDING_PARENT_CONSENT
PENDING_PARENT_CONSENT ──(phụ huynh đọc điều khoản + xác nhận OTP; trẻ ≥7 bấm "Con đồng ý")──► ACTIVE
PENDING_PARENT_CONSENT ──(quá hạn 7 ngày)──► EXPIRED (xóa dữ liệu)
ACTIVE ──(phụ huynh thu hồi / yêu cầu xóa)──► ERASURE_REQUESTED ──(≤72h)──► ERASED
```
- Trẻ <7 tuổi: chỉ cần đồng ý của phụ huynh (giả định Q2).
- OTP: 6 chữ số, hết hạn 10 phút, giới hạn thử 5 lần, rate-limit theo IP và liên hệ.
- Mọi chuyển trạng thái ghi vào `consent_events` (append-only).

### 3.2 Lesson Runtime & nội dung
Bài học = danh sách *step* thuộc các loại: `story`, `choice`, `drag_drop`, `short_text`, `ml_task`, `block_task`, `spot_ai_mistake`, `discussion`, `unplugged`. Mỗi bài khai báo `outcomes[]`, độ tuổi, thời lượng, và biến thể ngôn ngữ.

```jsonc
{
  "id": "L2-RESP-03", "level": 2, "pillar": "responsible_ai",
  "outcomes": ["RESP.2.1", "RESP.2.3"],
  "title": {"vi": "AI có thể nói sai!", "en": "AI can be wrong!"},
  "steps": [
    {"type": "story", "mascot": "bud", "text": {"vi": "..."}},
    {"type": "spot_ai_mistake",
     "ai_answer": {"vi": "Việt Nam có 70 tỉnh thành."},
     "facts": ["Việt Nam có 63 tỉnh thành (2024)"],
     "task": "mark_wrong_parts", "feedback": {"vi": "..."}}
  ]
}
```

### 3.3 ML Studio (FR-004/005/006) – Edge AI
Pipeline chạy trong Web Worker: `getUserMedia` → khung hình tensor (RAM) → embedding (MobileNet nhỏ, TF.js) → huấn luyện đầu phân loại (dense nhỏ hoặc KNN) → model JSON → `tensor.dispose()` và xóa buffer. Backend: WebGL, fallback WASM. Ngân sách: ≤15s huấn luyện trên thiết bị mục tiêu (benchmark ở Sprint 1). UI hiển thị Accuracy/Loss với tên Việt hóa ("Số lần học tập", "Kích thước nhóm mẫu"), kèm bước **"Vì sao model sai?"** (xem mẫu sai, thêm dữ liệu đa dạng) để thưởng quá trình.
- Kiểm thử bắt buộc: Playwright kiểm tra *không có request mạng chứa ảnh/âm thanh thô*.

### 3.4 Gamification (ADD-05)
XP theo *hành vi học*: hoàn thành bài, thử nghiệm với dữ liệu mới, tìm lỗi của AI, cải thiện model sau khi phân tích sai, giúp bạn (nhóm). Huy hiệu theo outcome (ví dụ "Thám tử kiểm chứng"). Không streak ở L1; từ L2 streak là tùy chọn, có "ngày nghỉ miễn phí". Giới hạn thời gian mặc định do phụ huynh/giáo viên cấu hình. Không đếm ngược gây áp lực, không so sánh xếp hạng công khai giữa trẻ.

### 3.5 Lớp học, phụ huynh
- **Family (MVP, trọng tâm):** phụ huynh là chủ tài khoản, tạo nhiều hồ sơ con; thiết bị dùng chung chuyển hồ sơ bằng biểu tượng + PIN, khóa khi hết giờ; xem nhật ký học, báo cáo outcome theo tuần, đặt giới hạn thời gian, thu hồi đồng ý, yêu cầu xóa; hướng dẫn "nói chuyện với con về AI"; hoạt động *Học cùng con* (câu hỏi gợi mở sau mỗi bài).
- **Classroom (Pha 2):** mã lớp 6 ký tự, đăng nhập bằng mã lớp + biểu tượng/PIN, giáo viên duyệt, bài giao có rubric, báo cáo theo lớp. Schema DB đã chừa chỗ (`schools`, `classes`) nhưng module chưa triển khai ở MVP.

### 3.6 Erasure (FR-011) – crypto-shredding
Dữ liệu cá nhân của mỗi học sinh mã hóa bằng *data key* riêng (envelope encryption qua KMS). Xóa = hủy data key + xóa bản ghi chính; bản sao lưu còn lại không giải mã được. Job theo dõi SLA 72h, cảnh báo ở 48h, ghi chứng từ xóa vào audit log (không chứa PII).

### 3.7 (Pha 2) AI Gateway – chatbot sandbox (ADD-03)
`Client → ai-gateway: [auth + consent check] → input filter (PII, prompt injection, chủ đề cấm) → system prompt theo bài/tuổi → LLM → output filter → client`. Giới hạn: số lượt, độ dài, chủ đề theo bài; log hội thoại (đã loại PII) cho giáo viên/phụ huynh; không lưu dài hạn; DPIA riêng.

## 4. Mô hình dữ liệu (rút gọn)

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| `users` | id, role, display_name, birth_year_month, locale, status | Lưu tháng/năm sinh, hạn chế PII; `status` theo máy trạng thái |
| `guardianships` | guardian_id, child_id, verified_at, channel | |
| `consent_events` | id, child_id, actor, type, version_of_terms, ts | append-only |
| `schools`, `classes`, `enrollments` | class_code, teacher_id, status | |
| `courses`, `lessons`, `outcomes`, `lesson_outcomes` | version, level, pillar, json | nội dung có phiên bản |
| `lesson_progress` | user_id, lesson_id, step_state, score, ts | |
| `xp_events`, `badges`, `user_badges` | reason (enum quá trình), points | |
| `assessments`, `assessment_items`, `assessment_results` | type (pre/post/micro/misconception) | phục vụ ADD-04/11 |
| `assignments`, `submissions`, `rubrics`, `rubric_scores` | | |
| `projects` | user_id, kind (PRJ-xx), model_meta | trọng số model chỉ lưu nếu Q1 = có |
| `screen_time_rules`, `usage_sessions` | daily_limit, started/ended | |
| `erasure_requests` | subject_id, requested_at, done_at, proof | |
| `audit_logs` | actor, action, target_type, target_id, ts | không lưu nội dung nhạy cảm |

## 5. API (phác thảo REST, tiền tố `/api/v1`)

| Nhóm | Endpoint tiêu biểu |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/profile-switch` (biểu tượng+PIN), `/auth/2fa/verify` (admin); Pha 2: `/auth/class-login` |
| Consent | `POST /consent/guardian/invite`, `POST /consent/child/agree`, `POST /consent/guardian/verify-otp`, `POST /consent/withdraw` |
| Content | `GET /courses`, `GET /lessons/:id`, `GET /outcomes` |
| Progress | `POST /progress/steps`, `GET /me/progress`, `POST /assessments/:id/submit` |
| Family | `POST /children`, `GET /children/:id/weekly-summary`, `GET /children/:id/co-learning-activities` |
| Classroom (Pha 2) | `POST /classes`, `POST /classes/:id/approve`, `POST /assignments`, `POST /submissions/:id/score` |
| Family | `GET /children/:id/report`, `PUT /children/:id/screen-time`, `POST /children/:id/erase` |
| Admin | `POST /admin/lessons`, `GET /admin/audit-logs`, `GET /admin/compliance-report` |

Quy ước: OpenAPI 3 sinh từ NestJS; mã lỗi chuẩn RFC 7807; phân quyền theo vai trò + quan hệ (phụ huynh chỉ thấy con mình, giáo viên chỉ thấy lớp mình).

## 6. Thiết kế giao diện (UX cho trẻ em)

| Mục | L1 (lớp 1–2) | L2 (lớp 3–5) | L3 (lớp 6–9) |
|---|---|---|---|
| Điều hướng | 3–4 nút lớn, icon + giọng đọc | Thanh điều hướng đơn giản | Điều hướng chuẩn, có tìm kiếm |
| Chữ | ≥16pt, đọc to mọi văn bản | ≥16pt | ≥14pt |
| Tương tác | Chạm/kéo thả | Kéo thả + gõ ngắn | Gõ, code |
| Vùng chạm | ≥ 44×44 px (đề xuất 56 px ở L1) | ≥ 44×44 | ≥ 44×44 |
| Tông | Màu tươi, mascot lớn | Mascot nhỏ hơn | Tối giản, ít mascot |

Màn hình MVP chính: Onboarding & Consent, Trang chủ (bản đồ hành trình), Lesson Player, ML Studio (3 bước: Thu thập – Học – Thử), Block Playground, Hồ sơ & huy hiệu, Dashboard phụ huynh, Cổng giáo viên, CMS admin. Yêu cầu: WCAG 2.1 AA, hỗ trợ đọc to, phụ đề, font dễ đọc cho dyslexia, giảm chuyển động (prefers-reduced-motion).

## 7. Bảo mật & vận hành

- TLS 1.3, AES-256 at rest (+ envelope encryption cho PII), mật khẩu argon2id, 2FA bắt buộc Admin, rate limiting, CSP nghiêm ngặt (cần cho sandbox Pyodide/Pha 2).
- Log ứng dụng không chứa PII; audit log bất biến; sao lưu 6h/lần mã hóa, lưu 2 vùng.
- Môi trường: dev / staging / prod, IaC (Terraform), CI/CD, giám sát (OpenTelemetry, cảnh báo SLA erasure & OTP).
- Mục tiêu MVP: availability 99,5% (cần xác nhận), tải trang ≤2s, load test 5.000 CCU.

## 8. Cấu trúc repo đề xuất

```
apps/web         Next.js PWA
apps/api         NestJS
packages/ui      thành phần UI + design tokens
packages/ml-core pipeline TF.js (worker)
packages/blocks  Scratch Blocks + ML extension
packages/content schema JSON bài học + validator
packages/shared  kiểu dữ liệu, i18n
content/         bài học (JSON) + outcomes
infra/           Terraform
docs/            PLAN, DESIGN, LEARNING_OUTCOMES
```

## 9. Quyết định cần xác nhận / rủi ro thiết kế

- Q1 (lưu model lên server), Q2 (trẻ <7 tuổi), Q3 (hosting tại VN) ảnh hưởng trực tiếp các mục 3.1, 3.6, 4, 7.
- Chọn mô hình embedding và dung lượng tải về (ảnh hưởng thiết bị yếu): quyết ở Sprint 1.
- Nhà cung cấp LLM và chính sách dữ liệu cho trẻ em: quyết trước Pha 2.
