import React, { useState } from 'react';
import type { SongRequest, RequestStatus } from '../types';
import { Check, X, User, Clock, RotateCcw, Disc, Sparkles } from 'lucide-react';
import { formatTimeAgo } from '../utils/helpers';

interface RequestCardProps {
  request: SongRequest;
  onUpdateStatus: (id: number, status: RequestStatus) => Promise<void>;
  isNew?: boolean;
  index?: number;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onUpdateStatus,
  isNew = false,
  index,
}) => {
  const [loadingAction, setLoadingAction] = useState<RequestStatus | null>(null);

  const handleAction = async (status: RequestStatus) => {
    if (loadingAction) return;
    setLoadingAction(status);
    try {
      await onUpdateStatus(request.id, status);
    } finally {
      setLoadingAction(null);
    }
  };

  const isPending = request.status === 'pending';
  const isPlayed = request.status === 'played';
  const isRejected = request.status === 'rejected';

  return (
    <article
      className={`relative group rounded-2xl p-4 sm:p-5 border transition-all duration-300 ${
        isNew
          ? 'bg-gradient-to-r from-amber-500/10 via-[#151824] to-[#10121a] border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
          : isPending
          ? 'deck-card border-[#232738] hover:border-zinc-600 shadow-md hover:shadow-xl'
          : isPlayed
          ? 'bg-[#10121a]/60 border-emerald-900/30 opacity-70 hover:opacity-90'
          : 'bg-[#10121a]/40 border-[#1a1d2b]/60 opacity-55 hover:opacity-80'
      }`}
    >
      {/* Светодиодный индикатор нового трека */}
      {isNew && (
        <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-400/30 animate-pulse">
          <Sparkles className="w-3 h-3" />
          <span>Новый заказ</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Инфо-блок трека */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Индикатор номера / Винил */}
          <div
            className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-mono text-xs font-bold transition-colors ${
              isPending
                ? 'bg-[#1c2030] text-amber-400 border border-amber-400/20'
                : isPlayed
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}
          >
            {isPending ? (
              typeof index === 'number' ? (
                <span className="tabular-nums">#{String(index + 1).padStart(2, '0')}</span>
              ) : (
                <Disc className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
              )
            ) : isPlayed ? (
              <Check className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            ) : (
              <X className="w-5 h-5 text-rose-400/80 stroke-[2.5]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Мета-информация (Гость, время, статус) */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Время заказа */}
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-[#161926] border border-[#232738] px-2 py-0.5 rounded-md font-mono tabular-nums">
                <Clock className="w-3 h-3 text-zinc-500" />
                {formatTimeAgo(request.created_at)}
              </span>

              {/* Имя заказчика */}
              {request.guest_name ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-200 bg-amber-950/40 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium">
                  <User className="w-3 h-3 text-amber-400" />
                  {request.guest_name}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500 bg-[#161926] px-2 py-0.5 rounded-md">
                  Гость вечеринки
                </span>
              )}

              {/* Статус в истории */}
              {isPlayed && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                  Сыграно
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-300 bg-rose-950/50 border border-rose-500/30 px-2 py-0.5 rounded-md font-semibold">
                  Отклонено
                </span>
              )}
            </div>

            {/* Название трека */}
            <h4 className="text-lg sm:text-xl font-bold tracking-tight text-white break-words select-text leading-snug">
              {request.song_text}
            </h4>
          </div>
        </div>

        {/* Кнопки управления диджея (Тактильные кнопки DJ-деки) */}
        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
          {isPending ? (
            <>
              {/* Кнопка "Сыграно" — яркий тактильный акцент */}
              <button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAction('played')}
                title="Отметить как сыгранный"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-black font-bold text-xs uppercase tracking-wider border border-emerald-500/30 hover:border-emerald-400 shadow-sm hover:shadow-md hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Сыграть</span>
              </button>

              {/* Кнопка "Отклонить" */}
              <button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAction('rejected')}
                title="Отклонить трек"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#161926] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-200 font-semibold text-xs border border-[#232738] hover:border-rose-500/40 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Снять</span>
              </button>
            </>
          ) : (
            /* Возврат в очередь */
            <button
              type="button"
              disabled={Boolean(loadingAction)}
              onClick={() => handleAction('pending')}
              title="Вернуть обратно в очередь"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161926] hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-[#232738] hover:border-zinc-600 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Вернуть в очередь</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
