import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { DanceBattle, DanceCam } from "../components/scene/DanceBattle";
import { DANCE2_URLS, DANCE_URLS, danceIsReady, danceStart, danceWhenReady } from "../danceReel";
import { preloadGlbs } from "../arenaPreload";

const NAMES = [
  "Ayse", "Mehmet", "Zeynep", "Can", "Elif",
  "Burak", "Deniz", "Ece", "Emre", "Fatma",
  "Gokhan", "Hakan", "Ipek", "Kaan", "Leyla",
];

export function DancePreviewPage() {
  const club = useMemo(() => new URLSearchParams(window.location.search).get("v") === "2", []);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let drop = false;
    void (async () => {
      try {
        await preloadGlbs([...(club ? DANCE2_URLS : DANCE_URLS)]);
        if (drop) return;
        setReady(true);
        await danceWhenReady();
        if (drop) return;
        danceStart();
        setPlaying(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    const poll = window.setInterval(() => {
      if (!danceIsReady()) return;
      setPlaying((was) => {
        if (!was) danceStart();
        return true;
      });
    }, 400);
    return () => {
      drop = true;
      window.clearInterval(poll);
    };
  }, [club]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#07090f", position: "relative" }}>
      <div style={{ position: "absolute", zIndex: 2, top: 8, left: 8, color: "#fff", font: "14px sans-serif" }}>
        {club ? "dance2 kulüp" : "dance mekan"} {playing ? "· oynuyor" : ready ? "· sahne yükleniyor" : "· modeller"}
        {err ? ` · hata: ${err}` : ""}
      </div>
      {ready && (
        <Canvas
          camera={{ position: [0, 3.4, 10], fov: 40, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: "100%", height: "100%" }}
        >
          <color attach="background" args={[club ? "#07090f" : "#1a1c22"]} />
          <DanceBattle names={NAMES} mekan={!club} />
          <DanceCam />
        </Canvas>
      )}
    </div>
  );
}
