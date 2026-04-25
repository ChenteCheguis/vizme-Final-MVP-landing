import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, Check } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOk = password.length >= 8;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const formReady =
    fullName.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    passwordOk &&
    passwordsMatch &&
    acceptTerms;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formReady) {
      setError('Revisa los campos resaltados.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
      navigate('/onboarding', { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (/already|registered|exists/i.test(msg)) {
        setError('Ya hay una cuenta con ese correo. Intenta iniciar sesión.');
      } else if (/network|fetch/i.test(msg)) {
        setError('Perdimos conexión. Reintenta en un momento.');
      } else {
        setError('No pudimos crear tu cuenta. Reintenta en un momento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Crear cuenta"
      quote="Tres minutos. Y empezamos a entender tu negocio."
      attribution="Promesa Vizme"
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-4xl font-light tracking-editorial text-vizme-navy">
            Crea tu cuenta
          </h1>
          <p className="mt-3 text-vizme-greyblue">
            En el siguiente paso vas a ver qué tan inteligente es nuestra IA con tu negocio.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-vizme-coral/30 bg-vizme-coral/8 px-4 py-3 text-sm text-vizme-coral animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Field
            id="fullName"
            type="text"
            label="Tu nombre completo"
            placeholder="Diego Ibarra"
            value={fullName}
            onChange={setFullName}
            icon={<User size={16} />}
            autoComplete="name"
          />
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
          <div>
            <Field
              id="password"
              type={showPwd ? 'text' : 'password'}
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={setPassword}
              icon={<Lock size={16} />}
              autoComplete="new-password"
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
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span
                className={[
                  'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                  passwordOk ? 'bg-vizme-navy text-white' : 'bg-vizme-greyblue/15 text-transparent',
                ].join(' ')}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span className={passwordOk ? 'text-vizme-navy' : 'text-vizme-greyblue'}>
                Al menos 8 caracteres
              </span>
            </div>
          </div>

          <Field
            id="confirmPassword"
            type={showPwd ? 'text' : 'password'}
            label="Confirma tu contraseña"
            placeholder="Repite la contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            icon={<Lock size={16} />}
            autoComplete="new-password"
            error={confirmPassword.length > 0 && !passwordsMatch ? 'Las contraseñas no coinciden.' : undefined}
          />

          <label className="flex cursor-pointer items-start gap-3 text-sm text-vizme-greyblue">
            <span className="relative mt-0.5">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="peer sr-only"
              />
              <span className="grid h-5 w-5 place-items-center rounded-md border border-vizme-greyblue/40 bg-white transition-colors peer-checked:border-vizme-navy peer-checked:bg-vizme-navy">
                <Check
                  size={12}
                  strokeWidth={3}
                  className={acceptTerms ? 'text-white' : 'text-transparent'}
                />
              </span>
            </span>
            <span className="leading-snug">
              Acepto los{' '}
              <a href="#" onClick={(e) => e.preventDefault()} className="text-vizme-navy underline decoration-vizme-coral/60 underline-offset-2">
                términos y condiciones
              </a>{' '}
              de Vizme.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !formReady}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-vizme-coral px-6 py-3.5 font-medium text-white shadow-glow-coral transition-all duration-200 hover:bg-vizme-orange hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-vizme-greyblue/40 disabled:shadow-none disabled:translate-y-0"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Crear cuenta y empezar
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="relative pt-4">
          <div className="editorial-rule" />
          <p className="mt-4 text-center text-sm text-vizme-greyblue">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-medium text-vizme-coral hover:text-vizme-orange">
              Inicia sesión
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
  error?: string;
}

function Field({ id, type, label, placeholder, value, onChange, icon, trailing, autoComplete, error }: FieldProps) {
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
            error ? '!border-vizme-coral/60' : '',
          ].join(' ')}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-3.5 grid place-items-center">{trailing}</span>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-vizme-coral">{error}</p>}
    </label>
  );
}
