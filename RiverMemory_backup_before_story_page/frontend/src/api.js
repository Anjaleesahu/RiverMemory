const BASE = import.meta.env.VITE_API_URL || "";
const API_DISPLAY_URL = BASE || "http://127.0.0.1:8000";
const TOKEN_KEY = "rm_token";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY));

export const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function detailText(d) {
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  return JSON.stringify(d);
}

async function request(path, { method = "GET", body, form, params } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(
      `Could not reach the RiverMemory API at ${API_DISPLAY_URL}. Check /api/health; if RiverMemory is already listening on port 8000, reuse that server instead of starting another.`,
      0
    );
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      msg = detailText((await res.json()).detail) || msg;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
  upload: (path, form) => request(path, { method: "POST", form }),
};

export function reportUrl(dataset, format, params) {
  return `${BASE}/api/reports/${dataset}${qs({ format, ...params })}`;
}

export async function download(url, fallbackName) {
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status);
  const cd = res.headers.get("content-disposition") || "";
  const name = (cd.match(/filename="?([^";]+)"?/) || [])[1] || fallbackName;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
