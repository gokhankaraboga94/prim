import { formatCount, formatPower, instagramUrl } from "../game";

type HUDProps = {
  handle: string;
  soldiers: number;
  level: number;
  power: number;
  maxHp: number;
  target: number;
};

export function HUD({ handle, soldiers, level, power, maxHp, target }: HUDProps) {
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (power / maxHp) * 100)) : 0;
  const hpPctLabel = (Math.floor(hpPct * 100 + 1e-9) / 100).toFixed(2);
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
        <div className="siege-bar" aria-label={`Kale sağlığı %${hpPctLabel}`}>
          <i style={{ width: `${hpPct}%` }} />
          <em>%{hpPctLabel}</em>
        </div>
      </div>
    </header>
  );
}
