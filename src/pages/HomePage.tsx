import { useState } from "react";
import { BattleScene } from "../components/scene/BattleScene";
import { HUD } from "../components/HUD";
import { JoinArmy } from "../components/JoinArmy";
import { ReelsMode } from "../components/ReelsMode";
import { SceneErrorBoundary } from "../components/SceneErrorBoundary";
import { useGame } from "../hooks/useGame";

export function HomePage() {
  const { game, reels, ready, level, power, pressure, maxHp, target } = useGame();
  const [mode, setMode] = useState<"battle" | "reels">("battle");
  const handle = game.instagramHandle.replace(/^@/, "");

  return (
    <div className="home">
      <div className="scene-wrap">
        <SceneErrorBoundary>
          <BattleScene soldiers={game.soldiers} level={level} pressure={Math.round(pressure * 20) / 20} />
        </SceneErrorBoundary>
      </div>
      <div className="vignette" />

      <HUD
        handle={handle}
        soldiers={game.soldiers}
        level={level}
        power={power}
        maxHp={maxHp}
        target={target}
        pressure={pressure}
      />

      <div className="home-body">
        <div className="story">
          <h1>Kale yıkılmıyor.</h1>
          <p className="cam-hint">Sürükle veya pinch ile bakış açısını değiştir</p>
        </div>
        <JoinArmy handle={handle} />
      </div>

      {reels.length > 0 && (
        <button
          type="button"
          className={`mode-toggle ${mode === "reels" ? "on" : ""}`}
          onClick={() => setMode((m) => (m === "battle" ? "reels" : "battle"))}
        >
          {mode === "reels" ? "Savaşa dön" : "Reels"}
        </button>
      )}

      {mode === "reels" && reels.length > 0 && (
        <ReelsMode items={reels} handle={handle} onClose={() => setMode("battle")} />
      )}

      {!ready && <div className="boot">Kuşatma hazırlanıyor…</div>}
    </div>
  );
}
