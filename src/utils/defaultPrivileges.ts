import type { CardRarity, RequirementType } from '../types/edukard';

export interface DefaultPrivilegeCardTemplate {
  title: string;
  summary: string;
  rarity: CardRarity;
  icon: string;
  color: string;
  requirement_type: RequirementType;
  requirement_rarity: CardRarity | null;
  requirement_count: number;
  consume_requirements: boolean;
  requires_teacher_validation: boolean;
}

/**
 * Mazo base equilibrado de cartas de privilegio para cualquier clase nueva.
 * El docente puede activar/desactivar cada una y ajustar cuántas cartas del temario
 * se destruyen al jugarla.
 */
export const DEFAULT_PRIVILEGE_CARDS: DefaultPrivilegeCardTemplate[] = [
  {
    title: 'DJ del Aula',
    summary: 'Elige la música de fondo (aprobada por el profe) durante el trabajo individual.',
    rarity: 'common',
    icon: '🎵',
    color: '#64748b',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 2,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Asiento de Honor',
    summary: 'Elige tu sitio en clase durante toda la sesión de hoy.',
    rarity: 'common',
    icon: '🪑',
    color: '#64748b',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 2,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Pista del Docente',
    summary: 'Pide una pista orientativa al profesor durante una actividad práctica.',
    rarity: 'rare',
    icon: '💡',
    color: '#0284c7',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 3,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Prórroga de 24h',
    summary: 'Entrega una actividad individual hasta 24 horas más tarde sin penalización.',
    rarity: 'epic',
    icon: '⏳',
    color: '#9333ea',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 4,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Báculo del Mentor Cooperativo',
    summary: 'Elige un compañero: si ambos sacáis 7 o más en la siguiente tarea, +0,2 a los dos.',
    rarity: 'epic',
    icon: '🤝',
    color: '#9333ea',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 4,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Pergamino de la Excelencia (+0,2)',
    summary: 'Suma +0,2 puntos directos a una actividad o a la nota del trimestre (requiere sacrificio de cartas de temario).',
    rarity: 'legendary',
    icon: '📜',
    color: '#d97706',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 6,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Llave de Recuperación',
    summary: 'Permite repetir o recuperar una actividad fallida o no entregada del trimestre.',
    rarity: 'legendary',
    icon: '🗝️',
    color: '#d97706',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 6,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
