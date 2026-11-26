-- ============================================================================
-- MAGRANA EDUKARD — Migración completa de tablas, índices, RLS y RPCs atómicas
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Salas / Clases de Edukard (autónomas por PIN o vinculables a Magrana Control)
CREATE TABLE IF NOT EXISTS public.edukard_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  magrana_class_id TEXT NULL,
  mode TEXT NOT NULL DEFAULT 'collection' CHECK (mode IN ('collection', 'arena')),
  pack_cost INTEGER NOT NULL DEFAULT 30 CHECK (pack_cost >= 0),
  cards_per_pack INTEGER NOT NULL DEFAULT 3 CHECK (cards_per_pack BETWEEN 1 AND 6),
  starting_coins INTEGER NOT NULL DEFAULT 60 CHECK (starting_coins >= 0),
  require_flash_on_play BOOLEAN NOT NULL DEFAULT TRUE,
  reward_rules JSONB NOT NULL DEFAULT '{"actimagen": 20, "examenes": 30, "colab": 15, "control_positive": 10}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edukard_rooms_teacher ON public.edukard_rooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_edukard_rooms_magrana_class ON public.edukard_rooms(magrana_class_id);

-- 2. Colecciones de temario (creadas con IA o manualmente, reutilizables)
CREATE TABLE IF NOT EXISTS public.edukard_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  description TEXT DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edukard_collections_teacher ON public.edukard_collections(teacher_id);

-- 3. Cartas (de Temario, Privilegio o Arena)
CREATE TABLE IF NOT EXISTS public.edukard_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  collection_id UUID NULL REFERENCES public.edukard_collections(id) ON DELETE CASCADE,
  room_id UUID NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'study' CHECK (kind IN ('study', 'privilege', 'arena')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  icon TEXT NOT NULL DEFAULT '🃏',
  color TEXT NOT NULL DEFAULT '#6366f1',
  -- Pregunta Flash de repaso (en el reverso de la carta)
  flash_question TEXT NULL,
  flash_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  flash_correct_index INTEGER NOT NULL DEFAULT 0,
  -- Requisitos para jugar esta carta (se consumen/destruyen al jugarla)
  requirement_type TEXT NOT NULL DEFAULT 'none'
    CHECK (requirement_type IN ('none', 'same_card_copies', 'specific_card_copies', 'rarity_count', 'collection_count')),
  requirement_card_id UUID NULL REFERENCES public.edukard_cards(id) ON DELETE SET NULL,
  requirement_rarity TEXT NULL CHECK (requirement_rarity IS NULL OR requirement_rarity IN ('common', 'rare', 'epic', 'legendary')),
  requirement_count INTEGER NOT NULL DEFAULT 0 CHECK (requirement_count >= 0),
  consume_requirements BOOLEAN NOT NULL DEFAULT TRUE,
  requires_teacher_validation BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edukard_cards_collection ON public.edukard_cards(collection_id);
CREATE INDEX IF NOT EXISTS idx_edukard_cards_room ON public.edukard_cards(room_id);
CREATE INDEX IF NOT EXISTS idx_edukard_cards_teacher ON public.edukard_cards(teacher_id);

-- 4. Colecciones activas en cada sala (N:M)
CREATE TABLE IF NOT EXISTS public.edukard_room_collections (
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.edukard_collections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, collection_id)
);

-- 5. Carteras de alumnos por sala
CREATE TABLE IF NOT EXISTS public.edukard_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  student_key TEXT NOT NULL,
  magrana_student_id TEXT NULL,
  student_name TEXT NOT NULL DEFAULT 'Alumno',
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  total_coins_earned INTEGER NOT NULL DEFAULT 0,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, student_key)
);

CREATE INDEX IF NOT EXISTS idx_edukard_wallets_room ON public.edukard_wallets(room_id);

-- 6. Inventario de cartas por alumno y sala (copias acumulables + registro de descubierta)
CREATE TABLE IF NOT EXISTS public.edukard_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  student_key TEXT NOT NULL,
  card_id UUID NOT NULL REFERENCES public.edukard_cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  ever_owned BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, student_key, card_id)
);

CREATE INDEX IF NOT EXISTS idx_edukard_inventory_room_student ON public.edukard_inventory(room_id, student_key);

-- 7. Canjes / cartas jugadas (con validación docente cuando aplica)
CREATE TABLE IF NOT EXISTS public.edukard_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  student_key TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT 'Alumno',
  card_id UUID NOT NULL REFERENCES public.edukard_cards(id) ON DELETE CASCADE,
  card_title TEXT NOT NULL,
  card_rarity TEXT NOT NULL DEFAULT 'common',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  flash_passed BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  teacher_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_edukard_redemptions_room ON public.edukard_redemptions(room_id, status);

-- 8. Libro mayor de monedas (auditoría + idempotencia para recompensas del ecosistema)
CREATE TABLE IF NOT EXISTS public.edukard_coin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  student_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_ref_id TEXT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edukard_ledger_idempotent
  ON public.edukard_coin_ledger(room_id, student_key, source, source_ref_id)
  WHERE source_ref_id IS NOT NULL;

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================
ALTER TABLE public.edukard_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_room_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_coin_ledger ENABLE ROW LEVEL SECURITY;

-- Salas: lectura pública por PIN (para alumnos invitados o autenticados), escritura solo del docente dueño
DROP POLICY IF EXISTS "edukard_rooms_select" ON public.edukard_rooms;
CREATE POLICY "edukard_rooms_select" ON public.edukard_rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_rooms_teacher_write" ON public.edukard_rooms;
CREATE POLICY "edukard_rooms_teacher_write" ON public.edukard_rooms FOR ALL
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- Colecciones: lectura si es pública o del docente o vinculada a una sala activa
DROP POLICY IF EXISTS "edukard_collections_select" ON public.edukard_collections;
CREATE POLICY "edukard_collections_select" ON public.edukard_collections FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_collections_teacher_write" ON public.edukard_collections;
CREATE POLICY "edukard_collections_teacher_write" ON public.edukard_collections FOR ALL
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- Cartas: lectura pública (los alumnos necesitan ver el álbum/sobres), escritura del docente dueño
DROP POLICY IF EXISTS "edukard_cards_select" ON public.edukard_cards;
CREATE POLICY "edukard_cards_select" ON public.edukard_cards FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_cards_teacher_write" ON public.edukard_cards;
CREATE POLICY "edukard_cards_teacher_write" ON public.edukard_cards FOR ALL
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- Relación sala-colección
DROP POLICY IF EXISTS "edukard_room_collections_select" ON public.edukard_room_collections;
CREATE POLICY "edukard_room_collections_select" ON public.edukard_room_collections FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_room_collections_teacher_write" ON public.edukard_room_collections;
CREATE POLICY "edukard_room_collections_teacher_write" ON public.edukard_room_collections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.edukard_rooms r WHERE r.id = room_id AND r.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.edukard_rooms r WHERE r.id = room_id AND r.teacher_id = auth.uid()));

-- Wallets, inventario, canjes y ledger: lectura abierta por sala (las escrituras van vía RPCs SECURITY DEFINER o docente)
DROP POLICY IF EXISTS "edukard_wallets_select" ON public.edukard_wallets;
CREATE POLICY "edukard_wallets_select" ON public.edukard_wallets FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_inventory_select" ON public.edukard_inventory;
CREATE POLICY "edukard_inventory_select" ON public.edukard_inventory FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_redemptions_select" ON public.edukard_redemptions;
CREATE POLICY "edukard_redemptions_select" ON public.edukard_redemptions FOR SELECT USING (true);
DROP POLICY IF EXISTS "edukard_redemptions_teacher_update" ON public.edukard_redemptions;
CREATE POLICY "edukard_redemptions_teacher_update" ON public.edukard_redemptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.edukard_rooms r WHERE r.id = room_id AND r.teacher_id = auth.uid()));
DROP POLICY IF EXISTS "edukard_ledger_select" ON public.edukard_coin_ledger;
CREATE POLICY "edukard_ledger_select" ON public.edukard_coin_ledger FOR SELECT USING (true);

-- ============================================================================
-- RPC 1: Asegurar cartera del alumno al entrar a una sala (con monedas iniciales)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_ensure_wallet(
  p_room_id UUID,
  p_student_key TEXT,
  p_student_name TEXT DEFAULT 'Alumno',
  p_magrana_student_id TEXT DEFAULT NULL
)
RETURNS public.edukard_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.edukard_rooms;
  v_wallet public.edukard_wallets;
BEGIN
  SELECT * INTO v_room FROM public.edukard_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala de Edukard no encontrada';
  END IF;

  INSERT INTO public.edukard_wallets (room_id, student_key, student_name, magrana_student_id, coins, total_coins_earned)
  VALUES (p_room_id, p_student_key, COALESCE(NULLIF(TRIM(p_student_name), ''), 'Alumno'), p_magrana_student_id, v_room.starting_coins, v_room.starting_coins)
  ON CONFLICT (room_id, student_key) DO UPDATE
    SET student_name = COALESCE(NULLIF(TRIM(EXCLUDED.student_name), ''), edukard_wallets.student_name),
        magrana_student_id = COALESCE(EXCLUDED.magrana_student_id, edukard_wallets.magrana_student_id),
        updated_at = NOW()
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

-- ============================================================================
-- RPC 2: Otorgar monedas (idempotente por source + source_ref_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_award_coins(
  p_room_id UUID,
  p_student_key TEXT,
  p_student_name TEXT,
  p_amount INTEGER,
  p_source TEXT,
  p_source_ref_id TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_magrana_student_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.edukard_wallets;
  v_inserted_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'zero_amount');
  END IF;

  v_wallet := public.edukard_ensure_wallet(p_room_id, p_student_key, p_student_name, p_magrana_student_id);

  IF p_source_ref_id IS NOT NULL THEN
    INSERT INTO public.edukard_coin_ledger (room_id, student_key, amount, source, source_ref_id, note)
    VALUES (p_room_id, p_student_key, p_amount, p_source, p_source_ref_id, p_note)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'coins', v_wallet.coins);
    END IF;
  ELSE
    INSERT INTO public.edukard_coin_ledger (room_id, student_key, amount, source, source_ref_id, note)
    VALUES (p_room_id, p_student_key, p_amount, p_source, NULL, p_note);
  END IF;

  UPDATE public.edukard_wallets
  SET coins = GREATEST(0, coins + p_amount),
      total_coins_earned = total_coins_earned + GREATEST(0, p_amount),
      updated_at = NOW()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'coins', v_wallet.coins);
END;
$$;

-- ============================================================================
-- RPC 3: Abrir un sobre atómicamente (Común 60% / Rara 25% / Épica 11% / Legendaria 4%)
-- Acumula copias repetidas (x2, x3, x4...) sin reembolso automático
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_open_pack(
  p_room_id UUID,
  p_student_key TEXT,
  p_student_name TEXT DEFAULT 'Alumno',
  p_magrana_student_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.edukard_rooms;
  v_wallet public.edukard_wallets;
  v_pool_count INTEGER;
  v_roll DOUBLE PRECISION;
  v_target_rarity TEXT;
  v_card public.edukard_cards;
  v_new_qty INTEGER;
  v_drawn JSONB := '[]'::jsonb;
  i INTEGER;
BEGIN
  SELECT * INTO v_room FROM public.edukard_rooms WHERE id = p_room_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala no encontrada o inactiva';
  END IF;

  v_wallet := public.edukard_ensure_wallet(p_room_id, p_student_key, p_student_name, p_magrana_student_id);

  IF v_wallet.coins < v_room.pack_cost THEN
    RAISE EXCEPTION 'No tienes suficientes monedas (necesitas %)', v_room.pack_cost;
  END IF;

  -- Verificar que hay cartas activas en la sala (cartas propias de la sala + colecciones vinculadas)
  SELECT COUNT(*) INTO v_pool_count
  FROM public.edukard_cards c
  WHERE c.is_active = TRUE
    AND (
      c.room_id = p_room_id
      OR c.collection_id IN (SELECT rc.collection_id FROM public.edukard_room_collections rc WHERE rc.room_id = p_room_id)
    );

  IF v_pool_count = 0 THEN
    RAISE EXCEPTION 'Esta sala aún no tiene cartas activas en sus sobres';
  END IF;

  -- Descontar monedas del sobre
  UPDATE public.edukard_wallets
  SET coins = coins - v_room.pack_cost,
      packs_opened = packs_opened + 1,
      updated_at = NOW()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.edukard_coin_ledger (room_id, student_key, amount, source, note)
  VALUES (p_room_id, p_student_key, -v_room.pack_cost, 'pack_open', 'Apertura de sobre');

  FOR i IN 1..v_room.cards_per_pack LOOP
    v_roll := random();
    IF v_roll < 0.04 THEN
      v_target_rarity := 'legendary';
    ELSIF v_roll < 0.15 THEN
      v_target_rarity := 'epic';
    ELSIF v_roll < 0.40 THEN
      v_target_rarity := 'rare';
    ELSE
      v_target_rarity := 'common';
    END IF;

    -- Intentar elegir una carta de la rareza sorteada
    SELECT c.* INTO v_card
    FROM public.edukard_cards c
    WHERE c.is_active = TRUE
      AND c.rarity = v_target_rarity
      AND (
        c.room_id = p_room_id
        OR c.collection_id IN (SELECT rc.collection_id FROM public.edukard_room_collections rc WHERE rc.room_id = p_room_id)
      )
    ORDER BY random()
    LIMIT 1;

    -- Fallback si no hay cartas de esa rareza exacta en la sala
    IF NOT FOUND THEN
      SELECT c.* INTO v_card
      FROM public.edukard_cards c
      WHERE c.is_active = TRUE
        AND (
          c.room_id = p_room_id
          OR c.collection_id IN (SELECT rc.collection_id FROM public.edukard_room_collections rc WHERE rc.room_id = p_room_id)
        )
      ORDER BY random()
      LIMIT 1;
    END IF;

    INSERT INTO public.edukard_inventory (room_id, student_key, card_id, quantity, ever_owned, updated_at)
    VALUES (p_room_id, p_student_key, v_card.id, 1, TRUE, NOW())
    ON CONFLICT (room_id, student_key, card_id) DO UPDATE
      SET quantity = edukard_inventory.quantity + 1,
          ever_owned = TRUE,
          updated_at = NOW()
    RETURNING quantity INTO v_new_qty;

    v_drawn := v_drawn || jsonb_build_array(jsonb_build_object(
      'card_id', v_card.id,
      'title', v_card.title,
      'summary', v_card.summary,
      'rarity', v_card.rarity,
      'kind', v_card.kind,
      'icon', v_card.icon,
      'color', v_card.color,
      'new_quantity', v_new_qty,
      'is_new', (v_new_qty = 1)
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'coins', v_wallet.coins,
    'packs_opened', v_wallet.packs_opened,
    'cards', v_drawn
  );
END;
$$;

-- ============================================================================
-- RPC 4: Jugar una carta (valida requisitos y DESTRUYE la carta + copias exigidas)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_play_card(
  p_room_id UUID,
  p_student_key TEXT,
  p_student_name TEXT,
  p_card_id UUID,
  p_flash_passed BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.edukard_cards;
  v_inv public.edukard_inventory;
  v_req_inv public.edukard_inventory;
  v_req_card public.edukard_cards;
  v_needed INTEGER;
  v_remaining INTEGER;
  v_take INTEGER;
  v_row RECORD;
  v_consumed JSONB := '[]'::jsonb;
  v_redemption public.edukard_redemptions;
BEGIN
  SELECT * INTO v_card FROM public.edukard_cards WHERE id = p_card_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carta no encontrada';
  END IF;

  SELECT * INTO v_inv
  FROM public.edukard_inventory
  WHERE room_id = p_room_id AND student_key = p_student_key AND card_id = p_card_id
  FOR UPDATE;

  IF NOT FOUND OR v_inv.quantity < 1 THEN
    RAISE EXCEPTION 'No tienes ninguna copia disponible de esta carta';
  END IF;

  -- Validar y consumir requisitos según requirement_type
  IF v_card.requirement_type = 'same_card_copies' AND v_card.requirement_count > 1 THEN
    v_needed := v_card.requirement_count;
    IF v_inv.quantity < v_needed THEN
      RAISE EXCEPTION 'Necesitas % copias de "%" para jugarla (tienes %)', v_needed, v_card.title, v_inv.quantity;
    END IF;
    UPDATE public.edukard_inventory
    SET quantity = quantity - CASE WHEN v_card.consume_requirements THEN v_needed ELSE 1 END,
        updated_at = NOW()
    WHERE id = v_inv.id;
    v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', v_card.title, 'count', CASE WHEN v_card.consume_requirements THEN v_needed ELSE 1 END));

  ELSIF v_card.requirement_type = 'specific_card_copies' AND v_card.requirement_card_id IS NOT NULL AND v_card.requirement_count > 0 THEN
    SELECT * INTO v_req_card FROM public.edukard_cards WHERE id = v_card.requirement_card_id;
    SELECT * INTO v_req_inv
    FROM public.edukard_inventory
    WHERE room_id = p_room_id AND student_key = p_student_key AND card_id = v_card.requirement_card_id
    FOR UPDATE;

    IF NOT FOUND OR v_req_inv.quantity < v_card.requirement_count THEN
      RAISE EXCEPTION 'Necesitas % copias de "%" para jugar esta carta (tienes %)',
        v_card.requirement_count, COALESCE(v_req_card.title, 'la carta requerida'), COALESCE(v_req_inv.quantity, 0);
    END IF;

    -- Destruir la carta jugada
    UPDATE public.edukard_inventory SET quantity = quantity - 1, updated_at = NOW() WHERE id = v_inv.id;
    v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', v_card.title, 'count', 1));

    -- Destruir también las copias exigidas
    IF v_card.consume_requirements THEN
      UPDATE public.edukard_inventory SET quantity = quantity - v_card.requirement_count, updated_at = NOW() WHERE id = v_req_inv.id;
      v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', COALESCE(v_req_card.title, 'Requisito'), 'count', v_card.requirement_count));
    END IF;

  ELSIF v_card.requirement_type IN ('rarity_count', 'collection_count') AND v_card.requirement_count > 0 THEN
    -- Comprobar cuántas copias de cartas de temario (excluyendo la carta jugada) tiene el alumno
    SELECT COALESCE(SUM(inv.quantity), 0) INTO v_remaining
    FROM public.edukard_inventory inv
    JOIN public.edukard_cards c ON c.id = inv.card_id
    WHERE inv.room_id = p_room_id
      AND inv.student_key = p_student_key
      AND inv.quantity > 0
      AND inv.card_id <> p_card_id
      AND c.kind = 'study'
      AND (v_card.requirement_type <> 'rarity_count' OR c.rarity = v_card.requirement_rarity);

    IF v_remaining < v_card.requirement_count THEN
      RAISE EXCEPTION 'Necesitas % cartas de temario% para jugar esta carta (tienes %)',
        v_card.requirement_count,
        CASE WHEN v_card.requirement_type = 'rarity_count' THEN ' (' || COALESCE(v_card.requirement_rarity, '') || ')' ELSE '' END,
        v_remaining;
    END IF;

    -- Destruir la carta jugada
    UPDATE public.edukard_inventory SET quantity = quantity - 1, updated_at = NOW() WHERE id = v_inv.id;
    v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', v_card.title, 'count', 1));

    -- Destruir también las copias de temario consumidas (priorizando cartas repetidas primero)
    IF v_card.consume_requirements THEN
      v_needed := v_card.requirement_count;
      FOR v_row IN
        SELECT inv.id AS inv_id, inv.quantity, c.title
        FROM public.edukard_inventory inv
        JOIN public.edukard_cards c ON c.id = inv.card_id
        WHERE inv.room_id = p_room_id
          AND inv.student_key = p_student_key
          AND inv.quantity > 0
          AND inv.card_id <> p_card_id
          AND c.kind = 'study'
          AND (v_card.requirement_type <> 'rarity_count' OR c.rarity = v_card.requirement_rarity)
        ORDER BY inv.quantity DESC, inv.updated_at ASC
      LOOP
        EXIT WHEN v_needed <= 0;
        v_take := LEAST(v_row.quantity, v_needed);
        UPDATE public.edukard_inventory SET quantity = quantity - v_take, updated_at = NOW() WHERE id = v_row.inv_id;
        v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', v_row.title, 'count', v_take));
        v_needed := v_needed - v_take;
      END LOOP;
    END IF;

  ELSE
    -- Sin requisitos extra: solo se destruye la carta jugada
    UPDATE public.edukard_inventory SET quantity = quantity - 1, updated_at = NOW() WHERE id = v_inv.id;
    v_consumed := v_consumed || jsonb_build_array(jsonb_build_object('title', v_card.title, 'count', 1));
  END IF;

  INSERT INTO public.edukard_redemptions (
    room_id, student_key, student_name, card_id, card_title, card_rarity,
    status, flash_passed, consumed_summary, resolved_at
  )
  VALUES (
    p_room_id,
    p_student_key,
    COALESCE(NULLIF(TRIM(p_student_name), ''), 'Alumno'),
    v_card.id,
    v_card.title,
    v_card.rarity,
    CASE WHEN v_card.requires_teacher_validation THEN 'pending' ELSE 'approved' END,
    COALESCE(p_flash_passed, FALSE),
    v_consumed,
    CASE WHEN v_card.requires_teacher_validation THEN NULL ELSE NOW() END
  )
  RETURNING * INTO v_redemption;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'redemption', to_jsonb(v_redemption),
    'consumed', v_consumed
  );
END;
$$;
