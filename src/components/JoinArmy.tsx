import { FormEvent, useState } from "react";
import { push, ref } from "firebase/database";
import { db } from "../firebase";
import { instagramUrl, normalizeHandle } from "../game";

type JoinArmyProps = {
  handle: string;
};

export function JoinArmy({ handle }: JoinArmyProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const owner = handle.replace(/^@/, "");
  const followHref = instagramUrl(owner);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const username = normalizeHandle(value);
    if (!username) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      await push(ref(db, "recruits"), {
        username,
        createdAt: Date.now(),
      });
      setValue("");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside className="join-panel">
      <p className="join-kicker">Ordunun parçası ol</p>
      <h2>Seni de asker ekleyelim</h2>
      <p className="join-copy">
        Instagram hesabını yaz, kuşatmaya katıl. Kaleyi yıkmak için{" "}
        <a href={followHref} target="_blank" rel="noreferrer">
          @{owner}
        </a>{" "}
        hesabını takip et — her takipçi bir asker.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="ig-handle">Instagram hesabın</label>
        <textarea
          id="ig-handle"
          rows={2}
          placeholder="@kullaniciadi"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
        />
        <div className="join-actions">
          <button type="submit" className="btn-gold" disabled={status === "saving"}>
            {status === "saving" ? "Ekleniyor..." : "Askere katıl"}
          </button>
          <a className="btn-follow" href={followHref} target="_blank" rel="noreferrer">
            Takip et
          </a>
        </div>
      </form>

      {status === "done" && (
        <p className="join-ok">Askere yazıldın. Şimdi @{owner} hesabını takip et, ordu büyüsün.</p>
      )}
      {status === "error" && (
        <p className="join-err">Geçerli bir Instagram kullanıcı adı yaz.</p>
      )}
    </aside>
  );
}
