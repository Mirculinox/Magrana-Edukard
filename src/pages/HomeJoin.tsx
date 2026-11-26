import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function HomeJoin() {
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();
  const [pin, setPin] = useState('');
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    navigate(`/play/${pin.trim().toUpperCase()}`);
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthError(null);
    const err = await signInWithEmail(email, password);
    if (err) setAuthError(err);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-3xl mx-auto shadow-2xl">
            🃏
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Magrana Edukard</h1>
          <p className="text-sm text-slate-400">
            Cartas coleccionables de temario, repaso activo y gamificación para el aula.
          </p>
        </div>

        {/* Acceso alumno por PIN */}
        <form
          onSubmit={handleJoin}
          className="rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-4 shadow-2xl"
        >
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 block mb-2">
              Soy alumno · Entrar con PIN de sala
            </label>
            <input
              type="text"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="EJ: A7K9P2"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-white/15 text-center font-mono text-xl font-black tracking-[0.25em] text-white uppercase focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={!pin.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-40 text-slate-950 font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Entrar a la Sala</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Acceso docente */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowTeacherLogin((p) => !p)}
            className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{showTeacherLogin ? 'Ocultar acceso docente' : 'Soy docente · Iniciar sesión'}</span>
          </button>
        </div>

        {showTeacherLogin && (
          <form
            onSubmit={handleTeacherLogin}
            className="rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 space-y-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo de tu cuenta Magrana"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
            />
            {authError && <p className="text-xs text-red-400 font-semibold">{authError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold cursor-pointer"
            >
              {submitting ? 'Entrando...' : 'Entrar al Panel Docente'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
