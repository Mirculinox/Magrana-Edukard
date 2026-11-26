import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Plus, Copy, Check, Trash2, Coins, ShieldCheck,
  BookOpen, Layers, Users, ExternalLink, LogOut, Settings, UserPlus,
  Menu, X, Moon, Sun
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import AiCollectionModal from '../components/AiCollectionModal';
import { HelpGuideButton } from '../components/HelpGuideButton';
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
  const [sharedRoomIds, setSharedRoomIds] = useState<Set<string>>(new Set());
  const [myUserCode, setMyUserCode] = useState<string>('');
  const [copiedUserCode, setCopiedUserCode] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [controlClasses, setControlClasses] = useState<Array<{ id: string; name: string; subject: string }>>([]);
  const [collections, setCollections] = useState<EdukardCollection[]>([]);
  const [collectionCardCounts, setCollectionCardCounts] = useState<Record<string, number>>({});
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'collections'>('rooms');
  const [roomSubTab, setRoomSubTab] = useState<'collections' | 'privileges' | 'validations' | 'students' | 'share'>('collections');

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlTheme = new URLSearchParams(window.location.search).get('theme');
      if (urlTheme === 'dark' || urlTheme === 'light') {
        localStorage.setItem('magrana_edukard_theme', urlTheme);
        localStorage.setItem('magrana_theme', urlTheme);
        return urlTheme === 'dark';
      }
      const saved = localStorage.getItem('magrana_edukard_theme') || localStorage.getItem('magrana_theme');
      return saved === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const apply = (dark: boolean) => {
      setIsDarkMode(dark);
      if (dark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };
    apply(isDarkMode);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'MAGRANA_REQUEST_THEME' }, '*');
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'MAGRANA_THEME_CHANGE' && (e.data.theme === 'dark' || e.data.theme === 'light')) {
        const dark = e.data.theme === 'dark';
        localStorage.setItem('magrana_edukard_theme', e.data.theme);
        localStorage.setItem('magrana_theme', e.data.theme);
        apply(dark);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleToggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('magrana_edukard_theme', 'dark');
      localStorage.setItem('magrana_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('magrana_edukard_theme', 'light');
      localStorage.setItem('magrana_theme', 'light');
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'MAGRANA_THEME_CHANGE', theme: next ? 'dark' : 'light' }, '*');
      }
    } catch {
      // ignore
    }
  };

  const loadBase = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [roomsRes, collabAcceptedRes, colsRes, cardsRes, clsRes, myCodeRes] = await Promise.all([
        supabase.from('edukard_rooms').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
        supabase
          .from('edukard_room_collaborators')
          .select('room_id')
          .eq('collaborator_id', user.id)
          .eq('status', 'accepted'),
        supabase.from('edukard_collections').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
        supabase.from('edukard_cards').select('id, collection_id').eq('teacher_id', user.id).eq('kind', 'study'),
        supabase
          .from('app_data')
          .select('id, payload')
          .eq('user_id', user.id)
          .eq('collection_name', 'classes'),
        supabase.rpc('edukard_ensure_teacher_code', {
          p_display_name: user.name || 'Docente',
          p_email: user.email || null,
        }),
      ]);

      if (myCodeRes.data?.user_code) {
        setMyUserCode(myCodeRes.data.user_code);
      }

      const ownRooms = (roomsRes.data || []) as EdukardRoom[];
      const sharedIds = (collabAcceptedRes.data || []).map((x: any) => x.room_id).filter(Boolean);
      let sharedRooms: EdukardRoom[] = [];
      if (sharedIds.length > 0) {
        const { data: sRooms } = await supabase.from('edukard_rooms').select('*').in('id', sharedIds);
        sharedRooms = (sRooms || []) as EdukardRoom[];
      }
      setSharedRoomIds(new Set(sharedIds));

      const mergedMap = new Map<string, EdukardRoom>();
      [...ownRooms, ...sharedRooms].forEach((r) => mergedMap.set(r.id, r));
      const rList = Array.from(mergedMap.values());
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
    const [rcRes, privRes, walletsRes, redRes, collabRes] = await Promise.all([
      supabase.from('edukard_room_collections').select('collection_id').eq('room_id', roomId),
      supabase.from('edukard_cards').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      supabase.from('edukard_wallets').select('*').eq('room_id', roomId).order('total_coins_earned', { ascending: false }),
      supabase.from('edukard_redemptions').select('*').eq('room_id', roomId).order('created_at', { ascending: false }),
      supabase.from('edukard_room_collaborators').select('*').eq('room_id', roomId).order('created_at', { ascending: false }),
    ]);

    const linkedIds = new Set<string>((rcRes.data || []).map((x: any) => x.collection_id));
    setLinkedCollectionIds(linkedIds);
    setRoomPrivilegeCards((privRes.data || []) as EdukardCard[]);
    setWallets((walletsRes.data || []) as EdukardWallet[]);
    setRedemptions((redRes.data || []) as EdukardRedemption[]);
    setCollaborators(collabRes.data || []);

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

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !inviteCodeInput.trim()) return;
    setInviting(true);
    setInviteStatusMsg(null);
    try {
      const { error } = await supabase.rpc('edukard_invite_collaborator', {
        p_room_id: selectedRoomId,
        p_target_user_code: inviteCodeInput.trim().toUpperCase(),
        p_owner_name: user?.name || 'Docente',
      });
      if (error) {
        setInviteStatusMsg(`⚠️ ${error.message}`);
        return;
      }
      setInviteCodeInput('');
      setInviteStatusMsg('✅ Invitación enviada. Le aparecerá en su Bandeja Central de Magrana para aceptar.');
      await loadRoomDetail(selectedRoomId);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    await supabase.from('edukard_room_collaborators').delete().eq('id', collabId);
    if (selectedRoomId) await loadRoomDetail(selectedRoomId);
  };

  const copyRoomLink = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyMyUserCode = async () => {
    if (!myUserCode) return;
    await navigator.clipboard.writeText(myUserCode);
    setCopiedUserCode(true);
    setTimeout(() => setCopiedUserCode(false), 2000);
  };

  const currentTabName = activeTab === 'rooms' ? 'Mis Gamificaciones' : 'Colecciones';

  return (
    <div className="flex flex-col md:flex-row h-screen max-h-screen overflow-hidden bg-[#FFF1F2] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors duration-300 relative z-0">
      {/* Mobile Top Header (< md) */}
      <header className="md:hidden sticky top-0 z-40 bg-[#1E293B] text-white border-b border-slate-700/80 px-4 py-3 flex items-center justify-between shadow-lg shrink-0">
        <div
          onClick={() => setActiveTab('rooms')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <img src="/logo_new.jpg" alt="Magrana Logo" className="w-9 h-9 object-contain rounded-lg shadow" />
          <div>
            <span className="font-bold text-base text-white tracking-tight leading-none block">Magrana</span>
            <span className="text-[10px] text-amber-400 font-black tracking-widest uppercase">EDUKARD</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            {currentTabName}
          </span>
          <button
            type="button"
            onClick={handleToggleDarkMode}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Left Sidebar (Mobile Drawer + Desktop Static Sidebar — idéntica al resto de apps de Magrana) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#1E293B] text-white border-r border-slate-700/80 p-4 flex flex-col gap-6 overflow-hidden shadow-2xl transition-transform duration-300 ease-in-out shrink-0
          md:static md:translate-x-0 md:h-full md:shrink-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center justify-between px-2 z-10 shrink-0">
          <div
            onClick={() => {
              setActiveTab('rooms');
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
            title="Ir a inicio de Magrana Edukard"
          >
            <img src="/logo_new.jpg" alt="Magrana Logo" className="w-11 h-11 object-contain drop-shadow-md rounded-lg" />
            <div>
              <h1 className="font-bold text-xl leading-tight text-white tracking-tight">Magrana</h1>
              <p className="text-xs text-amber-400 font-bold tracking-wider uppercase">EDUKARD</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white md:hidden transition-colors cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 flex flex-col gap-2 z-10 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('rooms');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center justify-between px-4 py-3 rounded-2xl font-bold transition-all text-sm w-full text-left cursor-pointer ${
              activeTab === 'rooms'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers size={19} className={activeTab === 'rooms' ? 'text-white' : 'text-slate-400'} />
              <span className="truncate">Mis Gamificaciones</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'rooms' ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {rooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('collections');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center justify-between px-4 py-3 rounded-2xl font-bold transition-all text-sm w-full text-left cursor-pointer ${
              activeTab === 'collections'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <BookOpen size={19} className={activeTab === 'collections' ? 'text-white' : 'text-slate-400'} />
              <span className="truncate">Colecciones</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'collections' ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {collections.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAiModal(true);
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-sm w-full text-left text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/25 cursor-pointer mt-1"
          >
            <Sparkles size={19} className="text-amber-400" />
            <span className="truncate">Crear cartas con IA</span>
          </button>
        </nav>

        {/* Sección inferior estandarizada */}
        <div className="mt-auto flex flex-col gap-2.5 z-10 border-t border-slate-700/80 pt-4 shrink-0">
          {myUserCode && (
            <button
              type="button"
              onClick={copyMyUserCode}
              title="Comparte este código para que otros docentes te inviten a co-editar"
              className="w-full px-3 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-600/70 text-left transition cursor-pointer"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tu código de co-edición
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-mono text-xs font-black text-amber-300 tracking-wider">
                  {myUserCode}
                </span>
                {copiedUserCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white/5 border border-slate-700/80 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                {(user?.name || 'D').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{user?.name || 'Docente'}</div>
                <div className="text-[10px] text-slate-400 truncate">Panel Docente</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleDarkMode}
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="p-3 rounded-2xl border bg-white/5 hover:bg-white/15 border-slate-600/80 text-slate-200 transition-all cursor-pointer shrink-0"
            >
              {isDarkMode ? <Sun size={17} className="text-amber-300" /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              className="p-3 rounded-2xl border bg-white/5 hover:bg-rose-500/20 border-slate-600/80 text-slate-300 hover:text-rose-300 transition-all cursor-pointer shrink-0"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 relative min-w-0 overflow-y-auto h-full space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Cargando Magrana Edukard...
              </p>
            </div>
          </div>
        ) : activeTab === 'collections' ? (
          /* ── TAB COLECCIONES DE TEMARIO ── */
          <section className="max-w-6xl mx-auto space-y-6">
            <div className="magrana-card rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Colecciones de Temario
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Crea mazos de cartas de estudio con IA a partir de tus apuntes y actívalos en cualquier gamificación.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <HelpGuideButton
                  title="Guía rápida · Colecciones"
                  subtitle="Cartas de temario para repasar sin exponer preguntas de examen."
                  items={[
                    {
                      label: 'Generación con IA',
                      description: 'Pega un tema o resumen de tus apuntes y Edukard genera un prompt listo para crear 15–30 cartas con preguntas flash.',
                    },
                    {
                      label: 'Reutilizables',
                      description: 'Una misma colección puede activarse en varias gamificaciones distintas a la vez.',
                    },
                    {
                      label: 'Sin mezclar exámenes',
                      description: 'Las preguntas flash salen únicamente de estas cartas de estudio, nunca de tu banco de Magrana Exámenes.',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nueva colección con IA</span>
                </button>
              </div>
            </div>

            {collections.length === 0 ? (
              <div className="magrana-card rounded-2xl p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Aún no tienes colecciones de temario
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                  Pulsa «Nueva colección con IA», pega tu temario y en segundos tendrás cartas coleccionables con preguntas flash listas para tus sobres.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="magrana-card rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          {col.subject || 'Temario'}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/10 text-slate-800 dark:text-white">
                          {collectionCardCounts[col.id] || 0} cartas
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{col.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{col.description}</p>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700/70">
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
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
          /* ── TAB MIS GAMIFICACIONES ── */
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Cabecera principal estilo Magrana */}
            <div className="magrana-card rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Mis Gamificaciones
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Diseña tus sistemas de cartas y recompensas, y vincula cada gamificación a una o varias clases desde Magrana Control.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <HelpGuideButton
                  title="Guía rápida · Magrana Edukard"
                  subtitle="Cómo gamificar tus clases paso a paso."
                  items={[
                    {
                      label: '1. Crea una gamificación',
                      description: 'Pulsa «Nueva Gamificación» y obtendrás un código único (ej. A7K9P2).',
                    },
                    {
                      label: '2. Vincula tus clases en Control',
                      description: 'En Magrana Control → Mis Clases, pulsa «🃏 Gamificar» y pega el código. Varias clases pueden compartir la misma gamificación.',
                    },
                    {
                      label: '3. Añade temario y privilegios',
                      description: 'Activa colecciones de cartas de estudio y configura qué copias debe sacrificar el alumno para jugar cada privilegio.',
                    },
                    {
                      label: '4. Co-edita con otros profes',
                      description: 'Usa la pestaña «🤝 Co-editar» con el código MGR-XXXXXX de un compañero; le llegará la invitación a su Bandeja Central.',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setShowNewRoomForm((p) => !p)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Gamificación</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Lista lateral de gamificaciones */}
              <aside className="lg:col-span-4 space-y-3">
                {showNewRoomForm && (
                  <form
                    onSubmit={handleCreateRoom}
                    className="magrana-card rounded-2xl p-4 space-y-3 border-2 border-amber-500/50 animate-fade-in"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Crear nueva gamificación
                      </span>
                      <div className="flex items-center gap-1">
                        <HelpGuideButton
                          title="Crear una Gamificación"
                          subtitle="Qué configura cada campo."
                          items={[
                            {
                              label: 'Nombre y asignatura',
                              description: 'Identifica la gamificación (por ejemplo «1º Laboratorio · Curso 26-27»).',
                            },
                            {
                              label: 'Coste del sobre',
                              description: 'Cuántas monedas necesita el alumno para abrir un sobre de 3 cartas (por defecto 30).',
                            },
                            {
                              label: 'Monedas iniciales',
                              description: 'Saldo de bienvenida al entrar por primera vez (60 monedas = 2 sobres iniciales).',
                            },
                            {
                              label: 'Código automático',
                              description: 'Al crearla se genera un código que podrás pegar en «🃏 Gamificar» dentro de Magrana Control.',
                            },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewRoomForm(false)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      value={newRoomTitle}
                      onChange={(e) => setNewRoomTitle(e.target.value)}
                      placeholder="Nombre (ej. 1º Laboratorio)"
                      className="w-full px-3 py-2 rounded-xl magrana-input text-xs font-medium"
                    />
                    <input
                      type="text"
                      value={newRoomSubject}
                      onChange={(e) => setNewRoomSubject(e.target.value)}
                      placeholder="Asignatura (opcional)"
                      className="w-full px-3 py-2 rounded-xl magrana-input text-xs font-medium"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">
                          Coste sobre (🪙)
                        </label>
                        <input
                          type="number"
                          min={5}
                          value={newRoomPackCost}
                          onChange={(e) => setNewRoomPackCost(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl magrana-input text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">
                          Monedas iniciales
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={newRoomStartCoins}
                          onChange={(e) => setNewRoomStartCoins(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl magrana-input text-xs font-bold"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                    >
                      Crear Gamificación
                    </button>
                  </form>
                )}

                {rooms.length === 0 ? (
                  <div className="magrana-card rounded-2xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Crea tu primera gamificación para obtener un código y vincularlo a tus clases en Magrana Control.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rooms.map((r) => {
                      const isSelected = selectedRoomId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoomId(r.id)}
                          className={`w-full text-left p-4 rounded-2xl transition cursor-pointer ${
                            isSelected
                              ? 'magrana-card ring-2 ring-amber-500'
                              : 'bg-white/85 dark:bg-[#1F2D42]/80 border border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                              {r.title}
                              {sharedRoomIds.has(r.id) && (
                                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300">
                                  Compartida
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              {r.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {r.subject || 'Sin asignatura'} · Sobre: {r.pack_cost} 🪙
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              {/* Detalle de la gamificación seleccionada */}
              <section className="lg:col-span-8 space-y-4">
                {!selectedRoom ? (
                  <div className="magrana-card rounded-2xl p-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    Selecciona o crea una gamificación para configurar sus colecciones, cartas de privilegio, alumnos y co-editores.
                  </div>
                ) : (
                  <>
                    {/* Cabecera de la gamificación */}
                    <div className="magrana-card rounded-2xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                              {selectedRoom.title}
                            </h3>
                            <span
                              title="Pega este código en «🃏 Gamificar» en Magrana Control"
                              className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35"
                            >
                              Código: {selectedRoom.code}
                            </span>
                            {selectedRoom.magrana_class_id && (
                              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                🔗 Conectada a Magrana
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Sobre: {selectedRoom.pack_cost} monedas ({selectedRoom.cards_per_pack} cartas) · Común 60% · Rara 25% · Épica 11% · Legendaria 4%
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyRoomLink(selectedRoom.code)}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-600"
                          >
                            {copiedCode === selectedRoom.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedCode === selectedRoom.code ? 'Código copiado' : 'Copiar código'}</span>
                          </button>
                          <Link
                            to={`/play/${selectedRoom.code}`}
                            target="_blank"
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <span>Vista Alumno</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Reglas de monedas automáticas + enlace opcional directo */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            🪙 Monedas automáticas:
                          </span>
                          {(
                            [
                              ['actimagen', 'Actimagen'],
                              ['examenes', 'Exámenes'],
                              ['colab', 'Colab'],
                              ['control_positive', 'Positivo'],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="inline-flex items-center gap-1 magrana-well px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                            >
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
                                className="w-10 bg-transparent text-amber-700 dark:text-amber-300 font-extrabold text-center focus:outline-none"
                              />
                              <span>🪙</span>
                            </label>
                          ))}
                        </div>

                        {controlClasses.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                              Clase directa:
                            </span>
                            <select
                              value={selectedRoom.magrana_class_id || ''}
                              onChange={(e) =>
                                handleUpdateRoom(selectedRoom.id, {
                                  magrana_class_id: e.target.value || null,
                                })
                              }
                              className="px-2.5 py-1 rounded-xl magrana-input text-[11px] font-semibold"
                            >
                              <option value="">Vincular desde Magrana Control</option>
                              {controlClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                  {cls.name}
                                  {cls.subject ? ` (${cls.subject})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sub-pestañas de la gamificación */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'collections', label: `📚 Temario en sobres (${linkedCollectionIds.size})` },
                        { id: 'privileges', label: `⭐ Privilegios (${roomPrivilegeCards.filter((c) => c.is_active).length})` },
                        { id: 'validations', label: `✅ Validaciones (${pendingValidationsCount})` },
                        { id: 'students', label: `👥 Alumnos (${wallets.length})` },
                        { id: 'share', label: `🤝 Co-editar (${collaborators.filter((c) => c.status === 'accepted').length})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setRoomSubTab(tab.id as any)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                            roomSubTab === tab.id
                              ? 'bg-[#1E293B] text-white border-[#1E293B] dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-[#1F2D42] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* SUBTAB 1: Colecciones activas */}
                    {roomSubTab === 'collections' && (
                      <div className="magrana-card rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Marca qué colecciones de temario pueden salir al abrir sobres en esta gamificación:
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAiModal(true)}
                            className="text-xs font-extrabold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                          >
                            + Crear colección con IA
                          </button>
                        </div>
                        {collections.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                            Crea primero una colección con IA para que los alumnos puedan conseguir cartas del temario.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {collections.map((col) => {
                              const active = linkedCollectionIds.has(col.id);
                              return (
                                <label
                                  key={col.id}
                                  className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                                    active
                                      ? 'bg-emerald-500/10 border-emerald-500/40'
                                      : 'magrana-well hover:border-amber-500/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      onChange={() => handleToggleCollectionInRoom(col.id)}
                                      className="w-4 h-4 accent-emerald-600"
                                    />
                                    <div>
                                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                        {col.title}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {col.subject || 'General'} · {collectionCardCounts[col.id] || 0} cartas
                                      </div>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                      active
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
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
                      <div className="magrana-card rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Al jugarse, cada carta <strong>se destruye junto con las copias exigidas</strong> para evitar abusos.
                          </p>
                          <HelpGuideButton
                            title="Requisitos de Privilegios"
                            subtitle="Evita que alumnos poco participativos jueguen cartas potentes."
                            items={[
                              {
                                label: 'Destrucción justa',
                                description: 'Al jugar un privilegio, se destruye la carta y las copias sacrificadas, pero el concepto sigue desbloqueado en el álbum para repasar.',
                              },
                              {
                                label: 'Sacrificar copias',
                                description: 'Puedes exigir X cartas del temario o X copias repetidas de una carta concreta antes de poder activarla.',
                              },
                            ]}
                          />
                        </div>
                        <div className="space-y-3">
                          {roomPrivilegeCards.map((card) => (
                            <div
                              key={card.id}
                              className={`p-4 rounded-xl border space-y-3 ${
                                card.is_active ? 'magrana-well' : 'magrana-well opacity-60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-2xl">{card.icon}</span>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-black text-slate-900 dark:text-white">
                                        {card.title}
                                      </span>
                                      <span
                                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${RARITY_META[card.rarity].badge}`}
                                      >
                                        {RARITY_META[card.rarity].label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                      {card.summary}
                                    </p>
                                  </div>
                                </div>
                                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={card.is_active}
                                    onChange={(e) => handleUpdatePrivilegeCard(card.id, { is_active: e.target.checked })}
                                    className="w-4 h-4 accent-amber-600"
                                  />
                                  <span>Activa</span>
                                </label>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/70 text-xs">
                                <Settings className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-400 font-semibold">
                                  Requisito al jugar:
                                </span>
                                <select
                                  value={card.requirement_type}
                                  onChange={(e) =>
                                    handleUpdatePrivilegeCard(card.id, {
                                      requirement_type: e.target.value as RequirementType,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg magrana-input text-xs font-medium"
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
                                    className="w-16 px-2 py-1 rounded-lg magrana-input text-center font-bold"
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
                                    className="px-2.5 py-1 rounded-lg magrana-input text-xs max-w-[220px]"
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
                      <div className="magrana-card rounded-2xl p-5 space-y-3">
                        {redemptions.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                            <ShieldCheck className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                            Todavía ningún alumno ha canjeado cartas en esta gamificación.
                          </div>
                        ) : (
                          redemptions.map((red) => (
                            <div
                              key={red.id}
                              className="p-4 rounded-xl magrana-well flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-black text-slate-900 dark:text-white">
                                    {red.student_name}
                                  </span>
                                  <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">
                                    usó «{red.card_title}»
                                  </span>
                                  {red.flash_passed && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                      ✓ Flash superada
                                    </span>
                                  )}
                                </div>
                                {Array.isArray(red.consumed_summary) && red.consumed_summary.length > 0 && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-extrabold cursor-pointer"
                                  >
                                    ✕ Rechazar
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                                    red.status === 'approved'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
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
                      <div className="magrana-card rounded-2xl p-5 space-y-3">
                        {wallets.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                            <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                            Vincula el código <strong className="text-amber-700 dark:text-amber-300">{selectedRoom.code}</strong> en tu clase de Magrana Control para que tus alumnos entren desde su ficha.
                          </div>
                        ) : (
                          wallets.map((w) => (
                            <div
                              key={w.id}
                              className="p-3.5 rounded-xl magrana-well flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                  {w.student_name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Saldo: <strong className="text-amber-700 dark:text-amber-300">{w.coins} 🪙</strong> · Sobres abiertos: {w.packs_opened}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleGiveBonusCoins(w, 15)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  <span>+15</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGiveBonusCoins(w, 30)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
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

                    {/* SUBTAB 5: Compartir / Co-editar con otros docentes */}
                    {roomSubTab === 'share' && (
                      <div className="magrana-card rounded-2xl p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                              <UserPlus className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />
                              <span>Invitar a otro docente a co-editar esta gamificación</span>
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Pide a tu compañero su <strong>Código de Usuario</strong> (ej.{' '}
                              <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">MGR-8K2P9Q</span>). Le aparecerá la invitación en su <strong>Bandeja Central</strong> de Magrana; si acepta, ambos editaréis lo mismo.
                            </p>
                          </div>
                          <HelpGuideButton
                            title="Co-edición entre docentes"
                            subtitle="Trabaja en equipo sobre la misma gamificación."
                            items={[
                              {
                                label: 'Código de usuario',
                                description: 'Cada profesor tiene su propio código MGR-XXXXXX en la parte inferior de la barra izquierda.',
                              },
                              {
                                label: 'Bandeja Central',
                                description: 'El docente invitado recibe la notificación en su Bandeja Central de Magrana y puede Aceptar o Rechazar.',
                              },
                            ]}
                          />
                        </div>

                        <form onSubmit={handleInviteCollaborator} className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={inviteCodeInput}
                            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                            placeholder="MGR-XXXXXX"
                            className="flex-1 min-w-[180px] px-3.5 py-2.5 rounded-xl magrana-input font-mono text-sm font-bold uppercase focus:outline-none focus:border-fuchsia-500"
                          />
                          <button
                            type="submit"
                            disabled={inviting || !inviteCodeInput.trim()}
                            className="px-4 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer shadow-sm"
                          >
                            {inviting ? 'Enviando...' : 'Enviar invitación'}
                          </button>
                        </form>

                        {inviteStatusMsg && (
                          <div className="p-3 rounded-xl magrana-well text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {inviteStatusMsg}
                          </div>
                        )}

                        {collaborators.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Docentes invitados
                            </span>
                            {collaborators.map((c) => (
                              <div
                                key={c.id}
                                className="p-3 rounded-xl magrana-well flex items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <span className="font-black text-slate-900 dark:text-white">
                                    {c.collaborator_name}
                                  </span>
                                  <span className="ml-2 font-mono text-slate-500 dark:text-slate-400">
                                    {c.collaborator_code}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-lg font-bold ${
                                      c.status === 'accepted'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : c.status === 'rejected'
                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                    }`}
                                  >
                                    {c.status === 'accepted'
                                      ? '✓ Co-editor activo'
                                      : c.status === 'rejected'
                                      ? '✕ Rechazada'
                                      : '⏳ Pendiente'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCollaborator(c.id)}
                                    className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
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
