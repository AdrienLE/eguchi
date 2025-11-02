/**
 * Tests for API utilities
 */

import { createApiClient } from '../../lib/api';

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ApiClient', () => {
  const baseUrl = 'https://api.test.com';
  const api = createApiClient(baseUrl, 5000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET requests', () => {
    test('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const result = await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
    });

    test('should include auth token when provided', async () => {
      const token = 'test-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      await api.get('/test', token);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    test('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await api.get('/test');

      expect(result.status).toBe(404);
      expect(result.error).toBe('HTTP 404: Not Found');
      expect(result.data).toBeUndefined();
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.get('/test');

      expect(result.status).toBe(0);
      expect(result.error).toBe('Network error');
    });
  });

  describe('POST requests', () => {
    test('should make successful POST request with data', async () => {
      const requestData = { name: 'Test Item' };
      const responseData = { id: 1, ...requestData };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => responseData,
      } as Response);

      const result = await api.post('/items', requestData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        })
      );
      expect(result.data).toEqual(responseData);
      expect(result.status).toBe(201);
    });
  });

  describe('PUT requests', () => {
    test('should make successful PUT request', async () => {
      const requestData = { name: 'Updated Item' };
      const responseData = { id: 1, ...requestData };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response);

      const result = await api.put('/items/1', requestData, 'token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items/1',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
          body: JSON.stringify(requestData),
        })
      );
      expect(result.data).toEqual(responseData);
    });

    test('should make PUT request without data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const result = await api.put('/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items/1',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: undefined,
        })
      );
      expect(result.data).toEqual({ success: true });
    });
  });

  describe('DELETE requests', () => {
    test('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response);

      const result = await api.delete('/items/1', 'token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
        })
      );
      expect(result.status).toBe(204);
    });

    test('should make DELETE request without token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as Response);

      const result = await api.delete('/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/items/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result.status).toBe(204);
    });
  });

  describe('Upload requests', () => {
    test('should handle file upload', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const responseData = { url: 'https://example.com/file.txt' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response);

      const result = await api.upload('/upload', mockFile, 'token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/upload',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer token',
          },
          body: expect.any(FormData),
        })
      );
      expect(result.data).toEqual(responseData);
    });

    test('should pass through FormData unchanged', async () => {
      const fd = new FormData();
      fd.append('file', new Blob(['abc'], { type: 'text/plain' }), 'a.txt');
      const responseData = { ok: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => responseData,
      } as Response);

      const result = await api.upload('/upload', fd);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/upload',
        expect.objectContaining({
          method: 'POST',
          body: fd,
        })
      );
      expect(result.data).toEqual(responseData);
    });
  });
});
