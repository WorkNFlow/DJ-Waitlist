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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
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
 * Получить правильный WebSocket URL на основе текущего хоста страницы
 */
export function getWebSocketUrl(code: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/${encodeURIComponent(code)}`;
}
