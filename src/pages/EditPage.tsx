import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SceneErrorBoundary } from "../components/SceneErrorBoundary";
import { EditField } from "../components/scene/EditField";
import { useGame } from "../hooks/useGame";
import { CHARACTERS, CHARACTERS2, GROUNDS, TEAMS, characterById, type CharacterDef } from "../edit/catalog";
import {
  assignNames,
  assignTeam,
  clearField,
  clearNames,
  createStore,
  deleteSave,
  hasSavedScene,
  listSaves,
  loadScene,
  peekSavedModels,
  peekSavedModelsFor,
  nudgeSelected,
  removeSelected,
  resetSlotOffsets,
  rotateSelected,
  saveScene,
  selectAll,
  selectTeam,
  setGround,
  setPlaceMode,
  spawnUnits,
  startBattle,
  unassignTeam,
  type SaveListItem,
} from "../edit/battle";
import { disposeAsset, disposeThumbRenderer, letterThumb, loadCharacter, snapshotCharacter, type CharacterAsset } from "../edit/loadModel";
import { REEL_HEIGHT, REEL_WIDTH, reelWindow } from "../recordCanvas";

type RosterTab = "chars" | "mafya" | "ground" | null;

export function EditPage() {
  const { game } = useGame();
  const store = useMemo(() => createStore(), []);
  const phone = useMemo(() => {
    if (typeof window === "undefined") return false;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 860;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return narrow || coarse;
  }, []);
  const [rev, setRev] = useState(0);
  const [tab, setTab] = useState<RosterTab>(null);
  const [team, setTeam] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [manual, setManual] = useState("");
  const [assets, setAssets] = useState<Record<string, CharacterAsset>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [recordMode, setRecordMode] = useState<"reel" | "map" | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [saveList, setSaveList] = useState<SaveListItem[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const loaded = useRef<CharacterAsset[]>([]);
  const assetsRef = useRef<Record<string, CharacterAsset>>({});
  const pendingAdd = useRef(new Map<string, number>());

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

  const started = useRef(new Set<string>());

  useEffect(() => {
    let stop = false;
    const queue = CHARACTERS.filter((def) => !(phone && def.heavy)).sort((a, b) => Number(Boolean(b.packed)) - Number(Boolean(a.packed)));
    const take = async () => {
      while (queue.length && !stop) {
        const def = queue.shift()!;
        if (started.current.has(def.id)) continue;
        started.current.add(def.id);
        try {
          const asset = await loadCharacter(def);
          if (stop) {
            disposeAsset(asset);
            started.current.delete(def.id);
            return;
          }
          loaded.current.push(asset);
          assetsRef.current = { ...assetsRef.current, [def.id]: asset };
          let thumb = "";
          try {
            thumb = phone ? letterThumb(def.label) : snapshotCharacter(asset);
          } catch {
            thumb = letterThumb(def.label);
          }
          setAssets((prev) => ({ ...prev, [def.id]: asset }));
          if (thumb) setThumbs((prev) => ({ ...prev, [def.id]: thumb }));
          flushPendingAdd(def.id);
        } catch {
          if (!stop) {
            started.current.delete(def.id);
            setFailed((prev) => ({ ...prev, [def.id]: true }));
          }
        }
        if (phone) await new Promise((resolve) => window.setTimeout(resolve, 40));
      }
    };
    const lanes = phone ? 1 : 2;
    void Promise.all(Array.from({ length: lanes }, () => take()));
    return () => {
      stop = true;
      disposeThumbRenderer();
      for (const asset of loaded.current) disposeAsset(asset);
      loaded.current = [];
      started.current.clear();
    };
  }, [phone]);

  function makeThumb(def: CharacterDef, asset: CharacterAsset) {
    try {
      if (phone) return letterThumb(def.label);
      return snapshotCharacter(asset) || letterThumb(def.label);
    } catch {
      return letterThumb(def.label);
    }
  }

  function flushPendingAdd(id: string) {
    const def = characterById(id);
    const asset = assetsRef.current[id];
    const want = pendingAdd.current.get(id) ?? 0;
    if (!def || !asset || want <= 0) return;
    pendingAdd.current.delete(id);
    spawnUnits(store, def, asset.radius, want);
  }

  function loadOne(id: string) {
    const def = characterById(id);
    if (!def) return;
    if (assetsRef.current[id]) {
      flushPendingAdd(id);
      return;
    }
    if (started.current.has(id)) return;
    started.current.add(id);
    setThumbs((prev) => (prev[def.id] ? prev : { ...prev, [def.id]: letterThumb(def.label) }));
    void loadCharacter(def)
      .then((asset) => {
        loaded.current.push(asset);
        assetsRef.current = { ...assetsRef.current, [def.id]: asset };
        const thumb = makeThumb(def, asset);
        setAssets((prev) => ({ ...prev, [def.id]: asset }));
        setThumbs((prev) => ({ ...prev, [def.id]: thumb }));
        flushPendingAdd(id);
      })
      .catch(() => {
        started.current.delete(id);
        pendingAdd.current.delete(id);
        setFailed((prev) => ({ ...prev, [def.id]: true }));
        store.note = `${def.label} yüklenemedi.`;
        store.bump();
      });
  }

  function ensureModels(ids: string[]) {
    for (const id of ids) loadOne(id);
  }

  function preloadRoster(list: CharacterDef[]) {
    for (const def of list) {
      setThumbs((prev) => (prev[def.id] ? prev : { ...prev, [def.id]: letterThumb(def.label) }));
      if (started.current.has(def.id) || assetsRef.current[def.id]) continue;
      if (phone && def.heavy) continue;
      loadOne(def.id);
    }
  }

  /** İlk tık: hazırsa hemen ekle; değilse yükle, bitince otomatik ekle. */
  function addOrFetch(id: string) {
    if (store.battle) {
      store.note = "Savaş sürüyor. Durdurunca eklenir.";
      store.bump();
      return;
    }
    const def = characterById(id);
    if (!def) return;
    if (failed[id]) {
      store.note = "Bu model açılmadı.";
      store.bump();
      return;
    }
    const n = Math.max(1, counts[id] ?? 1);
    const asset = assetsRef.current[id];
    if (asset) {
      spawnUnits(store, def, asset.radius, n);
      return;
    }
    pendingAdd.current.set(id, (pendingAdd.current.get(id) ?? 0) + n);
    store.note = `${def.label} yükleniyor → ${n} eklenecek…`;
    store.bump();
    loadOne(id);
  }

  // Kayıtlı sahnedeki GLB'leri önceden çek — Load'da yalnız daire kalmasın
  useEffect(() => {
    ensureModels(peekSavedModels());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected(store);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll(store);
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
  const standing = store.units.filter((unit) => unit.alive).length;
  const selectedInTeam = store.units.some((unit) => unit.alive && unit.team > 0 && store.selected.has(unit.id));
  const selectedNamed = store.units.some((unit) => unit.alive && unit.name && store.selected.has(unit.id));
  const teamCounts = TEAMS.map((item) => ({
    ...item,
    n: store.units.filter((unit) => unit.alive && unit.team === item.id).length,
  }));

  function stopRecord() {
    if (recorder.current && recorder.current.state === "recording") recorder.current.stop();
    store.recording = false;
    store.recordMode = null;
    store.fitMapOnce = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }

  function toggleRecord(mode: "reel" | "map") {
    if (recorder.current && recorder.current.state === "recording") {
      stopRecord();
      return;
    }
    const stage = document.querySelector(".edit-stage") as HTMLElement | null;
    const canvas = document.querySelector(".edit-stage canvas") as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== "function") {
      store.note = "Bu tarayıcı kaydı desteklemiyor.";
      store.bump();
      return;
    }
    const reel = document.createElement("canvas");
    reel.width = REEL_WIDTH;
    reel.height = REEL_HEIGHT;
    const flat = reel.getContext("2d", { alpha: false });
    if (!flat) {
      store.note = "Bu tarayıcı kaydı desteklemiyor.";
      store.bump();
      return;
    }
    let copying = true;
    const copyFrame = () => {
      if (!copying) return;
      const sw = canvas.width;
      const sh = canvas.height;
      if (sw > 0 && sh > 0) {
        // Ekran geniş olsa da dosya her zaman 9:16 reels
        const crop = reelWindow(sw, sh, store.reelU, store.reelV);
        flat.drawImage(canvas, crop.x, crop.y, crop.frameW, crop.frameH, 0, 0, REEL_WIDTH, REEL_HEIGHT);
      }
      requestAnimationFrame(copyFrame);
    };
    copyFrame();
    const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((item) => MediaRecorder.isTypeSupported(item)) || "";
    const stream = reel.captureStream(30);
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    } catch {
      copying = false;
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
      copying = false;
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = type.includes("mp4") ? (mode === "map" ? "wargame-edit-map.mp4" : "wargame-edit.mp4") : mode === "map" ? "wargame-edit-map.webm" : "wargame-edit.webm";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setRecordMode(null);
      recorder.current = null;
      store.recording = false;
      store.recordMode = null;
      store.fitMapOnce = false;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      store.note = "9:16 reels kaydı indirildi.";
      store.bump();
    };
    rec.start(250);
    recorder.current = rec;
    store.recording = true;
    store.recordMode = mode;
    store.fitMapOnce = mode === "map";
    setRecording(true);
    setRecordMode(mode);
    if (mode === "map" && stage?.requestFullscreen) {
      void stage.requestFullscreen().catch(() => undefined);
    }
    store.note =
      mode === "map"
        ? "Kayıt2: tam harita ekranda · dosya 9:16. Ok/Q-E/R-F/+- · Durdur."
        : "Kayıt: Ok kaydır · Q/E dön · R/F eğim · +/- zoom. Çerçeve senin kameran.";
    store.bump();
  }

  const rosterList = tab === "mafya" ? CHARACTERS2 : CHARACTERS;

  function toggleTab(next: RosterTab) {
    setTab((cur) => {
      const open = cur === next ? null : next;
      if (open === "mafya") preloadRoster(CHARACTERS2);
      return open;
    });
  }

  return (
    <div className="edit-page" data-rev={rev}>
      <header className="edit-bar">
        <button type="button" className={tab === "chars" ? "on" : ""} onClick={() => toggleTab("chars")}>
          Karakterler
        </button>
        <button type="button" className={tab === "mafya" ? "on" : ""} onClick={() => toggleTab("mafya")}>
          Karakterler2
        </button>
        <button type="button" className={tab === "ground" ? "on" : ""} onClick={() => toggleTab("ground")}>
          Zemin
        </button>
        <div className="edit-teams" aria-label="Takımlar">
          {TEAMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={team === item.id ? "on" : ""}
              title="İlk tık rengi seçer, ikinci tık takımın askerlerini seçer"
              onClick={() => {
                if (team === item.id && teamCounts[item.id - 1]?.n) selectTeam(store, item.id);
                else setTeam(item.id);
              }}
            >
              <i style={{ background: item.color }} />
              {item.label}
              {teamCounts[item.id - 1]?.n ? ` ${teamCounts[item.id - 1].n}` : ""}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => assignTeam(store, team)} disabled={!selected}>
          Takım olsun
        </button>
        <button type="button" onClick={() => unassignTeam(store)} disabled={!selectedInTeam}>
          Takımdan çıkar
        </button>
        <button
          type="button"
          className={store.placeMode === "team" ? "on" : ""}
          onClick={() => setPlaceMode(store, "team")}
          title="Tıklayınca bütün takım birlikte gider"
        >
          Takım taşı
        </button>
        <button
          type="button"
          className={store.placeMode === "member" ? "on" : ""}
          onClick={() => setPlaceMode(store, "member")}
          title="Seçili tek üyeyi tıklanan yere koy (takımda kalır)"
        >
          Üye taşı
        </button>
        <button type="button" onClick={() => nudgeSelected(store, 0, 0.9)} disabled={!selected} title="Takımda öne">
          Öne
        </button>
        <button type="button" onClick={() => nudgeSelected(store, 0, -0.9)} disabled={!selected} title="Takımda arkaya">
          Arkaya
        </button>
        <button type="button" onClick={() => nudgeSelected(store, -0.9, 0)} disabled={!selected}>
          Sola kaydır
        </button>
        <button type="button" onClick={() => nudgeSelected(store, 0.9, 0)} disabled={!selected}>
          Sağa kaydır
        </button>
        <button type="button" onClick={() => resetSlotOffsets(store)} disabled={!selected}>
          Nizam sıfırla
        </button>
        <button type="button" onClick={() => rotateSelected(store, -Math.PI / 8)} disabled={!selected}>
          ↺ Yön
        </button>
        <button type="button" onClick={() => rotateSelected(store, Math.PI / 8)} disabled={!selected}>
          Yön ↻
        </button>
        <button type="button" className="edit-vs" onClick={() => startBattle(store)}>
          {store.battle ? "Savaşı durdur" : "VS"}
        </button>
        <button
          type="button"
          className="edit-save"
          onClick={() => {
            saveScene(store);
            setSaveList(listSaves());
          }}
          disabled={recording}
          title="Sahneyi bu tarayıcıya kaydet (yeni kayıt)"
        >
          Save
        </button>
        <button
          type="button"
          className="edit-load"
          onClick={() => {
            setSaveList(listSaves());
            setLoadOpen(true);
          }}
          disabled={recording || !hasSavedScene()}
          title="Kayıtlardan birini seçip yükle"
        >
          Load
        </button>
        <button
          type="button"
          className={recording && recordMode === "reel" ? "edit-rec on" : "edit-rec"}
          onClick={() => toggleRecord("reel")}
          disabled={recording && recordMode === "map"}
        >
          {recording && recordMode === "reel" ? "Kaydı durdur" : "Kayıt"}
        </button>
        <button
          type="button"
          className={recording && recordMode === "map" ? "edit-rec on" : "edit-rec2"}
          onClick={() => toggleRecord("map")}
          disabled={recording && recordMode === "reel"}
          title="Tam harita ekranda izle, dosya yine 9:16 reels"
        >
          {recording && recordMode === "map" ? "Kaydı durdur" : "Kayıt2"}
        </button>
        <button type="button" onClick={() => selectAll(store)} disabled={!standing}>
          Hepsini seç
        </button>
        <button type="button" onClick={() => removeSelected(store)} disabled={!selected}>
          Sil
        </button>
        <button type="button" onClick={() => clearField(store)} disabled={!store.units.length || recording}>
          Haritayı temizle
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
        <button type="button" onClick={() => clearNames(store)} disabled={!selectedNamed}>
          Adı kaldır
        </button>
        <span className="edit-note">
          Seçili {selected}
          {store.battle ? " · savaşta" : ""} · {store.note}
        </span>
      </header>

      <p className="edit-help">
        Üye taşı ile konan birim sabitlenir; Nizam sıfırla demeden toplu taşımada kıpırdamaz. Save her seferinde yeni kayıt ekler; Load listeden seçer (yeniden eskiye). Kayıt2: tam harita, indirme 9:16.
      </p>

      {loadOpen && (
        <div className="edit-modal" role="dialog" aria-modal="true" aria-label="Kayıt seç">
          <div className="edit-modal-card">
            <header>
              <strong>Kayıt seç</strong>
              <button type="button" onClick={() => setLoadOpen(false)}>
                Kapat
              </button>
            </header>
            <p className="edit-modal-hint">Yeniden eskiye · tıkla yükle</p>
            <ul className="edit-save-list">
              {saveList.length === 0 ? (
                <li className="empty">Kayıt yok.</li>
              ) : (
                saveList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="edit-save-pick"
                      onClick={() => {
                        ensureModels(peekSavedModelsFor(item.id));
                        if (!loadScene(store, item.id)) return;
                        ensureModels([...new Set(store.units.map((unit) => unit.model))]);
                        const pending = store.units.some((unit) => unit.alive && !assets[unit.model]);
                        if (pending) {
                          store.note = `${store.note} · modeller yükleniyor…`;
                          store.bump();
                        }
                        setLoadOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      <em>{item.units} birim</em>
                    </button>
                    <button
                      type="button"
                      className="edit-save-del"
                      title="Bu kaydı sil"
                      onClick={() => {
                        deleteSave(item.id);
                        const next = listSaves();
                        setSaveList(next);
                        if (!next.length) setLoadOpen(false);
                        store.bump();
                      }}
                    >
                      Sil
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="edit-stage">
        {recording && recordMode === "reel" && <div className="edit-reel-frame" aria-hidden="true" />}
        {recording && recordMode === "map" && (
          <div className="edit-fs-hud" role="toolbar" aria-label="Tam ekran kontroller">
            <button type="button" className="edit-vs" onClick={() => startBattle(store)}>
              {store.battle ? "Savaşı durdur" : "VS"}
            </button>
            <button type="button" className="edit-rec on" onClick={() => toggleRecord("map")}>
              Kaydı durdur
            </button>
            <span className="edit-fs-hint">WASD / Ok · Q-E · R-F · +/-</span>
          </div>
        )}
        {(tab === "chars" || tab === "mafya") && (
          <section className="edit-roster" aria-label={tab === "mafya" ? "Karakterler2" : "Karakter listesi"}>
            {rosterList.map((def) => {
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
                      max={200}
                      value={counts[def.id] ?? 1}
                      onChange={(event) => setCounts((prev) => ({ ...prev, [def.id]: Math.max(1, Math.min(200, Number(event.target.value) || 1)) }))}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={store.battle || Boolean(failed[def.id])}
                    onClick={() => addOrFetch(def.id)}
                  >
                    {ready ? "Ekle" : failed[def.id] ? "Yok" : started.current.has(def.id) ? "Yüklenip eklenecek…" : "Getir / Ekle"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
        {tab === "ground" && (
          <section className="edit-roster edit-grounds" aria-label="Zemin seçimi">
            {GROUNDS.map((g) => (
              <article key={g.id}>
                <div className="edit-thumb" style={{ background: g.color }} />
                <strong>{g.label}</strong>
                <button type="button" className={store.ground === g.id ? "on" : ""} onClick={() => setGround(store, g.id)}>
                  {store.ground === g.id ? "Seçili" : "Seç"}
                </button>
              </article>
            ))}
          </section>
        )}
        <SceneErrorBoundary>
          <Canvas
            dpr={1}
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false, depth: true }}
            camera={{ fov: 42, near: 0.25, far: 420, position: [16, 24, 30] }}
            performance={{ min: 0.5 }}
          >
            <EditField store={store} assets={assets} />
          </Canvas>
        </SceneErrorBoundary>
        <div id="edit-marquee" className="edit-marquee" />
        {store.note ? <p className="edit-float-note">{store.note}</p> : null}
      </div>
    </div>
  );
}
