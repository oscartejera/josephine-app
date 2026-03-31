/**
 * BookAChatPage — Conversion page (isolated layout, no navbar/footer)
 * 
 * 2-column: form LEFT + social proof RIGHT
 * Real Calendly-style form with name, email, company, phone, message.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, ArrowLeft, Star, CheckCircle } from 'lucide-react';

export default function BookAChatPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', venues: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Integration point: Supabase insert or webhook
    console.log('Demo request:', form);
    setSubmitted(true);
  };

  const update = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal header */}
      <header style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--l-bg-cream)' }}>
        <Link to="/" className="l-navbar-logo" style={{ color: 'var(--l-text-dark)' }}>
          <div className="l-navbar-logo-icon"><ChefHat className="w-4 h-4 text-white" /></div>
          <span>Josephine</span>
        </Link>
        <Link to="/" style={{ fontSize: 14, color: 'var(--l-text-muted-dark)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <ArrowLeft className="w-4 h-4" />{isEs ? 'Volver' : 'Back'}
        </Link>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--l-bg-cream)' }}>
        {/* Form side */}
        <div style={{ padding: '60px 60px 60px 80px', maxWidth: 580 }}>
          <h1 style={{ fontFamily: 'var(--l-font-serif)', fontWeight: 700, fontStyle: 'italic', fontSize: 36, color: 'var(--l-text-dark)', lineHeight: 1.2, marginBottom: 16 }}>
            {isEs ? 'Reserva una demo personalizada' : 'Book a personalised demo'}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--l-text-muted-dark)', marginBottom: 40, lineHeight: 1.5 }}>
            {isEs
              ? 'Descubre cómo Josephine puede transformar las operaciones de tu restaurante. Sin compromiso.'
              : "See how Josephine can transform your restaurant operations. No strings attached."
            }
          </p>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <CheckCircle className="w-12 h-12" style={{ color: '#22C55E', margin: '0 auto 24px' }} />
              <h2 style={{ fontFamily: 'var(--l-font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--l-text-dark)', marginBottom: 12 }}>
                {isEs ? '¡Listo! Te contactaremos pronto.' : 'Done! We\'ll be in touch soon.'}
              </h2>
              <p style={{ color: 'var(--l-text-muted-dark)', marginBottom: 24 }}>
                {isEs ? 'Espera un email nuestro en las próximas 24 horas.' : 'Expect an email from us within 24 hours.'}
              </p>
              <Link to="/" className="l-btn-outline">{isEs ? 'Volver al inicio' : 'Back to home'}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="l-form">
              <div className="l-form-group">
                <label>{isEs ? 'Nombre completo' : 'Full name'} *</label>
                <input type="text" required value={form.name} onChange={update('name')} placeholder={isEs ? 'Tu nombre' : 'Your name'} />
              </div>
              <div className="l-form-group">
                <label>{isEs ? 'Email de trabajo' : 'Work email'} *</label>
                <input type="email" required value={form.email} onChange={update('email')} placeholder="you@restaurant.com" />
              </div>
              <div className="l-form-group">
                <label>{isEs ? 'Empresa' : 'Company'} *</label>
                <input type="text" required value={form.company} onChange={update('company')} placeholder={isEs ? 'Nombre de tu restaurante' : 'Your restaurant name'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="l-form-group">
                  <label>{isEs ? 'Teléfono' : 'Phone'}</label>
                  <input type="tel" value={form.phone} onChange={update('phone')} placeholder="+34..." />
                </div>
                <div className="l-form-group">
                  <label>{isEs ? 'Nº de locales' : 'Number of venues'}</label>
                  <select value={form.venues} onChange={update('venues')}>
                    <option value="">{isEs ? 'Seleccionar' : 'Select'}</option>
                    <option value="1">1</option>
                    <option value="2-5">2-5</option>
                    <option value="6-20">6-20</option>
                    <option value="21-50">21-50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>
              </div>
              <div className="l-form-group">
                <label>{isEs ? 'Mensaje (opcional)' : 'Message (optional)'}</label>
                <textarea value={form.message} onChange={update('message')} rows={3} placeholder={isEs ? '¿Qué te gustaría saber?' : 'What would you like to know?'} />
              </div>
              <button type="submit" className="l-btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {isEs ? 'Solicitar demo' : 'Request demo'}
              </button>
            </form>
          )}
        </div>

        {/* Social proof side */}
        <div style={{ background: 'var(--l-bg-dark)', color: 'var(--l-text-white)', padding: '60px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {[1,2,3,4,5].map(n => <Star key={n} className="w-5 h-5" style={{ color: '#FBBF24', fill: '#FBBF24' }} />)}
            </div>
            <p style={{ fontSize: 20, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16, fontFamily: 'var(--l-font-serif)' }}>
              {isEs
                ? '"Josephine nos ha ahorrado más de 20 horas semanales en gestión operativa. El ROI fue evidente en el primer mes."'
                : '"Josephine has saved us over 20 hours per week in operational management. The ROI was evident in the first month."'
              }
            </p>
            <div style={{ fontSize: 14, opacity: 0.7 }}>— Marco R., Director de Operaciones, La Piazza Group</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { v: '8.8x', l: 'ROI' },
              { v: '500+', l: isEs ? 'Restaurantes' : 'Restaurants' },
              { v: '95%', l: isEs ? 'Precisión' : 'Accuracy' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--l-font-serif)', fontWeight: 700, fontSize: 28, color: 'var(--l-accent-lavender)' }}>{m.v}</div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
