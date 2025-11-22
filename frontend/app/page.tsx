"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { ArrowRight, Bot, Loader2 } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import FeaturesExpandableCards from "@/components/features-expandable-cards"
import { Modal, ModalBody, ModalContent, ModalFooter, ModalTrigger } from "@/components/ui/animated-modal"
import { motion, useInView, useSpring } from "motion/react"
import { useEffect, useRef, useState } from "react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const
    }
  },
}

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
  const { ready, authenticated, login, loading, logout } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loadingLink, setLoadingLink] = useState<string | null>(null)

  const handleGetStarted = async () => {
    console.log('Get Started clicked!')
    setIsLoggingIn(true)
    try {
      await login()
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Loading Overlay */}
      {loadingLink && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-60 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-slate-900 mx-auto mb-4" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      )}

      {/* Glowing Blue Orb - Half Visible at Top */}
      <div className="absolute -top-[500px] left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] pointer-events-none z-0">
        <div className="absolute inset-0 bg-blue-400 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute inset-8 bg-blue-400 rounded-full blur-2xl opacity-30"></div>
        <div className="absolute inset-[490px] bg-blue-500 rounded-full blur-xl opacity-40"></div>
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-4 z-50 px-6"
      >
        <div className="container mx-auto max-w-6xl bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 relative rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                <Image 
                  src="/logo.jpeg" 
                  alt="BlockOps Logo" 
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xl font-semibold text-slate-900">BlockOps</span>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link 
                href="#features" 
                onClick={() => setLoadingLink('#features')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Features
              </Link>
              <Link 
                href="/api-docs" 
                prefetch 
                onClick={() => setLoadingLink('/api-docs')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                API Docs
              </Link>
              <Link 
                href="/contract-explorer" 
                onClick={() => setLoadingLink('/contract-explorer')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Contract Explorer
              </Link>
            </div>

            {/* Connect Wallet / Profile */}
            {!authenticated ? (
              <Button 
                onClick={handleGetStarted}
                variant="outline" 
                size="sm"
                disabled={isLoggingIn}
                className="text-slate-900 border-slate-200 hover:bg-slate-50 font-medium"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            ) : (
              <UserProfile onLogout={logout} />
            )}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="relative container mx-auto px-6 pt-24 pb-16 max-w-6xl">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative flex flex-col items-center text-center"
        >
          {/* Social Proof Badge */}
          <motion.div variants={itemVariants} className="mb-10 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-slate-700">Build your army of agents</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </motion.div>

          {/* Main Heading */}
          <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mt-4">
            <span className="text-slate-900">Build AI agents that</span>
            <br />
            <span className="text-blue-500">automate blockchain</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p variants={itemVariants} className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            At BlockOps, we believe automation should be simple, scalable, and accessible—creating a experience where ideas thrive and boundaries fade.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            {authenticated ? (
              <>
                <Button 
                  asChild
                  size="lg" 
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 rounded-lg"
                >
                  <Link href="/my-agents">
                    View My Agents
                  </Link>
                </Button>
                <Button 
                  asChild
                  size="lg" 
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-8 rounded-lg"
                >
                  <Link href="/agent-builder">
                    Create Agent
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={handleGetStarted}
                  size="lg" 
                  disabled={isLoggingIn}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 rounded-lg"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </>
            )}
          </motion.div>

          {/* Hero Image */}
          <motion.div variants={itemVariants} className="w-full max-w-3xl mx-auto">
            <Image
              src="/hero-diagram.png"
              alt="BlockOps Platform"
              width={1200}
              height={700}
              className="w-full h-auto"
              priority
            />
          </motion.div>
        </motion.div>
      </main>

      {/* By the Numbers Section */}
      <section id="features" className="bg-black min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]"></div>
        
        <div className="container mx-auto px-6 max-w-6xl relative z-10 py-16">
          {/* Section Header */}
          <div className="mb-16">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-white/50 text-sm font-medium mb-4 tracking-wide"
            >
              Limitless Possibilities
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 max-w-4xl"
            >
              Automate anything on-chain{" "}
              <span className="text-white/50">with powerful, composable blocks.</span>
            </motion.h2>
          </div>

          {/* Use Cases Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                title: "DeFi Automation", 
                description: "Auto-compound yields, manage liquidity positions, and execute limit orders across any DEX.",
                icon: (
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                )
              },
              { 
                title: "NFT Operations", 
                description: "Automate collections, snipe rare mints, and automate royalty distributions instantly.",
                icon: (
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )
              },
              { 
                title: "Smart Alerts", 
                description: "Get notified via Discord, Telegram, or Email when specific on-chain events occur.",
                icon: (
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                )
              },
              { 
                title: "Cross-Chain", 
                description: "Bridge assets and sync state between Ethereum, L2s, and other chains automatically.",
                icon: (
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 flex flex-col h-full"
              >
                <div className="mb-6 p-3 bg-white/5 rounded-xl w-fit border border-white/10">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-24">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="container mx-auto px-6 max-w-6xl"
        >
          <motion.div variants={itemVariants} className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Build, deploy, and manage AI agents for blockchain automation
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <FeaturesExpandableCards />
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-24">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="container mx-auto px-6 max-w-6xl"
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-600">
              Get started in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <motion.div variants={itemVariants} className="text-center">
              <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Create Your Agent</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Use our visual builder to create your first AI agent. Choose from templates or start from scratch.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div variants={itemVariants} className="text-center">
              <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Configure Workflows</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Set up your automation workflows by connecting nodes and configuring triggers.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div variants={itemVariants} className="text-center">
              <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Deploy & Automate</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Deploy your agent to the blockchain and automate its performance in real-time.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="bg-slate-50 py-24 border-t border-slate-200">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="container mx-auto px-6 max-w-4xl text-center"
        >
          <motion.h2 variants={itemVariants} className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Ready to get started?
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Join thousands of users building the future of blockchain automation.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {authenticated ? (
              <Button 
                asChild
                size="lg" 
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 rounded-lg"
              >
                <Link href="/agent-builder">
                  Start Building
                </Link>
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleGetStarted}
                  size="lg" 
                  disabled={isLoggingIn}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 rounded-lg"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Get Started Free"
                  )}
                </Button>
                <Button 
                  asChild
                  size="lg" 
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-white font-medium px-8 rounded-lg"
                >
                  <Link href="/api-docs">
                    View Documentation
                  </Link>
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="container mx-auto px-6 max-w-6xl"
        >
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Company Info */}
            <motion.div variants={itemVariants}>
              <Link href="/" className="flex items-center gap-2 mb-4 group">
                <div className="w-9 h-9 relative rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                  <Image 
                    src="/logo.jpeg" 
                    alt="BlockOps Logo" 
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-lg font-semibold">BlockOps</span>
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed">
                Building the future of blockchain automation.
              </p>
            </motion.div>

            {/* Product */}
            <motion.div variants={itemVariants}>
              <h4 className="font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-3">
                <li><Link href="/agent-builder" className="text-slate-400 hover:text-white transition-colors text-sm">Agent Builder</Link></li>
                <li><Link href="/my-agents" className="text-slate-400 hover:text-white transition-colors text-sm">My Agents</Link></li>
                <li><Link href="/contract-explorer" className="text-slate-400 hover:text-white transition-colors text-sm">Contract Explorer</Link></li>
                <li><Link href="/api-docs" className="text-slate-400 hover:text-white transition-colors text-sm">API Docs</Link></li>
              </ul>
            </motion.div>

            {/* Resources */}
            <motion.div variants={itemVariants}>
              <h4 className="font-semibold mb-4 text-sm">Resources</h4>
              <ul className="space-y-3">
                <li><Link href="/api-docs" className="text-slate-400 hover:text-white transition-colors text-sm">API Documentation</Link></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">GitHub</a></li>
              </ul>
            </motion.div>

            {/* Company */}
            <motion.div variants={itemVariants}>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-3">
                <li><a href="mailto:contact@blockops.com" className="text-slate-400 hover:text-white transition-colors text-sm">Contact</a></li>
              </ul>
            </motion.div>
          </div>

          {/* Bottom Bar */}
          <motion.div variants={itemVariants} className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2025 BlockOps. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </motion.div>
        </motion.div>
      </footer>
    </div>
  )
}
