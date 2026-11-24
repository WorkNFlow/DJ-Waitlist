import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getRoom } from '../api/client';
import { ArrowLeft, Loader2, KeyRound, Radio } from 'lucide-react';

export const GuestJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError('Введите код комнаты');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await getRoom(cleanCode);
      navigate(`/room/${cleanCode}`);
    } catch {
      setError('Комната с таким кодом не найдена. Уточните 4-значный код у диджея.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Декоративное фоновое свечение */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Кнопка возврата */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>На главную</span>
        </Link>

        {/* Форма входа */}
        <div className="deck-card border border-[#232738] rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#161926] border border-[#232738] text-[10px] text-zinc-400 uppercase tracking-widest font-mono mb-2">
            <Radio className="w-3 h-3 text-amber-400" />
            <span>Гостевой терминал</span>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">Вход в комнату</h2>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Введите 4-значный номер комнаты, отображаемый на экране или названный диджеем
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/70 border border-rose-800/60 text-rose-200 text-xs text-left">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="room-code" className="sr-only">
                Код комнаты
              </label>
              <input
                id="room-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoFocus
                placeholder="4829"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\s+/g, ''));
                  if (error) setError(null);
                }}
                className="w-full text-center text-3xl font-black font-mono tracking-widest bg-[#0a0b10] border-2 border-[#232738] focus:border-amber-400 rounded-2xl p-4 text-white placeholder:text-zinc-700 outline-none transition-colors tabular-nums shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] font-black text-black text-xs uppercase tracking-wider shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                  <span>Проверяем код...</span>
                </>
              ) : (
                <span>Подключиться к DJ</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};
