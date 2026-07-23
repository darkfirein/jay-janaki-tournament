import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
// withCredentials makes the browser send the httpOnly auth cookie on every
// request and store the one the backend sets on login/register — this is
// what replaces the old "read token from localStorage, attach as a header" flow.
const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Backend origin without the trailing /api — used to resolve uploaded file URLs
// (payment screenshots, QR code images) which are served as static files, not API routes.
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export const fileUrl = (path) => {
  if (!path) return '';
  // Cloudinary (and any other) URLs are already absolute — use as-is.
  // Local uploads are stored as relative "/uploads/..." paths and need the
  // backend origin prefixed to resolve.
  if (/^https?:\/\//i.test(path)) return path;
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
};

// Backend origin for the socket.io live chat connection
export const socketUrl = API_ORIGIN || window.location.origin;

// If the backend says this account is blocked (or the session cookie is gone/expired),
// bounce to login so the person can't keep acting as a logged-in user. The initial
// "am I logged in?" check on app load opts out via skipAuthRedirect, since a 401
// there just means "not logged in yet" — not a session that was lost.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.error || '';
    const sessionInvalid = status === 401 || (status === 403 && /blocked/i.test(message));
    if (sessionInvalid && !err.config?.skipAuthRedirect && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Admin CSV exports are behind the cookie-protected /admin routes — a plain
// <a href> download won't carry the httpOnly cookie the way the browser's own
// navigation does for same-site requests, so fetch as a blob through the
// authenticated axios instance instead, then save it locally.
export async function downloadCsv(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
