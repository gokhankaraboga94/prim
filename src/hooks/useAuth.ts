import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ADMIN_EMAIL, auth } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, []);

  const isAdmin = Boolean(user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  return { user, ready, isAdmin };
}
