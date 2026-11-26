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
    <div className="min-h-screen bg-[#FFF1F2] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/logo_new.jpg"
            alt="Magrana Logo"
            className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-lg border border-slate-200 dark:border-slate-700"
          />
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Magrana <span className="text-amber-600 dark:text-amber-400">Edukard</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Cartas coleccionables de temario, repaso activo y gamificación para el aula.
            </p>
          </div>
        </div>

        {/* Acceso alumno por código */}
        <form
          onSubmit={handleJoin}
          className="magrana-card rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-2">
              Soy alumno · Entrar con código de gamificación
            </label>
            <input
              type="text"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="EJ: A7K9P2"
              className="w-full px-4 py-3.5 rounded-xl magrana-input text-center font-mono text-xl font-black tracking-[0.25em] uppercase focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={!pin.trim()}
            className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
          >
            <span>Entrar a mi Álbum</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Acceso docente */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowTeacherLogin((p) => !p)}
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{showTeacherLogin ? 'Ocultar acceso docente' : 'Soy docente · Iniciar sesión'}</span>
          </button>
        </div>

        {showTeacherLogin && (
          <form
            onSubmit={handleTeacherLogin}
            className="magrana-card rounded-2xl p-6 space-y-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo de tu cuenta Magrana"
              className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-3.5 py-2.5 rounded-xl magrana-input text-sm"
            />
            {authError && <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{authError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#1E293B] hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white text-sm font-extrabold cursor-pointer shadow-sm"
            >
              {submitting ? 'Entrando...' : 'Entrar al Panel Docente'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
