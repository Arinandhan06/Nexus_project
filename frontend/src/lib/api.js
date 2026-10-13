import axios from "axios";

const defaultHost = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
const defaultPort = 8000;
const baseURL = import.meta.env.VITE_API_URL || `http://${defaultHost}:${defaultPort}`;

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("authToken");
    if (token) {
      if (config.headers && typeof config.headers.set === "function") {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear session token if the user identity validation endpoint explicitly fails
      const url = error.config?.url || "";
      if (url.endsWith("/me") || url === "/me") {
        sessionStorage.removeItem("authToken");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
