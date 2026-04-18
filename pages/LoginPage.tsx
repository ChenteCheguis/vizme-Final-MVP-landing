import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    const { error } = await signIn(data.email, data.password);
    if (error) {
      const msg = (error as { message?: string }).message ?? '';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) {
        setServerError('Correo o contraseña incorrectos.');
      } else if (msg.includes('Email not confirmed')) {
        setServerError('Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.');
      } else {
        setServerError(`Error al iniciar sesion: ${msg || 'Intenta de nuevo.'}`);
      }
    } else {
      // Full reload to ensure AuthContext picks up the session cleanly
      window.location.href = from;
    }
  };

  return (
    <div className="min-h-screen bg-vizme-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center group">
            <span className="text-2xl font-bold uppercase tracking-[0.2em] text-vizme-navy group-hover:text-vizme-red transition-colors">Vizme</span>
            <span className="text-[10px] text-vizme-greyblue tracking-[0.3em] uppercase">Dashboards e insights</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-vizme-navy/10 shadow-xl shadow-vizme-navy/5 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-vizme-navy">Bienvenido de vuelta</h1>
            <p className="text-sm text-vizme-greyblue mt-1">Inicia sesión para ver tu dashboard</p>
          </div>

          {serverError && (
            <div className="mb-4 p-3 rounded-xl bg-vizme-red/10 border border-vizme-red/20 text-sm text-vizme-red">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-vizme-navy mb-1.5">Correo electrónico</label>
              <input
                {...register('email')}
                type="email"
                placeholder="tu@empresa.com"
                className="w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 text-sm text-vizme-navy placeholder-vizme-greyblue/50 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-vizme-red">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-vizme-navy mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 pr-10 text-sm text-vizme-navy placeholder-vizme-greyblue/50 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vizme-greyblue hover:text-vizme-navy transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-vizme-red">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting
                ? <Loader2 size={16} className="animate-spin" />
                : <><span>Iniciar sesión</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-vizme-greyblue">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-vizme-red font-medium hover:text-vizme-orange transition-colors">
                Regístrate gratis
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-vizme-greyblue hover:text-vizme-navy transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
