import { instagramUrl } from "../game";

type JoinArmyProps = {
  handle: string;
};

export function JoinArmy({ handle }: JoinArmyProps) {
  const owner = handle.replace(/^@/, "");
  const followHref = instagramUrl(owner);

  return (
    <aside className="join-panel">
      <div className="join-text">
        <p className="join-kicker">Kuşatma yetmiyor</p>
        <h2>Askerler bir başına. Yardımın lazım.</h2>
        <p className="join-copy">
          Kaleyi tek başlarına yıkamazlar.{" "}
          <a href={followHref} target="_blank" rel="noreferrer">
            @{owner}
          </a>{" "}
          hesabını Instagram’dan takip et, orduya katıl.
        </p>
      </div>
      <a className="btn-follow" href={followHref} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
        </svg>
        Takip et
      </a>
    </aside>
  );
}
