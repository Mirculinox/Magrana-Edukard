import React, { useState, useMemo } from 'react';
import { Sparkles, Copy, Check, X, Upload } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { RARITY_META, type CardRarity } from '../types/edukard';
import { HelpGuideButton } from './HelpGuideButton';

interface AiCardDraft {
  title: string;
  summary: string;
  rarity: CardRarity;
  icon: string;
  color: string;
  flash_question: string;
  flash_options: string[];
  flash_correct_index: number;
}

interface AiCollectionModalProps {
  teacherId: string;
  authorName?: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AiCollectionModal({ teacherId, authorName, onClose, onCreated }: AiCollectionModalProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [cardCount, setCardCount] = useState(16);
  const [syllabusText, setSyllabusText] = useState('');
  const [copied, setCopied] = useState(false);

  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCards, setParsedCards] = useState<AiCardDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const generatedPrompt = useMemo(() => {
    const topicLabel = title.trim() || '[NOMBRE DEL TEMA]';
    const subjectLabel = subject.trim() || '[ASIGNATURA / NIVEL]';
    const notesBlock = syllabusText.trim()
      ? `\nTEMARIO / APUNTES DE REFERENCIA:\n"""\n${syllabusText.trim()}\n"""\n`
      : '';

    return `Actúa como un experto docente y diseñador de juegos educativos.
Crea una colección de ${cardCount} cartas coleccionables de repaso sobre el tema "${topicLabel}" (${subjectLabel}) para Magrana Edukard.
${notesBlock}
REGLAS ESTRICTAS:
1. Devuelve EXCLUSIVAMENTE un array JSON válido (sin texto antes ni después, sin bloques markdown).
2. Distribución aproximada de rarezas según importancia del concepto:
   - ~55% "common" (conceptos básicos/definiciones)
   - ~25% "rare" (relaciones, procesos o fórmulas)
   - ~15% "epic" (casos aplicados o distinciones complejas)
   - ~5% "legendary" (conceptos clave troncales del tema)
3. Cada objeto del array debe tener exactamente esta estructura:
{
  "title": "Nombre corto del concepto (máx 45 caracteres)",
  "summary": "Explicación clara y concisa para repasar en 1-2 frases (máx 180 caracteres)",
  "rarity": "common" | "rare" | "epic" | "legendary",
  "icon": "un único emoji representativo",
  "color": "#6366f1",
  "flash_question": "Pregunta rápida de repaso sobre este concepto",
  "flash_options": ["Opción A", "Opción B", "Opción C", "Opción D"],
  "flash_correct_index": 0
}
4. Asegúrate de que "flash_correct_index" sea un número entre 0 y 3 y que las 4 opciones sean plausibles y en español.`;
  }, [title, subject, cardCount, syllabusText]);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParseJson = () => {
    setParseError(null);
    try {
      const cleaned = jsonInput
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const raw = JSON.parse(cleaned);
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.cards) ? raw.cards : null;
      if (!arr || arr.length === 0) {
        setParseError('El JSON debe ser una lista (array) con al menos 1 carta.');
        return;
      }

      const validRarities: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];
      const normalized: AiCardDraft[] = arr.map((item: any, idx: number) => {
        const rarity: CardRarity = validRarities.includes(item.rarity) ? item.rarity : 'common';
        const opts = Array.isArray(item.flash_options) && item.flash_options.length >= 2
          ? item.flash_options.slice(0, 4).map(String)
          : ['Verdadero', 'Falso'];
        const correctIdx = Math.max(0, Math.min(opts.length - 1, Number(item.flash_correct_index) || 0));
        return {
          title: String(item.title || `Concepto ${idx + 1}`).trim().slice(0, 80),
          summary: String(item.summary || '').trim().slice(0, 320),
          rarity,
          icon: String(item.icon || '📘').trim().slice(0, 4),
          color: String(item.color || '#6366f1').trim(),
          flash_question: String(item.flash_question || '').trim(),
          flash_options: opts,
          flash_correct_index: correctIdx,
        };
      });

      setParsedCards(normalized);
    } catch (err: any) {
      setParseError('JSON no válido. Asegúrate de copiar solo el array [...] que devolvió la IA.');
    }
  };

  const handleSaveCollection = async () => {
    if (!title.trim()) {
      setParseError('Pon un nombre a la colección antes de guardarla.');
      return;
    }
    if (parsedCards.length === 0) {
      setParseError('Primero pega y valida el JSON de las cartas.');
      return;
    }

    setIsSaving(true);
    setParseError(null);
    try {
      const parsedTags = Array.from(
        new Set(
          tagsInput
            .split(/[\s,;]+/)
            .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
            .filter(Boolean)
        )
      );

      let { data: col, error: colErr } = await supabase
        .from('edukard_collections')
        .insert({
          teacher_id: teacherId,
          title: title.trim(),
          subject: subject.trim(),
          description: `${parsedCards.length} cartas de temario generadas con IA`,
          is_public: isPublic,
          tags: parsedTags,
          author_name: authorName || 'Docente',
        })
        .select()
        .single();

      // Fallback si SQL v3 aún no se ha ejecutado (sin columnas tags/author_name)
      if (colErr && /column|tags|author_name/i.test(colErr.message || '')) {
        const retry = await supabase
          .from('edukard_collections')
          .insert({
            teacher_id: teacherId,
            title: title.trim(),
            subject: subject.trim(),
            description: `${parsedCards.length} cartas de temario generadas con IA`,
            is_public: isPublic,
          })
          .select()
          .single();
        col = retry.data;
        colErr = retry.error;
      }

      if (colErr || !col) throw colErr || new Error('No se pudo crear la colección');

      const rows = parsedCards.map((c) => ({
        teacher_id: teacherId,
        collection_id: col.id,
        kind: 'study',
        title: c.title,
        summary: c.summary,
        rarity: c.rarity,
        icon: c.icon,
        color: c.color,
        flash_question: c.flash_question || null,
        flash_options: c.flash_options,
        flash_correct_index: c.flash_correct_index,
        requirement_type: 'none',
        requirement_count: 0,
        consume_requirements: true,
        requires_teacher_validation: false,
        is_active: true,
      }));

      const { error: cardsErr } = await supabase.from('edukard_cards').insert(rows);
      if (cardsErr) throw cardsErr;

      onCreated();
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Error guardando la colección en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl magrana-modal p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Crear Colección de Temario con IA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Genera el prompt con tu temario, pégalo en ChatGPT o Gemini y trae el JSON de vuelta.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <HelpGuideButton
              title="Cómo crear cartas con IA"
              subtitle="En 2 pasos sin coste de API."
              items={[
                {
                  label: 'Paso 1 · Copia el prompt',
                  description: 'Rellena el tema, pega tus apuntes y pulsa «Copiar Prompt». Pégalo en ChatGPT, Gemini o Claude.',
                },
                {
                  label: 'Paso 2 · Pega el JSON',
                  description: 'Copia el bloque JSON que te devuelva la IA, pégalo abajo y pulsa «Previsualizar cartas» antes de guardar.',
                },
              ]}
            />
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paso 1: Datos + Prompt */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nombre de la colección / Tema *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Tema 3 — Pruebas Diagnósticas"
                className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nº de cartas
              </label>
              <select
                value={cardCount}
                onChange={(e) => setCardCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm focus:outline-none focus:border-amber-500"
              >
                <option value={12}>12 cartas</option>
                <option value={16}>16 cartas (Recomendado)</option>
                <option value={20}>20 cartas</option>
                <option value={30}>30 cartas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Asignatura / Curso
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Biología 4º ESO / Laboratorio Clínico FP"
                className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Hashtags (separados por espacio o coma)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ej: #biologia #4eso #celula"
                className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl magrana-well cursor-pointer">
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                🌍 Colección pública en la Comunidad Magrana
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Otros docentes podrán encontrarla por hashtag y clonarla. Puedes desactivarlo cuando quieras.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-amber-600 shrink-0"
            />
          </label>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Pega tu temario o apuntes (opcional, pero mejora muchísimo las cartas)
            </label>
            <textarea
              rows={3}
              value={syllabusText}
              onChange={(e) => setSyllabusText(e.target.value)}
              placeholder="Pega aquí definiciones, puntos clave o resumen del tema..."
              className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="rounded-xl magrana-well p-4 space-y-2 border-amber-500/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Paso 1 · Copia este prompt en ChatGPT o Gemini
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Prompt'}</span>
              </button>
            </div>
            <pre className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
              {generatedPrompt}
            </pre>
          </div>
        </div>

        {/* Paso 2: Pegar JSON */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Paso 2 · Pega aquí la respuesta JSON de la IA
            </span>
            <button
              type="button"
              onClick={handleParseJson}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Previsualizar cartas</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[ { "title": "...", "summary": "...", "rarity": "common", ... } ]'
            className="w-full px-3.5 py-2.5 rounded-xl magrana-input font-mono text-xs focus:outline-none focus:border-emerald-500"
          />

          {parseError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs text-rose-700 dark:text-rose-200 font-semibold">
              ⚠️ {parseError}
            </div>
          )}

          {parsedCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ✅ {parsedCards.length} cartas listas para importar:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {parsedCards.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl magrana-well flex items-start gap-2"
                  >
                    <span className="text-lg">{c.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {c.title}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${RARITY_META[c.rarity].badge}`}
                        >
                          {RARITY_META[c.rarity].label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {c.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving || parsedCards.length === 0}
            onClick={handleSaveCollection}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer shadow-sm"
          >
            {isSaving ? 'Guardando...' : `Guardar colección (${parsedCards.length} cartas)`}
          </button>
        </div>
      </div>
    </div>
  );
}
