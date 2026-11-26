import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Coins, Sparkles, BookOpen, PackageOpen, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import CardVisual from '../components/CardVisual';
import {
  RARITY_META,
  type EdukardRoom,
  type EdukardCard,
  type EdukardWallet,
  type EdukardInventoryItem,
  type EdukardRedemption,
} from '../types/edukard';

interface DrawnCard {
  card_id: string;
  title: string;
  summary: string;
  rarity: EdukardCard['rarity'];
  kind: EdukardCard['kind'];
  icon: string;
  color: string;
  new_quantity: number;
  is_new: boolean;
}

export default function StudentRoom() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const cleanCode = (code || '').trim().toUpperCase();

  const urlName = searchParams.get('guest_name') || '';
  const urlMagranaStudentId = searchParams.get('magrana_student_id') || null;
  const urlMagranaUid = searchParams.get('magrana_uid') || null;

  const [studentName, setStudentName] = useState(() => {
    if (urlName.trim()) return urlName.trim();
    return localStorage.getItem('edukard_student_name') || '';
  });
  const [nameInput, setNameInput] = useState(studentName);

  const studentKey = useMemo(() => {
    if (urlMagranaStudentId) return `mag:${urlMagranaStudentId}`;
    if (urlMagranaUid) return `uid:${urlMagranaUid}`;
    const norm = studentName.trim().toLowerCase().replace(/\s+/g, '_');
    return norm ? `guest:${norm}` : '';
  }, [urlMagranaStudentId, urlMagranaUid, studentName]);

  const [room, setRoom] = useState<EdukardRoom | null>(null);
  const [allCards, setAllCards] = useState<EdukardCard[]>([]);
  const [wallet, setWallet] = useState<EdukardWallet | null>(null);
  const [inventory, setInventory] = useState<EdukardInventoryItem[]>([]);
  const [redemptions, setRedemptions] = useState<EdukardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<'packs' | 'hand' | 'album'>('packs');
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[] | null>(null);

  // Study Flashcard Modal
  const [studyCard, setStudyCard] = useState<EdukardCard | null>(null);
  const [studyPickedOpt, setStudyPickedOpt] = useState<number | null>(null);

  // Play Card + Flash Gate Modal
  const [playingCard, setPlayingCard] = useState<EdukardCard | null>(null);
  const [playFlashCard, setPlayFlashCard] = useState<EdukardCard | null>(null);
  const [playFlashPicked, setPlayFlashPicked] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playResultBanner, setPlayResultBanner] = useState<string | null>(null);

  const loadRoomData = useCallback(async () => {
    if (!cleanCode) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: roomRow, error: rErr } = await supabase
        .from('edukard_rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (rErr || !roomRow) {
        setErrorMsg(`No se encontró ninguna sala de Edukard con el código ${cleanCode}.`);
        setLoading(false);
        return;
      }
      setRoom(roomRow as EdukardRoom);

      const { data: rcRows } = await supabase
        .from('edukard_room_collections')
        .select('collection_id')
        .eq('room_id', roomRow.id);
      const colIds = (rcRows || []).map((x: any) => x.collection_id);

      const [privRes, studyRes] = await Promise.all([
        supabase.from('edukard_cards').select('*').eq('room_id', roomRow.id).eq('is_active', true),
        colIds.length > 0
          ? supabase.from('edukard_cards').select('*').in('collection_id', colIds).eq('is_active', true)
          : Promise.resolve({ data: [] }),
      ]);

      const merged = [...((studyRes.data || []) as EdukardCard[]), ...((privRes.data || []) as EdukardCard[])];
      setAllCards(merged);

      if (studentKey && studentName.trim()) {
        const { data: wData } = await supabase.rpc('edukard_ensure_wallet', {
          p_room_id: roomRow.id,
          p_student_key: studentKey,
          p_student_name: studentName.trim(),
          p_magrana_student_id: urlMagranaStudentId,
        });
        if (wData) setWallet(wData as EdukardWallet);

        const [invRes, redRes] = await Promise.all([
          supabase.from('edukard_inventory').select('*').eq('room_id', roomRow.id).eq('student_key', studentKey),
          supabase
            .from('edukard_redemptions')
            .select('*')
            .eq('room_id', roomRow.id)
            .eq('student_key', studentKey)
            .order('created_at', { ascending: false })
            .limit(15),
        ]);
        setInventory((invRes.data || []) as EdukardInventoryItem[]);
        setRedemptions((redRes.data || []) as EdukardRedemption[]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cargar la sala');
    } finally {
      setLoading(false);
    }
  }, [cleanCode, studentKey, studentName, urlMagranaStudentId]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  const invByCardId = useMemo(() => {
    const map: Record<string, EdukardInventoryItem> = {};
    inventory.forEach((it) => {
      map[it.card_id] = it;
    });
    return map;
  }, [inventory]);

  const cardsById = useMemo(() => {
    const map: Record<string, EdukardCard> = {};
    allCards.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [allCards]);

  const studyCards = useMemo(() => allCards.filter((c) => c.kind === 'study'), [allCards]);
  const privilegeCards = useMemo(() => allCards.filter((c) => c.kind !== 'study'), [allCards]);

  const totalOwnedStudyCopies = useMemo(() => {
    return studyCards.reduce((sum, c) => sum + (invByCardId[c.id]?.quantity || 0), 0);
  }, [studyCards, invByCardId]);

  const discoveredStudyCount = useMemo(() => {
    return studyCards.filter((c) => Boolean(invByCardId[c.id]?.ever_owned)).length;
  }, [studyCards, invByCardId]);

  const evaluateCardRequirement = (card: EdukardCard): { canPlay: boolean; label: string | null } => {
    const ownedQty = invByCardId[card.id]?.quantity || 0;
    if (ownedQty < 1) return { canPlay: false, label: null };

    if (card.requirement_type === 'same_card_copies' && card.requirement_count > 1) {
      const ok = ownedQty >= card.requirement_count;
      return {
        canPlay: ok,
        label: `Destruye ${card.requirement_count} copias de esta carta (tienes ${ownedQty}/${card.requirement_count})`,
      };
    }
    if (card.requirement_type === 'specific_card_copies' && card.requirement_card_id && card.requirement_count > 0) {
      const reqCard = cardsById[card.requirement_card_id];
      const have = invByCardId[card.requirement_card_id]?.quantity || 0;
      const ok = have >= card.requirement_count;
      return {
        canPlay: ok,
        label: `Destruye esta + ${card.requirement_count}x «${reqCard?.title || 'Carta requerida'}» (tienes ${have}/${card.requirement_count})`,
      };
    }
    if (card.requirement_type === 'collection_count' && card.requirement_count > 0) {
      const ok = totalOwnedStudyCopies >= card.requirement_count;
      return {
        canPlay: ok,
        label: `Destruye esta + ${card.requirement_count} cartas de temario (tienes ${totalOwnedStudyCopies}/${card.requirement_count})`,
      };
    }
    return { canPlay: true, label: 'Al jugarla, esta carta se destruye' };
  };

  const handleOpenPack = async () => {
    if (!room || !studentKey || isOpeningPack) return;
    setIsOpeningPack(true);
    setDrawnCards(null);
    try {
      const { data, error } = await supabase.rpc('edukard_open_pack', {
        p_room_id: room.id,
        p_student_key: studentKey,
        p_student_name: studentName.trim(),
        p_magrana_student_id: urlMagranaStudentId,
      });
      if (error) {
        alert(error.message);
        return;
      }
      const cards = (data?.cards || []) as DrawnCard[];
      setDrawnCards(cards);
      if (cards.some((c) => c.rarity === 'legendary' || c.rarity === 'epic')) {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 } });
      }
      await loadRoomData();
    } finally {
      setIsOpeningPack(false);
    }
  };

  const startPlayCardFlow = (card: EdukardCard) => {
    setPlayingCard(card);
    setPlayFlashPicked(null);
    // Elegir una pregunta flash aleatoria de las cartas de temario descubiertas por el alumno
    if (room?.require_flash_on_play) {
      const pool = studyCards.filter(
        (c) => Boolean(invByCardId[c.id]?.ever_owned) && c.flash_question && Array.isArray(c.flash_options) && c.flash_options.length >= 2
      );
      if (pool.length > 0) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setPlayFlashCard(picked);
        return;
      }
    }
    setPlayFlashCard(null);
  };

  const confirmPlayCard = async (flashPassed: boolean) => {
    if (!room || !playingCard || !studentKey) return;
    setIsPlaying(true);
    try {
      const { data, error } = await supabase.rpc('edukard_play_card', {
        p_room_id: room.id,
        p_student_key: studentKey,
        p_student_name: studentName.trim(),
        p_card_id: playingCard.id,
        p_flash_passed: flashPassed,
      });
      if (error) {
        alert(error.message);
        return;
      }
      const consumedList = Array.isArray(data?.consumed)
        ? data.consumed.map((c: any) => `${c.title} (x${c.count})`).join(', ')
        : playingCard.title;
      setPlayResultBanner(
        `✨ ¡Jugaste «${playingCard.title}»! Se destruyeron: ${consumedList}. ${
          playingCard.requires_teacher_validation ? 'Enviada al docente para validar.' : ''
        }`
      );
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.65 } });
      setPlayingCard(null);
      setPlayFlashCard(null);
      await loadRoomData();
    } finally {
      setIsPlaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Cargando sala Edukard...
      </div>
    );
  }

  if (errorMsg || !room) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-white/10 p-8 text-center space-y-3">
          <div className="text-4xl">🃏</div>
          <h2 className="text-lg font-extrabold text-white">Sala no encontrada</h2>
          <p className="text-xs text-slate-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!studentName.trim()) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nameInput.trim()) return;
            localStorage.setItem('edukard_student_name', nameInput.trim());
            setStudentName(nameInput.trim());
          }}
          className="max-w-md w-full rounded-3xl bg-slate-900 border border-white/15 p-7 space-y-4 shadow-2xl"
        >
          <div className="text-center space-y-1">
            <div className="text-4xl">🃏</div>
            <h1 className="text-xl font-black text-white">{room.title}</h1>
            <p className="text-xs text-slate-400">Introduce tu nombre y apellidos para abrir tu álbum de cartas</p>
          </div>
          <input
            type="text"
            required
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Ej: Laura García López"
            className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-sm cursor-pointer"
          >
            Entrar a mi Álbum →
          </button>
        </form>
      </div>
    );
  }

  const ownedPrivilegeCards = privilegeCards.filter((c) => (invByCardId[c.id]?.quantity || 0) > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Cabecera Alumno */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-xl">
              🃏
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">{room.title}</h1>
              <p className="text-xs text-slate-400">
                {studentName} · Álbum: {discoveredStudyCount}/{studyCards.length} conceptos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 font-black text-sm inline-flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              <span>{wallet?.coins ?? 0}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {playResultBanner && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
            <span>{playResultBanner}</span>
            <button type="button" onClick={() => setPlayResultBanner(null)} className="text-emerald-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navegación principal */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('packs')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
              tab === 'packs' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-white/10'
            }`}
          >
            <PackageOpen className="w-4 h-4" />
            <span>Tienda de Sobres</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('hand')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
              tab === 'hand' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-300 border border-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Cartas de Privilegio ({ownedPrivilegeCards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('album')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition ${
              tab === 'album' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300 border border-white/10'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Álbum de Repaso ({discoveredStudyCount}/{studyCards.length})</span>
          </button>
        </div>

        {/* TAB 1: SOBRES */}
        {tab === 'packs' && (
          <section className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/60 border border-indigo-400/30 p-7 text-center space-y-4 shadow-2xl">
              <div className="text-6xl">🎁</div>
              <div>
                <h2 className="text-2xl font-black text-white">Sobre de Cartas Edukard</h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Contiene <strong>{room.cards_per_pack} cartas</strong> aleatorias del temario y de privilegio. Acumula copias repetidas para desbloquear cartas especiales.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-[11px] font-bold">
                {(['common', 'rare', 'epic', 'legendary'] as const).map((r) => (
                  <span key={r} className={`px-2.5 py-0.5 rounded-full ${RARITY_META[r].badge}`}>
                    {RARITY_META[r].label}: {RARITY_META[r].prob}
                  </span>
                ))}
              </div>
              <button
                type="button"
                disabled={isOpeningPack || (wallet?.coins ?? 0) < room.pack_cost}
                onClick={handleOpenPack}
                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-40 text-slate-950 font-black text-sm shadow-xl transition cursor-pointer"
              >
                {isOpeningPack
                  ? 'Abriendo sobre...'
                  : (wallet?.coins ?? 0) < room.pack_cost
                  ? `Necesitas ${room.pack_cost} monedas (tienes ${wallet?.coins ?? 0})`
                  : `Abrir Sobre (${room.pack_cost} 🪙)`}
              </button>
            </div>

            {drawnCards && drawnCards.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-300">
                  ✨ ¡Cartas obtenidas en este sobre!
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {drawnCards.map((dc, idx) => {
                    const fullCard = cardsById[dc.card_id] || ({
                      id: dc.card_id,
                      title: dc.title,
                      summary: dc.summary,
                      rarity: dc.rarity,
                      kind: dc.kind,
                      icon: dc.icon,
                      color: dc.color,
                    } as EdukardCard);
                    return (
                      <div key={`${dc.card_id}-${idx}`} className="animate-card-pop" style={{ animationDelay: `${idx * 120}ms` }}>
                        <CardVisual
                          card={fullCard}
                          quantity={dc.new_quantity}
                          isNew={dc.is_new}
                          everOwned={true}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: CARTAS DE PRIVILEGIO */}
        {tab === 'hand' && (
          <section className="space-y-5">
            {ownedPrivilegeCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/40 p-10 text-center space-y-2">
                <div className="text-4xl">⭐</div>
                <h3 className="text-base font-extrabold text-white">Aún no tienes cartas de privilegio</h3>
                <p className="text-xs text-slate-400">Abre sobres para conseguir cartas de privilegio y cartas de temario para activarlas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedPrivilegeCards.map((card) => {
                  const qty = invByCardId[card.id]?.quantity || 0;
                  const evalReq = evaluateCardRequirement(card);
                  return (
                    <CardVisual
                      key={card.id}
                      card={card}
                      quantity={qty}
                      everOwned={true}
                      requirementLabel={evalReq.label}
                      canPlay={evalReq.canPlay}
                      onPlayClick={() => startPlayCardFlow(card)}
                    />
                  );
                })}
              </div>
            )}

            {redemptions.length > 0 && (
              <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Historial de tus cartas jugadas
                </h3>
                {redemptions.map((red) => (
                  <div
                    key={red.id}
                    className="p-3 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-white">{red.card_title}</span>
                    <span
                      className={`font-extrabold px-2 py-0.5 rounded-lg ${
                        red.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : red.status === 'rejected'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {red.status === 'approved' ? '✓ Aceptada' : red.status === 'rejected' ? '✕ Rechazada' : '⏳ Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: ÁLBUM DE REPASO */}
        {tab === 'album' && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">Álbum de Estudio y Repaso</h3>
                <p className="text-xs text-slate-400">
                  Copias disponibles para sacrificar al jugar cartas: <strong className="text-amber-300">{totalOwnedStudyCopies}</strong> · Incluso si consumes tus copias, siempre podrás repasar las cartas que hayas descubierto.
                </p>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {discoveredStudyCount} / {studyCards.length} descubiertas
              </span>
            </div>

            {studyCards.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-xs text-slate-400">
                El profesor todavía no ha activado ninguna colección de temario en esta sala.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {studyCards.map((card) => {
                  const inv = invByCardId[card.id];
                  return (
                    <CardVisual
                      key={card.id}
                      card={card}
                      quantity={inv?.quantity ?? 0}
                      everOwned={Boolean(inv?.ever_owned)}
                      onStudyClick={
                        inv?.ever_owned && card.flash_question
                          ? () => {
                              setStudyCard(card);
                              setStudyPickedOpt(null);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* MODAL REPASO FLASHCARD */}
      {studyCard && (
        <div
          onClick={() => setStudyCard(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full rounded-3xl bg-slate-900 border border-indigo-400/40 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{studyCard.icon}</span>
                <h3 className="text-base font-black text-white">{studyCard.title}</h3>
              </div>
              <button type="button" onClick={() => setStudyCard(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-2xl border border-white/10 leading-relaxed">
              {studyCard.summary}
            </p>
            {studyCard.flash_question && (
              <div className="space-y-2.5">
                <p className="text-sm font-extrabold text-indigo-300">⚡ Pregunta Flash: {studyCard.flash_question}</p>
                <div className="space-y-2">
                  {(studyCard.flash_options || []).map((opt, idx) => {
                    const isPicked = studyPickedOpt === idx;
                    const isCorrect = idx === studyCard.flash_correct_index;
                    let cls = 'bg-slate-950 border-white/15 text-slate-200 hover:border-indigo-400';
                    if (studyPickedOpt !== null) {
                      if (isCorrect) cls = 'bg-emerald-600/25 border-emerald-400 text-emerald-200 font-bold';
                      else if (isPicked) cls = 'bg-red-600/25 border-red-400 text-red-200';
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStudyPickedOpt(idx)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition cursor-pointer ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL JUGAR CARTA + PREGUNTA FLASH OBLIGATORIA */}
      {playingCard && (
        <div
          onClick={() => !isPlaying && setPlayingCard(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full rounded-3xl bg-slate-900 border border-amber-400/50 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-amber-300">
                🔥 Jugar «{playingCard.title}»
              </h3>
              <button type="button" onClick={() => setPlayingCard(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200">
              ⚠️ Al confirmar, <strong>esta carta y las copias exigidas se destruirán</strong> de tu inventario.
            </div>

            {playFlashCard ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400">
                  Supera esta Pregunta Flash de tu álbum ({playFlashCard.title}) para activar la carta:
                </p>
                <p className="text-sm font-extrabold text-white">{playFlashCard.flash_question}</p>
                <div className="space-y-2">
                  {(playFlashCard.flash_options || []).map((opt, idx) => {
                    const isPicked = playFlashPicked === idx;
                    const isCorrect = idx === playFlashCard.flash_correct_index;
                    let cls = 'bg-slate-950 border-white/15 text-slate-200 hover:border-amber-400';
                    if (playFlashPicked !== null) {
                      if (isCorrect) cls = 'bg-emerald-600/25 border-emerald-400 text-emerald-200 font-bold';
                      else if (isPicked) cls = 'bg-red-600/25 border-red-400 text-red-200';
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={playFlashPicked !== null}
                        onClick={() => setPlayFlashPicked(idx)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition cursor-pointer ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {playFlashPicked !== null && (
                  playFlashPicked === playFlashCard.flash_correct_index ? (
                    <button
                      type="button"
                      disabled={isPlaying}
                      onClick={() => confirmPlayCard(true)}
                      className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isPlaying ? 'Activando...' : '¡Correcto! Activar y destruir copias'}</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-400/40 text-xs text-red-200 font-bold">
                      ❌ Respuesta incorrecta. Repasa tu álbum y vuelve a intentarlo (tus cartas no se han destruido).
                    </div>
                  )
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isPlaying}
                onClick={() => confirmPlayCard(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-sm cursor-pointer"
              >
                {isPlaying ? 'Activando...' : 'Confirmar y jugar carta'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
