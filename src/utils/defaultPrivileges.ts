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
 * Mazo base equilibrado que se crea automáticamente en cada nueva gamificación.
 * Sin efectos invasivos en exámenes (solo un bonus controlado de nota) e incluye
 * recompensas de monedas.
 */
export const DEFAULT_PRIVILEGE_CARDS: DefaultPrivilegeCardTemplate[] = [
  {
    title: 'Bolsa de Monedas (+20 🪙)',
    summary: 'Recibe 20 monedas extra directas en tu saldo para abrir más sobres.',
    rarity: 'common',
    icon: '🪙',
    color: '#64748b',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 2,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Elegir Sitio Hoy',
    summary: 'Elige tu puesto en clase durante toda la sesión de hoy.',
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
    title: 'Elegir Pareja o Grupo',
    summary: 'Elige con quién trabajar en la próxima actividad por parejas o en equipo.',
    rarity: 'rare',
    icon: '👥',
    color: '#0284c7',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 3,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Pista del Docente',
    summary: 'Pide una pista orientativa al profesor durante una actividad práctica de clase.',
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
    title: 'Cofre del Tesoro (+45 🪙)',
    summary: 'Consigue 45 monedas directas para acelerar tu colección de cartas.',
    rarity: 'epic',
    icon: '💰',
    color: '#9333ea',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 4,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Bonus de Examen (+0,25)',
    summary: 'Suma +0,25 puntos directos en un examen del trimestre (requiere sacrificio de cartas de temario).',
    rarity: 'legendary',
    icon: '📜',
    color: '#d97706',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 6,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
];

/**
 * Catálogo ampliado de plantillas de efectos listos para añadir en 1 clic desde la pestaña Privilegios.
 */
export const PRIVILEGE_TEMPLATE_CATALOG: DefaultPrivilegeCardTemplate[] = [
  ...DEFAULT_PRIVILEGE_CARDS,
  {
    title: 'Bonus de Examen (+0,5)',
    summary: 'Suma +0,5 puntos directos en un examen del trimestre (sacrificio alto de cartas de temario).',
    rarity: 'legendary',
    icon: '🏆',
    color: '#d97706',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 8,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: '+0,2 en Actividad de Clase',
    summary: 'Suma +0,2 puntos a una actividad o práctica evaluable del trimestre.',
    rarity: 'rare',
    icon: '📈',
    color: '#0284c7',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 3,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Sobre Extra Gratis (+30 🪙)',
    summary: 'Recibe el equivalente a un sobre completo (30 monedas) en tu saldo.',
    rarity: 'rare',
    icon: '🎁',
    color: '#0284c7',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 3,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Revisión Previa de Borrador',
    summary: 'El docente revisa tu borrador de un trabajo y te da feedback antes de la entrega final.',
    rarity: 'rare',
    icon: '🔎',
    color: '#0284c7',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 3,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Elegir Orden de Exposición',
    summary: 'Elige en qué turno o día quieres realizar tu presentación oral.',
    rarity: 'common',
    icon: '🗓️',
    color: '#64748b',
    requirement_type: 'collection_count',
    requirement_rarity: null,
    requirement_count: 2,
    consume_requirements: true,
    requires_teacher_validation: true,
  },
  {
    title: 'Bonus Cooperativo (+0,2)',
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
    title: 'Segunda Oportunidad en Práctica',
    summary: 'Permite repetir o mejorar una actividad práctica del trimestre.',
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
