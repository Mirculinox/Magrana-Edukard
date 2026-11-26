import React from 'react';
import { Flame, Lock, Sparkles, BookOpen } from 'lucide-react';
import { RARITY_META, type EdukardCard } from '../types/edukard';

interface CardVisualProps {
  card: EdukardCard;
  quantity?: number;
  everOwned?: boolean;
  requirementLabel?: string | null;
  canPlay?: boolean;
  isNew?: boolean;
  onStudyClick?: () => void;
  onPlayClick?: () => void;
  compact?: boolean;
}

export default function CardVisual({
  card,
  quantity,
  everOwned = true,
  requirementLabel,
  canPlay = false,
  isNew = false,
  onStudyClick,
  onPlayClick,
  compact = false,
}: CardVisualProps) {
  const meta = RARITY_META[card.rarity] || RARITY_META.common;
  const isLockedInAlbum = quantity === 0 && !everOwned;

  return (
    <div
      className={`relative rounded-2xl border-2 ${meta.border} bg-gradient-to-br ${meta.bg} shadow-xl ${meta.glow} flex flex-col justify-between overflow-hidden transition-transform hover:-translate-y-0.5 ${
        compact ? 'p-3 gap-2' : 'p-4 gap-3'
      } ${isLockedInAlbum ? 'opacity-45 grayscale' : ''}`}
    >
      {/* Cabecera: rareza + tipo + copias */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.badge}`}>
          {meta.label}
        </span>

        <div className="flex items-center gap-1.5">
          {isNew && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 animate-pulse">
              ¡NUEVA!
            </span>
          )}
          {quantity !== undefined && quantity > 0 && (
            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-white/15 text-white border border-white/20">
              x{quantity}
            </span>
          )}
          {quantity === 0 && everOwned && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700">
              Usada (en álbum)
            </span>
          )}
        </div>
      </div>

      {/* Icono + Título + Resumen */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-white/15 shadow-inner"
            style={{ backgroundColor: `${card.color || '#6366f1'}33` }}
          >
            {isLockedInAlbum ? '❓' : card.icon || '🃏'}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block">
              {card.kind === 'study' ? '📚 Temario' : card.kind === 'privilege' ? '⭐ Privilegio' : '⚔️ Arena'}
            </span>
            <h4 className="text-sm font-extrabold text-white leading-tight break-words">
              {isLockedInAlbum ? 'Carta sin descubrir' : card.title}
            </h4>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
          {isLockedInAlbum
            ? 'Abre sobres para descubrir esta carta y desbloquear su ficha de repaso.'
            : card.summary}
        </p>
      </div>

      {/* Requisito de juego (si aplica) */}
      {requirementLabel && !isLockedInAlbum && (
        <div className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/10 text-amber-200 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="leading-snug">{requirementLabel}</span>
        </div>
      )}

      {/* Acciones */}
      {(onStudyClick || onPlayClick) && !isLockedInAlbum && (
        <div className="flex items-center gap-2 pt-1">
          {onStudyClick && card.flash_question && (
            <button
              type="button"
              onClick={onStudyClick}
              className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Repasar</span>
            </button>
          )}
          {onPlayClick && (quantity ?? 0) > 0 && (
            <button
              type="button"
              onClick={onPlayClick}
              disabled={!canPlay}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                canPlay
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-md cursor-pointer'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
            >
              {canPlay ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{canPlay ? 'Jugar carta' : 'Bloqueada'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
