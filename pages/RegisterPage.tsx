import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres'),
    email: z.string().email('Ingresa un correo válido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

// ── NDA Modal ────────────────────────────────────────────────────────────────

const NDAModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-vizme-navy/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-vizme-navy/8">
        <h2 className="text-base font-bold text-vizme-navy">Acuerdo de Confidencialidad y Términos de Uso</h2>
        <button onClick={onClose} className="h-8 w-8 rounded-full bg-vizme-bg hover:bg-vizme-navy/10 flex items-center justify-center transition-colors">
          <X size={14} className="text-vizme-navy" />
        </button>
      </div>
      <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-4 text-sm text-vizme-greyblue leading-relaxed">
        <p className="font-bold text-vizme-navy">1. Objeto del Acuerdo</p>
        <p>Este acuerdo establece los términos bajo los cuales Vizme (vizme.com.mx) trata los datos que el usuario carga en la plataforma, incluyendo archivos Excel y CSV con información de negocio.</p>

        <p className="font-bold text-vizme-navy">2. Confidencialidad de los Datos</p>
        <p>Vizme se compromete a mantener total confidencialidad sobre la información cargada por el usuario. Tus datos <strong>no serán compartidos con terceros, ni usados para entrenar modelos de IA externos</strong>. El acceso está estrictamente limitado al procesamiento necesario para generar los análisis solicitados.</p>

        <p className="font-bold text-vizme-navy">3. Uso de la Plataforma</p>
        <p>El usuario acepta utilizar la plataforma únicamente para fines legítimos de análisis de negocio. Queda prohibido cargar información de terceros sin autorización, datos que violen leyes de privacidad, o contenido malicioso.</p>

        <p className="font-bold text-vizme-navy">4. Procesamiento con IA</p>
        <p>Los datos son procesados mediante modelos de inteligencia artificial (Anthropic Claude) para generar dashboards, reportes e insights. Este procesamiento se realiza de forma segura y los datos no son retenidos por el modelo de IA más allá de la sesión de análisis.</p>

        <p className="font-bold text-vizme-navy">5. Almacenamiento y Seguridad</p>
        <p>La información se almacena en servidores de Supabase con cifrado en tránsito y en reposo. Vizme implementa medidas de seguridad estándar de la industria para proteger tus datos.</p>

        <p className="font-bold text-vizme-navy">6. Eliminación de Datos</p>
        <p>Puedes solicitar la eliminación de todos tus datos en cualquier momento escribiendo a diego@vizme.com.mx. Los datos serán eliminados en un plazo máximo de 30 días naturales.</p>

        <p className="font-bold text-vizme-navy">7. Responsabilidad</p>
        <p>Los análisis e insights generados por Vizme son de carácter informativo y no constituyen asesoría financiera, legal o fiscal. El usuario es responsable de las decisiones tomadas con base en estos análisis.</p>

        <p className="font-bold text-vizme-navy">8. Ley Aplicable</p>
        <p>Este acuerdo se rige por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se resolverá ante los tribunales competentes de la Ciudad de México.</p>

        <p className="text-[11px] text-vizme-greyblue/60 border-t border-vizme-navy/8 pt-4">
          Última actualización: Enero 2025 · Vizme.com.mx · diego@vizme.com.mx
        </p>
      </div>
      <div className="px-6 py-4 border-t border-vizme-navy/8">
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-vizme-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-vizme-red transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const RegisterPage: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ndaOpen, setNdaOpen] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    if (!termsAccepted) return;
    setServerError('');
    const { error, session } = await signUp(data.email, data.password, data.fullName);
    if (error) {
      const msg = (error as { message?: string }).message ?? '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setServerError('Este correo ya está registrado. Inicia sesión.');
      } else if (msg.includes('not authorized') || msg.includes('Signups not allowed')) {
        setServerError('El registro está deshabilitado en este momento. Contacta al administrador.');
      } else {
        setServerError(`Error al crear tu cuenta: ${msg || 'Intenta de nuevo.'}`);
      }
    } else if (session) {
      // Email confirmation disabled — user is logged in immediately
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/onboarding';
      }, 1200);
    } else {
      // Email confirmation required — show message
      setPendingConfirmation(true);
    }
  };

  const inputCls = 'w-full rounded-xl border border-vizme-navy/10 bg-vizme-bg px-4 py-3 text-sm text-vizme-navy placeholder-vizme-greyblue/50 focus:border-vizme-red focus:outline-none focus:ring-2 focus:ring-vizme-red/20 transition-all';

  if (pendingConfirmation) {
    return (
      <div className="min-h-screen bg-vizme-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-vizme-navy/10 shadow-xl p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <h2 className="text-xl font-semibold text-vizme-navy">Revisa tu correo</h2>
          <p className="text-sm text-vizme-greyblue leading-relaxed">
            Te enviamos un link de confirmacion. Haz clic en el y vuelve aqui para iniciar sesion.
          </p>
          <Link
            to="/login"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-vizme-navy px-6 py-3 text-sm font-semibold text-white hover:bg-vizme-red transition-colors"
          >
            Ir a iniciar sesion
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-vizme-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-vizme-navy/10 shadow-xl p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-vizme-navy">¡Cuenta creada!</h2>
          <p className="text-sm text-vizme-greyblue">Redirigiendo a tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {ndaOpen && <NDAModal onClose={() => setNdaOpen(false)} />}

      <div className="min-h-screen bg-vizme-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center group">
              <span className="text-2xl font-bold uppercase tracking-[0.2em] text-vizme-navy group-hover:text-vizme-red transition-colors">Vizme</span>
              <span className="text-[10px] text-vizme-greyblue tracking-[0.3em] uppercase">Business Intelligence</span>
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-vizme-navy/10 shadow-xl shadow-vizme-navy/5 p-8">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-vizme-navy">Crea tu cuenta</h1>
              <p className="text-sm text-vizme-greyblue mt-1">Tu primer dashboard en menos de 2 minutos</p>
            </div>

            {serverError && (
              <div className="mb-4 p-3 rounded-xl bg-vizme-red/10 border border-vizme-red/20 text-sm text-vizme-red">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Nombre completo</label>
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="Ana García"
                  className={inputCls}
                />
                {errors.fullName && <p className="mt-1 text-xs text-vizme-red">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Correo electrónico</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="tu@empresa.com"
                  className={inputCls}
                />
                {errors.email && <p className="mt-1 text-xs text-vizme-red">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mín. 8 chars, 1 mayúscula, 1 número"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-vizme-greyblue hover:text-vizme-navy transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-vizme-red">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-vizme-navy mb-1.5">Confirmar contraseña</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="••••••••"
                  className={inputCls}
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-vizme-red">{errors.confirmPassword.message}</p>}
              </div>

              {/* NDA / Terms checkbox */}
              <div className={`rounded-xl border-2 p-3 transition-all ${termsAccepted ? 'border-vizme-red/30 bg-vizme-red/5' : 'border-vizme-navy/10 bg-vizme-bg'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-all ${
                        termsAccepted ? 'bg-vizme-red border-vizme-red' : 'bg-white border-vizme-navy/20'
                      }`}
                    >
                      {termsAccepted && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <span className="text-xs text-vizme-greyblue leading-relaxed">
                    Acepto el{' '}
                    <button
                      type="button"
                      onClick={() => setNdaOpen(true)}
                      className="text-vizme-red font-medium hover:text-vizme-orange transition-colors underline underline-offset-2"
                    >
                      Acuerdo de Confidencialidad y Términos de Uso
                    </button>{' '}
                    de Vizme. Mis datos están protegidos bajo NDA.
                  </span>
                </label>
              </div>
              {!termsAccepted && (
                <p className="text-[11px] text-vizme-greyblue/60 -mt-2">
                  Debes aceptar los términos para continuar.
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !termsAccepted}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-vizme-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-vizme-red/25 hover:bg-vizme-orange transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting
                  ? <Loader2 size={16} className="animate-spin" />
                  : <><span>Crear cuenta</span><ArrowRight size={16} /></>
                }
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-vizme-greyblue">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-vizme-red font-medium hover:text-vizme-orange transition-colors">
                  Iniciar sesión
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
    </>
  );
};

export default RegisterPage;
