import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRoom, sendSongRequest } from '../api/client';
import type { Room, SongRequest } from '../types';
import {
  Send,
  Music,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Disc3,
  Flame,
  Heart,
  Sparkles,
  Zap,
} from 'lucide-react';

const LOCAL_STORAGE_GUEST_NAME_KEY = 'dj_guest_name';
const LOCAL_STORAGE_MY_REQUESTS_KEY = 'dj_my_requests';

// Быстрые теги / настроения для заказа
const VIBE_SUGGESTIONS = [
  { label: 'Танцевальный хит', icon: Flame, tag: '[Хит] ' },
  { label: 'Медляк', icon: Heart, tag: '[Медляк] ' },
  { label: 'Поздравление', icon: Sparkles, tag: '[Поздравление] ' },
  { label: 'Драйв', icon: Zap, tag: '[Драйв] ' },
];

export const GuestRoomPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();

  const [room, setRoom] = useState<Room | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(Boolean(code));
  const [roomError, setRoomError] = useState<string | null>(!code ? 'Код комнаты не указан' : null);

  const [songText, setSongText] = useState('');
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_GUEST_NAME_KEY) || '';
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Список отправленных треков этого гостя
  const [mySentRequests, setMySentRequests] = useState<SongRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_MY_REQUESTS_KEY}_${code}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!code) return;

    let isMounted = true;
    getRoom(code)
      .then((data) => {
        if (isMounted) {
          setRoom(data.room);
          setLoadingRoom(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRoomError(`Комната #${code} не найдена`);
          setLoadingRoom(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !songText.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(false);

    try {
      if (guestName.trim()) {
        localStorage.setItem(LOCAL_STORAGE_GUEST_NAME_KEY, guestName.trim());
      }

      const newRequest = await sendSongRequest(code, songText, guestName);

      const updatedList = [newRequest, ...mySentRequests];
      setMySentRequests(updatedList);
      try {
        localStorage.setItem(
          `${LOCAL_STORAGE_MY_REQUESTS_KEY}_${code}`,
          JSON.stringify(updatedList.slice(0, 20)),
        );
      } catch {
        // quota handled
      }

      setSongText('');
      setSuccessMessage(true);

      setTimeout(() => {
        setSuccessMessage(false);
      }, 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось отправить заказ';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVibeTagClick = (tag: string) => {
    if (!songText.includes(tag.trim())) {
      setSongText((prev) => `${tag}${prev}`);
    }
  };

  if (loadingRoom) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <Disc3 className="w-12 h-12 text-amber-400 animate-vinyl-spin mb-4" />
        <p className="text-zinc-400 text-xs uppercase tracking-widest font-mono">
          Подключение к эфиру DJ...
        </p>
      </main>
    );
  }

  if (roomError || !room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">{roomError || 'Комната не найдена'}</h2>
        <p className="text-sm text-zinc-400 mb-6 max-w-xs leading-relaxed">
          Проверьте правильность кода у диджея или вернитесь на главную страницу
        </p>
        <Link
          to="/"
          className="px-6 py-3 rounded-xl bg-[#161926] hover:bg-[#232738] text-white font-bold text-xs uppercase tracking-wider border border-[#2b3047] transition-all cursor-pointer"
        >
          На главную
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-14 pt-4 px-4 sm:px-6 max-w-lg mx-auto flex flex-col justify-between">
      <div>
        {/* Шапка гостевой страницы */}
        <header className="flex items-center justify-between pb-4 mb-5 border-b border-[#232738]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c2030] to-[#12141e] border border-[#2b3047] flex items-center justify-center text-amber-400 shadow-md">
              <Disc3 className="w-5 h-5 animate-vinyl-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white">DJ Room</h1>
                <span className="font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded text-xs tabular-nums">
                  #{room.code}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>DJ принимает заказы</span>
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="text-[11px] text-zinc-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-[#10121a] border border-[#232738]"
          >
            Выход
          </Link>
        </header>

        {/* Уведомление об успешной отправке */}
        {successMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-100 flex items-start gap-3 shadow-lg shadow-emerald-950/40 animate-in fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-emerald-300">
                Трек отправлен диджею!
              </div>
              <div className="text-xs text-emerald-200/80 mt-0.5 leading-relaxed">
                Диджей увидит вашу заявку у себя в очереди треков.
              </div>
            </div>
          </div>
        )}

        {/* Ошибка отправки */}
        {submitError && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">{submitError}</div>
          </div>
        )}

        {/* Форма заказа песни */}
        <section className="deck-card border border-[#232738] rounded-3xl p-5 sm:p-6 shadow-xl mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-black text-white">Заказать песню</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Напишите название трека или исполнителя
            </p>
          </div>

          {/* Быстрые теги настроения */}
          <div className="mb-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">
              Быстрый акцент (опционально)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VIBE_SUGGESTIONS.map((v) => {
                const IconComponent = v.icon;
                return (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => handleVibeTagClick(v.tag)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161926] hover:bg-[#1f2335] active:scale-[0.97] border border-[#2b3047] text-zinc-300 hover:text-white text-xs transition-colors cursor-pointer"
                  >
                    <IconComponent className="w-3 h-3 text-amber-400" />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Поле названия трека */}
            <div>
              <label
                htmlFor="song-text"
                className="block text-[11px] font-bold text-zinc-300 mb-1.5 uppercase tracking-wider"
              >
                Песня или артист <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="song-text"
                  type="text"
                  required
                  autoFocus
                  placeholder="Например: Daft Punk - One More Time"
                  value={songText}
                  onChange={(e) => setSongText(e.target.value)}
                  className="w-full bg-[#0a0b10] border border-[#232738] focus:border-amber-400 rounded-xl px-4 py-3.5 pl-11 text-white placeholder:text-zinc-600 outline-none transition-colors text-sm shadow-inner"
                />
                <Music className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Имя гостя */}
            <div>
              <label
                htmlFor="guest-name"
                className="block text-[11px] font-bold text-zinc-300 mb-1.5 uppercase tracking-wider"
              >
                Ваше имя <span className="text-zinc-500 font-normal">(по желанию)</span>
              </label>
              <div className="relative">
                <input
                  id="guest-name"
                  type="text"
                  maxLength={50}
                  placeholder="Как к вам обращаться?"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-[#0a0b10] border border-[#232738] focus:border-amber-400 rounded-xl px-4 py-3.5 pl-11 text-white placeholder:text-zinc-600 outline-none transition-colors text-sm shadow-inner"
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={submitting || !songText.trim()}
              className="w-full mt-2 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] font-black text-black text-xs uppercase tracking-wider shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                  <span>Отправляем трек в эфир...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Отправить диджею</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* История заказов текущего гостя */}
        {mySentRequests.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1 font-mono">
              Ваши отправленные заявки ({mySentRequests.length})
            </h3>
            <div className="flex flex-col gap-2">
              {mySentRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-[#10121a] border border-[#232738] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-zinc-200 font-medium truncate">{req.song_text}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 bg-[#161926] px-2 py-0.5 rounded font-mono shrink-0">
                    В очереди
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="text-center text-[11px] text-zinc-400 py-3 font-mono">
        DJ Request Live Table
      </footer>
    </main>
  );
};
