import axios from 'axios';

/**
 * Centralized Axios instance for all backend API calls.
 * All API communication should go through this client.
 *
 * Features:
 * - Base URL from environment
 * - Automatic JSON content-type
 * - Interceptors for auth tokens and error handling (to be added in P03)
 */
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor — attach auth token (will be implemented in P03)
apiClient.interceptors.request.use(
  (config) => {
    // TODO: P03 will add JWT token from auth context
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor — handle common errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // TODO: P03 will handle 401 → redirect to login, token refresh
    return Promise.reject(error);
  },
);

export default apiClient;
