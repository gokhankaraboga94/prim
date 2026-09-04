import { FormEvent, useState } from "react";
import { signOut } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../firebase";
import {
  compactCommanders,
  enlistWithNames,
  formatCount,
  isCommander,
  retargetCommander,
  formatPower,
  namedCount,
  normalizeHandle,
  parseNameList,
  removeSoldierName,
  renameSoldier,
  targetForLevel,
  toGameRecord,
} from "../game";
import { useGame } from "../hooks/useGame";
import { ReelCapture } from "../components/ReelCapture";
import { REEL_DURATIONS, type ReelDuration } from "../recordCanvas";

export function AdminPage() {
  const { game, recruits, level, power, pressure, target, maxHp } = useGame();
  const [soldiersInput, setSoldiersInput] = useState("");
  const [addInput, setAddInput] = useState("");
  const [namesInput, setNamesInput] = useState("");
  const [cmdDraft, setCmdDraft] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [reelSeconds, setReelSeconds] = useState<ReelDuration>(7);
  const [reelText, setReelText] = useState(true);
  const [reelDay, setReelDay] = useState("1");
  const [capturing, setCapturing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const handle = handleInput || game.instagramHandle;
  const cmdValue = cmdDraft ?? game.commanders.join("\n");

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
    const extra = Math.max(0, Math.floor(Number(addInput || 0)));
    const incoming = parseNameList(namesInput);
    if (!extra && !incoming.length) {
      setMsg("Asker sayısı veya kullanıcı adı yaz.");
      return;
    }
    setBusy(true);
    try {
      const next = enlistWithNames(game.names, game.soldiers, incoming, extra);
      const payload = toGameRecord(game, Date.now(), { soldiers: next.soldiers, names: next.names });
      await set(ref(db, "game"), payload);
      setAddInput("");
      if (incoming.length) setNamesInput("");
      setMsg(
        next.named
          ? `${next.added} asker eklendi, ${next.named} isim verildi.`
          : next.added
            ? `Orduya ${next.added} asker eklendi.`
            : "Bu kullanıcı adları zaten orduda."
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
      const next = enlistWithNames(game.names, game.soldiers, incoming);
      if (!next.added) {
        setNamesInput("");
        setMsg("Bu kullanıcı adları zaten orduda.");
        return;
      }
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { soldiers: next.soldiers, names: next.names }));
      setNamesInput("");
      setMsg(`${next.named} asker oluşturuldu ve isimleri verildi.`);
    } catch {
      setMsg("İsimler kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNames(names: string[], ok: string, commanders = game.commanders) {
    setBusy(true);
    try {
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { names, commanders }));
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
    await saveNames(
      renameSoldier(game.names, game.soldiers, editIndex, next),
      `@${next} güncellendi.`,
      retargetCommander(game.commanders, game.names[editIndex], next)
    );
  }

  async function onSaveCommanders(e: FormEvent) {
    e.preventDefault();
    const incoming = parseNameList(cmdValue);
    const commanders = compactCommanders(incoming, game.names);
    const missing = incoming.filter(
      (n) => !commanders.some((c) => c.toLowerCase() === n.toLowerCase())
    );
    setBusy(true);
    try {
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { commanders }));
      setCmdDraft(null);
      if (!incoming.length) {
        setMsg("Komutan kalmadı.");
      } else if (missing.length) {
        setMsg(
          `${commanders.length} komutan kaydedildi. Orduda yok: ${missing.map((n) => `@${n}`).join(", ")}`
        );
      } else {
        setMsg(`${commanders.map((n) => `@${n}`).join(", ")} komutan.`);
      }
    } catch {
      setMsg("Komutan kaydedilemedi.");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="admin-app">
      <header className="admin-top">
        <div>
          <p className="join-kicker">Komuta paneli</p>
          <h1>Kuşatma yönetimi</h1>
          <p className="join-kicker">sürüm 7 — parlament mavi kısa pelerin</p>
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
            Virgül, boşluk veya alt alta yaz. Asker ekle demeden isim yazarsan o kadar yeni asker
            oluşur ve bu adlar verilir. Zaten listedeki adlar tekrar eklenmez.
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
              Asker oluştur
            </button>
          </form>
          <form onSubmit={onSaveCommanders}>
            <label>Komutanlar</label>
            <p className="muted">
              Ordudaki kullanıcılardan bir veya daha fazla ad yaz. Listedekiler komutan olur; adı
              silinen komutanlıktan çıkar.
            </p>
            <textarea
              rows={4}
              placeholder={"komutan1\nkomutan2"}
              value={cmdValue}
              onChange={(e) => setCmdDraft(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              Komutanları kaydet
            </button>
          </form>
          <p className="muted">
            {namedCount(game.names, game.soldiers)} isimli ·{" "}
            {Math.max(0, game.soldiers - namedCount(game.names, game.soldiers))} isimsiz ·{" "}
            {game.commanders.length} komutan
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setListOpen((open) => !open)}
          >
            {listOpen ? "Listeyi gizle" : "Kullanıcı listesini aç"}
          </button>
          {listOpen && (
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
                      <span className={isCommander(name, game.commanders) ? "cmd" : undefined}>@{name}</span>
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
          )}
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
          <label>Gün</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={reelDay}
            onChange={(e) => setReelDay(e.target.value)}
            placeholder="5"
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={reelText}
              onChange={(e) => setReelText(e.target.checked)}
            />
            Yazı olsun mu
          </label>
          <button type="button" className="btn-gold" onClick={() => setCapturing(true)}>
            Kaydı başlat
          </button>
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

      {capturing && (
        <ReelCapture
          soldiers={game.soldiers}
          names={game.names}
          commanders={game.commanders}
          level={level}
          pressure={pressure}
          hp={power}
          maxHp={maxHp}
          seconds={reelSeconds}
          showTitles={reelText}
          day={Math.max(0, Math.floor(Number(reelDay)) || 0)}
          onClose={() => setCapturing(false)}
        />
      )}
    </div>
  );
}
