import { useEffect, useRef, useState } from "react";
import type { ReelItem } from "../game";

type ReelsModeProps = {
  items: ReelItem[];
  handle: string;
  onClose: () => void;
};

export function ReelsMode({ items, handle, onClose }: ReelsModeProps) {
  const [index, setIndex] = useState(0);
  const touch = useRef({ y: 0, t: 0 });
  const lastWheel = useRef(0);
  const total = items.length;
  const current = items[index];

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  if (!current) return null;

  function go(dir: 1 | -1) {
    if (!total) return;
    setIndex((i) => (i + dir + total) % total);
  }

  return (
    <section
      className="reels"
      onWheel={(e) => {
        if (Math.abs(e.deltaY) < 24) return;
        const now = Date.now();
        if (now - lastWheel.current < 420) return;
        lastWheel.current = now;
        go(e.deltaY > 0 ? 1 : -1);
      }}
      onTouchStart={(e) => {
        touch.current = { y: e.touches[0].clientY, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const dy = touch.current.y - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 48) go(dy > 0 ? 1 : -1);
      }}
    >
      <div key={current.id} className="reels-slide">
        {current.type === "video" ? (
          <video src={current.url} autoPlay muted loop playsInline />
        ) : (
          <img src={current.url} alt={current.caption || "Reels"} />
        )}
        <div className="reels-shade" />
        <div className="reels-meta">
          <span>@{handle.replace(/^@/, "")}</span>
          {current.caption && <p>{current.caption}</p>}
          <small>
            {index + 1} / {total} · kaydır
          </small>
        </div>
      </div>
      <button type="button" className="reels-close" onClick={onClose}>
        Savaşa dön
      </button>
      <div className="reels-nav">
        <button type="button" onClick={() => go(-1)} aria-label="Önceki">
          ↑
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Sonraki">
          ↓
        </button>
      </div>
      <ol className="reels-dots">
        {items.map((item, i) => (
          <li key={item.id} className={i === index ? "on" : ""} />
        ))}
      </ol>
    </section>
  );
}
