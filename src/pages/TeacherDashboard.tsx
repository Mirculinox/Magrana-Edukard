import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Plus, Copy, Check, Trash2, Coins, ShieldCheck,
  BookOpen, Layers, Users, ExternalLink, LogOut, Settings
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import AiCollectionModal from '../components/AiCollectionModal';
import { DEFAULT_PRIVILEGE_CARDS, generateRoomCode } from '../utils/defaultPrivileges';
import {
  RARITY_META,
  type EdukardRoom,
  type EdukardCollection,
  type EdukardCard,
  type EdukardWallet,
  type EdukardRedemption,
  type RequirementType,
} from '../types/edukard';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<EdukardRoom[]>([]);
  const [controlClasses, setControlClasses] = useState<Array<{ id: string; name: string; subject: string }>>([]);
  const [collections, setCollections] = useState<EdukardCollection[]>([]);
  const [collectionCardCounts, setCollectionCardCounts] = useState<Record<string, number>>({});
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'collections'>('rooms');
  const [roomSubTab, setRoomSubTab] = useState<'collections' | 'privileges' | 'validations' | 'students'>('collections');

  // Room details
  const [linkedCollectionIds, setLinkedCollectionIds] = useState<Set<string>>(new Set());
  const [roomPrivilegeCards, setRoomPrivilegeCards] = useState<EdukardCard[]>([]);
  const [roomStudyCards, setRoomStudyCards] = useState<EdukardCard[]>([]);
  const [wallets, setWallets] = useState<EdukardWallet[]>([]);
  const [redemptions, setRedemptions] = useState<EdukardRedemption[]>([]);

  // Modals & forms
  const [showAiModal, setShowAiModal] = useState(false);
  const [showNewRoomForm, setShowNewRoomForm] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomSubject, setNewRoomSubject] = useState('');
  const [newRoomPackCost, setNewRoomPackCost] = useState(30);
  const [newRoomStartCoins, setNewRoomStartCoins] = useState(60);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [roomsRes, colsRes, cardsRes, clsRes] = await Promise.all([
        supabase.from('edukard_rooms').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
        supabase.from('edukard_collections').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
        supabase.from('edukard_cards').select('id, collection_id').eq('teacher_id', user.id).eq('kind', 'study'),
        supabase
          .from('app_data')
          .select('id, payload')
          .eq('user_id', user.id)
          .eq('collection_name', 'classes'),
      ]);

      const rList = (roomsRes.data || []) as EdukardRoom[];
      setRooms(rList);
      if (!selectedRoomId && rList.length > 0) {
        setSelectedRoomId(rList[0].id);
      }
      setCollections((colsRes.data || []) as EdukardCollection[]);
      setControlClasses(
        (clsRes.data || [])
          .filter((c: any) => !c.payload?.is_archived)
          .map((c: any) => ({
            id: String(c.id),
            name: c.payload?.name || 'Clase',
            subject: c.payload?.subject || '',
          }))
      );

      const counts: Record<string, number> = {};
      (cardsRes.data || []).forEach((c: any) => {
        if (c.collection_id) counts[c.collection_id] = (counts[c.collection_id] || 0) + 1;
      });
      setCollectionCardCounts(counts);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedRoomId]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  const loadRoomDetail = useCallback(async (roomId: string) => {
    const [rcRes, privRes, walletsRes, redRes] = await Promise.all([
      supabase.from('edukard_room_collections').select('collection_id').eq('room_id', roomId),
      supabase.from('edukard_cards').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      supabase.from('edukard_wallets').select('*').eq('room_id', roomId).order('total_coins_earned', { ascending: false }),
      supabase.from('edukard_redemptions').select('*').eq('room_id', roomId).order('created_at', { ascending: false }),
    ]);

    const linkedIds = new Set<string>((rcRes.data || []).map((x: any) => x.collection_id));
    setLinkedCollectionIds(linkedIds);
    setRoomPrivilegeCards((privRes.data || []) as EdukardCard[]);
    setWallets((walletsRes.data || []) as EdukardWallet[]);
    setRedemptions((redRes.data || []) as EdukardRedemption[]);

    if (linkedIds.size > 0) {
      const { data: sCards } = await supabase
        .from('edukard_cards')
        .select('*')
        .in('collection_id', Array.from(linkedIds))
        .eq('kind', 'study')
        .order('title', { ascending: true });
      setRoomStudyCards((sCards || []) as EdukardCard[]);
    } else {
      setRoomStudyCards([]);
    }
  }, []);

  useEffect(() => {
    if (selectedRoomId) loadRoomDetail(selectedRoomId);
  }, [selectedRoomId, loadRoomDetail]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;
  const pendingValidationsCount = redemptions.filter((r) => r.status === 'pending').length;

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newRoomTitle.trim()) return;
    const code = generateRoomCode();
    const { data: created, error } = await supabase
      .from('edukard_rooms')
      .insert({
        teacher_id: user.id,
        code,
        title: newRoomTitle.trim(),
        subject: newRoomSubject.trim(),
        pack_cost: newRoomPackCost,
        starting_coins: newRoomStartCoins,
      })
      .select()
      .single();

    if (error || !created) {
      alert(error?.message || 'Error al crear la sala');
      return;
    }

    // Sembrar las cartas de privilegio por defecto en esta sala
    const privRows = DEFAULT_PRIVILEGE_CARDS.map((p) => ({
      teacher_id: user.id,
      room_id: created.id,
      kind: 'privilege',
      title: p.title,
      summary: p.summary,
      rarity: p.rarity,
      icon: p.icon,
      color: p.color,
      requirement_type: p.requirement_type,
      requirement_rarity: p.requirement_rarity,
      requirement_count: p.requirement_count,
      consume_requirements: p.consume_requirements,
      requires_teacher_validation: p.requires_teacher_validation,
      is_active: true,
    }));
    await supabase.from('edukard_cards').insert(privRows);

    setNewRoomTitle('');
    setNewRoomSubject('');
    setShowNewRoomForm(false);
    setSelectedRoomId(created.id);
    await loadBase();
    await loadRoomDetail(created.id);
  };

  const handleUpdateRoom = async (roomId: string, patch: Partial<EdukardRoom>) => {
    await supabase.from('edukard_rooms').update(patch).eq('id', roomId);
    await loadBase();
  };

  const handleToggleCollectionInRoom = async (collectionId: string) => {
    if (!selectedRoomId) return;
    if (linkedCollectionIds.has(collectionId)) {
      await supabase
        .from('edukard_room_collections')
        .delete()
        .eq('room_id', selectedRoomId)
        .eq('collection_id', collectionId);
    } else {
      await supabase
        .from('edukard_room_collections')
        .insert({ room_id: selectedRoomId, collection_id: collectionId });
    }
    await loadRoomDetail(selectedRoomId);
  };

  const handleUpdatePrivilegeCard = async (cardId: string, patch: Partial<EdukardCard>) => {
    await supabase.from('edukard_cards').update(patch).eq('id', cardId);
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  };

  const handleResolveRedemption = async (redemptionId: string, status: 'approved' | 'rejected') => {
    await supabase
      .from('edukard_redemptions')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', redemptionId);
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  };

  const handleGiveBonusCoins = async (wallet: EdukardWallet, amount: number) => {
    if (!selectedRoomId) return;
    await supabase.rpc('edukard_award_coins', {
      p_room_id: selectedRoomId,
      p_student_key: wallet.student_key,
      p_student_name: wallet.student_name,
      p_amount: amount,
      p_source: 'teacher_bonus',
      p_note: 'Recompensa manual del docente',
    });
    await loadRoomDetail(selectedRoomId);
  };

  const handleDeleteCollection = async (colId: string) => {
    if (!window.confirm('¿Eliminar esta colección y todas sus cartas?')) return;
    await supabase.from('edukard_collections').delete().eq('id', colId);
    await loadBase();
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  };

  const copyRoomLink = async (code: string) => {
    const url = `${window.location.origin}/play/${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-xl shadow-lg">
              🃏
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Magrana Edukard</h1>
              <p className="text-xs text-slate-400">Panel Docente · {user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'rooms' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              🏫 Mis Salas ({rooms.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collections')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'collections' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              📚 Colecciones ({collections.length})
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Crear con IA</span>
            </button>
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando panel de Edukard...</div>
        ) : activeTab === 'collections' ? (
          /* ── TAB COLECCIONES DE TEMARIO ── */
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-black text-white">Colecciones de Temario</h2>
                <p className="text-xs text-slate-400">
                  Crea mazos de estudio con IA a partir de tus apuntes y actívalos en cualquier sala.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nueva colección con IA</span>
              </button>
            </div>

            {collections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/40 p-12 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-purple-400 mx-auto" />
                <h3 className="text-base font-extrabold text-white">Aún no tienes colecciones de temario</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Pulsa «Nueva colección con IA», pega tu temario y en 30 segundos tendrás 15–30 cartas con preguntas flash listas para tus sobres.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="rounded-2xl bg-slate-900 border border-white/10 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300">
                          {col.subject || 'Temario'}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">
                          {collectionCardCounts[col.id] || 0} cartas
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white">{col.title}</h3>
                      <p className="text-xs text-slate-400">{col.description}</p>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* ── TAB SALAS / CLASES ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista lateral de salas */}
            <aside className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Tus Salas</h2>
                <button
                  type="button"
                  onClick={() => setShowNewRoomForm((p) => !p)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva sala</span>
                </button>
              </div>

              {showNewRoomForm && (
                <form
                  onSubmit={handleCreateRoom}
                  className="rounded-2xl bg-slate-900 border border-indigo-500/40 p-4 space-y-3"
                >
                  <input
                    type="text"
                    required
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="Nombre de la sala (ej. 1º Laboratorio)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newRoomSubject}
                    onChange={(e) => setNewRoomSubject(e.target.value)}
                    placeholder="Asignatura (opcional)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Coste sobre</label>
                      <input
                        type="number"
                        min={5}
                        value={newRoomPackCost}
                        onChange={(e) => setNewRoomPackCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Monedas iniciales</label>
                      <input
                        type="number"
                        min={0}
                        value={newRoomStartCoins}
                        onChange={(e) => setNewRoomStartCoins(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Crear Sala Edukard
                  </button>
                </form>
              )}

              {rooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-xs text-slate-400">
                  Crea tu primera sala para obtener un código PIN y compartirla con tu clase.
                </div>
              ) : (
                <div className="space-y-2">
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer ${
                        selectedRoomId === r.id
                          ? 'bg-indigo-950/50 border-indigo-400/60'
                          : 'bg-slate-900 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-white truncate">{r.title}</span>
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-white/10 text-amber-300">
                          {r.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {r.subject || 'Sin asignatura'} · Sobre: {r.pack_cost} 🪙
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {/* Detalle de la sala seleccionada */}
            <section className="lg:col-span-8 space-y-4">
              {!selectedRoom ? (
                <div className="rounded-3xl bg-slate-900/50 border border-white/10 p-12 text-center text-sm text-slate-400">
                  Selecciona o crea una sala para configurar sus colecciones, cartas de privilegio y alumnos.
                </div>
              ) : (
                <>
                  {/* Cabecera sala + Conexión opcional con Magrana Control */}
                  <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-black text-white">{selectedRoom.title}</h2>
                          <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40">
                            PIN: {selectedRoom.code}
                          </span>
                          {selectedRoom.magrana_class_id && (
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                              🔗 Conectada a Magrana
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Sobre: {selectedRoom.pack_cost} monedas ({selectedRoom.cards_per_pack} cartas) · Común 60% · Rara 25% · Épica 11% · Legendaria 4%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyRoomLink(selectedRoom.code)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedCode === selectedRoom.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode === selectedRoom.code ? 'Enlace copiado' : 'Copiar enlace'}</span>
                        </button>
                        <Link
                          to={`/play/${selectedRoom.code}`}
                          target="_blank"
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <span>Vista Alumno</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Conector opcional con Magrana Control + Recompensas automáticas */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-300">🔗 Vincular con clase de Magrana Control:</span>
                        <select
                          value={selectedRoom.magrana_class_id || ''}
                          onChange={(e) =>
                            handleUpdateRoom(selectedRoom.id, {
                              magrana_class_id: e.target.value || null,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-white text-xs font-semibold"
                        >
                          <option value="">Modo independiente (solo PIN)</option>
                          {controlClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}{cls.subject ? ` (${cls.subject})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedRoom.magrana_class_id && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                          <span className="text-emerald-300 font-bold">Monedas auto:</span>
                          {([
                            ['actimagen', 'Actimagen'],
                            ['examenes', 'Exámenes'],
                            ['colab', 'Colab'],
                            ['control_positive', 'Positivo'],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="inline-flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-white/10">
                              <span>{label}:</span>
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={selectedRoom.reward_rules?.[key] ?? 0}
                                onChange={(e) =>
                                  handleUpdateRoom(selectedRoom.id, {
                                    reward_rules: {
                                      ...selectedRoom.reward_rules,
                                      [key]: Math.max(0, Number(e.target.value) || 0),
                                    },
                                  })
                                }
                                className="w-11 bg-transparent text-amber-300 font-extrabold text-center focus:outline-none"
                              />
                              <span>🪙</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-pestañas de la sala */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'collections', label: `📚 Temario en sobres (${linkedCollectionIds.size})` },
                      { id: 'privileges', label: `⭐ Cartas de Privilegio (${roomPrivilegeCards.filter((c) => c.is_active).length})` },
                      { id: 'validations', label: `✅ Validaciones (${pendingValidationsCount})` },
                      { id: 'students', label: `👥 Alumnos (${wallets.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRoomSubTab(tab.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          roomSubTab === tab.id
                            ? 'bg-white text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-white/10 hover:bg-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* SUBTAB 1: Colecciones activas */}
                  {roomSubTab === 'collections' && (
                    <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          Marca qué colecciones de temario pueden salir al abrir sobres en esta sala:
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAiModal(true)}
                          className="text-xs font-bold text-purple-300 hover:underline cursor-pointer"
                        >
                          + Crear colección con IA
                        </button>
                      </div>
                      {collections.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Crea primero una colección con IA para que los alumnos puedan conseguir cartas del temario.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {collections.map((col) => {
                            const active = linkedCollectionIds.has(col.id);
                            return (
                              <label
                                key={col.id}
                                className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                                  active
                                    ? 'bg-emerald-950/40 border-emerald-500/50'
                                    : 'bg-slate-950 border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => handleToggleCollectionInRoom(col.id)}
                                    className="w-4 h-4 accent-emerald-500"
                                  />
                                  <div>
                                    <div className="text-sm font-extrabold text-white">{col.title}</div>
                                    <div className="text-xs text-slate-400">
                                      {col.subject || 'General'} · {collectionCardCounts[col.id] || 0} cartas
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                  {active ? 'Activa en sobres' : 'Inactiva'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 2: Cartas de Privilegio y requisitos */}
                  {roomSubTab === 'privileges' && (
                    <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-3">
                      <p className="text-xs text-slate-400">
                        Al jugarse, cada carta <strong>se destruye junto con las copias exigidas</strong> para evitar abusos.
                      </p>
                      <div className="space-y-3">
                        {roomPrivilegeCards.map((card) => (
                          <div
                            key={card.id}
                            className={`p-4 rounded-2xl border space-y-3 ${
                              card.is_active ? 'bg-slate-950 border-white/15' : 'bg-slate-950/40 border-white/5 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-2xl">{card.icon}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-extrabold text-white">{card.title}</span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${RARITY_META[card.rarity].badge}`}>
                                      {RARITY_META[card.rarity].label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{card.summary}</p>
                                </div>
                              </div>
                              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={card.is_active}
                                  onChange={(e) => handleUpdatePrivilegeCard(card.id, { is_active: e.target.checked })}
                                  className="w-4 h-4 accent-amber-500"
                                />
                                <span>Activa</span>
                              </label>
                            </div>

                            {/* Configurador rápido del requisito de copias/cartas */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10 text-xs">
                              <Settings className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-400 font-semibold">Requisito al jugar:</span>
                              <select
                                value={card.requirement_type}
                                onChange={(e) =>
                                  handleUpdatePrivilegeCard(card.id, {
                                    requirement_type: e.target.value as RequirementType,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-white text-xs"
                              >
                                <option value="none">Ninguno (solo destruir esta)</option>
                                <option value="collection_count">Sacrificar X cartas de temario</option>
                                <option value="specific_card_copies">Sacrificar X copias de una carta concreta</option>
                                <option value="same_card_copies">Tener X copias de esta misma carta</option>
                              </select>

                              {card.requirement_type !== 'none' && (
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={card.requirement_count}
                                  onChange={(e) =>
                                    handleUpdatePrivilegeCard(card.id, {
                                      requirement_count: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-white/15 text-white text-center font-bold"
                                />
                              )}

                              {card.requirement_type === 'specific_card_copies' && (
                                <select
                                  value={card.requirement_card_id || ''}
                                  onChange={(e) =>
                                    handleUpdatePrivilegeCard(card.id, {
                                      requirement_card_id: e.target.value || null,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 text-white text-xs max-w-[220px]"
                                >
                                  <option value="">Selecciona carta del temario...</option>
                                  {roomStudyCards.map((sc) => (
                                    <option key={sc.id} value={sc.id}>
                                      {sc.icon} {sc.title}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 3: Validaciones */}
                  {roomSubTab === 'validations' && (
                    <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-3">
                      {redemptions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                          <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          Todavía ningún alumno ha canjeado cartas en esta sala.
                        </div>
                      ) : (
                        redemptions.map((red) => (
                          <div
                            key={red.id}
                            className="p-4 rounded-2xl bg-slate-950 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-extrabold text-white">{red.student_name}</span>
                                <span className="text-xs text-amber-300 font-bold">usó «{red.card_title}»</span>
                                {red.flash_passed && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                                    ✓ Flash superada
                                  </span>
                                )}
                              </div>
                              {Array.isArray(red.consumed_summary) && red.consumed_summary.length > 0 && (
                                <p className="text-[11px] text-slate-400">
                                  🔥 Cartas destruidas:{' '}
                                  {red.consumed_summary.map((c) => `${c.title} (x${c.count})`).join(', ')}
                                </p>
                              )}
                            </div>

                            {red.status === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleResolveRedemption(red.id, 'approved')}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
                                >
                                  ✓ Aceptar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResolveRedemption(red.id, 'rejected')}
                                  className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/35 text-red-300 text-xs font-extrabold cursor-pointer"
                                >
                                  ✕ Rechazar
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                                  red.status === 'approved'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-red-500/15 text-red-300'
                                }`}
                              >
                                {red.status === 'approved' ? '✓ Aceptada' : '✕ Rechazada'}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* SUBTAB 4: Alumnos y Monedas */}
                  {roomSubTab === 'students' && (
                    <div className="rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-3">
                      {wallets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          Comparte el PIN <strong className="text-amber-300">{selectedRoom.code}</strong> para que entren tus alumnos.
                        </div>
                      ) : (
                        wallets.map((w) => (
                          <div
                            key={w.id}
                            className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-extrabold text-white">{w.student_name}</div>
                              <div className="text-xs text-slate-400">
                                Saldo: <strong className="text-amber-300">{w.coins} 🪙</strong> · Sobres abiertos: {w.packs_opened}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleGiveBonusCoins(w, 15)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>+15</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGiveBonusCoins(w, 30)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>+1 Sobre (30)</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {showAiModal && user?.id && (
        <AiCollectionModal
          teacherId={user.id}
          onClose={() => setShowAiModal(false)}
          onCreated={() => {
            loadBase();
            if (selectedRoomId) loadRoomDetail(selectedRoomId);
          }}
        />
      )}
    </div>
  );
}
