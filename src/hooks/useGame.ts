import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase";
import { DEFAULT_GAME, parseGame, resolveSiege, type GameState, type Recruit, type ReelItem } from "../game";

const CACHE_KEY = "wars-game-v1";

function readCache(): GameState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return parseGame(JSON.parse(raw) as Partial<GameState>);
  } catch {
    return null;
  }
}

function writeCache(game: GameState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(game));
  } catch {
    /* quota / private mode */
  }
}

export function useGame() {
  const [game, setGame] = useState<GameState>(() => readCache() ?? DEFAULT_GAME);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [ready, setReady] = useState(() => Boolean(readCache()));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const fail = () => setReady(true);
    const timer = window.setTimeout(fail, 1500);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    const unsubGame = onValue(
      ref(db, "game"),
      (snap) => {
        const next = parseGame(snap.val() as Partial<GameState> | null);
        setGame(next);
        writeCache(next);
        setReady(true);
      },
      fail
    );

    const unsubRecruits = onValue(
      ref(db, "recruits"),
      (snap) => {
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
      },
      fail
    );

    const unsubReels = onValue(
      ref(db, "reels"),
      (snap) => {
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
      },
      fail
    );

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clock);
      unsubGame();
      unsubRecruits();
      unsubReels();
    };
  }, []);

  const siege = useMemo(() => resolveSiege(game, now), [game, now]);

  return { game, recruits, reels, ready, ...siege, power: siege.hp };
}
