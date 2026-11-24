import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRoom, updateRequestStatus, getWebSocketUrl } from '../api/client';
import type { Room, SongRequest, RequestStatus, WSMessage } from '../types';
import { RequestCard } from '../components/RequestCard';
import { QrCodeModal } from '../components/QrCodeModal';
import { playNotificationSound } from '../utils/helpers';
import {
  QrCode,
  Radio,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Disc3,
} from 'lucide-react';

type TabType = 'queue' | 'history';

export const DjRoomPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket статус
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // Вкладки и фильтрация
  const [activeTab, setActiveTab] = useState<TabType>('queue');
  const [searchQuery, setSearchQuery] = useState('');

  // Модалка QR-кода
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // ID последнего поступившего заказа для анимации подсветки
  const [newestRequestId, setNewestRequestId] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Ручная перезагрузка данных
  const fetchRoomData = async () => {
    if (!code) return;
    try {
      const data = await getRoom(code);
      setRoom(data.room);
      setRequests(data.requests || []);
      setError(null);
    } catch {
      setError(`Комната #${code} не найдена`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!code) return;

    getRoom(code)
      .then((data) => {
        if (!isMounted) return;
        setRoom(data.room);
        setRequests(data.requests || []);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setError(`Комната #${code} не найдена`);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  // Подключение к WebSocket с автореконнектом
  useEffect(() => {
    if (!code) return;
    isUnmountedRef.current = false;

    const connectWs = () => {
      if (isUnmountedRef.current) return;

      const wsUrl = getWebSocketUrl(code);
      setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const data: WSMessage = JSON.parse(event.data);
          if (data.type === 'new_request' && data.payload) {
            const incoming = data.payload;
            setRequests((prev) => {
              if (prev.some((r) => r.id === incoming.id)) {
                return prev;
              }
              return [incoming, ...prev];
            });

            // Подсветка нового заказа
            setNewestRequestId(incoming.id);
            setTimeout(() => {
              setNewestRequestId(null);
            }, 6000);

            // Звуковой сигнал
            playNotificationSound();
          } else if (data.type === 'status_updated' && data.payload) {
            const updated = data.payload;
            setRequests((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r)),
            );
          }
        } catch {
          // Игнорируем поврежденные фреймы
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWs();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[WS] WebSocket error in DJ room:', err);
      };
    };

    connectWs();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [code]);

  // Смена статуса трека
  const handleUpdateStatus = async (id: number, status: RequestStatus) => {
    if (!code) return;

    const previousRequests = [...requests];
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );

    try {
      await updateRequestStatus(code, id, status);
    } catch (err: unknown) {
      setRequests(previousRequests);
      alert(err instanceof Error ? err.message : 'Не удалось обновить статус трека');
    }
  };

  // Фильтрация
  const queueRequests = requests.filter((r) => r.status === 'pending');
  const historyRequests = requests.filter(
    (r) => r.status === 'played' || r.status === 'rejected',
  );

  const displayedList = (activeTab === 'queue' ? queueRequests : historyRequests).filter(
    (r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.song_text.toLowerCase().includes(q) ||
        (r.guest_name && r.guest_name.toLowerCase().includes(q))
      );
    },
  );

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="relative mb-5">
          <Disc3 className="w-14 h-14 text-amber-400 animate-vinyl-spin" />
        </div>
        <p className="text-zinc-300 font-medium text-sm tracking-wide">
          Запуск DJ-пульта...
        </p>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">{error || 'Комната не найдена'}</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-sm">
          Возможно, сессия была завершена или сервер перезагрузился. Вы можете создать новую комнату на главной.
        </p>
        <Link
          to="/"
          className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-all"
        >
          На главную
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen pb-16 flex flex-col">
      {/* Главная DJ-панель (Header Console) */}
      <header className="sticky top-0 z-30 bg-[#090a0f]/90 backdrop-blur-xl border-b border-[#232738] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Левая часть: лого, эквалайзер, комната */}
        <div className="flex items-center gap-3.5 sm:gap-5">
          <Link
            to="/"
            title="DJ Request"
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c2030] to-[#12141e] border border-[#2b3047] flex items-center justify-center text-amber-400 shadow-lg group-hover:border-amber-400/50 transition-colors">
              <Radio className="w-5 h-5 group-hover:scale-105 transition-transform" />
            </div>
            <div className="hidden md:flex flex-col">
              <span className="font-extrabold text-white text-base leading-tight tracking-tight">
                DJ REQUEST
              </span>
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                Live Console
              </span>
            </div>
          </Link>

          <div className="h-6 w-px bg-[#232738] hidden sm:block" />

          {/* Номер комнаты со светодиодным акцентом */}
          <div className="flex items-center gap-2 bg-[#10121a] border border-[#232738] px-3.5 py-1.5 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest hidden sm:inline">
              Комната:
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono tracking-wider text-amber-400 tabular-nums">
              #{room.code}
            </span>
          </div>

          {/* Индикатор эфира и анимация эквалайзера */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10121a] border border-[#232738]">
            {wsStatus === 'connected' ? (
              <>
                {/* Анимированный эквалайзер */}
                <div className="flex items-end gap-0.5 h-3.5 w-4">
                  <div className="w-1 bg-emerald-400 rounded-full animate-eq-1" />
                  <div className="w-1 bg-emerald-400 rounded-full animate-eq-2" />
                  <div className="w-1 bg-emerald-400 rounded-full animate-eq-3" />
                </div>
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider hidden sm:inline font-mono">
                  В эфире
                </span>
              </>
            ) : wsStatus === 'connecting' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400 text-xs font-medium hidden sm:inline">
                  Подключение...
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-400 text-xs font-medium hidden sm:inline">
                  Офлайн
                </span>
              </>
            )}
          </div>
        </div>

        {/* Правая часть: быстрые действия диджея */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchRoomData}
            title="Обновить список треков"
            className="p-2.5 rounded-xl bg-[#10121a] hover:bg-[#1a1d2b] text-zinc-400 hover:text-white border border-[#232738] transition-all cursor-pointer active:scale-[0.97]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black font-extrabold text-xs uppercase tracking-wider shadow-md shadow-amber-400/20 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">QR-код гостям</span>
            <span className="sm:hidden">QR</span>
          </button>
        </div>
      </header>

      {/* Основной экран стола заказов */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Панель фильтров: Очередь / История / Поиск */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center bg-[#10121a] p-1.5 rounded-2xl border border-[#232738] self-start sm:self-auto shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Очередь</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold tabular-nums ${
                  activeTab === 'queue'
                    ? 'bg-black text-amber-400'
                    : 'bg-[#1e2233] text-zinc-300'
                }`}
              >
                {queueRequests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>История</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold tabular-nums ${
                  activeTab === 'history'
                    ? 'bg-black text-amber-400'
                    : 'bg-[#1e2233] text-zinc-300'
                }`}
              >
                {historyRequests.length}
              </span>
            </button>
          </div>

          {/* Поиск */}
          {requests.length > 3 && (
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Поиск по названию или имени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#10121a] border border-[#232738] focus:border-amber-400 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-white placeholder:text-zinc-500 outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Список треков */}
        {displayedList.length === 0 ? (
          /* Empty State — Винил в ожидании */
          <div className="flex flex-col items-center justify-center p-10 sm:p-16 rounded-3xl bg-[#10121a]/60 border border-[#232738] text-center my-6 relative overflow-hidden">
            {/* Фоновое свечение */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative mb-5">
              <div className="w-24 h-24 rounded-full bg-[#161926] border-2 border-[#2b3047] flex items-center justify-center shadow-xl">
                <Disc3 className="w-12 h-12 text-zinc-500 group-hover:text-amber-400 transition-colors animate-vinyl-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/20 animate-pulse pointer-events-none" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              {activeTab === 'queue'
                ? searchQuery
                  ? 'Ничего не найдено по запросу'
                  : 'Очередь треков пуста'
                : 'История пока чиста'}
            </h3>
            <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
              {activeTab === 'queue'
                ? 'Выведите QR-код на экран или назовите код комнаты в микрофон, чтобы гости могли заказать свои любимые треки.'
                : 'Здесь будут сохраняться сыгранные и отклоненные треки вашей сессии.'}
            </p>

            {activeTab === 'queue' && !searchQuery && (
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-400/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4 stroke-[2.5]" />
                <span>Открыть QR-код для гостей</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedList.map((req, idx) => (
              <RequestCard
                key={req.id}
                request={req}
                index={activeTab === 'queue' ? idx : undefined}
                onUpdateStatus={handleUpdateStatus}
                isNew={req.id === newestRequestId}
              />
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно QR-кода */}
      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        roomCode={room.code}
      />
    </div>
  );
};
