import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

export function useApi(path, params, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const key = path + JSON.stringify(params || {});
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(path, params)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);
  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(getToken());
  const login = async (username, password) => {
    const r = await api.post("/api/auth/login", { username, password });
    setToken(r.access_token);
    setTok(r.access_token);
  };
  const logout = () => {
    setToken(null);
    setTok(null);
  };
  // drop an expired token automatically
  useEffect(() => {
    if (!token) return;
    api.get("/api/auth/me").catch((e) => {
      if (e.status === 401 || e.status === 403) logout();
    });
  }, [token]);
  return createElement(AuthCtx.Provider, { value: { isAdmin: !!token, login, logout } }, children);
}

export const useAuth = () => useContext(AuthCtx);
