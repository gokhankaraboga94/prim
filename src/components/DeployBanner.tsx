import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const KEY = "wars_seen_deploy_id";

function deployUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}deploy.json?t=${Date.now()}`;
}

/** Her yeni deploy sonrası 5 sn sabit üst bant — mobil dahil. */
export function DeployBanner() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let hideTimer = 0;
    void fetch(deployUrl(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { id?: string; at?: string; note?: string } | null) => {
        if (stop || !data?.id || data.id === "pending") return;
        let seen = "";
        try {
          seen = localStorage.getItem(KEY) || "";
        } catch {
          /* ignore */
        }
        if (seen === data.id) return;
        const when = data.at
          ? new Date(data.at).toLocaleString("tr-TR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "";
        setText(`Push başarılı · ${when}${data.note ? ` · ${data.note}` : ""}`);
        try {
          localStorage.setItem(KEY, data.id);
        } catch {
          /* ignore */
        }
        hideTimer = window.setTimeout(() => {
          if (!stop) setText(null);
        }, 5000);
      })
      .catch(() => {
        /* deploy.json yoksa sessiz */
      });
    return () => {
      stop = true;
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!text || typeof document === "undefined") return null;
  return createPortal(
    <div className="admin-push-banner admin-push-banner--fixed" role="status">
      {text}
    </div>,
    document.body
  );
}
