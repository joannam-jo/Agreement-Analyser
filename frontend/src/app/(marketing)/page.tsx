"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Upload,
  ScanSearch,
  HandCoins,
  Highlighter,
  Calculator,
  Languages,
  ShieldCheck,
  MessageCircle,
  Gavel,
  GraduationCap,
  Users,
  Briefcase,
  Sprout,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  { icon: Upload, title: "Upload your agreement", desc: "PDF, Word file, or just a photo from your phone.", tint: "bg-pastel-sky text-pop-sky" },
  { icon: ScanSearch, title: "We read every line", desc: "Each clause is checked for fees, traps and unfair terms.", tint: "bg-pastel-lilac text-pop-lilac" },
  { icon: HandCoins, title: "You decide with confidence", desc: "See the real cost, what to ask for, and what to avoid.", tint: "bg-pastel-mint text-pop-mint" },
];

const features = [
  { icon: Highlighter, title: "Risky lines highlighted", desc: "Red, amber and green marks right on your document, line by line.", tint: "bg-pastel-rose text-pop-rose" },
  { icon: Calculator, title: "The real cost, in rupees", desc: "Your EMI, what you actually receive, and the true yearly rate with all fees.", tint: "bg-pastel-mint text-pop-mint" },
  { icon: Languages, title: "English and हिन्दी", desc: "Explanations you can read, or listen to, in your own language.", tint: "bg-pastel-lemon text-pop-lemon" },
  { icon: ShieldCheck, title: "Catches hidden tricks", desc: "Tiny print, white text and other ways documents hide things from you.", tint: "bg-pastel-sky text-pop-sky" },
  { icon: MessageCircle, title: "Ask anything", desc: "“Can I repay early?” “What if I pay late?” Get a straight answer.", tint: "bg-pastel-lilac text-pop-lilac" },
  { icon: Gavel, title: "Help to take action", desc: "A ready complaint letter and the right place to report problems.", tint: "bg-pastel-peach text-pop-peach" },
];

const audiences = [
  { icon: GraduationCap, title: "Students", desc: "Education loans, moratorium interest and co-borrower terms explained.", tint: "bg-pastel-sky text-pop-sky" },
  { icon: Sprout, title: "First-time borrowers", desc: "Personal and app loans, before a small loan becomes a big problem.", tint: "bg-pastel-mint text-pop-mint" },
  { icon: Users, title: "Families", desc: "Check the fine print together before anyone signs as a guarantor.", tint: "bg-pastel-peach text-pop-peach" },
  { icon: Briefcase, title: "Finance professionals", desc: "Advisors, NGOs and legal aid teams reviewing agreements for clients.", tint: "bg-pastel-lilac text-pop-lilac" },
];

const fadeUp = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-pastel-mint px-3 py-1 text-xs font-semibold text-pop-mint">
            <ShieldCheck className="h-3.5 w-3.5" /> Free · Private · No sign-up needed
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-ink sm:text-5xl lg:text-6xl">
            Know what you’re signing <span className="text-brand-trust">before</span> you sign it.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-brand-cool">
            Upload any loan or financial agreement. We point out hidden fees, unfair terms and the real cost, in plain English or Hindi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/upload">
              <Button size="lg">
                Check my agreement <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-cool">
            <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-pop-mint" /> Encrypted, only you can see it</span>
            <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-pop-lemon" /> English &amp; हिन्दी</span>
          </div>
        </motion.div>

        {/* Example result, drawn with real UI pieces */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="relative">
          <div className="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-pastel-lemon" aria-hidden />
          <div className="absolute -bottom-6 -right-4 h-36 w-36 rounded-full bg-pastel-sky" aria-hidden />
          <div className="relative rounded-3xl border border-ink/10 bg-surface p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-cool">Personal loan agreement</p>
                <p className="text-lg font-bold text-ink">₹50,000 · 12 months</p>
              </div>
              <span className="rounded-full bg-pastel-rose px-3 py-1 text-xs font-bold text-pop-rose">Trust 34/100</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-brand-graphite p-4">
                <p className="text-xs text-brand-cool">Advertised rate</p>
                <p className="text-2xl font-extrabold text-ink">24%</p>
              </div>
              <div className="rounded-2xl bg-pastel-rose p-4">
                <p className="text-xs text-ink/70">Real yearly cost</p>
                <p className="text-2xl font-extrabold text-pop-rose">42.8%</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 text-sm">
              <li className="flex gap-3 rounded-2xl bg-pastel-rose/70 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pop-rose" />
                <span className="text-ink"><b>Rate can change anytime.</b> The lender can raise it without telling you.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-pastel-lemon/80 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-pop-lemon" />
                <span className="text-ink"><b>₹4,500 fee taken upfront.</b> You receive ₹45,500, not ₹50,000.</span>
              </li>
              <li className="flex gap-3 rounded-2xl bg-pastel-mint/80 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pop-mint" />
                <span className="text-ink"><b>Early repayment allowed.</b> 30 days’ written notice, no hidden fees.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-ink sm:text-4xl">Three simple steps</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-brand-cool">No jargon, no forms to fill. It takes about a minute.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div key={s.title} {...fadeUp} transition={{ delay: i * 0.08 }} className="rounded-3xl border border-ink/10 bg-brand-navy p-6">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tint}`}>
                    <s.icon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-bold text-brand-cool">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-brand-cool">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-ink sm:text-4xl">Everything you need to decide</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-brand-cool">Built for real loan documents from banks, NBFCs and loan apps.</p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ delay: i * 0.05 }} className="rounded-3xl border border-ink/10 bg-surface p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${f.tint}`}>
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
              <p className="mt-1 text-sm text-brand-cool">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-ink sm:text-4xl">Made for everyone who signs</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map((a, i) => (
              <motion.div key={a.title} {...fadeUp} transition={{ delay: i * 0.05 }} className={`rounded-3xl p-6 ${a.tint.split(" ")[0]}`}>
                <a.icon className={`h-7 w-7 ${a.tint.split(" ")[1]}`} />
                <h3 className="mt-3 text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-1 text-sm text-ink/70">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="rounded-[2rem] bg-brand-trust px-8 py-12 text-center text-white shadow-lift">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Got an agreement to sign?</h2>
          <p className="mx-auto mt-3 max-w-lg text-white/85">Check it first. It’s free, private, and takes about a minute.</p>
          <Link href="/upload" className="mt-8 inline-block">
            <Button size="lg" className="bg-white text-brand-trust hover:bg-white/90 hover:brightness-100">
              Check my agreement <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-6 text-xs text-white/70">Automated guidance, not legal advice.</p>
        </div>
      </section>
    </div>
  );
}
