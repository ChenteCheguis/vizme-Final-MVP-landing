import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Necesitamos tu correo y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Decidir destino: si usuario tiene proyectos → /projects, si no → /onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesión no disponible');
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const next = state?.from?.pathname && state.from.pathname !== '/login'
        ? state.from.pathname
        : (count && count > 0 ? '/projects' : '/onboarding');
      navigate(next, { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (/invalid|credentials|password/i.test(msg)) {
        setError('Correo o contraseña incorrectos.');
      } else if (/network|fetch/i.test(msg)) {
        setError('Perdimos conexión. Reintenta en un momento.');
      } else {
        setError('No pudimos iniciarte sesión. Reintenta en un momento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Acceso"
      quote="Tus datos. Sin que la incertidumbre los gobierne."
      attribution="Vizme · Marzo 2026"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-4xl font-light tracking-editorial text-vizme-navy">
            Bienvenido de vuelta
          </h1>
          <p className="mt-3 text-vizme-greyblue">
            Entra para ver lo que tu data ya te quería contar.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 px-4 py-3 text-sm text-vizme-coral animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Field
            id="email"
            type="email"
            label="Correo"
            placeholder="tunombre@empresa.mx"
            value={email}
            onChange={setEmail}
            icon={<Mail size={16} />}
            autoComplete="email"
          />
          <div className="space-y-2">
            <Field
              id="password"
              type={showPwd ? 'text' : 'password'}
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              icon={<Lock size={16} />}
              autoComplete="current-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-vizme-greyblue transition-colors hover:text-vizme-navy"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <div className="flex justify-end">
              <a
                href="#"
                title="Próximamente"
                className="text-xs text-vizme-greyblue/80 hover:text-vizme-navy"
                onClick={(e) => e.preventDefault()}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-vizme-coral px-6 py-3.5 font-medium text-white shadow-glow-coral transition-all duration-200 hover:bg-vizme-orange hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-vizme-greyblue/40 disabled:shadow-none disabled:translate-y-0"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Iniciar sesión
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="relative pt-4">
          <div className="editorial-rule" />
          <p className="mt-4 text-center text-sm text-vizme-greyblue">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/signup" className="font-medium text-vizme-coral hover:text-vizme-orange">
              Crea una en 30 segundos
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

interface FieldProps {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  autoComplete?: string;
}

function Field({ id, type, label, placeholder, value, onChange, icon, trailing, autoComplete }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="label-eyebrow">{label}</span>
      <div className="relative mt-1.5">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-vizme-greyblue">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={[
            'input-vizme',
            icon ? 'pl-10' : '',
            trailing ? 'pr-10' : '',
          ].join(' ')}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-3.5 grid place-items-center">{trailing}</span>
        )}
      </div>
    </label>
  );
}
