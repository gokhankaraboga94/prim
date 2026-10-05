import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  removeSoldier,
  removeSoldiersByNames,
  renameSoldier,
  targetForLevel,
  toGameRecord,
} from "../game";
import { useGame } from "../hooks/useGame";
import { ReelCapture } from "../components/ReelCapture";
import { REEL_DURATIONS } from "../recordCanvas";
import { CINEMA_DURATIONS, CINEMA_ID, CINEMA_MODE, SHOT_MODES, type ReelShot } from "../shotModes";
import { HOOK_ID, HOOK_MODE, JOIN_ID, JOIN_MODE, ROSTER_ID, ROSTER_MODE, ensureJoinMark, finishJoinBacklogIfCaughtUp, isJoin, isPlanB, joinQueue, rosterDuration, saveJoinMark, setJoinForcePack, wipeJoinCacheAfter317, type PlanBId } from "../rosterReel";
import { SAGA_MODES, isSaga, sagaDuration, type SagaId } from "../sagaReel";
import { DISCOVER_ID, DISCOVER2_ID, DISCOVER3_ID, RAF2_ID, DISCOVER_MODE, DISCOVER2_MODE, DISCOVER3_MODE, RAF2_MODE, DISCOVER_SECONDS, DISCOVER3_SECONDS, RAF2_SECONDS, isDiscover, isDiscoverEngage, isDiscoverShelf, isDiscoverTrailer, type DiscoverId } from "../discoverReel";
import { MIX_MODES, MIX_SECONDS, MIX9_SECONDS, isMix, isMix9, type MixId } from "../mixReel";
import { COUNTDOWN_ID, COUNTDOWN_MODE, COUNTDOWN_SECONDS, isCountdown, type CountdownId } from "../countdownReel";
import { HARIKA2_SECONDS, SPIN_SECONDS, XXX_MODES, XXX_SECONDS, XXXV_SECONDS, isXxx, xxxHideCmd, xxxSeconds, type XxxId } from "../xxxReel";
import { DEFEND_ID, DEFEND2_ID, DEFEND3_ID, DEFEND4_ID, DEFEND_MODE, DEFEND2_MODE, DEFEND3_MODE, DEFEND4_MODE, DEFEND_SECONDS, DEFEND2_SECONDS, DEFEND3_SECONDS, DEFEND4_SECONDS, isDefend, isDefend2, isDefend3, isDefend4, isDefendSortie, type DefendId } from "../defendReel";
import { VS_ID, VS2_ID, VS_MODE, VS2_MODE, VS_SECONDS, VS2_SECONDS, isVs, isVs2, isVsMode, type VsId } from "../vsReel";
import { NEW1_ID, NEW1_MODE, NEW1_SECONDS, NEW2_ID, NEW2_MODE, NEW2_SECONDS, NEW3_ID, NEW3_MODE, NEW3_SECONDS, NEW4_ID, NEW4_MODE, NEW4_SECONDS, NEW5_ID, NEW5_MODE, NEW5_SECONDS, NEW6_ID, NEW6_MODE, NEW6_SECONDS, NEW62_ID, NEW62_MODE, NEW62_SECONDS, NEW7_ID, NEW7_MODE, NEW7_SECONDS, isNew1, isNew2, isNew3, isNew4, isNew5, isNew6, isNew62, isNew7, isNewField, type New1Id, type New2Id, type New3Id, type New4Id, type New5Id, type New6Id, type New62Id, type New7Id } from "../new1Reel";
import { LAB_ID, LAB_MODE, LAB_SECONDS, isLab, type LabId } from "../mazeReel";
import { DEV2_ID, DEV2_MODE, DEV2_SECONDS, DEV3_ID, DEV3_MODE, DEV3_SECONDS, DEV4_ID, DEV4_MODE, DEV4_SECONDS, DEV5_ID, DEV5_MODE, DEV5_SECONDS, DEV_ID, DEV_MODE, DEV_SECONDS, DEVS_ID, DEVS_MODE, DEVS_SECONDS, SNAKE_ID, SNAKE_MODE, SNAKE_SECONDS, isDev, isDev2, isDev3, isDev4, isDev5, isDevs, isGiantShot, isSnake, type Dev2Id, type Dev3Id, type Dev4Id, type Dev5Id, type DevId, type DevsId, type SnakeId } from "../devReel";
import { FILM_ID, FILM_MODE, FILM_SECONDS, isFilm, type FilmId } from "../filmReel";
import { DRAGON_ID, DRAGON_MODE, DRAGON_SECONDS, isDragon, type DragonId } from "../dragonReel";
import { unlockReelSfx } from "../reelSfx";

function skippedNote(skipped: string[]): string {
  if (!skipped.length) return "";
  const shown = skipped.slice(0, 12).map((n) => `@${n}`).join(", ");
  const more = skipped.length > 12 ? ` ve ${skipped.length - 12} ad daha` : "";
  return `Listede var, geçildi: ${shown}${more}.`;
}

export function AdminPage() {
  const { game, recruits, level, power, pressure, target, maxHp } = useGame();
  const [soldiersInput, setSoldiersInput] = useState("");
  const [addInput, setAddInput] = useState("");
  const [namesInput, setNamesInput] = useState("");
  const [dropInput, setDropInput] = useState("");
  const [cmdDraft, setCmdDraft] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [reelSeconds, setReelSeconds] = useState<number>(7);
  const [reelText, setReelText] = useState(true);
  const [reelSkipCmd, setReelSkipCmd] = useState(false);
  const [reelShot, setReelShot] = useState<ReelShot | PlanBId | SagaId | DiscoverId | MixId | CountdownId | DefendId | VsId | New1Id | New2Id | New3Id | New4Id | New5Id | New6Id | New62Id | New7Id | LabId | DevId | Dev2Id | Dev3Id | Dev4Id | Dev5Id | SnakeId | DevsId | FilmId | DragonId | XxxId | null>(null);
  const [reelDay, setReelDay] = useState("1");
  const [capturing, setCapturing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [joinTick, setJoinTick] = useState(0);
  const [joinLastTen, setJoinLastTen] = useState(true);
  const [joinExtras, setJoinExtras] = useState("");
  const [captureGen, setCaptureGen] = useState(0);
  const [captureSec, setCaptureSec] = useState(7);
  const captureJoinIds = useRef<number[]>([]);

  const handle = handleInput || game.instagramHandle;
  const cmdValue = cmdDraft ?? game.commanders.join("\n");
  const joinExtraNames = useMemo(() => parseNameList(joinExtras), [joinExtras]);
  const pendingJoin = useMemo(() => {
    ensureJoinMark(game.names, game.soldiers);
    return joinQueue(game.names, game.soldiers, joinLastTen, joinExtraNames);
  }, [game.names, game.soldiers, joinTick, joinLastTen, joinExtraNames]);

  useEffect(() => {
    ensureJoinMark(game.names, game.soldiers);
  }, [game.names, game.soldiers]);

  useEffect(() => {
    if (!isJoin(reelShot) || capturing) return;
    setReelSeconds(pendingJoin.seconds);
  }, [reelShot, pendingJoin.seconds, capturing]);

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
      const note = skippedNote(next.skipped);
      const lead = next.named
        ? `${next.named} yeni asker eklendi.`
        : next.added
          ? `Orduya ${next.added} asker eklendi.`
          : "";
      setMsg([lead, note].filter(Boolean).join(" ") || "Eklenecek yeni ad yok.");
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
      const note = skippedNote(next.skipped);
      if (!next.added && !next.named) {
        setNamesInput("");
        setMsg(note || "Bu kullanıcı adları zaten orduda.");
        return;
      }
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { soldiers: next.soldiers, names: next.names }));
      setNamesInput("");
      setMsg(
        [
          next.added ? `${next.named} asker oluşturuldu.` : `${next.named} isimsiz slota yazıldı.`,
          note,
        ]
          .filter(Boolean)
          .join(" ")
      );
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
        setMsg("Komutan listesi boş. Varsayılan @Wargame2028.");
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

  async function onDropNames(e: FormEvent) {
    e.preventDefault();
    const incoming = parseNameList(dropInput);
    if (!incoming.length) {
      setMsg("Silinecek kullanıcı adlarını alt alta veya virgülle yaz.");
      return;
    }
    const next = removeSoldiersByNames(game.names, game.soldiers, incoming);
    if (!next.removed.length) {
      setMsg("Bu adlardan hiçbiri orduda yok.");
      return;
    }
    setBusy(true);
    try {
      const commanders = compactCommanders(game.commanders, next.names);
      await set(ref(db, "game"), toGameRecord(game, Date.now(), {
        soldiers: next.soldiers,
        names: next.names,
        commanders,
      }));
      setDropInput("");
      const gone = next.removed.map((n) => `@${n}`).join(", ");
      const miss = next.missing.length
        ? ` Orduda yok: ${next.missing.map((n) => `@${n}`).join(", ")}.`
        : "";
      setMsg(`${next.removed.length} asker silindi (${gone}). Ordu ${formatCount(next.soldiers)}.${miss}`);
    } catch {
      setMsg("Askerler silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteName(index: number, name: string) {
    const next = removeSoldier(game.names, game.soldiers, index);
    setBusy(true);
    try {
      await set(ref(db, "game"), toGameRecord(game, Date.now(), { soldiers: next.soldiers, names: next.names }));
      setEditIndex(null);
      setEditValue("");
      setMsg(`@${name} silindi. Ordu ${formatCount(next.soldiers)} asker.`);
    } catch {
      setMsg("Asker silinemedi.");
    } finally {
      setBusy(false);
    }
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
          <p className="join-kicker">sürüm 109 — toplu isim sil</p>
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

      {msg && !capturing && <p className="admin-msg">{msg}</p>}

      {!capturing && <div className="admin-grid">
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
            Virgül, boşluk veya alt alta yaz. Listede olmayan adlar yeni asker olur.
            Listede olanlar eklenmez, listede var diye geçilir.
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
          <form onSubmit={onDropNames}>
            <label>İsim kaldır</label>
            <p className="muted">
              Yapıştırılan her ad ordudan çıkar, asker sayısı o kadar düşer.
              Listede yoksa dokunulmaz.
            </p>
            <textarea
              rows={8}
              placeholder={"babapiro5552\ndefne34529\neemirsmsk_"}
              value={dropInput}
              onChange={(e) => setDropInput(e.target.value)}
            />
            <button className="btn-gold" disabled={busy}>
              Bu isimleri sil
            </button>
          </form>
          <form onSubmit={onSaveCommanders}>
            <label>Komutanlar</label>
            <p className="muted">
              Liste boşsa komutan @Wargame2028. Ordudan bir veya daha fazla ad yazarsan onlar
              komutan olur; adı silinen komutanlıktan çıkar ve liste yine boşsa varsayılan döner.
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
            {game.commanders.length ? `${game.commanders.length} komutan` : "varsayılan @Wargame2028"}
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setListOpen((open) => !open)}
          >
            {listOpen ? "Listeyi gizle" : "Kullanıcı listesini aç"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const lines = game.names.filter(Boolean).map((name) => name.replace(/^@+/, ""));
              if (!lines.length) {
                setMsg("Dışarı aktarılacak kullanıcı adı yok.");
                return;
              }
              const text = `${lines.join("\n")}\n`;
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "kullanici-adlari.txt";
              a.click();
              URL.revokeObjectURL(url);
              void navigator.clipboard?.writeText(text).catch(() => undefined);
              setMsg(`${lines.length} kullanıcı adı dışarı aktarıldı.`);
            }}
          >
            Kullanıcı adlarını dışarı aktar
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
            {(
              reelShot === CINEMA_ID
                ? CINEMA_DURATIONS
                : isDiscoverTrailer(reelShot)
                  ? [DISCOVER3_SECONDS]
                  : isDiscoverShelf(reelShot)
                    ? [RAF2_SECONDS]
                  : isCountdown(reelShot)
                    ? [COUNTDOWN_SECONDS]
                  : isDragon(reelShot)
                    ? [DRAGON_SECONDS]
                  : isFilm(reelShot)
                    ? [FILM_SECONDS]
                  : isGiantShot(reelShot)
                    ? [isDevs(reelShot) ? DEVS_SECONDS : isSnake(reelShot) ? SNAKE_SECONDS : isDev5(reelShot) ? DEV5_SECONDS : isDev4(reelShot) ? DEV4_SECONDS : isDev3(reelShot) ? DEV3_SECONDS : isDev2(reelShot) ? DEV2_SECONDS : DEV_SECONDS]
                  : isNewField(reelShot)
                    ? [isLab(reelShot) ? LAB_SECONDS : isNew7(reelShot) ? NEW7_SECONDS : isNew62(reelShot) ? NEW62_SECONDS : isNew6(reelShot) ? NEW6_SECONDS : isNew5(reelShot) ? NEW5_SECONDS : isNew4(reelShot) ? NEW4_SECONDS : isNew3(reelShot) ? NEW3_SECONDS : isNew2(reelShot) ? NEW2_SECONDS : NEW1_SECONDS]
                  : isVsMode(reelShot)
                    ? [isVs2(reelShot) ? VS2_SECONDS : VS_SECONDS]
                  : isDefend4(reelShot)
                    ? [DEFEND4_SECONDS]
                  : isDefend3(reelShot)
                    ? [DEFEND3_SECONDS]
                  : isDefendSortie(reelShot)
                    ? [DEFEND2_SECONDS]
                  : isDefend(reelShot)
                    ? [DEFEND_SECONDS]
                  : isXxx(reelShot)
                    ? [xxxSeconds(reelShot)]
                  : isMix9(reelShot)
                    ? [MIX9_SECONDS]
                  : isMix(reelShot)
                    ? [MIX_SECONDS]
                  : isDiscover(reelShot)
                    ? [DISCOVER_SECONDS]
                  : isJoin(reelShot)
                    ? [pendingJoin.seconds]
                    : isPlanB(reelShot)
                      ? [rosterDuration(reelShot, namedCount(game.names, game.soldiers))]
                      : isSaga(reelShot)
                      ? [sagaDuration(reelShot)]
                      : REEL_DURATIONS
            ).map((sec) => (
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
          <label className="check-row">
            <input
              type="checkbox"
              checked={reelSkipCmd}
              onChange={(e) => setReelSkipCmd(e.target.checked)}
            />
            Komutansız kayıt
          </label>
          <p className="muted">
            İşaretlersen kayıt komutan yakın planı olmadan, kamera dönüşünden başlar. “X. GÜN” ve
            “KALE KUŞATILDI” o anda çıkar. İşaretlemezsen eski usül komutanla başlar.
          </p>
          <label>new1 — {NEW1_SECONDS}s</label>
          <p className="muted">
            Yazı yok. Kuş bakışı açık arazi. Düşman önden ve arkadan kalabalık basar, bizimkiler tek tek düşer.
            Kamera alçalınca kullanıcı adları okunur.
          </p>
          <div className="dur-pills shot-pills">
            <button
              type="button"
              className={reelShot === NEW1_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW1_ID ? null : NEW1_ID));
                setReelSeconds(NEW1_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW1_MODE.label} — {NEW1_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW2_ID ? null : NEW2_ID));
                setReelSeconds(NEW2_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW2_MODE.label} — {NEW2_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW3_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW3_ID ? null : NEW3_ID));
                setReelSeconds(NEW3_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW3_MODE.label} — {NEW3_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW4_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW4_ID ? null : NEW4_ID));
                setReelSeconds(NEW4_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW4_MODE.label} — {NEW4_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW5_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW5_ID ? null : NEW5_ID));
                setReelSeconds(NEW5_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW5_MODE.label} — {NEW5_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW6_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW6_ID ? null : NEW6_ID));
                setReelSeconds(NEW6_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW6_MODE.label} — {NEW6_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW62_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW62_ID ? null : NEW62_ID));
                setReelSeconds(NEW62_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW62_MODE.label} — {NEW62_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === NEW7_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === NEW7_ID ? null : NEW7_ID));
                setReelSeconds(NEW7_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {NEW7_MODE.label} — {NEW7_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === LAB_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === LAB_ID ? null : LAB_ID));
                setReelSeconds(LAB_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {LAB_MODE.label} — {LAB_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEV_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEV_ID ? null : DEV_ID));
                setReelSeconds(DEV_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEV_MODE.label} — {DEV_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEV2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEV2_ID ? null : DEV2_ID));
                setReelSeconds(DEV2_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEV2_MODE.label} — {DEV2_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEV3_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEV3_ID ? null : DEV3_ID));
                setReelSeconds(DEV3_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEV3_MODE.label} — {DEV3_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEV4_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEV4_ID ? null : DEV4_ID));
                setReelSeconds(DEV4_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEV4_MODE.label} — {DEV4_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEV5_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEV5_ID ? null : DEV5_ID));
                setReelSeconds(DEV5_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEV5_MODE.label} — {DEV5_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === SNAKE_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === SNAKE_ID ? null : SNAKE_ID));
                setReelSeconds(SNAKE_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {SNAKE_MODE.label} — {SNAKE_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEVS_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEVS_ID ? null : DEVS_ID));
                setReelSeconds(DEVS_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DEVS_MODE.label} — {DEVS_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DRAGON_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DRAGON_ID ? null : DRAGON_ID));
                setReelSeconds(DRAGON_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {DRAGON_MODE.label} — {DRAGON_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === FILM_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === FILM_ID ? null : FILM_ID));
                setReelSeconds(FILM_SECONDS);
                setReelText(false);
                setReelSkipCmd(true);
              }}
            >
              {FILM_MODE.label} — {FILM_SECONDS}s
            </button>
          </div>
          {isDev(reelShot) && (
            <p className="muted">Boş arazi, 300 asker, isimler üstte. Uzun siyah zırhlı dev. Yarısı kılıç ve mızrak, yarısı yay. Her vuruş 10-20 askeri siler. Üstte sayı düşer.</p>
          )}
          {isDev2(reelShot) && (
            <p className="muted">DEV ile aynı. Dev daha büyük, 450 asker, isimler daha iri. Her vuruş 10-20 askeri siler. Üstte sayı düşer.</p>
          )}
          {isDev3(reelShot) && (
            <p className="muted">DEV2 ile aynı. Bütün takipçiler sahnede, isimler iri. Devin kapattığı askerin adı görünmez. Üstte sayı düşer.</p>
          )}
          {isDev4(reelShot) && (
            <p className="muted">DEV3 ile aynı. Boş elde kılıç var. Her 3 saniyede kılıç 5 askeri fırlatıp öldürür. Üstte sayı düşer.</p>
          )}
          {isDev5(reelShot) && (
            <p className="muted">DEV4 ile aynı. Dev daha kalıplı, boynuzlu, tek kızıl göz. İsimler bar gibi sarı. Üstte sayı düşer.</p>
          )}
          {isSnake(reelShot) && (
            <p className="muted">DEV5 ile aynı kadro ve kamera. Yeşil-kahverengi yılan. Bekleyenler dairede. Çoğunluk başa, birkaç kişi gövdeye ve kuyruğa gider. Yılan hem onlara hem dairedeki bekleyen ve okçulara saldırır.</p>
          )}
          {isDevs(reelShot) && (
            <p className="muted">Yılan ile aynı kadro ve saldırı. Kamera biraz daha geniş, alttaki askerler de kadrajda, isimler net. Ortada yılan yok. Askerden 3 kat büyük, gri zırhlı 10 dev. Daha dağınık durur, gezer. Bekleyenler en yakındaki deve ok atar, saldırınca da en yakındakine gider. Kılıç değdiği an ölürler; asker yere düşer, kanlı kalır, sonra kaybolur. Devler ölmez.</p>
          )}
          {isDragon(reelShot) && (
            <p className="muted">Kırmızı ejder alev indirir, askerler ok atar. Atlı geç gelir, mızrağını fırlatır, ejder yaralanır ve kaçar.</p>
          )}
          {isFilm(reelShot) && (
            <p className="muted">18 takipçi yerde dağınık, adları üstte. Başlarında 100 düşman bekler. 3. saniyede 150 asker hilal gibi, her biri ayrı yerden gelir. Ölüler yerde kalır.</p>
          )}
          {isLab(reelShot) && (
            <p className="muted">200 son katılan birlikte girer. Kamera geriden ve uzaktan, askerler görünecek şekilde koridoru takip eder. Taş duvarlar mazgallı. Sonda çıkanlara yaklaşır.</p>
          )}
          {isNew7(reelShot) && (
            <p className="muted">new5 ile aynı, kamera daha geriden. Kaybedecekken arkadan 24 asker belirir. Yazıyı sen eklersin.</p>
          )}
          {isNew62(reelShot) && (
            <p className="muted">new6 ile aynı. Bizim asker yüzde 50, düşman yüzde 25 fazla. Kamera aynı açıda daha uzaktan.</p>
          )}
          {isNew6(reelShot) && (
            <p className="muted">4 köprü tek merkeze bağlı. Üçerli düşman koşarak gelir. Ortadaki dar halka tutunur, sonra kaybeder. Üstte bar.</p>
          )}
          {isNew5(reelShot) && (
            <p className="muted">İnce uzun köprü. Bizimkiler arkadan koşup sabit düşmanı öldürür, ölen silinir. Kamera arkadan takip eder. Üstte bar.</p>
          )}
          {isNew4(reelShot) && (
            <p className="muted">new3 ile aynı. Dar yüksek bir tepede, etraf boş. Kamera uzaklaşınca tepe ortaya çıkar.</p>
          )}
          {isNew3(reelShot) && (
            <p className="muted">new2 ile aynı. Bar daha aşağıda. İki taraf kılıçla vuruyor.</p>
          )}
          {isNew2(reelShot) && (
            <p className="muted">
              Yazı yok. Yakın dövüşle açılır, sonra uzaklaşır. Mavi askerler kırmızıya mızrak sallar, sırayla vuruşur.
            </p>
          )}
          <label>Çekim modu</label>
          <p className="muted">
            On bir tekil açı duruyor; tek tek çekebilirsin. Birleşim, bunların en iyi sahnelerini 30 /
            60 / 90 saniyelik tek videoda keser.
          </p>
          <div className="dur-pills shot-pills">
            {SHOT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={reelShot === mode.id ? "on" : ""}
                onClick={() => {
                  setReelShot((cur) => (cur === mode.id ? null : mode.id));
                  setReelSeconds((sec) => ((REEL_DURATIONS as readonly number[]).includes(sec) ? sec : 30));
                }}
              >
                {mode.label}
              </button>
            ))}
            <button
              type="button"
              className={reelShot === CINEMA_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === CINEMA_ID ? null : CINEMA_ID));
                setReelSeconds((sec) => (CINEMA_DURATIONS as readonly number[]).includes(sec) ? sec : 30);
              }}
            >
              {CINEMA_MODE.label}
            </button>
          </div>
          <label>Keşfet — 15s</label>
          <p className="muted">
            Aynı klip, iki yazı. Keşfet: izlenme. Keşfet 2: beğeni + yorum — ikinci
            dalga. Kamera, loop, komutansız kare aynı. Raf 2 ayrı: 14 sn, en çok
            takip ve izlenme getiren kesit + yazı.
          </p>
          <div className="dur-pills shot-pills">
            <button
              type="button"
              className={reelShot === DISCOVER_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DISCOVER_ID ? null : DISCOVER_ID));
                setReelSeconds(DISCOVER_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DISCOVER_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === DISCOVER2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DISCOVER2_ID ? null : DISCOVER2_ID));
                setReelSeconds(DISCOVER_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DISCOVER2_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === DISCOVER3_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DISCOVER3_ID ? null : DISCOVER3_ID));
                setReelSeconds(DISCOVER3_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DISCOVER3_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === RAF2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === RAF2_ID ? null : RAF2_ID));
                setReelSeconds(RAF2_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {RAF2_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === COUNTDOWN_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === COUNTDOWN_ID ? null : COUNTDOWN_ID));
                setReelSeconds(COUNTDOWN_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {COUNTDOWN_MODE.label} — {COUNTDOWN_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEFEND_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEFEND_ID ? null : DEFEND_ID));
                setReelSeconds(DEFEND_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DEFEND_MODE.label} — {DEFEND_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEFEND2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEFEND2_ID ? null : DEFEND2_ID));
                setReelSeconds(DEFEND2_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DEFEND2_MODE.label} — {DEFEND2_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEFEND3_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEFEND3_ID ? null : DEFEND3_ID));
                setReelSeconds(DEFEND3_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DEFEND3_MODE.label} — {DEFEND3_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === DEFEND4_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === DEFEND4_ID ? null : DEFEND4_ID));
                setReelSeconds(DEFEND4_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {DEFEND4_MODE.label} — {DEFEND4_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === VS_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === VS_ID ? null : VS_ID));
                setReelSeconds(VS_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {VS_MODE.label} — {VS_SECONDS}s
            </button>
            <button
              type="button"
              className={reelShot === VS2_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === VS2_ID ? null : VS2_ID));
                setReelSeconds(VS2_SECONDS);
                setReelSkipCmd(true);
              }}
            >
              {VS2_MODE.label} — {VS2_SECONDS}s
            </button>
          </div>
          {reelShot === DISCOVER_ID && (
            <p className="muted">
              Caption: Takip etmezsen kale yıkılmıyor. Tanıdığın var mı? Adın yoksa takip et — sonraki turda askersin. 1 takip = 1 asker. wargame.lol · @wargame2028
              {" "}Hashtag: #wargame #oyun #reels
            </p>
          )}
          {isDiscoverEngage(reelShot) && (
            <p className="muted">
              Caption: Adın çıkarsa yoruma SAVAŞTAYIM yaz. Kale düşsün diyorsan beğen. 1 takip = 1 asker. wargame.lol · @wargame2028
              {" "}İlk yorumu sabitle: SAVAŞTAYIM — kopyala yapıştır, ordudasın.
              {" "}Hashtag: #wargame #oyun #reels
            </p>
          )}
          {isDiscoverTrailer(reelShot) && (
            <p className="muted">
              40 sn fragman. Gün alanına yazdığın sayı ve ordu sayısı ekranda. Ses senin:
              kale, ordu, ok, kapı, savaş, sonra takip. Komutan yakın plan yok.
              {" "}Ses: Bugün X. gün. Takipçimiz Y. Kale duruyor. Ok yağmuru. Kapı açıldı. Savaş. Takip et, orduya katıl, kale düşsün.
              {" "}Caption: Adın çıkarsa yoruma SAVAŞTAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {isCountdown(reelShot) && (
            <p className="muted">
              14 sn. DUR → 3·2·1·ATEŞ → asker savaşıyor → sensin → beğen + buradayım. Mix gibi: her askerin üstünde ad (isim yoksa etiket yok).
              Oklar ATEŞ’te gider. Gerçek yay/ok kaydı sesi videoya girer. Komutansız, kale canı yok, kapı açılmaz.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}İlk yorumu sabitle: BURADAYIM
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {reelShot === DEFEND_ID && (
            <p className="muted">
              15.2 sn. Tepeden 360° çember kadraja sığar, sonra yaklaşır. Düşman kalabalık, aralarında ince boşluk.
              Kullanıcı adları askerlerin üstünde. Komutansız, kale canı yok.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}İlk yorumu sabitle: BURADAYIM
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {isDefend2(reelShot) && (
            <p className="muted">
              21.4 sn. Kuş bakışı: ordu kalenin gerisinde, kapı açılır, düşman kalabalık çıkar, sağa-sola iki kola ayrılır, uçlar birleşince tam çember. Sonrası Savunma ile aynı daralma.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}İlk yorumu sabitle: BURADAYIM
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {isDefend4(reelShot) && (
            <p className="muted">
              Savunma 3 ile aynı. Zemin new3 toprağı, bizim askerler mavi.
            </p>
          )}
          {reelShot === DEFEND3_ID && (
            <p className="muted">
              27 sn. Çıkış ve yakınlaşma 13. saniyeye kadar sürer; sonra askerlerin üstünde gezinir, sabit daire değil.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}İlk yorumu sabitle: BURADAYIM
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {isVs(reelShot) && (
            <p className="muted">
              30 sn. Boş arazide karşılıklı savaş. Düşman 3 kat, bizim 1 asker 3 düşmana bedel; 4 düşman 1 askerimizi düşürür. Kamera havadan, film gibi yakınlaşıp uzaklaşır. Tüm isimler açık.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}Hashtag: #wargame #stratejioyunu #ordu #wargame2028
            </p>
          )}
          {isVs2(reelShot) && (
            <p className="muted">
              30 sn. Kapı kapalı. 4 merdiven, başarısız tırmanış: bazıları düşer, bazıları tepede ölür. Tüm isimler açık, üst üste binmez.
              {" "}Caption: Adın çıkarsa yoruma BURADAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
            </p>
          )}
          {isDiscoverShelf(reelShot) && (
            <p className="muted">
              14 sn. Açılış tepeden tüm ordu, sonra geniş ordu, final tüm kale — kapı yok.
              Kullanıcı adları tepede ve geniş orduda. Günde bir kez at.
              {" "}Ses (14 sn): Dur. Orduda bir asker eksiğiz. Çünkü sen yoksun. Takip edince bu orduda asker oluyorsun. Bir takip, bir asker. Videoyu paylaş. Orduya asker çağır. Takip et. Kale düşsün.
              {" "}Caption: Dur. 1 asker eksiğiz — sen yoksun. Takip et, orduda asker ol. Videoyu paylaş, orduya asker çağır. 1 takip = 1 asker. wargame.lol
              {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
              {" "}Pin yok. İlk saat gelen yoruma hemen cevap.
            </p>
          )}
          <label>Mix — 15s / Mix 9 — 60s</label>
          <p className="muted">
            Alt 1/2/6 aynı. Mix 7 alt daha uzak-yüksek, yavaş sağ-sol.
            Üst: Mix 1 sol çapraz, Mix 2 tepe sol, Mix 6 tepe sağ, Mix 7 daha yakın ordu+kale.
            Mix 8 = Mix 7, paneller ters.
            Mix 9 (ağır): Mix 6 kameraları — üst normal hız, alt aynı tarama 60 sn çok yavaş.
            Yazı ve kale canı yok; sen eklersin. Kapı kapalı, düşman çıkmaz.
          </p>
          <div className="dur-pills shot-pills">
            {MIX_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={reelShot === mode.id ? "on" : ""}
                onClick={() => {
                  setReelShot((cur) => (cur === mode.id ? null : mode.id));
                  setReelSeconds(isMix9(mode.id) ? MIX9_SECONDS : MIX_SECONDS);
                  setReelText(false);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <label>xxx — {XXX_SECONDS}s / xxx3 · vv1 · vv2 · harika — {XXXV_SECONDS}s / harika2–6 — {HARIKA2_SECONDS}s / spin — {SPIN_SECONDS}s</label>
          <p className="muted">
            Keşfet sinematikleri. xxx: yazısız. harika6 = harika5, kanca 2–5s sabit:
            DUR. SENİN İSMİN DE BURADA OLABİLİR. 18s, 1080p, ok yok.
            spin: siyah zemin, 13s — isimler karışık ve tekrarsız geçer, 6. saniyede kilit, sonra büyür.
          </p>
          <div className="dur-pills shot-pills">
            {XXX_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={reelShot === mode.id ? "on" : ""}
                onClick={() => {
                  setReelShot((cur) => (cur === mode.id ? null : mode.id));
                  setReelSeconds(xxxSeconds(mode.id));
                  setReelText(false);
                  if (xxxHideCmd(mode.id)) setReelSkipCmd(true);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <label>B planı — İsim avı</label>
          <p className="muted">
            Keşif izleyicisi kendi adını aramaz. İlk kare kale, yazı “bu isimler kaleyi
            yıkıyor / takip etmezsen kale duruyor”. Listede “tanıdığın var mı” ve
            “sıradaki sen ol”. Dipte kale canı düşer — sonuna kadar bahis. CTA:
            adın yoksa takip et, sonraki reelde asker olursun.
          </p>
          <div className="dur-pills shot-pills">
            <button
              type="button"
              className={reelShot === ROSTER_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === ROSTER_ID ? null : ROSTER_ID));
                setReelSeconds(rosterDuration(ROSTER_ID, namedCount(game.names, game.soldiers)));
              }}
            >
              {ROSTER_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === HOOK_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === HOOK_ID ? null : HOOK_ID));
                setReelSeconds(15);
              }}
            >
              {HOOK_MODE.label}
            </button>
            <button
              type="button"
              className={reelShot === JOIN_ID ? "on" : ""}
              onClick={() => {
                setReelShot((cur) => (cur === JOIN_ID ? null : JOIN_ID));
                setReelSeconds(pendingJoin.seconds);
              }}
            >
              {JOIN_MODE.label}
            </button>
          </div>
          {isJoin(reelShot) && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={joinLastTen}
                  onChange={(e) => setJoinLastTen(e.target.checked)}
                />
                Son 10’u da dahil et
              </label>
              <label>Eski takipçi ekle</label>
              <textarea
                rows={5}
                placeholder={"eski1\neski2"}
                value={joinExtras}
                onChange={(e) => setJoinExtras(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const n = wipeJoinCacheAfter317(game.names, game.soldiers);
                  setJoinTick((x) => x + 1);
                  setMsg(`317’den sonrası cache’ten silindi. Kuyrukta ${n} asker. Kaydı başlat.`);
                }}
              >
                317 sonrası cache sil
              </button>
              <p className="muted">
                {pendingJoin.backlog
                  ? `Tek seferlik: 317’den sonrası. Bu kayıtta ${pendingJoin.ids.length} asker${pendingJoin.leftover > 0 ? ` · sonra ${pendingJoin.leftover} kalır` : " · bu grupla biter, sonraki kayıtlarda yine yalnızca yeni katılanlar"}.`
                  : `Boş bırakırsan akış aynı devam eder. Satır satır veya boşlukla yazarsan bu adlar son katılanlara eklenir. Yeni asker varsa yalnızca onlar. Bu kayıtta ${pendingJoin.ids.length} asker${pendingJoin.fresh > 0 ? ` · ${Math.min(pendingJoin.fresh, pendingJoin.ids.length - pendingJoin.extra)} yeni` : joinLastTen && pendingJoin.extra === 0 ? " · son 10" : ""}${pendingJoin.extra > 0 ? ` · ${pendingJoin.extra} eski takipçi` : ""}${pendingJoin.leftover > 0 ? ` · sonra ${pendingJoin.leftover} kalır` : ""}${joinExtraNames.length > pendingJoin.extra ? ` · ${joinExtraNames.length - pendingJoin.extra} ad orduda yok` : ""}.`}
                {" "}Caption: Adın çıkarsa yoruma SAVAŞTAYIM yaz. Kale düşsün diyorsan beğen. Canlı kuşatma. 1 takip = 1 asker. wargame.lol
                {" "}Hashtag: #wargame #stratejioyunu #kalekuşatma #ordu #wargame2028
              </p>
            </>
          )}
          {isPlanB(reelShot) && !isJoin(reelShot) && (
            <p className="muted">
              Caption: Bu isimler kaleyi yıkıyor. Tanıdığın var mı? Yoksa takip et — sonraki reelde asker olursun. 1 takip = 1 asker. wargame.lol · @wargame2028
              {" "}Hashtag: #wargame #oyun #reels
            </p>
          )}
          <label>C planı — Senaryo</label>
          <p className="muted">
            Eski çekimler duruyor. Kuşatma: ordu → surdaki düşman bizi izliyor → ok
            yağmuru → kapı açılır, hücum, savaş. Sur bakışı ve Hücum aynı hikâyenin
            kısa kesimleri.
          </p>
          <div className="dur-pills shot-pills">
            {SAGA_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={reelShot === mode.id ? "on" : ""}
                onClick={() => {
                  setReelShot((cur) => (cur === mode.id ? null : mode.id));
                  setReelSeconds(mode.seconds);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {isSaga(reelShot) && (
            <p className="muted">
              Caption: Kale bizi izliyor. 1 takip = 1 asker. wargame.lol · @wargame2028
              {" "}Hashtag: #wargame #oyun #reels
            </p>
          )}
          <button
            type="button"
            className="btn-gold"
            onClick={() => {
              if (capturing) return;
              void unlockReelSfx();
              if (isJoin(reelShot) && pendingJoin.ids.length === 0) {
                const text = "Kayıt başlamadı: işlenecek yeni asker yok. Son 10 kutusunu aç veya eski takipçi yaz.";
                setMsg(text);
                window.alert(text);
                return;
              }
              try {
                if (isJoin(reelShot)) {
                  captureJoinIds.current = pendingJoin.ids.slice();
                  setJoinForcePack(pendingJoin.pack);
                  setCaptureSec(pendingJoin.seconds);
                  setReelSeconds(pendingJoin.seconds);
                } else {
                  captureJoinIds.current = [];
                  setJoinForcePack(null);
                  setCaptureSec(reelSeconds);
                }
                setMsg("");
                setCaptureGen((n) => n + 1);
                setCapturing(true);
              } catch (e) {
                const text = e instanceof Error ? e.message : "Kayıt başlamadı.";
                setMsg(text);
                window.alert(text);
              }
            }}
          >
            {isJoin(reelShot) && pendingJoin.backlog
              ? `Kaydı başlat · 317’den sonrası${pendingJoin.leftover > 0 ? ` · ${pendingJoin.leftover} kalır` : ""}`
              : isJoin(reelShot) && pendingJoin.leftover > 0
                ? `Kaydı başlat · ${pendingJoin.leftover} kalır`
                : "Kaydı başlat"}
          </button>
          {isJoin(reelShot) && pendingJoin.ids.length === 0 && (
            <p className="muted">Bu buton şimdi kayıt açmaz: kuyruk boş. Yeni asker yoksa Son 10’u işaretle.</p>
          )}
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
      </div>}

      {capturing && (
        <ReelCapture
          key={captureGen}
          soldiers={game.soldiers}
          names={game.names}
          commanders={game.commanders}
          level={level}
          pressure={pressure}
          hp={power}
          maxHp={maxHp}
          seconds={captureSec}
          showTitles={reelText}
          skipCommander={reelSkipCmd || isDiscover(reelShot) || isCountdown(reelShot) || isDefend(reelShot) || isVsMode(reelShot) || isNewField(reelShot) || isLab(reelShot) || isGiantShot(reelShot) || isFilm(reelShot) || isDragon(reelShot) || (isXxx(reelShot) && xxxHideCmd(reelShot))}
          shotMode={reelShot === CINEMA_ID || isPlanB(reelShot) || isSaga(reelShot) || isDiscover(reelShot) || isCountdown(reelShot) || isDefend(reelShot) || isVsMode(reelShot) || isNewField(reelShot) || isLab(reelShot) || isGiantShot(reelShot) || isFilm(reelShot) || isDragon(reelShot) || isMix(reelShot) || isXxx(reelShot) ? null : reelShot}
          cinema={reelShot === CINEMA_ID}
          roster={isPlanB(reelShot) ? reelShot : null}
          saga={isSaga(reelShot) ? reelShot : null}
          discover={isDiscover(reelShot) ? reelShot : null}
          countdown={isCountdown(reelShot) ? reelShot : null}
          defend={isDefend(reelShot) ? reelShot : null}
          vs={isVsMode(reelShot) ? reelShot : null}
          new1={isNew1(reelShot) ? reelShot : null}
          new2={isNew2(reelShot) ? reelShot : null}
          new3={isNew3(reelShot) ? reelShot : null}
          new4={isNew4(reelShot) ? reelShot : null}
          new5={isNew5(reelShot) ? reelShot : null}
          new6={isNew6(reelShot) ? reelShot : null}
          new62={isNew62(reelShot) ? reelShot : null}
          new7={isNew7(reelShot) ? reelShot : null}
          maze={isLab(reelShot) ? reelShot : null}
          film={isFilm(reelShot) ? reelShot : null}
          dragon={isDragon(reelShot) ? reelShot : null}
          giant={isGiantShot(reelShot) ? reelShot : null}
          mix={isMix(reelShot) ? reelShot : null}
          xxx={isXxx(reelShot) ? reelShot : null}
          rosterIds={isJoin(reelShot) ? captureJoinIds.current : null}
          day={Math.max(0, Math.floor(Number(reelDay)) || 0)}
          onRecorded={() => {
            if (isJoin(reelShot)) {
              saveJoinMark(game.names, captureJoinIds.current);
              finishJoinBacklogIfCaughtUp(game.names, game.soldiers);
              setJoinTick((n) => n + 1);
            }
          }}
          onClose={() => {
            setJoinForcePack(null);
            setCapturing(false);
          }}
        />
      )}
    </div>
  );
}
