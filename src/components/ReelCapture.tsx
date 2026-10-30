import { useEffect, useRef, useState } from "react";
import { BattleScene } from "./scene/BattleScene";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { recordCanvas, saveReelBlob, wait, REEL_HOLD } from "../recordCanvas";
import { xxxHideCmd, xxxHiRes, type XxxId } from "../xxxReel";
import { reelSfxStream, unlockReelSfx } from "../reelSfx";
import type { ShotId } from "../shotModes";
import { isJoin, rosterDuration, type PlanBId } from "../rosterReel";
import type { SagaId } from "../sagaReel";
import type { DiscoverId } from "../discoverReel";
import { isMix9, type MixId } from "../mixReel";
import type { CountdownId } from "../countdownReel";
import type { DefendId } from "../defendReel";
import type { VsId } from "../vsReel";
import { type New1Id, type New2Id, type New3Id, type New4Id, type New5Id, type New6Id, type New62Id, type New7Id } from "../new1Reel";
import type { LabId } from "../mazeReel";
import type { FilmId } from "../filmReel";
import type { DragonId } from "../dragonReel";
import { isDevSmall, zillaHold, zillaIsReady, zillaStart, type GiantId } from "../devReel";
import type { WarsId } from "../warsReel";
import type { OrduId } from "../orduReel";
import type { Rival } from "../karsiReel";
import type { OkId } from "../okReel";
import { elfHasScene, elfHold, elfIsReady, elfLoadDone, elfLoadTotal, elfStartPlay, elfWarm, elfWhenReady, type ElfId } from "../elfReel";
import { ElfScene } from "./scene/ElfScene";
import { WEBGL_BLOCKED, webglBlocked, webglOpen } from "../webglOk";

function sceneErrMsg(e: Error) {
  if (webglBlocked(e)) return WEBGL_BLOCKED;
  if (/R3F:|THREE namespace|forget to extend/i.test(e.message)) {
    return "Sahne açılamadı. Sayfayı tamamen yenile, elf'i tekrar dene.";
  }
  return e.message || "Sahne çöktü.";
}
import type { KalkanId } from "../kalkanReel";
import type { HeroId } from "../heroReel";
import type { LoopId } from "../loopReel";
import { KURTAR_URLS, kurtarHold, kurtarIsReady, kurtarStart, kurtarWhenReady, type KurtarId } from "../kurtarReel";
import { GECME_URLS, gecmeHold, gecmeIsReady, gecmeStart, gecmeWhenReady, type GecmeId } from "../gecmeReel";
import { KUYU_URLS, kuyuHold, kuyuIsReady, kuyuStart, kuyuWhenReady, type KuyuId } from "../kuyuReel";
import { KAPI_URLS, kapiHold, kapiIsReady, kapiStart, kapiWhenReady, type KapiId } from "../kapiReel";
import { MAGDUR_URLS, magdurHold, magdurIsReady, magdurStart, magdurWhenReady, type MagdurId } from "../magdurReel";
import { KARE_URLS, kareHold, kareIsReady, kareStart, kareWhenReady, type KareId } from "../kareReel";
import { DEVKONG_URLS, devKongHold, devKongIsReady, devKongStart, devKongWhenReady, type DevKongId } from "../devKongReel";
import { SAVAS_URLS, savasHold, savasIsReady, savasStart, savasWhenReady, type SavasId } from "../savasReel";
import { KIRMIZI_URLS, kirmiziHold, kirmiziIsReady, kirmiziStart, kirmiziWhenReady, type KirmiziId } from "../kirmiziReel";
import { BASKA_URL, baskaHold, baskaIsReady, baskaStart, baskaWhenReady, type BaskaId } from "../baskaReel";
import { ARAGORN_URLS, aragornHold, aragornIsReady, aragornStart, aragornWhenReady, type AragornId } from "../aragornTestReel";
import { DOVUS_URLS, dovusHold, dovusIsReady, dovusStart, dovusWhenReady, type DovusId } from "../dovusReel";
import { KUYULAR_URLS, kuyularHold, kuyularIsReady, kuyularStart, kuyularWhenReady, type KuyularId } from "../kuyularReel";
import { ARENA3_ARENA_URL, ARENA3_HERO_URLS, type Arena2Id, type Arena3Id, type ArenaId } from "../arenaReel";
import { preloadGlbs } from "../arenaPreload";
import type { Bout2Id, BoutId } from "../boutReel";
import type { KayitId } from "../kayitReel";

type ReelCaptureProps = {
  soldiers: number;
  names: string[];
  commanders?: string[];
  level: number;
  pressure: number;
  hp: number;
  maxHp: number;
  seconds: number;
  showTitles?: boolean;
  warLook?: boolean;
  day?: number;
  skipCommander?: boolean;
  shotMode?: ShotId | null;
  cinema?: boolean;
  roster?: PlanBId | null;
  saga?: SagaId | null;
  discover?: DiscoverId | null;
  countdown?: CountdownId | null;
  defend?: DefendId | null;
  vs?: VsId | null;
  new1?: New1Id | null;
  new2?: New2Id | null;
  new3?: New3Id | null;
  new4?: New4Id | null;
  new5?: New5Id | null;
  new6?: New6Id | null;
  new62?: New62Id | null;
  new7?: New7Id | null;
  maze?: LabId | null;
  film?: FilmId | null;
  dragon?: DragonId | null;
  giant?: GiantId | null;
  wars?: WarsId | null;
  ordu?: OrduId | null;
  karsi?: Rival | null;
  ok?: OkId | null;
  elf?: ElfId | null;
  kalkan?: KalkanId | null;
  hero?: HeroId | null;
  loop?: LoopId | null;
  kurtar?: KurtarId | null;
  gecme?: GecmeId | null;
  kuyu?: KuyuId | null;
  kapi?: KapiId | null;
  magdur?: MagdurId | null;
  kare?: KareId | null;
  devKong?: DevKongId | null;
  savas?: SavasId | null;
  kirmizi?: KirmiziId | null;
  baska?: BaskaId | null;
  aragorn?: AragornId | null;
  dovus?: DovusId | null;
  kuyular?: KuyularId | null;
  arena?: ArenaId | null;
  arena2?: Arena2Id | null;
  arena3?: Arena3Id | null;
  bout?: BoutId | Bout2Id | null;
  kayit?: KayitId | null;
  mix?: MixId | null;
  xxx?: XxxId | null;
  rosterIds?: number[] | null;
  onRecorded?: () => void;
  onClose: () => void;
};

export function ReelCapture({ soldiers, names, commanders = [], level, pressure, hp, maxHp, seconds, showTitles = true, warLook = false, day = 0, skipCommander = false, shotMode = null, cinema = false, roster = null, saga = null, discover = null, countdown = null, defend = null, vs = null, new1 = null, new2 = null, new3 = null, new4 = null, new5 = null, new6 = null, new62 = null, new7 = null, maze = null, film = null, dragon = null, giant = null, wars = null, ordu = null, karsi = null, ok = null, elf = null, kalkan = null, hero = null, loop = null, kurtar = null, gecme = null, kuyu = null, kapi = null, magdur = null, kare = null, devKong = null, savas = null, kirmizi = null, baska = null, aragorn = null, dovus = null, kuyular = null, arena = null, arena2 = null, arena3 = null, bout = null, kayit = null, mix = null, xxx = null, rosterIds = null, onRecorded, onClose }: ReelCaptureProps) {
  const clip = roster && isJoin(roster) && rosterIds?.length ? rosterDuration(roster, rosterIds.length) : seconds;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"boot" | "rec" | "done" | "err">("boot");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [elfReady, setElfReady] = useState(!elf);
  const [elfDone, setElfDone] = useState(0);
  // Arena3 fetches its packed models first; the scene mounts once they are in memory.
  const [assets, setAssets] = useState(() =>
    arena3
      ? { ready: false, done: 0, total: ARENA3_HERO_URLS.length + 1 }
      : kurtar
        ? { ready: false, done: 0, total: KURTAR_URLS.length }
        : gecme
          ? { ready: false, done: 0, total: GECME_URLS.length }
          : kuyu
            ? { ready: false, done: 0, total: KUYU_URLS.length }
            : kapi
              ? { ready: false, done: 0, total: KAPI_URLS.length }
              : devKong
                ? { ready: false, done: 0, total: DEVKONG_URLS.length }
                : savas
                  ? { ready: false, done: 0, total: SAVAS_URLS.length }
                : kirmizi
                  ? { ready: false, done: 0, total: KIRMIZI_URLS.length }
                : baska
                  ? { ready: false, done: 0, total: 1 }
                : aragorn
                  ? { ready: false, done: 0, total: ARAGORN_URLS.length }
                : dovus
                  ? { ready: false, done: 0, total: DOVUS_URLS.length }
                : kuyular
                  ? { ready: false, done: 0, total: KUYULAR_URLS.length }
                : kare
                  ? { ready: false, done: 0, total: KARE_URLS.length }
                : magdur
                  ? { ready: false, done: 0, total: MAGDUR_URLS.length }
                  : isDevSmall(giant)
                    ? { ready: false, done: 0, total: 1 }
                    : { ready: true, done: 0, total: 0 }
  );

  useEffect(() => {
    if (!arena3 && !kurtar && !gecme && !kuyu && !kapi && !magdur && !kare && !devKong && !savas && !kirmizi && !baska && !aragorn && !dovus && !kuyular && !isDevSmall(giant)) return;
    let stop = false;
    const urls = arena3 ? [...ARENA3_HERO_URLS, ARENA3_ARENA_URL] : kurtar ? KURTAR_URLS : gecme ? GECME_URLS : kuyu ? KUYU_URLS : devKong ? DEVKONG_URLS : savas ? SAVAS_URLS : kirmizi ? KIRMIZI_URLS : baska ? [BASKA_URL] : aragorn ? ARAGORN_URLS : dovus ? DOVUS_URLS : kuyular ? KUYULAR_URLS : kare ? KARE_URLS : magdur ? MAGDUR_URLS : isDevSmall(giant) ? ["/models/godzilla.glb"] : KAPI_URLS;
    void preloadGlbs(urls, (done, total) => {
      if (!stop) setAssets({ ready: false, done, total });
    }).then(() => {
      if (!stop) setAssets((cur) => ({ ...cur, ready: true }));
    });
    return () => {
      stop = true;
    };
  }, [arena3, kurtar, gecme, kuyu, kapi, magdur, kare, devKong, savas, kirmizi, baska, aragorn, dovus, kuyular, giant]);

  useEffect(() => {
    if (!elf) return;
    if (!webglOpen()) {
      setErr(WEBGL_BLOCKED);
      setPhase("err");
      return;
    }
    elfWarm();
    setElfReady(false);
    let stop = false;
    void elfWhenReady().then(() => {
      if (!stop) setElfReady(true);
    });
    return () => {
      stop = true;
    };
  }, [elf]);

  useEffect(() => {
    if (!assets.ready) return;
    let stop = false;
    (async () => {
      const start = performance.now();
      while (!canvasRef.current && performance.now() - start < 12000) {
        await wait(40);
        if (stop) return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        setErr("Sahne hazır olmadı. İptal deyip tekrar dene.");
        setPhase("err");
        return;
      }
      if (kurtar || gecme || kuyu || kapi || magdur || kare || devKong || savas || kirmizi || baska || aragorn || dovus || kuyular) {
        const loadStart = performance.now();
        const sceneReady = kurtar ? kurtarIsReady : gecme ? gecmeIsReady : kuyu ? kuyuIsReady : devKong ? devKongIsReady : savas ? savasIsReady : kirmizi ? kirmiziIsReady : baska ? baskaIsReady : aragorn ? aragornIsReady : dovus ? dovusIsReady : kuyular ? kuyularIsReady : kare ? kareIsReady : magdur ? magdurIsReady : kapiIsReady;
        while (!sceneReady() && performance.now() - loadStart < (savas || kirmizi || baska || kuyular ? 50000 : 25000)) {
          await wait(80);
          if (stop) return;
        }
        if (!sceneReady()) {
          setErr("Sahne hazırlanamadı. İptal deyip tekrar dene.");
          setPhase("err");
          return;
        }
        if (kurtar) kurtarHold();
        else if (gecme) gecmeHold();
        else if (kuyu) kuyuHold();
        else if (devKong) devKongHold();
        else if (savas) savasHold();
        else if (kirmizi) kirmiziHold();
        else if (baska) baskaHold();
        else if (aragorn) aragornHold();
        else if (dovus) dovusHold();
        else if (kuyular) kuyularHold();
        else if (kare) kareHold();
        else if (magdur) magdurHold();
        else kapiHold();
        if (kurtar) await kurtarWhenReady();
        else if (gecme) await gecmeWhenReady();
        else if (kuyu) await kuyuWhenReady();
        else if (devKong) await devKongWhenReady();
        else if (savas) await savasWhenReady();
        else if (kirmizi) await kirmiziWhenReady();
        else if (baska) await baskaWhenReady();
        else if (aragorn) await aragornWhenReady();
        else if (dovus) await dovusWhenReady();
        else if (kuyular) await kuyularWhenReady();
        else if (kare) await kareWhenReady();
        else if (magdur) await magdurWhenReady();
        else await kapiWhenReady();
      }
      if (isDevSmall(giant)) {
        const loadStart = performance.now();
        while (!zillaIsReady() && performance.now() - loadStart < 50000) {
          await wait(80);
          if (stop) return;
        }
        if (!zillaIsReady()) {
          setErr("Sahne hazırlanamadı. İptal deyip tekrar dene.");
          setPhase("err");
          return;
        }
        zillaHold();
      }
      if (elf) {
        const loadStart = performance.now();
        while (!elfIsReady() && performance.now() - loadStart < 40000) {
          setElfDone(elfLoadDone());
          await wait(80);
          if (stop) return;
        }
        setElfDone(elfLoadDone());
        if (!elfHasScene()) {
          setErr("Meydan veya elf modeli yüklenemedi. İptal deyip tekrar dene.");
          setPhase("err");
          return;
        }
        setElfReady(true);
        elfHold();
      }
      await wait(Math.round(REEL_HOLD * 1000) + 80);
      if (stop) return;
      if (elf) elfHold();
      setPhase("rec");
      try {
        await Promise.race([unlockReelSfx(), wait(1200)]);
        if (stop) return;
        const heavy = isMix9(mix);
        const bits = heavy ? 2_500_000 : xxx && xxxHiRes(xxx) ? 24_000_000 : 8_000_000;
        const recorded = await recordCanvas(canvas, clip, reelSfxStream(), bits, heavy, isDevSmall(giant) ? zillaStart : kurtar ? kurtarStart : gecme ? gecmeStart : kuyu ? kuyuStart : devKong ? devKongStart : savas ? savasStart : kirmizi ? kirmiziStart : baska ? baskaStart : aragorn ? aragornStart : dovus ? dovusStart : kuyular ? kuyularStart : kare ? kareStart : magdur ? magdurStart : kapi ? kapiStart : elf ? elfStartPlay : undefined);
        if (stop) return;
        setBlob(recorded);
        setPreview(URL.createObjectURL(recorded));
        setPhase("done");
        onRecorded?.();
        try {
          await saveReelBlob(recorded, clip);
        } catch {
          /* iPhone often needs a second tap */
        }
      } catch (e) {
        if (stop) return;
        setErr(e instanceof Error ? e.message : "Kayıt alınamadı.");
        setPhase("err");
      }
    })();
    return () => {
      stop = true;
    };
  }, [clip, assets.ready]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onSave() {
    if (!blob) return;
    setBusy(true);
    try {
      await saveReelBlob(blob, clip);
    } catch {
      setErr("Kayıt paylaşılmadı. Tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reel-capture">
      <div className="reel-capture-scene">
        <div className="reel-capture-frame">
        {phase !== "done" && phase !== "err" && assets.ready && (
        <SceneErrorBoundary
          onError={(e) => {
            setErr(sceneErrMsg(e));
            setPhase("err");
          }}
        >
          {elf ? (
            <ElfScene
              onReady={(canvas) => {
                canvasRef.current = canvas;
              }}
              onBlocked={(msg) => {
                setErr(msg);
                setPhase("err");
              }}
            />
          ) : (
          <BattleScene
            soldiers={soldiers}
            names={names}
            commanders={commanders}
            level={level}
            pressure={pressure}
            hp={hp}
            maxHp={maxHp}
            cinematic
            duration={clip}
            warLook={warLook}
            day={day}
            skipCommander={skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(new1) || Boolean(new2) || Boolean(new3) || Boolean(new4) || Boolean(new5) || Boolean(new6) || Boolean(new62) || Boolean(new7) || Boolean(maze) || Boolean(film) || Boolean(giant) || Boolean(wars) || Boolean(ordu) || Boolean(karsi) || Boolean(ok) || Boolean(elf) || Boolean(kalkan) || Boolean(hero) || Boolean(loop) || Boolean(arena) || Boolean(arena2) || Boolean(arena3) || Boolean(bout) || Boolean(kayit) || Boolean(xxx && xxxHideCmd(xxx))}
            shotMode={cinema || roster || saga || discover || countdown || defend || vs || new1 || new2 || new3 || new4 || new5 || new6 || new62 || new7 || maze || film || giant || wars || ordu || karsi || ok || elf || kalkan || hero || loop || arena || arena2 || arena3 || bout || kayit || mix || xxx ? null : shotMode}
            cinema={cinema}
            roster={roster}
            saga={saga}
            discover={discover}
            countdown={countdown}
            defend={defend}
            vs={vs}
            new1={new1}
            new2={new2}
            new3={new3}
            new4={new4}
            new5={new5}
            new6={new6}
            new62={new62}
            new7={new7}
            maze={maze}
            film={film}
            dragon={dragon}
            giant={giant}
            wars={wars}
            ordu={ordu}
            karsi={karsi}
            ok={ok}
            elf={elf}
            kalkan={kalkan}
            hero={hero}
            loop={loop}
            kurtar={kurtar}
            gecme={gecme}
            kuyu={kuyu}
            kapi={kapi}
            magdur={magdur}
            kare={kare}
            devKong={devKong}
            savas={savas}
            kirmizi={kirmizi}
            baska={baska}
            aragorn={aragorn}
            dovus={dovus}
            kuyular={kuyular}
            arena={arena}
            arena2={arena2}
            arena3={arena3}
            bout={bout}
            kayit={kayit}
            mix={mix}
            xxx={xxx}
            showTitles={showTitles && !mix && !xxx && !new1 && !new2 && !new3 && !new4 && !new5 && !new6 && !new62 && !new7 && !maze && !film && !dragon && !giant && !wars && !ordu && !karsi && !ok && !elf && !kalkan && !hero && !loop && !kurtar && !gecme && !kuyu && !kapi && !magdur && !kare && !devKong && !savas && !kirmizi && !baska && !aragorn && !dovus && !kuyular && !arena && !arena2 && !arena3 && !bout && !kayit}
            rosterIds={rosterIds}
            onReady={(canvas) => {
              canvasRef.current = canvas;
            }}
          />
          )}
        </SceneErrorBoundary>
        )}
        </div>
      </div>

      {(phase === "boot" || phase === "rec") && (
        <div className="reel-capture-hud">
          <p>{phase === "boot" ? (!assets.ready || (elf && !elfReady) || ((kurtar && !kurtarIsReady()) || (gecme && !gecmeIsReady()) || (kuyu && !kuyuIsReady()) || (kapi && !kapiIsReady()) || (magdur && !magdurIsReady()) || (kare && !kareIsReady()) || (devKong && !devKongIsReady()) || (savas && !savasIsReady()) || (kirmizi && !kirmiziIsReady()) || (baska && !baskaIsReady()) || (aragorn && !aragornIsReady()) || (dovus && !dovusIsReady()) || (kuyular && !kuyularIsReady())) ? `Modeller yükleniyor… ${elf ? `${elfDone}/${elfLoadTotal()}` : assets.total ? `${assets.done}/${assets.total}` : ""}` : "Sahne hazırlanıyor…") : "Kayıt alınıyor…"}</p>
        </div>
      )}

      {phase === "err" && (
        <div className="reel-capture-hud">
          <p>{err}</p>
        </div>
      )}

      {phase === "done" && (
        <div className="reel-capture-done">
          {preview && <video src={preview} playsInline controls />}
          <div className="reel-capture-actions">
            <p>Kayıt hazır. iPhone’da Kaydet ile Fotoğraflar’a at.</p>
            <button type="button" className="btn-gold" onClick={() => void onSave()} disabled={busy}>
              Kaydet / Paylaş
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {(phase === "boot" || phase === "err" || phase === "rec") && (
        <button type="button" className="btn-ghost reel-capture-close" onClick={onClose}>
          İptal
        </button>
      )}
    </div>
  );
}
