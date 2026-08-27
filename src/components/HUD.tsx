import { formatCount, instagramUrl } from "../game";

type HUDProps = {
  handle: string;
  soldiers: number;
  level: number;
  power: number;
  pressure: number;
};

export function HUD({ handle, soldiers, level, power, pressure }: HUDProps) {
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
            <b>{formatCount(power)}</b>
          </div>
          <div className="hud-divider" />
          <div className="hud-stat">
            <span>Seviye</span>
            <b>{level}</b>
          </div>
        </div>
        <div className="siege-bar" aria-label={`Kuşatma %${pct}`}>
          <i style={{ width: `${pct}%` }} />
          <em>%{pct} kuşatma — kale yıkılmak üzere seviye atlar</em>
        </div>
      </div>
    </header>
  );
}
