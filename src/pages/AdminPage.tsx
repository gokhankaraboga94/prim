import { FormEvent, useState } from "react";
import { signOut } from "firebase/auth";
import { push, ref, remove, set } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase";
import {
  assignNames,
  formatCount,
  formatPower,
  namedCount,
  normalizeHandle,
  parseNameList,
  removeSoldierName,
  renameSoldier,
  targetForLevel,
  toGameRecord,
  type ReelItem,
} from "../game";
import { useGame } from "../hooks/useGame";
import { ReelCapture } from "../components/ReelCapture";
import { REEL_DURATIONS, type ReelDuration } from "../recordCanvas";

export function AdminPage() {
  const { game, recruits, reels, level, power, pressure, target, maxHp } = useGame();
  const [soldiersInput, setSoldiersInput] = useState("");
  const [addInput, setAddInput] = useState("");
  const [namesInput, setNamesInput] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [reelUrl, setReelUrl] = useState("");
  const [reelCaption, setReelCaption] = useState("");
  const [reelType, setReelType] = useState<"image" | "video">("image");
  const [preview, setPreview] = useState<ReelItem | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [reelSeconds, setReelSeconds] = useState<ReelDuration>(7);
  const [capturing, setCapturing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handle = handleInput || game.instagramHandle;

  async function saveSoldiers(next: number) {
    const soldiers = Math.max(0, Math.floor(next));
    const payload = toGameRecord(game, Date.now(), { soldiers });
    await set(ref(db, "game"), payload);
    setMsg(
      payload.castleLevel > game.castleLevel
        ? `Ordu ${formatCount(soldiers)}. Kale seviye ${payload.castleLevel} — hedef ${formatCount(targetForLevel(payload.castleLevel))}.`
        : `Ordu güncellendi: ${formatCount(soldiers)} asker. Kale gücü ${formatPower(payload.castleHp)}.`
    );
  }

  async function onSetSoldiers(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSoldiers(Number(soldiersInput));
      setSoldiersInput("");
    } catch {
      setMsg("Asker sayısı yazılamadı. Firebase kurallarını kontrol et.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddSoldiers(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const extra = Math.max(0, Math.floor(Number(addInput || 0)));
      const incoming = parseNameList(namesInput);
      const soldiers = game.soldiers + extra;
      const names = incoming.length ? assignNames(game.names, soldiers, incoming) : game.names;
      const payload = toGameRecord(game, Date.now(), { soldiers, names });
      await set(ref(db, "game"), payload);
      setAddInput("");
      if (incoming.length) setNamesInput("");
      setMsg(
        incoming.length
          ? `${extra} asker eklendi, ${incoming.length} isim isimsizlere atandı.`
          : `Orduya ${extra} asker eklendi.`
      );
    } catch {
      setMsg("Asker eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function onAssignNames(e: FormEvent) {
    e.preventDefault();
    const incoming = parseNameList(namesInput);
    if (!incoming.length) {
      setMsg("Virgül, boşluk veya alt alta kullanıcı adı yaz.");
      return;
    }
    setBusy(true);
    try {
      const names = assignNames(game.names, game.soldiers, incoming);
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { names }));
      setNamesInput("");
      const filled = namedCount(names, game.soldiers) - namedCount(game.names, game.soldiers);
      setMsg(`${Math.max(0, filled)} isim rastgele isimsiz askerlere yazıldı.`);
    } catch {
      setMsg("İsimler kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNames(names: string[], ok: string) {
    setBusy(true);
    try {
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { names }));
      setEditIndex(null);
      setEditValue("");
      setMsg(ok);
    } catch {
      setMsg("İsim güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(index: number, name: string) {
    setEditIndex(index);
    setEditValue(name);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (editIndex == null) return;
    const next = normalizeHandle(editValue);
    if (!next) {
      setMsg("Kullanıcı adı boş olamaz. Silmek için Sil’e bas.");
      return;
    }
    const clash = game.names.findIndex((n, i) => i !== editIndex && n.toLowerCase() === next.toLowerCase());
    if (clash >= 0) {
      setMsg(`@${next} zaten listede.`);
      return;
    }
    await saveNames(renameSoldier(game.names, game.soldiers, editIndex, next), `@${next} güncellendi.`);
  }

  async function onDeleteName(index: number, name: string) {
    await saveNames(removeSoldierName(game.names, game.soldiers, index), `@${name} silindi.`);
  }

  async function onSaveHandle(e: FormEvent) {
    e.preventDefault();
    const instagramHandle = normalizeHandle(handleInput);
    if (!instagramHandle) {
      setMsg("Instagram kullanıcı adı gerekli.");
      return;
    }
    setBusy(true);
    try {
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { instagramHandle }));
      setHandleInput("");
      setMsg(`Anasayfada @${instagramHandle} görünecek.`);
    } catch {
      setMsg("Hesap adı kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function addReel(url: string, type: "image" | "video", caption: string) {
    await push(ref(db, "reels"), {
      url,
      type,
      caption: caption.trim(),
      createdAt: Date.now(),
    });
  }

  async function onAddReelUrl(e: FormEvent) {
    e.preventDefault();
    if (!reelUrl.trim()) return;
    setBusy(true);
    try {
      await addReel(reelUrl.trim(), reelType, reelCaption);
      setReelUrl("");
      setReelCaption("");
      setMsg("Reels eklendi.");
    } catch {
      setMsg("Reels kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadReel(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const path = `reels/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const type = file.type.startsWith("video") ? "video" : "image";
      await addReel(url, type, reelCaption);
      setReelCaption("");
      setMsg("Görüntü yüklendi.");
    } catch {
      setMsg("Yükleme başarısız. Storage kurallarını yayınla veya URL kullan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReel(id: string) {
    await remove(ref(db, `reels/${id}`));
  }

  return (
    <div className="admin-app">
      <header className="admin-top">
        <div>
          <p className="join-kicker">Komuta paneli</p>
          <h1>Kuşatma yönetimi</h1>
        </div>
        <button type="button" className="btn-ghost" onClick={() => signOut(auth)}>
          Çıkış
        </button>
      </header>

      <section className="admin-metrics">
        <article>
          <span>Asker</span>
          <b>{formatCount(game.soldiers)}</b>
        </article>
        <article>
          <span>Kale gücü</span>
          <b>{formatPower(power)}</b>
        </article>
        <article>
          <span>Seviye / hedef</span>
          <b>
            {level} · {formatCount(target)}
          </b>
        </article>
        <article>
          <span>Yıpranma</span>
          <b>%{Math.round(pressure * 100)}</b>
        </article>
        <article>
          <span>İsimli asker</span>
          <b>
            {namedCount(game.names, game.soldiers)} / {formatCount(game.soldiers)}
          </b>
        </article>
      </section>

      {msg && <p className="admin-msg">{msg}</p>}

      <div className="admin-grid">
        <section className="admin-card">
          <h2>Asker sayısı</h2>
          <p className="muted">
            Instagram takipçi sayınla eşitle. 1. seviye hedef 10.000, 2. seviye 50.000. Kale gücü 24/7
            yavaşça erir; 10.000 asker yaklaşık 12 günde 1. seviyeyi düşürür.
          </p>
          <form onSubmit={onSetSoldiers}>
            <label>Toplam asker / takipçi</label>
            <input
              type="number"
              min={0}
              placeholder={String(game.soldiers)}
              value={soldiersInput}
              onChange={(e) => setSoldiersInput(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              Orduyu ayarla
            </button>
          </form>
          <form onSubmit={onAddSoldiers}>
            <label>Asker ekle</label>
            <input
              type="number"
              min={1}
              placeholder="Örn. 50"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              Ekle
            </button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Asker kullanıcı adları</h2>
          <p className="muted">
            Virgül, boşluk veya alt alta yaz. İsimsiz askerlere rastgele dağılır. 13 takipçi adı
            yazarsan 13 isimsiz askerin üstüne @ad gelir. Yeni 5 asker ekleyip 5 isim verirsen
            o isimsizler bu adları alır.
          </p>
          <form onSubmit={onAssignNames}>
            <label>@kullanıcıadları</label>
            <textarea
              rows={6}
              placeholder={"kullanici1\nkullanici2\nkullanici3"}
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              İsimleri ata
            </button>
          </form>
          <p className="muted">
            {namedCount(game.names, game.soldiers)} isimli ·{" "}
            {Math.max(0, game.soldiers - namedCount(game.names, game.soldiers))} isimsiz
          </p>
          <ul className="name-list">
            {game.names.map((name, index) =>
              name ? (
                <li key={`${index}-${name}`}>
                  {editIndex === index ? (
                    <form className="name-edit" onSubmit={(e) => void onSaveEdit(e)}>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        aria-label="Kullanıcı adını düzenle"
                      />
                      <button className="btn-gold" disabled={busy}>
                        Kaydet
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setEditIndex(null);
                          setEditValue("");
                        }}
                      >
                        İptal
                      </button>
                    </form>
                  ) : (
                    <>
                      <span>@{name}</span>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => startEdit(index, name)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => void onDeleteName(index, name)}
                      >
                        Sil
                      </button>
                    </>
                  )}
                </li>
              ) : null
            )}
          </ul>
        </section>

        <section className="admin-card">
          <h2>Instagram hesabı</h2>
          <p className="muted">Anasayfanın üstünde ve “takip et” butonunda bu ad yazılır.</p>
          <form onSubmit={onSaveHandle}>
            <label>Hesap</label>
            <textarea
              rows={2}
              placeholder={`@${game.instagramHandle}`}
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              Kaydet
            </button>
          </form>
          <p className="muted">Şu an: @{handle.replace(/^@/, "")}</p>
        </section>

        <section className="admin-card">
          <h2>Ekran kaydı</h2>
          <p className="muted">
            iPhone’da Kaydı başlat: anasayfa kuşatması tam ekran açılır, en iyi kamera açısıyla
            otomatik kayıt alınır. Bitince Kaydet / Paylaş ile cihaza indir.
          </p>
          <label>Süre</label>
          <div className="dur-pills">
            {REEL_DURATIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                className={reelSeconds === sec ? "on" : ""}
                onClick={() => setReelSeconds(sec)}
              >
                {sec} sn
              </button>
            ))}
          </div>
          <button type="button" className="btn-gold" onClick={() => setCapturing(true)}>
            Kaydı başlat
          </button>
        </section>

        <section className="admin-card admin-span">
          <h2>Reels görüntüleri</h2>
          <p className="muted">Anasayfada Reels moduyla kaydırarak geçilir. Video veya görsel ekle.</p>
          <form onSubmit={onAddReelUrl} className="reel-form">
            <label>Görsel / video URL</label>
            <input
              value={reelUrl}
              onChange={(e) => setReelUrl(e.target.value)}
              placeholder="https://..."
            />
            <label>Altyazı</label>
            <input value={reelCaption} onChange={(e) => setReelCaption(e.target.value)} />
            <label>Tür</label>
            <select value={reelType} onChange={(e) => setReelType(e.target.value as "image" | "video")}>
              <option value="image">Görsel</option>
              <option value="video">Video</option>
            </select>
            <button className="btn-gold" disabled={busy}>
              URL ekle
            </button>
          </form>
          <label className="file-btn">
            Dosya yükle
            <input
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                void onUploadReel(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>
          <ul className="reel-list">
            {reels.map((item) => (
              <li key={item.id}>
                <button type="button" className="thumb" onClick={() => setPreview(item)}>
                  {item.type === "video" ? "Video" : "Görsel"}
                </button>
                <span>{item.caption || item.url.slice(0, 48)}</span>
                <button type="button" className="btn-ghost" onClick={() => void deleteReel(item.id)}>
                  Sil
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-card">
          <h2>Katılan askerler</h2>
          <ul className="recruit-list">
            {recruits.length === 0 && <li className="muted">Henüz gönüllü yok.</li>}
            {recruits.map((r) => (
              <li key={r.id}>@{r.username}</li>
            ))}
          </ul>
        </section>
      </div>

      {preview && (
        <div className="preview-overlay" onClick={() => setPreview(null)}>
          {preview.type === "video" ? (
            <video src={preview.url} controls autoPlay />
          ) : (
            <img src={preview.url} alt={preview.caption || "Reels"} />
          )}
        </div>
      )}

      {capturing && (
        <ReelCapture
          soldiers={game.soldiers}
          names={game.names}
          level={level}
          pressure={pressure}
          hp={power}
          maxHp={maxHp}
          handle={game.instagramHandle}
          seconds={reelSeconds}
          onClose={() => setCapturing(false)}
        />
      )}
    </div>
  );
}
