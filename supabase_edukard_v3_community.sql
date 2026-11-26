-- ============================================================================
-- MAGRANA EDUKARD v3 — Colecciones Públicas por Defecto, Hashtags y Comunidad
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

ALTER TABLE public.edukard_collections
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT 'Docente',
  ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_edukard_collections_public
  ON public.edukard_collections(is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_edukard_collections_tags
  ON public.edukard_collections USING GIN (tags);

-- Permitir leer colecciones públicas y sus cartas de estudio a cualquier usuario autenticado
DROP POLICY IF EXISTS "edukard_collections_public_select" ON public.edukard_collections;
CREATE POLICY "edukard_collections_public_select" ON public.edukard_collections
  FOR SELECT USING (is_public = true OR auth.uid() = teacher_id);

DROP POLICY IF EXISTS "edukard_cards_public_collection_select" ON public.edukard_cards;
CREATE POLICY "edukard_cards_public_collection_select" ON public.edukard_cards
  FOR SELECT USING (
    collection_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.edukard_collections c
      WHERE c.id = edukard_cards.collection_id AND c.is_public = true
    )
  );

-- RPC para clonar una colección pública de la comunidad a las colecciones del docente actual
CREATE OR REPLACE FUNCTION public.edukard_clone_collection(
  p_source_collection_id UUID,
  p_author_name TEXT DEFAULT 'Docente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_src RECORD;
  v_new_col_id UUID;
  v_copied INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Debes iniciar sesión.');
  END IF;

  SELECT * INTO v_src
  FROM public.edukard_collections
  WHERE id = p_source_collection_id
    AND (is_public = true OR teacher_id = v_uid);

  IF v_src.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La colección no existe o es privada.');
  END IF;

  INSERT INTO public.edukard_collections (
    teacher_id, title, subject, description, is_public, tags, author_name
  ) VALUES (
    v_uid,
    v_src.title,
    v_src.subject,
    v_src.description,
    true,
    COALESCE(v_src.tags, '{}'),
    COALESCE(NULLIF(TRIM(p_author_name), ''), 'Docente')
  )
  RETURNING id INTO v_new_col_id;

  INSERT INTO public.edukard_cards (
    teacher_id, collection_id, kind, title, summary, rarity, icon, color,
    flash_question, flash_options, flash_correct_index,
    requirement_type, requirement_count, consume_requirements,
    requires_teacher_validation, is_active
  )
  SELECT
    v_uid, v_new_col_id, kind, title, summary, rarity, icon, color,
    flash_question, flash_options, flash_correct_index,
    requirement_type, requirement_count, consume_requirements,
    requires_teacher_validation, is_active
  FROM public.edukard_cards
  WHERE collection_id = p_source_collection_id;

  GET DIAGNOSTICS v_copied = ROW_COUNT;

  UPDATE public.edukard_collections
  SET downloads_count = COALESCE(downloads_count, 0) + 1
  WHERE id = p_source_collection_id;

  RETURN jsonb_build_object('ok', true, 'collection_id', v_new_col_id, 'cards_copied', v_copied);
END;
$$;
