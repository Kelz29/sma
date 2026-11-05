import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8083/api/v1",
  withCredentials: true,
  headers: {
    // The API is tunnelled via ngrok (free tier), which serves a browser-warning
    // HTML page (without CORS headers) to browser UAs unless this header is sent.
    // That page makes login fail as an opaque CORS error. Harmless on non-ngrok hosts.
    "ngrok-skip-browser-warning": "true",
  },
});

api.interceptors.request.use((config) => {
  const { accessToken, tenantId } = useAuthStore.getState();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId) {
    config.headers = config.headers ?? {};
    config.headers["X-Tenant-Id"] = tenantId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

