import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, ExternalLink, Radio } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  roomCode,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const guestUrl = `${window.location.origin}/room/${roomCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#10121a] border border-[#232738] p-6 sm:p-7 text-center shadow-2xl shadow-black/80 flex flex-col items-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Декоративный свет */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Кнопка закрытия */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть модальное окно"
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-[#1a1d2b] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Заголовок карточки в стиле VIP Pass */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Radio className="w-3.5 h-3.5" />
          <span>Гостевой доступ в эфир</span>
        </div>

        <h3 id="qr-modal-title" className="text-2xl font-black text-white tracking-tight mb-1">
          Заказ треков у DJ
        </h3>
        <p className="text-xs text-zinc-400 mb-6 max-w-xs">
          Наведите камеру смартфона на QR-код для моментального перехода к заказу песни
        </p>

        {/* QR Code Container с четким контрастом */}
        <div className="relative group bg-white p-5 rounded-2xl shadow-xl shadow-black/50 mb-6 flex items-center justify-center ring-4 ring-white/10">
          <QRCodeSVG
            value={guestUrl}
            size={220}
            level="Q"
            marginSize={1}
          />
        </div>

        {/* Номер комнаты крупным LED-шрифтом */}
        <div className="w-full bg-[#0a0b10] border border-[#232738] rounded-2xl p-3.5 mb-4">
          <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">
            Код комнаты для ручного ввода
          </div>
          <div className="text-4xl font-black tracking-widest text-amber-400 select-all font-mono tabular-nums">
            {roomCode}
          </div>
        </div>

        {/* Ссылка и кнопка копирования */}
        <div className="w-full flex items-center gap-2 bg-[#161926] rounded-xl p-2.5 text-xs text-zinc-300 mb-4 border border-[#232738]">
          <span className="truncate flex-1 text-left font-mono pl-1 text-[11px] text-zinc-400">
            {guestUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black rounded-lg font-bold text-xs transition-all cursor-pointer shrink-0 shadow-sm"
            title="Скопировать ссылку"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Готово</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Копия</span>
              </>
            )}
          </button>
        </div>

        {/* Прямая ссылка для тестирования на этом же устройстве */}
        <a
          href={guestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
        >
          <span>Открыть стол заказов в новой вкладке</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
