"use client";
import { Shell } from "../../../components/Shell";
import { get } from "../../../lib/api";
import { useAsync } from "../../../lib/hooks";
import { loc, useI18n } from "../../../lib/i18n";

type Guide = { sections: { id: string; title: { vi: string; en?: string }; body: { vi: string; en?: string } }[] };

export default function Guide() {
  const { t, lang } = useI18n();
  const { data } = useAsync(() => get<Guide>("/api/v1/parent-guide"), []);
  return (
    <Shell title={t("guide")}>
      {data?.sections.map((s) => <section key={s.id} className="card"><h2>{loc(s.title, lang)}</h2><p>{loc(s.body, lang)}</p></section>)}
    </Shell>
  );
}
