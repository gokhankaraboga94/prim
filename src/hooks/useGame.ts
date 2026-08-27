import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase";
import {
  DEFAULT_GAME,
  castlePower,
  levelForSoldiers,
  siegePressure,
  type GameState,
  type Recruit,
  type ReelItem,
} from "../game";

export function useGame() {
  const [game, setGame] = useState<GameState>(DEFAULT_GAME);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubGame = onValue(ref(db, "game"), (snap) => {
      const v = snap.val() as Partial<GameState> | null;
      setGame({
        soldiers: Math.max(0, Math.floor(Number(v?.soldiers) || 0)),
        instagramHandle: String(v?.instagramHandle || DEFAULT_GAME.instagramHandle),
        updatedAt: Number(v?.updatedAt) || 0,
      });
      setReady(true);
    });

    const unsubRecruits = onValue(ref(db, "recruits"), (snap) => {
      const v = snap.val() as Record<string, Omit<Recruit, "id">> | null;
      if (!v) {
        setRecruits([]);
        return;
      }
      const list = Object.entries(v)
        .map(([id, item]) => ({
          id,
          username: String(item.username || ""),
          createdAt: Number(item.createdAt) || 0,
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 40);
      setRecruits(list);
    });

    const unsubReels = onValue(ref(db, "reels"), (snap) => {
      const v = snap.val() as Record<string, Omit<ReelItem, "id">> | null;
      if (!v) {
        setReels([]);
        return;
      }
      const list = Object.entries(v)
        .map(([id, item]) => ({
          id,
          url: String(item.url || ""),
          type: item.type === "video" ? ("video" as const) : ("image" as const),
          caption: item.caption ? String(item.caption) : "",
          createdAt: Number(item.createdAt) || 0,
        }))
        .filter((item) => item.url)
        .sort((a, b) => a.createdAt - b.createdAt);
      setReels(list);
    });

    return () => {
      unsubGame();
      unsubRecruits();
      unsubReels();
    };
  }, []);

  const derived = useMemo(() => {
    const level = levelForSoldiers(game.soldiers);
    const power = castlePower(level);
    const pressure = siegePressure(game.soldiers, power);
    return { level, power, pressure };
  }, [game.soldiers]);

  return { game, recruits, reels, ready, ...derived };
}
