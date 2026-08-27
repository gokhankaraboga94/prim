import { useState } from "react";
import { BattleScene } from "../components/scene/BattleScene";
import { HUD } from "../components/HUD";
import { JoinArmy } from "../components/JoinArmy";
import { ReelsMode } from "../components/ReelsMode";
import { useGame } from "../hooks/useGame";
import { formatCount } from "../game";

export function HomePage() {
  const { game, recruits, reels, ready, level, power, pressure } = useGame();
  const [mode, setMode] = useState<"battle" | "reels">("battle");
  const handle = game.instagramHandle.replace(/^@/, "");

  return (
    <div className="home">
      <BattleScene soldiers={game.soldiers} level={level} pressure={pressure} />
      <div className="vignette" />

      <HUD
        handle={handle}
        soldiers={game.soldiers}
        level={level}
        power={power}
        pressure={pressure}
      />

      <div className="home-body">
        <div className="story">
          <p className="story-kicker">Düşman kalesi · Seviye {level}</p>
          <h1>Kale yıkılmıyor.</h1>
          <p>
            {formatCount(game.soldiers)} asker kuşatmada. Kale gücü {formatCount(power)}. Ordu yetince kale
            otomatik seviye atlar — kuşatma hiç bitmez.
          </p>
          {recruits.length > 0 && (
            <p className="recruits-live">
              Son katılanlar:{" "}
              {recruits.slice(0, 5).map((r) => `@${r.username}`).join(" · ")}
            </p>
          )}
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
