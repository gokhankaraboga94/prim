import { useEffect, useRef, useState } from "react";
import { BattleScene } from "./scene/BattleScene";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { recordCanvas, saveReelBlob, wait, REEL_HOLD } from "../recordCanvas";
import { xxxHideCmd, xxxHiRes, type XxxId } from "../xxxReel";
import { reelSfxStream, unlockReelSfx } from "../reelSfx";
import type { ShotId } from "../shotModes";
import type { PlanBId } from "../rosterReel";
import type { SagaId } from "../sagaReel";
import type { DiscoverId } from "../discoverReel";
import type { MixId } from "../mixReel";
import type { CountdownId } from "../countdownReel";
import type { DefendId } from "../defendReel";
import type { VsId } from "../vsReel";
import { type New1Id, type New2Id, type New3Id } from "../new1Reel";

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
  mix?: MixId | null;
  xxx?: XxxId | null;
  rosterIds?: number[] | null;
  onRecorded?: () => void;
  onClose: () => void;
};

export function ReelCapture({ soldiers, names, commanders = [], level, pressure, hp, maxHp, seconds, showTitles = true, warLook = false, day = 0, skipCommander = false, shotMode = null, cinema = false, roster = null, saga = null, discover = null, countdown = null, defend = null, vs = null, new1 = null, new2 = null, new3 = null, mix = null, xxx = null, rosterIds = null, onRecorded, onClose }: ReelCaptureProps) {
  const clip = seconds;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"boot" | "rec" | "done" | "err">("boot");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
      await wait(Math.round(REEL_HOLD * 1000) + 80);
      if (stop) return;
      setPhase("rec");
      try {
        await Promise.race([unlockReelSfx(), wait(1200)]);
        if (stop) return;
        const bits = xxx && xxxHiRes(xxx) ? 24_000_000 : 8_000_000;
        const recorded = await recordCanvas(canvas, clip, reelSfxStream(), bits);
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
  }, [clip]);

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
        {phase !== "done" && (
        <SceneErrorBoundary
          onError={(e) => {
            setErr(e.message || "Sahne çöktü.");
            setPhase("err");
          }}
        >
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
            skipCommander={skipCommander || Boolean(discover) || Boolean(countdown) || Boolean(defend) || Boolean(vs) || Boolean(new1) || Boolean(new2) || Boolean(new3) || Boolean(xxx && xxxHideCmd(xxx))}
            shotMode={cinema || roster || saga || discover || countdown || defend || vs || new1 || new2 || new3 || mix || xxx ? null : shotMode}
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
            mix={mix}
            xxx={xxx}
            showTitles={showTitles && !mix && !xxx && !new1 && !new2 && !new3}
            rosterIds={rosterIds}
            onReady={(canvas) => {
              canvasRef.current = canvas;
            }}
          />
        </SceneErrorBoundary>
        )}
        </div>
      </div>

      {(phase === "boot" || phase === "rec") && (
        <div className="reel-capture-hud">
          <p>{phase === "boot" ? "Sahne hazırlanıyor…" : "Kayıt alınıyor…"}</p>
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
          <p>Kayıt hazır. iPhone’da Kaydet ile Fotoğraflar’a at.</p>
          <button type="button" className="btn-gold" onClick={() => void onSave()} disabled={busy}>
            Kaydet / Paylaş
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Kapat
          </button>
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
