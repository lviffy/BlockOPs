"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { ArrowRight, Bot, Loader2 } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import { PrivateKeySetupModal } from "@/components/private-key-setup-modal"
import FeaturesExpandableCards from "@/components/features-expandable-cards"
import { Modal, ModalBody, ModalContent, ModalFooter, ModalTrigger } from "@/components/ui/animated-modal"
import { motion, useInView, useSpring } from "motion/react"
import { useEffect, useRef, useState, useCallback } from "react"
import Lenis from 'lenis'



function NumberTicker({ 
  value, 
  direction = "up", 
  delay = 0, 
  className, 
  decimalPlaces = 0 
}: { 
  value: number, 
  direction?: "up" | "down", 
  delay?: number, 
  className?: string, 
  decimalPlaces?: number 
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useSpring(direction === "down" ? value : 0, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        motionValue.set(direction === "down" ? 0 : value);
      }, delay * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInView, motionValue, direction, value, delay]);

  useEffect(() => {
    return motionValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toFixed(decimalPlaces);
      }
    });
  }, [motionValue, decimalPlaces]);

  return <span className={className} ref={ref} />;
}

export default function Home() {
  const { ready, authenticated, login, loading, logout, user, showPrivateKeySetup, setShowPrivateKeySetup, syncUser } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loadingLink, setLoadingLink] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Initialize Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const handleGetStarted = useCallback(async () => {
    console.log('Get Started clicked!')
    setIsLoggingIn(true)
    try {
      await login()
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoggingIn(false)
    }
  }, [login])

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-500 text-sm">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      {/* Loading Overlay */}
      {loadingLink && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-60 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>
      )}

      {/* Radial Blue Glow - Top Center */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 z-0 flex justify-center"
        aria-hidden="true"
      >
        <div
          className="h-[600px] w-[900px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.10) 40%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="sticky top-3 z-50 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl bg-white/75 backdrop-blur-xl rounded-2xl border border-blue-100/80 shadow-sm shadow-blue-900/5">
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 relative rounded-lg overflow-hidden ring-1 ring-blue-100 transition-transform group-hover:scale-105">
                <Image src="/logo.jpeg" alt="BlockOps Logo" fill priority className="object-cover" />
              </div>
              <span className="text-[15px] font-semibold text-slate-900 tracking-tight">BlockOps</span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-7">
              {[
                { label: 'Features', href: '#features' },
                { label: 'API Docs', href: '/api-docs', prefetch: true },
                { label: 'Contract Explorer', href: '/contract-explorer' },
              ].map(({ label, href, prefetch: pf }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={pf}
                  onClick={() => setLoadingLink(href)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {!authenticated ? (
                <Button
                  onClick={handleGetStarted}
                  size="sm"
                  disabled={isLoggingIn}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm px-4 rounded-xl shadow-none"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">Connecting</span>
                      <span className="sm:hidden">…</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Connect Wallet</span>
                      <span className="sm:hidden">Connect</span>
                    </>
                  )}
                </Button>
              ) : (
                <UserProfile onLogout={logout} />
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-500 hover:text-slate-900 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-blue-100/60 px-4 py-4">
              <div className="flex flex-col gap-1">
                {[
                  { label: 'Features', href: '#features' },
                  { label: 'API Docs', href: '/api-docs', prefetch: true },
                  { label: 'Contract Explorer', href: '/contract-explorer' },
                ].map(({ label, href, prefetch: pf }) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={pf}
                    onClick={() => { setLoadingLink(href); setMobileMenuOpen(false) }}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors py-2.5 px-2 rounded-lg hover:bg-slate-50"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <main className="relative z-10 container mx-auto px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-28 pb-12 sm:pb-16 max-w-5xl">
        <div className="flex flex-col items-center text-center">

          {/* Pill badge */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm">
            <Bot className="w-3.5 h-3.5" />
            Build your army of on-chain agents
            <ArrowRight className="w-3 h-3 text-blue-400" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-5 sm:mb-6 max-w-4xl px-2">
            <span className="text-slate-900">Build AI agents that </span>
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              automate blockchain
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto mb-9 sm:mb-10 leading-relaxed px-2">
            At BlockOps, we believe automation should be simple, scalable, and accessible &mdash; an experience where ideas thrive and boundaries fade.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 sm:mb-14 w-full max-w-xs sm:max-w-none px-2">
            {authenticated ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 rounded-xl w-full sm:w-auto shadow-sm shadow-blue-600/20"
                >
                  <Link href="/my-agents">View My Agents</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold px-7 rounded-xl w-full sm:w-auto"
                >
                  <Link href="/agent-builder">Create Agent</Link>
                </Button>
              </>
            ) : (
              <Button
                onClick={handleGetStarted}
                size="lg"
                disabled={isLoggingIn}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 rounded-xl w-full sm:w-auto shadow-sm shadow-blue-600/20"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>Get Started — it&apos;s free</>
                )}
              </Button>
            )}
          </div>

          {/* Hero Product Screenshot */}
          <div className="w-full max-w-4xl mx-auto px-2">
            <div
              className="rounded-2xl overflow-hidden border border-blue-100 shadow-xl"
              style={{ boxShadow: '0 24px 64px -12px rgba(37,99,235,0.15), 0 0 0 1px rgba(37,99,235,0.07)' }}
            >
              <Image
                src="/hero-diagram.png"
                alt="BlockOps Platform"
                width={1200}
                height={700}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      </main>

      {/* ── Social-Proof Bar ────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-slate-100 bg-slate-50/60 py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <p className="text-center text-xs font-medium tracking-widest uppercase text-slate-400 mb-5">
            Trusted by builders on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
            {['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Base'].map((chain) => (
              <span key={chain} className="text-sm font-semibold text-slate-400 hover:text-blue-600 transition-colors cursor-default select-none">
                {chain}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases (dark) ───────────────────────────────────────── */}
      <section id="features" className="relative overflow-hidden" style={{ backgroundColor: '#020c1f' }}>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Blue glow blob */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.12) 0%, transparent 70%)' }}
        />

        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10 py-20 sm:py-28">
          {/* Header */}
          <div className="mb-14 sm:mb-18">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-400 mb-4">
              Limitless Possibilities
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight max-w-3xl">
              Automate anything on-chain{' '}
              <span className="text-blue-300/60">with powerful, composable blocks.</span>
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              {
                title: 'DeFi Automation',
                description: 'Auto-compound yields, manage liquidity positions, and execute limit orders across any DEX.',
                icon: (
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
              },
              {
                title: 'NFT Operations',
                description: 'Automate collections, snipe rare mints, and automate royalty distributions instantly.',
                icon: (
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: 'Smart Alerts',
                description: 'Get notified via Discord, Telegram, or Email when specific on-chain events occur.',
                icon: (
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
              },
              {
                title: 'Cross-Chain',
                description: 'Bridge assets and sync state between Ethereum, L2s, and other chains automatically.',
                icon: (
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-2xl border p-6 sm:p-7 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderColor: 'rgba(59,130,246,0.15)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)')}
              >
                <div
                  className="mb-5 w-9 h-9 flex items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(37,99,235,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-blue-100/40 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (light) ───────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-24 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-14 sm:mb-16">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-500 mb-3">
              Platform
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              Everything you need
            </h2>
            <p className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto">
              Build, deploy, and manage AI agents for blockchain automation — all in one place.
            </p>
          </div>
          <FeaturesExpandableCards />
        </div>
      </section>

      {/* ── How It Works (dark) ────────────────────────────────────── */}
      <section className="relative w-full py-12 lg:py-20 overflow-hidden" style={{ backgroundColor: '#f8faff' }}>
        <div className="w-full px-[2vw]">
          <div className="max-w-[2000px] mx-auto">
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{ backgroundColor: '#020c1f' }}
            >
              {/* Inner grid */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />
              <div className="relative z-10 px-8 sm:px-12 lg:px-16 py-14 lg:py-22">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mx-auto">

                  {/* LEGO Cube Stack */}
                  <div className="relative h-[500px] sm:h-[600px] lg:h-[700px] order-2 lg:order-1">
                    <div className="absolute bottom-0 left-0 h-full w-full translate-x-[-100px] translate-y-[280px] scale-50 lg:translate-x-0 lg:translate-y-0 lg:scale-100" style={{ willChange: 'transform' }}>
                      {/* Column 1 */}
                      <Image alt="cube" width={220} height={288} loading="lazy" className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block hidden" style={{ bottom: '-100px', left: '434px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} loading="lazy" className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block hidden" style={{ bottom: '54px', left: '434px' }} src="/lego_cube.webp" />
                      {/* Column 2 */}
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '-100px', left: '316px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '54px', left: '316px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '208px', left: '316px' }} src="/lego_cube.webp" />
                      {/* Column 3 */}
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '-100px', left: '198px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '54px', left: '198px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '208px', left: '198px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '362px', left: '198px' }} src="/lego_cube.webp" />
                      {/* Column 4 */}
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '-180px', left: '80px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '-26px', left: '80px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '128px', left: '80px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '282px', left: '80px' }} src="/lego_cube.webp" />
                      <Image alt="cube" width={220} height={288} className="absolute hover:z-10 hover:mix-blend-soft-light transition-all duration-300 max-sm:block xl:block" style={{ bottom: '441px', left: '80px' }} src="/lego_cube.webp" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-white space-y-6 order-1 lg:order-2">
                    <div className="space-y-4">
                      <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-400">
                        How It Works
                      </span>
                      <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight text-white">
                        Automation<br />Made Simple
                      </h2>
                    </div>
                    <p className="text-base sm:text-lg text-blue-100/50 leading-relaxed max-w-lg">
                      BlockOps transforms complex blockchain operations into simple, automated workflows. Build powerful AI agents with our visual builder, connect to any smart contract, and let your agents handle everything from DeFi strategies to NFT operations — no coding required.
                    </p>
                    <Link
                      href="/api-docs"
                      onClick={() => setLoadingLink('/api-docs')}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:gap-3 mt-2 shadow-sm shadow-blue-900/20"
                    >
                      Explore Documentation
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 sm:py-24"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)' }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            Start automating your<br className="hidden sm:block" /> blockchain workflows today
          </h2>
          <p className="text-blue-100/80 text-base sm:text-lg mb-9 max-w-md mx-auto leading-relaxed">
            Join the builders deploying intelligent on-chain agents with BlockOps.
          </p>
          {!authenticated ? (
            <Button
              onClick={handleGetStarted}
              size="lg"
              disabled={isLoggingIn}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 rounded-xl shadow-lg shadow-blue-900/20"
            >
              {isLoggingIn ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
              ) : (
                'Get Started Free'
              )}
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 rounded-xl shadow-lg shadow-blue-900/20">
              <Link href="/agent-builder">Create Your First Agent</Link>
            </Button>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: '#020c1f' }} className="text-white py-14 sm:py-18">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12">

            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-4 group">
                <div className="w-8 h-8 relative rounded-lg overflow-hidden ring-1 ring-blue-900/50 transition-transform group-hover:scale-105">
                  <Image src="/logo.jpeg" alt="BlockOps Logo" fill className="object-cover" />
                </div>
                <span className="text-[15px] font-semibold tracking-tight">BlockOps</span>
              </Link>
              <p className="text-blue-100/30 text-sm leading-relaxed">
                Building the future of blockchain automation.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-blue-100/40 mb-4">Product</h4>
              <ul className="space-y-3">
                {[
                  { label: 'Agent Builder', href: '/agent-builder' },
                  { label: 'My Agents', href: '/my-agents' },
                  { label: 'Orbit L3 Builder', href: '/orbit-builder' },
                  { label: 'Contract Explorer', href: '/contract-explorer' },
                  { label: 'API Docs', href: '/api-docs' },
                ].map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-blue-100/40 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-blue-100/40 mb-4">Resources</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/api-docs" className="text-sm text-blue-100/40 hover:text-white transition-colors">API Documentation</Link>
                </li>
                <li>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-100/40 hover:text-white transition-colors">GitHub</a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-blue-100/40 mb-4">Company</h4>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:contact@blockops.com" className="text-sm text-blue-100/40 hover:text-white transition-colors">Contact</a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-7 flex flex-col sm:flex-row justify-between items-center gap-4" style={{ borderColor: 'rgba(59,130,246,0.1)' }}>
            <p className="text-blue-100/25 text-xs sm:text-sm text-center sm:text-left">
              © 2025 BlockOps. All rights reserved.
            </p>
            <div className="flex gap-5 sm:gap-6">
              <a href="#" className="text-blue-100/25 hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </a>
              <a href="#" className="text-blue-100/25 hover:text-white transition-colors" aria-label="GitHub">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a href="#" className="text-blue-100/25 hover:text-white transition-colors" aria-label="LinkedIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Private Key Setup Modal */}
      {authenticated && user && (
        <PrivateKeySetupModal
          open={showPrivateKeySetup}
          onOpenChange={setShowPrivateKeySetup}
          userId={user.id}
          onComplete={syncUser}
        />
      )}
    </div>
  )
}
