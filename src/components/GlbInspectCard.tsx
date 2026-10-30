import { useState } from "react";
import { formatBytes, inspectGlb, RED_JOINTS, type GlbReport } from "../glbInspect";

const VERDICT: Record<GlbReport["verdict"], string> = {
  none: "İskelet yok. Kırmızı klibi bağlanmaz. Bu sayfa modele ücretsiz iskelet takamaz: kemik listesi yetmez, her köşenin hangi kemiğe bağlı olduğu da gerekir. Mixamo veya AccuRIG bunu ücretsiz yapar. Riglenmiş glb’yi tekrar bırak.",
  match: "Kırmızının 66 kemiği duruyor. Kılıç, koşu, kombo ve ölüm klipleri bu modele bağlanır.",
  partial: "İskelet var ama kırmızının kemik adları eksik. Klipler eksik kemiklerde oynamaz.",
  other: "İskelet var, kemik adları kırmızıdan farklı. Bu klipler bağlanmaz.",
};

export function GlbInspectCard() {
  const [report, setReport] = useState<GlbReport | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      setReport(inspectGlb(file.name, buf));
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Dosya okunamadı.");
    } finally {
      setBusy(false);
    }
  }

  const missing = report?.missing.slice(0, 8) ?? [];

  return (
    <section className="admin-card admin-span">
      <h2>Model analizi</h2>
      <p className="muted">
        Glb buraya düşer, tarayıcıda okunur, sunucuya gitmez. İskelet, köşe sayısı ve kırmızıdaki 66 kemikle eşleşme yazılır. Ücretsiz otomatik iskelet bu sitede yok.
      </p>
      <label>
        Glb dosyası
        <input
          type="file"
          accept=".glb,model/gltf-binary"
          disabled={busy}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p className="muted">Okunuyor…</p>}
      {err && <p className="admin-msg">{err}</p>}
      {report && (
        <div>
          <p>
            <b>{report.name}</b> · {formatBytes(report.bytes)} · {report.meshes} mesh · {report.verts.toLocaleString("tr-TR")} köşe · {report.joints.length} kemik · {report.anims.length} klip
          </p>
          <p>{VERDICT[report.verdict]}</p>
          {report.verdict === "partial" && missing.length > 0 && (
            <p className="muted">
              Eksik {report.missing.length}/{RED_JOINTS.length}: {missing.join(", ")}
              {report.missing.length > missing.length ? "…" : ""}
            </p>
          )}
          {report.anims.length > 0 && <p className="muted">Kendi klipleri: {report.anims.join(", ")}</p>}
        </div>
      )}
    </section>
  );
}
