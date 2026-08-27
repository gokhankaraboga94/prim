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
        <p className="join-kicker">Ordunun parçası ol</p>
        <h2>Seni de asker ekleyelim</h2>
        <p className="join-copy">
          Kaleyi yıkmak için{" "}
          <a href={followHref} target="_blank" rel="noreferrer">
            @{owner}
          </a>{" "}
          hesabını Instagram’dan takip et.
        </p>
      </div>
      <a className="btn-follow" href={followHref} target="_blank" rel="noreferrer">
        Takip et
      </a>
    </aside>
  );
}
