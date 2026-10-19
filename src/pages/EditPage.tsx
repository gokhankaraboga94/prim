import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneErrorBoundary } from "../components/SceneErrorBoundary";
import { EditField } from "../components/scene/EditField";
import { useGame } from "../hooks/useGame";
import { CHARACTERS, TEAMS, characterById } from "../edit/catalog";
import { assignNames, assignTeam, createStore, removeSelected, spawnUnits, startBattle } from "../edit/battle";
import { disposeThumbRenderer, loadCharacter, snapshotCharacter, type CharacterAsset } from "../edit/loadModel";

export function EditPage() {
  const { game } = useGame();
  const store = useMemo(() => createStore(), []);
  const [rev, setRev] = useState(0);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [manual, setManual] = useState("");
  const [assets, setAssets] = useState<Record<string, CharacterAsset>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const fn = () => setRev((n) => n + 1);
    store.listeners.add(fn);
    return () => {
      store.listeners.delete(fn);
    };
  }, [store]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Düzenle | Wargame";
    document.body.classList.add("edit-route");
    return () => {
      document.title = previous;
      document.body.classList.remove("edit-route");
    };
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      for (const def of CHARACTERS) {
        if (stop) return;
        try {
          const asset = await loadCharacter(def);
          if (stop) {
            asset.geometry.dispose();
            asset.material.dispose();
            return;
          }
          let thumb = "";
          try {
            thumb = snapshotCharacter(asset);
          } catch {
            thumb = "";
          }
          setAssets((prev) => ({ ...prev, [def.id]: asset }));
          if (thumb) setThumbs((prev) => ({ ...prev, [def.id]: thumb }));
        } catch {
          if (!stop) setFailed((prev) => ({ ...prev, [def.id]: true }));
        }
      }
    })();
    return () => {
      stop = true;
      disposeThumbRenderer();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected(store);
      } else if (event.key === "Escape") {
        store.selected.clear();
        store.note = "Seçim kalktı.";
        store.bump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  useEffect(() => {
    return () => {
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    };
  }, []);

  const selected = store.selected.size;
  const teamCounts = TEAMS.map((item) => ({
    ...item,
    n: store.units.filter((unit) => unit.alive && unit.team === item.id).length,
  }));

  function add(id: string) {
    const def = characterById(id);
    const asset = assets[id];
    if (!def || !asset) {
      store.note = failed[id] ? "Bu model açılmadı." : "Model yükleniyor.";
      store.bump();
      return;
    }
    spawnUnits(store, def, asset.radius, counts[id] ?? 1);
  }

  function toggleRecord() {
    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.stop();
      return;
    }
    const canvas = document.querySelector(".edit-stage canvas") as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== "function") {
      store.note = "Bu tarayıcı kaydı desteklemiyor.";
      store.bump();
      return;
    }
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((item) => MediaRecorder.isTypeSupported(item)) || "";
    const stream = canvas.captureStream(30);
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    } catch {
      store.note = "Kayıt başlatılamadı.";
      store.bump();
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "wargame-edit.webm";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      recorder.current = null;
      store.note = "Kayıt indirildi.";
      store.bump();
    };
    rec.start(250);
    recorder.current = rec;
    setRecording(true);
    store.note = "Kayıt alınıyor.";
    store.bump();
  }

  return (
    <div className="edit-page" data-rev={rev}>
      <header className="edit-bar">
        <button type="button" className={open ? "on" : ""} onClick={() => setOpen((value) => !value)}>
          Karakterler
        </button>
        <div className="edit-teams" aria-label="Takımlar">
          {TEAMS.map((item) => (
            <button key={item.id} type="button" className={team === item.id ? "on" : ""} onClick={() => setTeam(item.id)}>
              <i style={{ background: item.color }} />
              {item.label}
              {teamCounts[item.id - 1]?.n ? ` ${teamCounts[item.id - 1].n}` : ""}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => assignTeam(store, team)} disabled={!selected}>
          Takım olsun
        </button>
        <button type="button" className="edit-vs" onClick={() => startBattle(store)}>
          {store.battle ? "Durdur" : "VS"}
        </button>
        <button type="button" className={recording ? "edit-rec on" : "edit-rec"} onClick={toggleRecord}>
          {recording ? "Durdur" : "Kayıt"}
        </button>
        <button type="button" onClick={() => removeSelected(store)} disabled={!selected}>
          Sil
        </button>
        <button type="button" onClick={() => assignNames(store, game.names, "")} disabled={!selected}>
          Rastgele ad
        </button>
        <label className="edit-name">
          <input value={manual} placeholder="İsim yaz" onChange={(event) => setManual(event.target.value)} />
        </label>
        <button type="button" onClick={() => assignNames(store, game.names, manual)} disabled={!selected || !manual.trim()}>
          Adı ata
        </button>
        <span className="edit-note">
          Seçili {selected}
          {store.battle ? " · savaşta" : ""} · {store.note}
        </span>
      </header>

      <p className="edit-help">
        Sol tık seçer, sürükleyince kutu olur. Takımdan birini seçip yere tıklayınca bütün takım askeri nizamda oraya gider. Savaşta ölenlerin yeri kapanır, kalanlar yeniden dizilir. Sağ tuş kamerayı döndürür, tekerlek yakınlaştırır, orta tuş ve ok tuşları haritayı kaydırır. Takımsız asker savaşmaz.
      </p>

      <div className="edit-stage">
        {open && (
          <section className="edit-roster" aria-label="Karakter listesi">
            {CHARACTERS.map((def) => {
              const ready = Boolean(assets[def.id]);
              return (
                <article key={def.id}>
                  <div className="edit-thumb">{thumbs[def.id] ? <img src={thumbs[def.id]} alt="" /> : <span>{failed[def.id] ? "!" : "…"}</span>}</div>
                  <strong>{def.label}</strong>
                  <label>
                    Adet
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={counts[def.id] ?? 1}
                      onChange={(event) => setCounts((prev) => ({ ...prev, [def.id]: Math.max(1, Math.min(40, Number(event.target.value) || 1)) }))}
                    />
                  </label>
                  <button type="button" disabled={!ready || store.battle} onClick={() => add(def.id)}>
                    {ready ? "Ekle" : failed[def.id] ? "Yok" : "Yükleniyor"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
        <SceneErrorBoundary>
          <Canvas
            dpr={[1, 1.25]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false }}
            camera={{ fov: 42, near: 0.2, far: 900, position: [16, 24, 30] }}
          >
            <EditField store={store} assets={assets} />
          </Canvas>
        </SceneErrorBoundary>
        <div id="edit-marquee" className="edit-marquee" />
      </div>
    </div>
  );
}
