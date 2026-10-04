"use client";
import { useState, type FormEvent } from "react";
import { Shell } from "../../components/Shell";
import { ApiError, get, post } from "../../lib/api";
import { useAsync } from "../../lib/hooks";

type Lessons = { published: { id: string; level: number; title: string }[]; drafts: { id: string; lesson_id: string; version: number; status: string; author_id: string }[] };

function Console({ onLogout }: { onLogout: () => void }) {
  const { data, error, reload } = useAsync(() => get<Lessons>("/api/v1/admin/lessons"), []);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState("");
  const [out, setOut] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setMsg(""); try { setOut(await fn()); await reload(); } catch (e) { setMsg(`${(e as ApiError).code}: ${(e as ApiError).detail ?? ""}`); } };
  if (error?.status === 401 || error?.status === 403) { onLogout(); return null; }
  return (
    <div className="stack">
      <div className="row"><button className="btn" onClick={() => run(() => get("/api/v1/admin/compliance-report"))}>Báo cáo tuân thủ</button>
        <button className="btn" onClick={() => run(() => get("/api/v1/admin/pilot-export"))}>Xuất dữ liệu pilot (ẩn danh)</button>
        <button className="btn" onClick={() => run(() => get("/api/v1/admin/audit-logs?limit=50"))}>Nhật ký kiểm toán</button>
        <button className="btn" onClick={() => run(() => post("/api/v1/admin/maintenance/run"))}>Chạy bảo trì (hết hạn/xóa)</button>
        <button className="btn" onClick={async () => { await post("/api/v1/auth/logout"); onLogout(); }}>Đăng xuất</button></div>
      {msg && <p className="err" role="alert">{msg}</p>}
      <section className="card"><h2>Bài đã xuất bản ({data?.published.length})</h2><ul>{data?.published.map((l) => <li key={l.id}>{l.id} · cấp {l.level} · {l.title}</li>)}</ul></section>
      <section className="card stack"><h2>Bản nháp</h2>
        <ul>{data?.drafts.map((d) => (
          <li key={d.id} className="row">{d.lesson_id} v{d.version} <span className="pill">{d.status}</span>
            {d.status === "draft" && <button className="btn" onClick={() => run(() => post(`/api/v1/admin/drafts/${d.id}/submit`))}>Gửi duyệt</button>}
            {d.status === "in_review" && <><button className="btn" onClick={() => run(() => post(`/api/v1/admin/drafts/${d.id}/review`, { decision: "approve" }))}>Duyệt</button><button className="btn btn-danger" onClick={() => run(() => post(`/api/v1/admin/drafts/${d.id}/review`, { decision: "reject" }))}>Từ chối</button></>}
          </li>))}</ul>
        <form className="stack" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => post("/api/v1/admin/drafts", { lesson: JSON.parse(json) })); }}>
          <label>Bài học (JSON theo schema)<textarea rows={8} value={json} onChange={(e) => setJson(e.target.value)} /></label>
          <button className="btn btn-primary">Tạo bản nháp</button>
        </form>
        <p className="muted">Người duyệt phải khác tác giả (duyệt 2 bước).</p>
      </section>
      {out !== null && <pre className="card" style={{ overflow: "auto", maxHeight: 360 }}>{JSON.stringify(out, null, 2)}</pre>}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [f, setF] = useState({ email: "", password: "", totp: "" });
  const [err, setErr] = useState("");
  useAsync(async () => { try { const me = await get<{ role: string }>("/api/v1/auth/me"); setAuthed(me.role === "admin"); } catch { setAuthed(false); } return null; }, []);
  if (authed) return <Shell title="Quản trị"><Console onLogout={() => setAuthed(false)} /></Shell>;
  return (
    <Shell title="Quản trị (2FA bắt buộc)">
      <form className="card stack" onSubmit={async (e) => { e.preventDefault(); setErr(""); try { await post("/api/v1/auth/login", f); setAuthed(true); } catch { setErr("Thông tin hoặc mã 2FA chưa đúng."); } }}>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Mật khẩu<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label>Mã 2FA (6 số)<input type="text" inputMode="numeric" maxLength={6} required value={f.totp} onChange={(e) => setF({ ...f, totp: e.target.value })} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary">Đăng nhập</button>
      </form>
    </Shell>
  );
}
