import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assessment, lesson, outcomeCatalog, type Assessment, type Lesson, type Outcome } from "@aibuddy/content";

/** Kho nội dung: nạp và kiểm tra schema khi khởi động (lỗi nội dung = không khởi động). */
export class ContentStore {
  private byId = new Map<string, Lesson>();
  private _outcomes: Outcome[] = [];
  private _assessments = new Map<string, Assessment>();

  constructor(private dir: string) {}

  load(): this {
    const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
    this._outcomes = outcomeCatalog.parse(readJson(join(this.dir, "outcomes/outcomes.json"))).outcomes;
    const ld = join(this.dir, "lessons");
    for (const f of readdirSync(ld).filter((x) => x.endsWith(".json")).sort()) {
      const l = lesson.parse(readJson(join(ld, f)));
      this.byId.set(l.id, l);
    }
    const ad = join(this.dir, "assessments");
    if (existsSync(ad)) for (const f of readdirSync(ad).filter((x) => x.endsWith(".json")).sort()) {
      const a = assessment.parse(readJson(join(ad, f)));
      this._assessments.set(a.id, a);
    }
    const known = new Set(this._outcomes.map((o) => o.id));
    for (const l of this.byId.values()) for (const o of l.outcomes) if (!known.has(o)) throw new Error(`lesson ${l.id} references unknown outcome ${o}`);
    return this;
  }

  lessons(level?: number): Lesson[] {
    return [...this.byId.values()].filter((l) => !level || l.level === level);
  }
  lesson(id: string): Lesson | undefined { return this.byId.get(id); }
  outcomes(): Outcome[] { return this._outcomes; }
  assessment(id: string): Assessment | undefined { return this._assessments.get(id); }
  assessments(): Assessment[] { return [...this._assessments.values()]; }
  /** CMS: thay/ thêm bài đã được duyệt xuất bản. */
  publish(l: Lesson): void { this.byId.set(l.id, l); }
}
