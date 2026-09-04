import { useEffect, useRef, useState } from "react";
import { BattleScene } from "./scene/BattleScene";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { recordCanvas, saveReelBlob, wait } from "../recordCanvas";
import { CINEMA_DURATION, type ShotId } from "../shotModes";

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
  onClose: () => void;
};

export function ReelCapture({ soldiers, names, commanders = [], level, pressure, hp, maxHp, seconds, showTitles = true, warLook = false, day = 0, skipCommander = false, shotMode = null, cinema = false, onClose }: ReelCaptureProps) {
  const clip = cinema ? CINEMA_DURATION : seconds;
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
      while (!canvasRef.current && performance.now() - start < 8000) {
        await wait(80);
        if (stop) return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        setErr("Sahne hazır olmadı.");
        setPhase("err");
        return;
      }
      await wait(2300);
      if (stop) return;
      setPhase("rec");
      try {
        const recorded = await recordCanvas(canvas, clip);
        if (stop) return;
        setBlob(recorded);
        setPreview(URL.createObjectURL(recorded));
        setPhase("done");
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
        <SceneErrorBoundary>
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
            showTitles={showTitles}
            warLook={warLook}
            day={day}
            skipCommander={skipCommander}
            shotMode={cinema ? null : shotMode}
            cinema={cinema}
            onReady={(canvas) => {
              canvasRef.current = canvas;
            }}
          />
        </SceneErrorBoundary>
        )}
        </div>
      </div>

      {phase === "err" && (
        <div className="reel-capture-hud">
          <p>{err}</p>
        </div>
      )}

      {phase === "done" && (
        <div className="reel-capture-done">
          {preview && <video src={preview} playsInline muted controls />}
          <p>Kayıt hazır. iPhone’da Kaydet ile Fotoğraflar’a at.</p>
          <button type="button" className="btn-gold" onClick={() => void onSave()} disabled={busy}>
            Kaydet / Paylaş
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Kapat
          </button>
        </div>
      )}

      {(phase === "boot" || phase === "err") && (
        <button type="button" className="btn-ghost reel-capture-close" onClick={onClose}>
          İptal
        </button>
      )}
    </div>
  );
}
