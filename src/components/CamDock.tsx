import { useEffect, useState } from "react";
import { liveCam, resetLiveCam, setLiveCam, subscribeLiveCam } from "../liveCam";

export function CamDock() {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [, setRev] = useState(0);

  useEffect(() => subscribeLiveCam(() => setRev((n) => n + 1)), []);

  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  return (
    <div className="cam-dock">
      <button type="button" onClick={toggleFull}>
        {full ? "Tam ekrandan çık" : "Tam ekran"}
      </button>
      <button type="button" className={open ? "on" : ""} onClick={() => setOpen((value) => !value)}>
        Kamera
      </button>
      {open && (
        <div className="cam-panel">
          <label>
            Hız
            <input
              type="range"
              min={0.35}
              max={2.6}
              step={0.05}
              value={liveCam.speed}
              onChange={(event) => setLiveCam({ speed: Number(event.target.value) })}
            />
          </label>
          <label>
            Görüş
            <input
              type="range"
              min={18}
              max={70}
              step={1}
              value={liveCam.fov}
              onChange={(event) => setLiveCam({ fov: Number(event.target.value) })}
            />
          </label>
          <label>
            Yükseklik
            <input
              type="range"
              min={4}
              max={90}
              step={1}
              value={liveCam.height ?? 22}
              onChange={(event) => setLiveCam({ height: Number(event.target.value) })}
            />
          </label>
          <button type="button" onClick={() => resetLiveCam()}>
            Sıfırla
          </button>
        </div>
      )}
    </div>
  );
}
