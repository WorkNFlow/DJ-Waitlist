import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../api/client';
import {
  Disc3,
  Smartphone,
  Loader2,
  Music,
  ArrowRight,
  Radio,
  Zap,
  Volume2,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      navigate(`/dj/${room.code}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать комнату';
      setError(msg);
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Атмосферный фон ночного клуба */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Верхний статус-бар */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#141724] border border-[#232738] flex items-center justify-center text-amber-400">
            <Radio className="w-4 h-4" />
          </div>
          <span className="font-extrabold tracking-tight text-white text-sm">
            DJ REQUEST
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#10121a] border border-[#232738] text-[11px] text-zinc-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Live Table</span>
        </div>
      </header>

      {/* Центральный блок */}
      <div className="w-full max-w-xl mx-auto my-auto relative z-10 text-center flex flex-col items-center py-8 sm:py-12">
        {/* Иконка диджейского винила */}
        <div className="relative mb-6 group cursor-pointer" onClick={handleCreateRoom}>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-[#1c2030] to-[#10121a] border border-[#2b3047] shadow-2xl shadow-black/80 flex items-center justify-center text-amber-400 transition-all duration-500 group-hover:scale-105 group-hover:border-amber-400/50">
            <Disc3 className="w-10 h-10 animate-vinyl-spin group-hover:text-amber-300 transition-colors" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-amber-400/10 blur-sm pointer-events-none -z-10 group-hover:bg-amber-400/20 transition-all" />
        </div>

        {/* Заголовок */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4 leading-[1.1]">
          Стол заказов для вашего <span className="text-amber-400">сета</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mb-8 max-w-md leading-relaxed text-balance">
          Интерактивная очередь треков в реальном времени. Гости заказывают любимую музыку по QR-коду со смартфона без приложений и регистрации.
        </p>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="w-full mb-6 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/60 text-rose-200 text-xs text-left">
            {error}
          </div>
        )}

        {/* Карточки выбора роли */}
        <div className="w-full flex flex-col sm:flex-row gap-3.5">
          {/* Я — диджей */}
          <button
            type="button"
            disabled={isCreating}
            onClick={handleCreateRoom}
            className="flex-1 group relative p-5 rounded-2xl bg-gradient-to-br from-[#1c2030] to-[#12141e] hover:from-[#23273c] hover:to-[#161826] border border-[#2b3047] hover:border-amber-400/40 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-lg hover:shadow-amber-500/5 disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                {isCreating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="text-base text-white font-extrabold mb-1">
              {isCreating ? 'Создаем сессию...' : 'Я — Диджей'}
            </div>
            <div className="text-xs text-zinc-400 font-normal leading-relaxed">
              Открыть консоль управления треками и сгенерировать QR-код
            </div>
          </button>

          {/* Я — гость */}
          <button
            type="button"
            onClick={() => navigate('/join')}
            className="flex-1 group relative p-5 rounded-2xl bg-[#10121a]/80 hover:bg-[#151824] border border-[#232738] hover:border-zinc-600 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-md"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#1c2030] border border-[#2a2f45] flex items-center justify-center text-zinc-300 group-hover:text-white">
                <Smartphone className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>

            <div className="text-base text-white font-extrabold mb-1">Я — Гость</div>
            <div className="text-xs text-zinc-400 font-normal leading-relaxed">
              Войти по 4-значному коду зала и отправить пожелание
            </div>
          </button>
        </div>
      </div>

      {/* Особенности платформы внизу */}
      <footer className="w-full max-w-2xl mx-auto py-4 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400 bg-[#10121a]/60 border border-[#232738]/60 p-2.5 rounded-xl">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Мгновенный live-эфир</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400 bg-[#10121a]/60 border border-[#232738]/60 p-2.5 rounded-xl">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Без логинов и паролей</span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400 bg-[#10121a]/60 border border-[#232738]/60 p-2.5 rounded-xl">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Звуковой сигнал DJ</span>
          </div>
        </div>
      </footer>
    </main>
  );
};
