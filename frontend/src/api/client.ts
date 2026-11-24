import type {
  Room,
  RoomDetailsResponse,
  SongRequest,
  RequestStatus,
  CreateSongRequestPayload,
} from '../types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

function buildEndpointUrl(endpoint: string): string {
  if (!API_BASE_URL) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = buildEndpointUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Ошибка запроса (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response body is not JSON or is empty, fallback to status text
      if (response.statusText) {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }
    }
    throw new ApiError(response.status, errorMessage);
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Создать новую комнату диджея
 */
export async function createRoom(): Promise<Room> {
  return request<Room>('/api/rooms', {
    method: 'POST',
  });
}

/**
 * Получить данные комнаты и существующие заказы
 */
export async function getRoom(code: string): Promise<RoomDetailsResponse> {
  return request<RoomDetailsResponse>(`/api/rooms/${encodeURIComponent(code)}`, {
    method: 'GET',
  });
}

/**
 * Отправить заказ песни в комнату
 */
export async function sendSongRequest(
  code: string,
  songText: string,
  guestName?: string,
): Promise<SongRequest> {
  const payload: CreateSongRequestPayload = {
    song_text: songText.trim(),
    guest_name: guestName ? guestName.trim() : undefined,
  };

  return request<SongRequest>(`/api/rooms/${encodeURIComponent(code)}/requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Обновить статус заказа (диджей отмечает сыграно или отклонено)
 */
export async function updateRequestStatus(
  code: string,
  id: number,
  status: RequestStatus,
): Promise<SongRequest> {
  return request<SongRequest>(
    `/api/rooms/${encodeURIComponent(code)}/requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

/**
 * Получить правильный WebSocket URL на основе текущего хоста страницы или VITE_API_BASE_URL
 */
export function getWebSocketUrl(code: string): string {
  const customWsBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim();
  if (customWsBase) {
    return `${customWsBase.replace(/\/+$/, '')}/ws/${encodeURIComponent(code)}`;
  }

  if (API_BASE_URL) {
    const wsBase = API_BASE_URL.replace(/^http(s)?:\/\//i, (_, isHttps) =>
      isHttps ? 'wss://' : 'ws://',
    );
    return `${wsBase}/ws/${encodeURIComponent(code)}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/${encodeURIComponent(code)}`;
}
