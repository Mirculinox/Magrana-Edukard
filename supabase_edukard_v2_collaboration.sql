-- ============================================================================
-- MAGRANA EDUKARD v2 — Código de Usuario Docente, Co-edición e Invitaciones
-- + Enlace de múltiples clases de Magrana Control a una Gamificación por código
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Código único de usuario para cada docente (para recibir invitaciones de co-edición)
CREATE TABLE IF NOT EXISTS public.edukard_teacher_codes (
  user_id UUID PRIMARY KEY,
  user_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Docente',
  email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edukard_teacher_codes_code ON public.edukard_teacher_codes(user_code);

-- 2. Colaboradores / Co-editores de una Gamificación
CREATE TABLE IF NOT EXISTS public.edukard_room_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  owner_name TEXT NOT NULL DEFAULT 'Docente',
  collaborator_id UUID NOT NULL,
  collaborator_code TEXT NOT NULL,
  collaborator_name TEXT NOT NULL DEFAULT 'Docente',
  room_title TEXT NOT NULL DEFAULT 'Gamificación',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ NULL,
  UNIQUE (room_id, collaborator_id)
);

CREATE INDEX IF NOT EXISTS idx_edukard_collab_user ON public.edukard_room_collaborators(collaborator_id, status);
CREATE INDEX IF NOT EXISTS idx_edukard_collab_room ON public.edukard_room_collaborators(room_id);

-- 3. Vinculación N:1 — múltiples clases de Magrana Control pueden usar la misma Gamificación
CREATE TABLE IF NOT EXISTS public.edukard_class_links (
  class_id TEXT PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.edukard_rooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edukard_class_links_room ON public.edukard_class_links(room_id);

-- Migrar vínculos antiguos de edukard_rooms.magrana_class_id si existieran
INSERT INTO public.edukard_class_links (class_id, room_id, teacher_id)
SELECT magrana_class_id, id, teacher_id
FROM public.edukard_rooms
WHERE magrana_class_id IS NOT NULL AND TRIM(magrana_class_id) <> ''
ON CONFLICT (class_id) DO NOTHING;

-- ============================================================================
-- Helper de permisos: ¿es el usuario dueño o co-editor aceptado de la gamificación?
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_can_edit_room(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.edukard_rooms r
    WHERE r.id = p_room_id AND r.teacher_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.edukard_room_collaborators c
    WHERE c.room_id = p_room_id
      AND c.collaborator_id = p_user_id
      AND c.status = 'accepted'
  );
$$;

-- ============================================================================
-- RLS para nuevas tablas y actualización para co-editores
-- ============================================================================
ALTER TABLE public.edukard_teacher_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_room_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edukard_class_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edukard_teacher_codes_select" ON public.edukard_teacher_codes;
CREATE POLICY "edukard_teacher_codes_select" ON public.edukard_teacher_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "edukard_collab_select" ON public.edukard_room_collaborators;
CREATE POLICY "edukard_collab_select" ON public.edukard_room_collaborators FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = collaborator_id);

DROP POLICY IF EXISTS "edukard_collab_owner_delete" ON public.edukard_room_collaborators;
CREATE POLICY "edukard_collab_owner_delete" ON public.edukard_room_collaborators FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = collaborator_id);

DROP POLICY IF EXISTS "edukard_collab_invitee_update" ON public.edukard_room_collaborators;
CREATE POLICY "edukard_collab_invitee_update" ON public.edukard_room_collaborators FOR UPDATE
  USING (auth.uid() = collaborator_id);

DROP POLICY IF EXISTS "edukard_class_links_select" ON public.edukard_class_links;
CREATE POLICY "edukard_class_links_select" ON public.edukard_class_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "edukard_class_links_teacher_write" ON public.edukard_class_links;
CREATE POLICY "edukard_class_links_teacher_write" ON public.edukard_class_links FOR ALL
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- Permitir a co-editores aceptados editar rooms, cards de esa room, room_collections y redemptions
DROP POLICY IF EXISTS "edukard_rooms_teacher_write" ON public.edukard_rooms;
CREATE POLICY "edukard_rooms_teacher_write" ON public.edukard_rooms FOR ALL
  USING (public.edukard_can_edit_room(id, auth.uid()))
  WITH CHECK (auth.uid() = teacher_id OR public.edukard_can_edit_room(id, auth.uid()));

DROP POLICY IF EXISTS "edukard_cards_teacher_write" ON public.edukard_cards;
CREATE POLICY "edukard_cards_teacher_write" ON public.edukard_cards FOR ALL
  USING (
    auth.uid() = teacher_id
    OR (room_id IS NOT NULL AND public.edukard_can_edit_room(room_id, auth.uid()))
  )
  WITH CHECK (
    auth.uid() = teacher_id
    OR (room_id IS NOT NULL AND public.edukard_can_edit_room(room_id, auth.uid()))
  );

DROP POLICY IF EXISTS "edukard_room_collections_teacher_write" ON public.edukard_room_collections;
CREATE POLICY "edukard_room_collections_teacher_write" ON public.edukard_room_collections FOR ALL
  USING (public.edukard_can_edit_room(room_id, auth.uid()))
  WITH CHECK (public.edukard_can_edit_room(room_id, auth.uid()));

DROP POLICY IF EXISTS "edukard_redemptions_teacher_update" ON public.edukard_redemptions;
CREATE POLICY "edukard_redemptions_teacher_update" ON public.edukard_redemptions FOR UPDATE
  USING (public.edukard_can_edit_room(room_id, auth.uid()));

-- ============================================================================
-- RPC: Generar/obtener el Código de Usuario del docente (MGR-XXXXXX)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_ensure_teacher_code(
  p_display_name TEXT DEFAULT 'Docente',
  p_email TEXT DEFAULT NULL
)
RETURNS public.edukard_teacher_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.edukard_teacher_codes;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_attempt INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT * INTO v_row FROM public.edukard_teacher_codes WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := 'MGR-'
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1)
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1)
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1)
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1)
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1)
      || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);

    BEGIN
      INSERT INTO public.edukard_teacher_codes (user_id, user_code, display_name, email)
      VALUES (v_uid, v_code, COALESCE(NULLIF(TRIM(p_display_name), ''), 'Docente'), p_email)
      RETURNING * INTO v_row;
      RETURN v_row;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 10 THEN
        RAISE EXCEPTION 'No se pudo generar un código único';
      END IF;
    END;
  END LOOP;
END;
$$;

-- ============================================================================
-- RPC: Invitar a otro docente por su Código de Usuario (aparece en su Bandeja Central)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_invite_collaborator(
  p_room_id UUID,
  p_target_user_code TEXT,
  p_owner_name TEXT DEFAULT 'Docente'
)
RETURNS public.edukard_room_collaborators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room public.edukard_rooms;
  v_target public.edukard_teacher_codes;
  v_inv public.edukard_room_collaborators;
  v_clean_code TEXT := UPPER(TRIM(COALESCE(p_target_user_code, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT * INTO v_room FROM public.edukard_rooms WHERE id = p_room_id;
  IF NOT FOUND OR NOT public.edukard_can_edit_room(p_room_id, v_uid) THEN
    RAISE EXCEPTION 'No tienes permisos para compartir esta gamificación';
  END IF;

  SELECT * INTO v_target FROM public.edukard_teacher_codes WHERE UPPER(user_code) = v_clean_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ningún docente con el código "%". Pídele que abra Edukard una vez para generar su código.', v_clean_code;
  END IF;

  IF v_target.user_id = v_uid THEN
    RAISE EXCEPTION 'No puedes invitarte a ti mismo';
  END IF;

  INSERT INTO public.edukard_room_collaborators (
    room_id, owner_id, owner_name, collaborator_id, collaborator_code, collaborator_name, room_title, status, responded_at
  )
  VALUES (
    p_room_id, v_uid, COALESCE(NULLIF(TRIM(p_owner_name), ''), 'Docente'),
    v_target.user_id, v_target.user_code, v_target.display_name, v_room.title, 'pending', NULL
  )
  ON CONFLICT (room_id, collaborator_id) DO UPDATE
    SET status = CASE WHEN edukard_room_collaborators.status = 'accepted' THEN 'accepted' ELSE 'pending' END,
        owner_name = EXCLUDED.owner_name,
        room_title = EXCLUDED.room_title,
        responded_at = CASE WHEN edukard_room_collaborators.status = 'accepted' THEN edukard_room_collaborators.responded_at ELSE NULL END
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

-- ============================================================================
-- RPC: Vincular una clase de Magrana Control a una Gamificación por su código
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edukard_link_class_by_code(
  p_class_id TEXT,
  p_room_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_room public.edukard_rooms;
  v_clean_code TEXT := UPPER(TRIM(COALESCE(p_room_code, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión';
  END IF;

  SELECT * INTO v_room
  FROM public.edukard_rooms
  WHERE UPPER(code) = v_clean_code AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ninguna gamificación activa con el código "%"', v_clean_code;
  END IF;

  INSERT INTO public.edukard_class_links (class_id, room_id, teacher_id)
  VALUES (p_class_id, v_room.id, v_uid)
  ON CONFLICT (class_id) DO UPDATE
    SET room_id = EXCLUDED.room_id,
        teacher_id = EXCLUDED.teacher_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'class_id', p_class_id,
    'room_id', v_room.id,
    'room_code', v_room.code,
    'room_title', v_room.title
  );
END;
$$;
