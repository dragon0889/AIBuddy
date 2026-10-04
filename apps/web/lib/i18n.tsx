"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Dict = Record<string, { vi: string; en?: string }>;

/** Chuỗi giao diện (ADD-10/SRS 5.1: song ngữ Việt mặc định, Anh). Thiếu bản Anh sẽ dùng bản Việt. */
export const dict: Dict = {
  appName: { vi: "AIBuddy", en: "AIBuddy" },
  tagline: { vi: "Học AI cùng con – hiểu AI và biết dùng AI an toàn", en: "Learn AI with your child – understand AI and use it safely" },
  register: { vi: "Đăng ký (phụ huynh)", en: "Sign up (parent)" },
  login: { vi: "Đăng nhập", en: "Log in" },
  logout: { vi: "Đăng xuất", en: "Log out" },
  email: { vi: "Email", en: "Email" },
  password: { vi: "Mật khẩu (tối thiểu 10 ký tự)", en: "Password (min. 10 characters)" },
  phone: { vi: "Số điện thoại (tuỳ chọn, để nhận mã qua SMS)", en: "Phone (optional, for SMS codes)" },
  acceptTerms: { vi: "Tôi là cha mẹ/người giám hộ và đồng ý với điều khoản xử lý dữ liệu", en: "I am a parent/guardian and agree to the data processing terms" },
  verifyTitle: { vi: "Xác minh email", en: "Verify your email" },
  code: { vi: "Mã 6 số", en: "6-digit code" },
  confirm: { vi: "Xác nhận", en: "Confirm" },
  resend: { vi: "Gửi lại mã", en: "Resend code" },
  children: { vi: "Hồ sơ của con", en: "Your children" },
  addChild: { vi: "Thêm hồ sơ con", en: "Add a child" },
  nickname: { vi: "Biệt danh (không cần tên thật)", en: "Nickname (no real name needed)" },
  birthYear: { vi: "Năm sinh", en: "Birth year" },
  birthMonth: { vi: "Tháng sinh", en: "Birth month" },
  pin4: { vi: "Mã PIN 4 số của con", en: "Child's 4-digit PIN" },
  create: { vi: "Tạo hồ sơ", en: "Create profile" },
  play: { vi: "Cho con chơi", en: "Let the child play" },
  report: { vi: "Báo cáo tuần", en: "Weekly report" },
  settings: { vi: "Cài đặt", en: "Settings" },
  dailyMinutes: { vi: "Giới hạn mỗi ngày (phút)", en: "Daily limit (minutes)" },
  allowCamera: { vi: "Cho phép dùng camera (chỉ khi có người lớn bên cạnh)", en: "Allow camera (only with an adult nearby)" },
  save: { vi: "Lưu", en: "Save" },
  withdraw: { vi: "Rút đồng ý và xóa dữ liệu của con", en: "Withdraw consent and delete child's data" },
  eraseAccount: { vi: "Xóa toàn bộ tài khoản", en: "Delete my whole account" },
  guide: { vi: "Hướng dẫn nói chuyện với con về AI", en: "How to talk to your child about AI" },
  consentTitle: { vi: "Đồng ý của phụ huynh", en: "Parental consent" },
  consentBody: { vi: "Chúng tôi chỉ thu thập dữ liệu tối thiểu (biệt danh, tháng/năm sinh, tiến độ học). Ảnh và âm thanh khi huấn luyện mô hình ở lại trên thiết bị và bị xóa sau khi huấn luyện. Bạn có thể rút đồng ý và yêu cầu xóa dữ liệu bất cứ lúc nào.", en: "We collect minimal data (nickname, birth month/year, learning progress). Photos and audio used for training stay on the device and are deleted after training. You can withdraw consent and request deletion at any time." },
  childAgree: { vi: "Con đồng ý", en: "I agree" },
  childAgreeText: { vi: "Bud sẽ lưu tên biệt danh và những bài con đã học. Ảnh con chụp chỉ ở trên máy này. Con đồng ý chơi cùng Bud chứ?", en: "Bud will remember your nickname and the lessons you finished. Photos stay on this device. Do you want to play with Bud?" },
  whoPlays: { vi: "Ai sẽ chơi hôm nay?", en: "Who is playing today?" },
  enterPin: { vi: "Nhập mã PIN", en: "Enter your PIN" },
  exit: { vi: "Thoát", en: "Exit" },
  readAloud: { vi: "Đọc to", en: "Read aloud" },
  next: { vi: "Tiếp", en: "Next" },
  check: { vi: "Kiểm tra", en: "Check" },
  tryAgain: { vi: "Thử lại", en: "Try again" },
  done: { vi: "Xong", en: "Done" },
  xp: { vi: "điểm", en: "XP" },
  timeUp: { vi: "Hết giờ chơi hôm nay rồi! Hẹn con ngày mai nhé.", en: "That's all for today! See you tomorrow." },
  loading: { vi: "Đang tải…", en: "Loading…" },
  lang: { vi: "English", en: "Tiếng Việt" },
  errorGeneric: { vi: "Có lỗi xảy ra, thử lại nhé.", en: "Something went wrong. Please try again." },
};

type Lang = "vi" | "en";
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof dict) => string }>({ lang: "vi", setLang: () => {}, t: (k) => dict[k]?.vi ?? String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");
  useEffect(() => {
    try { const s = localStorage.getItem("ab_lang"); if (s === "en" || s === "vi") setLangState(s); } catch { /* bộ nhớ bị chặn: bỏ qua */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("ab_lang", l); } catch { /* ignore */ } };
  const t = (k: keyof typeof dict) => (lang === "en" ? dict[k]?.en : undefined) ?? dict[k]?.vi ?? String(k);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
/** Văn bản nội dung đa ngôn ngữ ({vi,en?}). */
export const loc = (x: { vi: string; en?: string } | undefined, lang: Lang) => (x ? (lang === "en" ? x.en : undefined) ?? x.vi : "");
