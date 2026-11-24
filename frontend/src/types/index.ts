export type RequestStatus = 'pending' | 'played' | 'rejected';

export interface Room {
  id: number;
  code: string;
  created_at: string;
}

export interface SongRequest {
  id: number;
  room_id: number;
  song_text: string;
  guest_name?: string;
  status: RequestStatus;
  created_at: string;
}

export interface RoomDetailsResponse {
  room: Room;
  requests: SongRequest[];
}

export interface CreateSongRequestPayload {
  song_text: string;
  guest_name?: string;
}

export type WSMessageType = 'new_request' | 'status_updated';

export interface WSNewRequestMessage {
  type: 'new_request';
  payload: SongRequest;
}

export interface WSStatusUpdatedMessage {
  type: 'status_updated';
  payload: SongRequest;
}

export type WSMessage = WSNewRequestMessage | WSStatusUpdatedMessage;
