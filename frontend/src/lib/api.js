import axios from "axios";

const defaultHost = "localhost";
const defaultPort = 8000;
const baseURL = import.meta.env.VITE_API_URL || `http://${defaultHost}:${defaultPort}`;

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("authToken");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem("authToken");
    }
    return Promise.reject(error);
  }
);

export default api;
