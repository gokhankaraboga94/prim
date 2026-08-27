import { formatCount, formatPower, instagramUrl } from "../game";

type HUDProps = {
  handle: string;
  soldiers: number;
  level: number;
  power: number;
  maxHp: number;
  target: number;
  pressure: number;
};

export function HUD({ handle, soldiers, level, power, maxHp, target, pressure }: HUDProps) {
  const pct = Math.round(pressure * 100);
  const href = instagramUrl(handle);

  return (
    <header className="hud">
      <a className="hud-brand" href={href} target="_blank" rel="noreferrer">
        <span className="hud-kicker">Instagram</span>
        <strong>@{handle.replace(/^@/, "")}</strong>
      </a>

      <div className="hud-center">
        <div className="hud-stats">
          <div className="hud-stat">
            <span>Asker / Takipçi</span>
            <b>{formatCount(soldiers)}</b>
          </div>
          <div className="hud-divider" />
          <div className="hud-stat">
            <span>Kale Gücü</span>
            <b>{formatPower(power)}</b>
          </div>
          <div className="hud-divider" />
          <div className="hud-stat">
            <span>Hedef · Sv.{level}</span>
            <b>{formatCount(target)}</b>
          </div>
        </div>
        <div className="siege-bar" aria-label={`Kuşatma %${pct}`}>
          <i style={{ width: `${pct}%` }} />
          <em>
            Hedef {formatCount(target)} takipçi · kalan {formatPower(power)} / {formatCount(maxHp)}
          </em>
        </div>
      </div>
    </header>
  );
}
