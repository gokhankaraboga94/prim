import { useEffect, useRef, useState } from "react";
import { BattleScene } from "./scene/BattleScene";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { recordCanvas, saveReelBlob, wait } from "../recordCanvas";

type ReelCaptureProps = {
  soldiers: number;
  names: string[];
  level: number;
  pressure: number;
  hp: number;
  maxHp: number;
  seconds: number;
  showTitles?: boolean;
  onClose: () => void;
};

export function ReelCapture({ soldiers, names, level, pressure, hp, maxHp, seconds, showTitles = true, onClose }: ReelCaptureProps) {
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
      await wait(1100);
      if (stop) return;
      setPhase("rec");
      try {
        const recorded = await recordCanvas(canvas, seconds);
        if (stop) return;
        setBlob(recorded);
        setPreview(URL.createObjectURL(recorded));
        setPhase("done");
        try {
          await saveReelBlob(recorded, seconds);
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
  }, [seconds]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onSave() {
    if (!blob) return;
    setBusy(true);
    try {
      await saveReelBlob(blob, seconds);
    } catch {
      setErr("Kayıt paylaşılmadı. Tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reel-capture">
      <div className="reel-capture-scene">
        <SceneErrorBoundary>
          <BattleScene
            soldiers={soldiers}
            names={names}
            level={level}
            pressure={pressure}
            hp={hp}
            maxHp={maxHp}
            cinematic
            duration={seconds}
            showTitles={showTitles}
            onReady={(canvas) => {
              canvasRef.current = canvas;
            }}
          />
        </SceneErrorBoundary>
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
