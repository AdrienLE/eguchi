/**
 * Modular API utilities for the base app
 */

import { APP_CONFIG } from './config';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface ApiClient {
  get<T>(endpoint: string, token?: string): Promise<ApiResponse<T>>;
  post<T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>>;
  put<T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>>;
  delete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>>;
  upload<T>(endpoint: string, file: File | FormData, token?: string): Promise<ApiResponse<T>>;
}

class BaseApiClient implements ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl || APP_CONFIG.api.baseUrl;
    this.timeout = timeout || APP_CONFIG.api.timeout;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    // Log the API call for debugging
    console.log(`🌐 API ${options.method || 'GET'}: ${url}`);
    console.log(`📋 Headers:`, options.headers);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Log response status
      console.log(`📡 Response ${response.status}: ${options.method || 'GET'} ${url}`);

      if (!response.ok) {
        // Handle 401 Unauthorized specially to trigger silent re-auth on web
        if (response.status === 401) {
          console.log('🔐 401 Unauthorized - Token may be expired');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth-expired'));
          }
        }
        return {
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Log error
      console.log(
        `❌ Error: ${options.method || 'GET'} ${url} - ${error.message || 'Network error'}`
      );
      console.log(`❌ Full error:`, error);

      return {
        status: 0,
        error: error.message || 'Network error',
      };
    }
  }

  async get<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  }

  async post<T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  }

  async upload<T>(
    endpoint: string,
    file: File | FormData,
    token?: string
  ): Promise<ApiResponse<T>> {
    const body =
      file instanceof FormData
        ? file
        : (() => {
            const formData = new FormData();
            formData.append('file', file);
            return formData;
          })();

    return this.request<T>(endpoint, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type - let browser set it with boundary
      },
      body,
    });
  }
}

// Default API client instance
export const api = new BaseApiClient();

// Factory function for creating custom API clients
export const createApiClient = (baseUrl?: string, timeout?: number): ApiClient => {
  return new BaseApiClient(baseUrl, timeout);
};
