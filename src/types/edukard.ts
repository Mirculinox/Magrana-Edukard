export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CardKind = 'study' | 'privilege' | 'arena';
export type RequirementType =
  | 'none'
  | 'same_card_copies'
  | 'specific_card_copies'
  | 'rarity_count'
  | 'collection_count';

export interface EdukardRoom {
  id: string;
  teacher_id: string;
  code: string;
  title: string;
  subject: string;
  magrana_class_id: string | null;
  mode: 'collection' | 'arena';
  pack_cost: number;
  cards_per_pack: number;
  starting_coins: number;
  require_flash_on_play: boolean;
  reward_rules: {
    actimagen: number;
    examenes: number;
    colab: number;
    control_positive: number;
  };
  is_active: boolean;
  created_at: string;
}

export interface EdukardCollection {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  description: string;
  is_public: boolean;
  tags?: string[];
  author_name?: string;
  downloads_count?: number;
  created_at: string;
}

export interface EdukardCard {
  id: string;
  teacher_id: string;
  collection_id: string | null;
  room_id: string | null;
  kind: CardKind;
  title: string;
  summary: string;
  rarity: CardRarity;
  icon: string;
  color: string;
  flash_question: string | null;
  flash_options: string[];
  flash_correct_index: number;
  requirement_type: RequirementType;
  requirement_card_id: string | null;
  requirement_rarity: CardRarity | null;
  requirement_count: number;
  consume_requirements: boolean;
  requires_teacher_validation: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface EdukardWallet {
  id: string;
  room_id: string;
  student_key: string;
  magrana_student_id: string | null;
  student_name: string;
  coins: number;
  total_coins_earned: number;
  packs_opened: number;
}

export interface EdukardInventoryItem {
  id: string;
  room_id: string;
  student_key: string;
  card_id: string;
  quantity: number;
  ever_owned: boolean;
}

export interface EdukardRedemption {
  id: string;
  room_id: string;
  student_key: string;
  student_name: string;
  card_id: string;
  card_title: string;
  card_rarity: CardRarity;
  status: 'pending' | 'approved' | 'rejected';
  flash_passed: boolean;
  consumed_summary: Array<{ title: string; count: number }>;
  teacher_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const RARITY_META: Record<
  CardRarity,
  {
    label: string;
    border: string;
    bg: string;
    badge: string;
    glow: string;
    prob: string;
  }
> = {
  common: {
    label: 'Común',
    border: 'border-slate-500/60',
    bg: 'from-slate-800/95 to-slate-900/95',
    badge: 'bg-slate-700 text-slate-200',
    glow: 'shadow-slate-900/40',
    prob: '60%',
  },
  rare: {
    label: 'Rara',
    border: 'border-sky-400/80',
    bg: 'from-sky-950/95 to-slate-900/95',
    badge: 'bg-sky-500/20 text-sky-300 border border-sky-400/40',
    glow: 'shadow-sky-500/20',
    prob: '25%',
  },
  epic: {
    label: 'Épica',
    border: 'border-purple-400/85',
    bg: 'from-purple-950/95 to-slate-900/95',
    badge: 'bg-purple-500/20 text-purple-300 border border-purple-400/40',
    glow: 'shadow-purple-500/25',
    prob: '11%',
  },
  legendary: {
    label: 'Legendaria',
    border: 'border-amber-400/90',
    bg: 'from-amber-950/90 via-slate-900/95 to-amber-950/80',
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-400/50',
    glow: 'shadow-amber-500/30',
    prob: '4%',
  },
};
