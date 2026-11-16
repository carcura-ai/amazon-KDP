import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react"
import BlurText from "@/components/BlurText"
import ShinyText from "@/components/ShinyText"
import SpotlightCard from "@/components/SpotlightCard"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { BorderBeam } from "@/components/ui/border-beam"
import { Marquee } from "@/components/ui/marquee"
import { NumberTicker } from "@/components/ui/number-ticker"
import vorher from "@/assets/carcura-bmw-m2-front-vorher-hd.webp"
import nachher from "@/assets/carcura-bmw-m2-front-nachher-hd.webp"
import team from "@/assets/carcura-team-alexander-richy.webp"
import logo from "@/assets/carcura-logo-600.webp"

const SITE = "https://carcura.info"
const WA_PREIS =
  "https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20h%C3%A4tte%20gern%20einen%20Preis.%0AAuto%3A%20%0AWas%20soll%20gemacht%20werden%3A%20%0AOrt%3A%20"
const WA_TERMIN = "https://wa.me/491706669516?text=Hallo%20Carcura%2C%20ich%20m%C3%B6chte%20einen%20Termin%20anfragen."
const MAPS = "https://maps.google.com/maps?cid=13912678674450594421"
const EASE = [0.22, 1, 0.36, 1] as const

const PREISE = [
  { name: "Innenreinigung", was: "Sitze, Teppiche, Armaturen, Scheiben innen", preis: 90, href: "/auto-innenreinigung/" },
  { name: "Innen + außen", was: "Innenraum und Handwäsche mit Felgen", preis: 145, href: "/leistungen/" },
  { name: "Innen + Tierhaare", was: "Hundehaare aus Sitzen, Teppich und Kofferraum", preis: 119, href: "/tierhaare-auto-entfernen/" },
  { name: "Fleck im Sitz", was: "Ein Sitz, Fleck nass gereinigt", preis: 49, href: "/autositz-reinigen-flecken/" },
  { name: "Politur", was: "Glanz zurück, leichte Kratzer raus", preis: 349, href: "/autopolitur/" },
  { name: "Keramikversiegelung", was: "Inkl. Politur und Pflegeset", preis: 700, href: "/keramikversiegelung/" },
]

const BEWERTUNGEN = [
  { text: "… super beeindruckend was die jungs aus meinem alten lack rausgeholt haben und die keramikversieglung ist wirklich ein MUSS.", von: "Audi TT 8n, Politur und Keramik, Nov. 2026" },
  { text: "… sie haben mein Auto wieder zum glänzen gebracht, von innen – sowie außen. Professionell, detailverliebt, präzise, kompetent, zuverlässig …", von: "Nina, BMW 1er innen und außen, Okt. 2026" },
  { text: "Nach Terminabsprache wurde das Fahrzeug pünktlich geholt und sogar schneller gebracht als abgesprochen. Gerne wieder", von: "Tobias, Hol- und Bringservice, Aug. 2026" },
  { text: "Unser Kuga war bei Alex in den besten Händen. Weiter so.", von: "Elke R., Ford Kuga, Okt. 2026" },
  { text: "Hab ein Fahrzeug mit einigen KM auf dem Buckel aufbereiten lassen und das Ergebnis ist einfach klasse geworden.", von: "Jan M., Aufbereitung, Okt. 2026" },
  { text: "Schnelle und saubere Arbeit zum Fairen Preis. Sehr zufrieden gerne wieder!", von: "Merlin, Okt. 2026" },
]

const FAQ = [
  ["Was kostet eine Aufbereitung bei euch?", "Die Innenreinigung beginnt bei 90 €, innen und außen bei 145 €, das Familienpaket mit Tierhaaren bei 169 €. Den festen Preis für dein Auto bekommst du vorher."],
  ["Wie schnell bekomme ich einen Termin?", "Meist innerhalb von 1–2 Wochen, auch abends und samstags. Bei Notfällen wie Erbrochenem melde dich direkt – wir schauen, wie schnell es geht."],
  ["Muss ich mein Auto nach Walterschen bringen?", "Nein. Im Umkreis von 10 km holen wir kostenlos ab, weiter entfernt für 2 € pro zusätzlichem Kilometer."],
  ["Wann bezahle ich?", "Bis 500 € erst bei der Übergabe – mit Karte oder auf Rechnung. Ab 500 € zahlst du 50 % bei der Terminbestätigung an, den Rest bei der Übergabe."],
  ["Kann ich einen Termin absagen?", "Ja, bis 48 Stunden vorher kostenlos. Sagst du später ab, berechnen wir 50 % des vereinbarten Preises – außer bei Unvorhersehbarem wie Krankheit oder Unfall. Du kannst nachweisen, dass uns kein oder ein geringerer Schaden entstanden ist. Dein gesetzliches Widerrufsrecht bleibt unberührt."],
  ["Geht jeder Fleck raus?", "Die meisten ja. Ob ein Fleck ganz verschwindet, hängt von Material, Alter und Ursache ab. Nach einem Foto sagen wir dir ehrlich, was realistisch ist."],
]

const ORTE = [
  { ort: "Altenkirchen, Weyerbusch, Flammersfeld", preis: "kostenlos", pos: 14 },
  { ort: "Asbach", preis: "ca. 11 €", pos: 38 },
  { ort: "Hachenburg", preis: "ca. 28 €", pos: 62 },
  { ort: "Wissen", preis: "ca. 31 €", pos: 74 },
  { ort: "Neuwied", preis: "ca. 51 €", pos: 96 },
]

const wrap = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-16"
const btn =
  "inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-base font-semibold no-underline select-none"

/* ---------- kleine Bausteine ---------- */

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Knopf, der dem Mauszeiger ein Stück folgt. Auf Touch-Geräten ein normaler Knopf. */
function Magnet({ children, className, href }: { children: React.ReactNode; className: string; href: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16 })
  const sy = useSpring(y, { stiffness: 220, damping: 16 })
  return (
    <motion.a
      href={href}
      className={className}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - r.left - r.width / 2) * 0.28)
        y.set((e.clientY - r.top - r.height / 2) * 0.28)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.a>
  )
}

/* ---------- Hero ---------- */

const WORTE = ["sauber.", "fleckenfrei.", "glänzend.", "geschützt."]

function Wechselwort() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % WORTE.length), 2400)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="relative inline-block h-[1.08em] overflow-hidden align-bottom text-accent">
      <span className="invisible">fleckenfrei.</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={WORTE[i]}
          className="absolute top-0 left-0"
          initial={{ y: "100%", opacity: 0, filter: "blur(8px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {WORTE[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Auto als Linie: zeichnet sich, dann läuft ein Glanzstreifen darüber, Wasser perlt ab. */
function AutoBuehne() {
  const draw = (delay: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { duration: 1.8, delay, ease: EASE }, opacity: { duration: 0.2, delay } },
  })
  const tropfen = [
    { x: 236, d: 0 }, { x: 292, d: 0.9 }, { x: 348, d: 1.7 }, { x: 404, d: 0.4 }, { x: 180, d: 1.3 }, { x: 470, d: 2.1 },
  ]
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-line bg-ink-2 p-5 sm:p-8">
      <BorderBeam size={120} duration={7} colorFrom="#e8f320" colorTo="#ffffff" borderWidth={1.5} />
      <svg viewBox="0 0 600 250" className="block h-auto w-full" role="img" aria-label="Animation: Ein Auto wird poliert, Wasser perlt ab">
        <defs>
          <linearGradient id="glanz" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#e8f320" stopOpacity="0" />
            <stop offset="0.5" stopColor="#e8f320" stopOpacity="0.95" />
            <stop offset="1" stopColor="#e8f320" stopOpacity="0" />
          </linearGradient>
          <clipPath id="karosse">
            <path d="M40 170 C40 150 60 142 95 138 L150 132 C175 105 215 88 270 86 L340 86 C385 88 420 108 448 132 L520 140 C548 144 560 154 560 170 L560 180 L40 180 Z" />
          </clipPath>
        </defs>

        {/* Boden */}
        <motion.line x1="20" x2="580" y1="211" y2="211" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" {...draw(0.1)} />

        {/* Karosserie */}
        <motion.path
          d="M40 180 L40 170 C40 150 60 142 95 138 L150 132 C175 105 215 88 270 86 L340 86 C385 88 420 108 448 132 L520 140 C548 144 560 154 560 170 L560 180 L500 180 A38 38 0 0 0 424 180 L196 180 A38 38 0 0 0 120 180 Z"
          fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" {...draw(0.2)}
        />
        <motion.path d="M178 130 C198 110 228 100 270 98 L300 98 L300 130 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" {...draw(0.7)} />
        <motion.path d="M312 98 L340 98 C372 100 398 114 418 130 L312 130 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" {...draw(0.9)} />
        <motion.line x1="306" x2="306" y1="132" y2="176" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" {...draw(1.1)} />

        {/* Räder drehen sich */}
        {[158, 462].map((cx, n) => (
          <g key={cx}>
            <motion.circle cx={cx} cy={180} r={30} fill="none" stroke="#fff" strokeWidth="2.5" {...draw(1 + n * 0.15)} />
            <motion.g
              style={{ transformOrigin: `${cx}px 180px`, transformBox: "view-box" }}
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              transition={{ opacity: { delay: 1.6 }, rotate: { duration: 6, repeat: Infinity, ease: "linear" } }}
            >
              {[0, 72, 144, 216, 288].map((a) => (
                <line key={a} x1={cx} y1={180} x2={cx + 20 * Math.cos((a * Math.PI) / 180)} y2={180 + 20 * Math.sin((a * Math.PI) / 180)} stroke="#e8f320" strokeWidth="2" strokeLinecap="round" />
              ))}
              <circle cx={cx} cy={180} r={5} fill="#e8f320" />
            </motion.g>
          </g>
        ))}

        {/* Glanzstreifen über den Lack */}
        <g clipPath="url(#karosse)">
          <motion.rect
            y="70" width="150" height="120" fill="url(#glanz)" opacity="0.5"
            style={{ transformBox: "view-box" }}
            initial={{ x: -180 }} animate={{ x: 640 }}
            transition={{ duration: 2.6, delay: 2, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          />
        </g>

        {/* Wasser perlt ab */}
        {tropfen.map((t) => (
          <motion.circle
            key={t.x} cx={t.x} r="3.2" fill="#e8f320"
            initial={{ cy: 88, opacity: 0 }}
            animate={{ cy: [88, 132, 214], opacity: [0, 1, 0] }}
            transition={{ duration: 2.2, delay: 2.4 + t.d, repeat: Infinity, repeatDelay: 1.9, ease: "easeIn", times: [0, 0.45, 1] }}
          />
        ))}

        {/* Funkeln */}
        {[{ x: 250, y: 62 }, { x: 498, y: 116 }, { x: 96, y: 112 }].map((s, n) => (
          <motion.path
            key={n}
            d={`M${s.x} ${s.y - 11} L${s.x + 3} ${s.y - 3} L${s.x + 11} ${s.y} L${s.x + 3} ${s.y + 3} L${s.x} ${s.y + 11} L${s.x - 3} ${s.y + 3} L${s.x - 11} ${s.y} L${s.x - 3} ${s.y - 3} Z`}
            fill="#e8f320"
            style={{ transformOrigin: `${s.x}px ${s.y}px`, transformBox: "view-box" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 45, 90] }}
            transition={{ duration: 1.6, delay: 2.8 + n * 0.7, repeat: Infinity, repeatDelay: 2.4 }}
          />
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>Von Hand in unserer Halle in Walterschen</span>
        <span className="rounded-full bg-accent px-4 py-1.5 font-semibold text-ink">Innen ab 90 €</span>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-clip pt-8 pb-10 sm:pt-14 lg:pt-20">
      {/* ruhiges Lichtfeld im Hintergrund */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{ background: "radial-gradient(closest-side, #e8f320, transparent)" }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.16, 0.26, 0.16] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className={`${wrap} relative grid items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-20`}>
        <div className="grid gap-6">
          <h1 className="text-[clamp(2rem,5.4vw,4.6rem)]" aria-label="Dein Auto wieder richtig sauber.">
            <BlurText text="Dein Auto wieder richtig" delay={110} stepDuration={0.4} trigger="load" className="font-display" />
            <Wechselwort />
          </h1>
          <Reveal delay={0.5}>
            <p className="max-w-[34ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">
              Von Hand in unserer Halle im Westerwald. Wir holen es auch ab.
            </p>
          </Reveal>
          <Reveal delay={0.65} className="flex flex-wrap gap-3">
            <Magnet href={WA_PREIS} className={`${btn} bg-accent text-ink`}>Preis per WhatsApp</Magnet>
            <motion.a href="tel:+491706669516" whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className={`${btn} border border-line text-white`}>
              0170 6669516
            </motion.a>
          </Reveal>
          <Reveal delay={0.8}>
            <a href={MAPS} className="inline-flex items-center gap-3 text-sm text-muted no-underline">
              <span className="flex gap-0.5 text-accent" aria-hidden>
                {[0, 1, 2, 3, 4].map((n) => (
                  <motion.span key={n} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.1 + n * 0.09, type: "spring", stiffness: 300, damping: 12 }}>★</motion.span>
                ))}
              </span>
              <span><b className="font-semibold text-white">4,8</b> aus 17 Google-Bewertungen</span>
            </a>
          </Reveal>
        </div>
        <Reveal delay={0.3}><AutoBuehne /></Reveal>
      </div>

      {/* Laufband mit Ab-Preisen */}
      <div className="relative mt-12 border-y border-line">
        <Marquee pauseOnHover className="py-4 [--duration:38s] [--gap:2.5rem]">
          {PREISE.map((p) => (
            <a key={p.name} href={SITE + p.href} className="flex items-baseline gap-3 whitespace-nowrap text-white no-underline">
              <span className="text-muted">{p.name}</span>
              <span className="text-xl font-semibold">ab {p.preis} €</span>
              <span className="text-accent" aria-hidden>✦</span>
            </a>
          ))}
        </Marquee>
      </div>
    </section>
  )
}

/* ---------- Preise ---------- */

function Preise() {
  return (
    <section className="bg-paper py-20 text-ink lg:py-32">
      <div className={wrap}>
        <Reveal className="mb-12 grid gap-4">
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Preise, die du vorher kennst.</h2>
          <p className="max-w-[34ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-[#55565c]">Fester Preis vor dem Termin. Meist noch am selben Tag.</p>
        </Reveal>
        <ul className="m-0 list-none border-t-[1.5px] border-ink p-0">
          {PREISE.map((p, i) => (
            <motion.li
              key={p.name}
              className="border-b border-ink/15"
              initial={{ opacity: 0, x: -36 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
            >
              <a href={SITE + p.href} className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 overflow-hidden px-2 py-5 text-ink no-underline sm:px-4">
                <span aria-hidden className="absolute inset-0 origin-left scale-x-0 bg-accent transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" />
                <span className="relative">
                  <span className="block text-[clamp(1.2rem,1.8vw,1.5rem)] leading-tight font-semibold">{p.name}</span>
                  <span className="block text-sm text-[#55565c]">{p.was}</span>
                </span>
                <span className="relative flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-sm text-[#55565c]">ab</span>
                  <span className="text-[clamp(1.9rem,4vw,3.25rem)] leading-none font-semibold tracking-tight">
                    <NumberTicker value={p.preis} className="tracking-tight !text-ink" /> €
                  </span>
                  <span aria-hidden className="hidden translate-x-[-8px] text-2xl opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:inline">→</span>
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
        <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-5">
          <p className="max-w-[56ch] text-sm text-[#55565c]">
            Endpreise, ohne Umsatzsteuer (Kleinunternehmer, § 19 UStG). Gleicher Ab-Preis für PKW, Kombi und Van. Ab 500 € mit 50 % Anzahlung.
          </p>
          <Magnet href={`${SITE}/leistungen/`} className={`${btn} bg-ink text-paper`}>Alle Leistungen</Magnet>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- Drei Wege ---------- */

function Strich({ d, delay = 0 }: { d: string; delay?: number }) {
  return (
    <motion.path
      d={d} fill="none" stroke="#e8f320" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ duration: 1.3, delay, ease: EASE }}
    />
  )
}

const WEGE = [
  {
    titel: "Einfach wieder sauber", text: "Innen, außen oder beides.", ab: "Familienpaket ab 169 €", href: "/leistungen/",
    icon: ["M18 54 L18 34 C18 22 26 14 36 14 C46 14 54 22 54 34 L54 54", "M12 54 L60 54", "M26 30 L46 30", "M26 40 L46 40"],
  },
  {
    titel: "Fleck, Haare, Geruch", text: "Auch Notfälle wie Erbrochenes.", ab: "Fleck + Geruch ab 119 €", href: "/autositz-reinigen-flecken/",
    icon: ["M36 10 C36 10 18 30 18 42 C18 52 26 60 36 60 C46 60 54 52 54 42 C54 30 36 10 36 10 Z", "M28 44 C28 48 31 52 36 52"],
  },
  {
    titel: "Politur & Keramik", text: "Bis zu 5 Jahre Schutz laut Hersteller.", ab: "Keramik ab 700 €", href: "/keramikversiegelung/",
    icon: ["M36 8 L42 30 L64 36 L42 42 L36 64 L30 42 L8 36 L30 30 Z", "M56 10 L58 16 L64 18 L58 20 L56 26 L54 20 L48 18 L54 16 Z"],
  },
]

function Wege() {
  return (
    <section className="py-20 lg:py-32">
      <div className={wrap}>
        <Reveal className="mb-12 grid gap-4">
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Was brauchst du?</h2>
          <p className="max-w-[34ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">Unsicher? Schick 2–3 Fotos, wir sagen dir, was nötig ist.</p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {WEGE.map((w, i) => (
            <Reveal key={w.titel} delay={i * 0.12}>
              <motion.a href={SITE + w.href} className="block h-full text-white no-underline" whileHover={{ y: -8 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
                <SpotlightCard spotlightColor="rgba(232,243,32,.28)" className="flex h-full min-h-[300px] flex-col justify-between gap-10 !rounded-[22px] !p-8">
                  <svg viewBox="0 0 72 72" className="h-20 w-20" aria-hidden>
                    {w.icon.map((d, n) => <Strich key={n} d={d} delay={0.2 + n * 0.25} />)}
                  </svg>
                  <div className="grid gap-2">
                    <h3 className="text-[clamp(1.25rem,1.8vw,1.56rem)] leading-tight font-semibold">{w.titel}</h3>
                    <p className="text-muted">{w.text}</p>
                    <p className="font-semibold text-accent">{w.ab}</p>
                  </div>
                </SpotlightCard>
              </motion.a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Vorher / Nachher zum Ziehen ---------- */

function VorherNachher() {
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const setze = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    setPos(Math.min(96, Math.max(4, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <section className="pb-20 lg:pb-32">
      <div className={`${wrap} grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
        <Reveal className="grid gap-5">
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Zieh selbst. Vorher, nachher.</h2>
          <p className="max-w-[36ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">Ein BMW M2 bei uns in der Halle: gewaschen, poliert, versiegelt.</p>
        </Reveal>
        <Reveal delay={0.15}>
          <div
            ref={box}
            className="relative aspect-[4/3] w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-[22px] bg-ink-3 select-none"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setze(e.clientX) }}
            onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") setze(e.clientX) }}
          >
            <img src={nachher} alt="BMW M2 nach der Aufbereitung" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <img src={vorher} alt="BMW M2 vor der Aufbereitung" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
            <span className="absolute top-4 left-4 rounded-full bg-ink/80 px-3 py-1 text-sm">Vorher</span>
            <span className="absolute top-4 right-4 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-ink">Nachher</span>
            <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${pos}%` }}>
              <motion.div
                className="absolute top-1/2 left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-lg font-bold text-ink"
                animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
              >
                ↔
              </motion.div>
            </div>
            <input
              type="range" min={4} max={96} value={pos} onChange={(e) => setPos(+e.target.value)}
              aria-label="Vorher-Nachher-Vergleich verschieben" className="absolute inset-x-0 bottom-0 h-6 w-full opacity-0 focus-visible:opacity-100"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- Ablauf: Linie füllt sich beim Scrollen ---------- */

const SCHRITTE = [
  ["Anfragen", "Foto per WhatsApp, du bekommst einen festen Preis."],
  ["Termin", "Meist in 1–2 Wochen, auch abends und samstags."],
  ["Gepflegt zurück", "Bezahlt wird bei der Übergabe, ab 500 € mit Anzahlung."],
]

function Ablauf() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] })
  const breite = useSpring(scrollYProgress, { stiffness: 90, damping: 22 })
  return (
    <section className="pb-20 lg:pb-32">
      <div className={wrap} ref={ref}>
        <Reveal className="mb-12"><h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">In drei Schritten erledigt.</h2></Reveal>
        <div className="relative mb-8 h-[3px] rounded bg-line">
          <motion.div className="absolute inset-0 origin-left rounded bg-accent" style={{ scaleX: breite }} />
        </div>
        <ol className="m-0 grid list-none gap-8 p-0 md:grid-cols-3">
          {SCHRITTE.map(([t, s], i) => (
            <motion.li
              key={t} className="grid gap-2"
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-12% 0px" }}
              transition={{ duration: 0.6, delay: i * 0.18, ease: EASE }}
            >
              <motion.span
                className="font-display text-6xl leading-none font-extrabold text-accent" aria-hidden
                initial={{ scale: 0.4, rotate: -12 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.1 + i * 0.18 }}
              >
                {i + 1}
              </motion.span>
              <h3 className="text-[clamp(1.25rem,1.8vw,1.56rem)] font-semibold">{t}</h3>
              <p className="text-muted">{s}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------- Bewertungen: zwei Laufbänder ---------- */

function Karte({ b }: { b: (typeof BEWERTUNGEN)[number] }) {
  return (
    <figure className="m-0 flex w-[min(78vw,360px)] shrink-0 flex-col justify-between gap-6 rounded-[22px] bg-ink-3 p-7">
      <div>
        <span className="mb-3 block tracking-[2px] text-accent" aria-label="5 Sterne">★★★★★</span>
        <blockquote className="m-0 text-[1.04rem] leading-normal">„{b.text}“</blockquote>
      </div>
      <figcaption className="text-sm text-muted">{b.von}</figcaption>
    </figure>
  )
}

function Bewertungen() {
  return (
    <section className="overflow-clip bg-ink-2 py-20 lg:py-28">
      <div className={`${wrap} mb-12 flex flex-wrap items-end justify-between gap-5`}>
        <Reveal className="grid gap-4">
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">
            <NumberTicker value={4.8} decimalPlaces={1} className="!text-accent" /> von 5 bei Google.
          </h2>
          <p className="max-w-[36ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">17 Bewertungen, genau so, wie sie bei Google stehen.</p>
        </Reveal>
        <motion.a href={MAPS} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className={`${btn} border border-line text-white`}>Alle Bewertungen</motion.a>
      </div>
      <div className="relative">
        <Marquee pauseOnHover repeat={3} className="[--duration:60s] [--gap:1.5rem]">
          {BEWERTUNGEN.slice(0, 3).map((b) => <Karte key={b.von} b={b} />)}
        </Marquee>
        <Marquee pauseOnHover reverse repeat={3} className="[--duration:60s] [--gap:1.5rem]">
          {BEWERTUNGEN.slice(3).map((b) => <Karte key={b.von} b={b} />)}
        </Marquee>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-2 to-transparent sm:w-32" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-2 to-transparent sm:w-32" />
      </div>
    </section>
  )
}

/* ---------- Hol- & Bringservice: Auto fährt die Strecke ---------- */

function HolBring() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] })
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 20 })
  const links = useTransform(p, [0, 1], ["0%", "100%"])
  return (
    <section className="py-20 lg:py-32">
      <div className={wrap} ref={ref}>
        <Reveal className="mb-14 grid gap-4">
          <h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Keine Zeit? Wir holen ab.</h2>
          <p className="max-w-[40ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">Bis 10 km kostenlos, darüber 2 € pro Kilometer, hin und zurück.</p>
        </Reveal>

        {/* Strecke */}
        <div className="relative mx-2 mb-12 h-16">
          <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded bg-line" />
          <div className="absolute top-1/2 left-0 h-[3px] w-[26%] -translate-y-1/2 rounded bg-accent/40" />
          <motion.div className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded bg-accent" style={{ width: links }} />
          {ORTE.map((o) => (
            <motion.span
              key={o.ort} aria-hidden className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-ink"
              style={{ left: `${o.pos}%` }}
              initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", delay: 0.2 + o.pos / 120 }}
            />
          ))}
          <motion.div aria-hidden className="absolute top-1/2 -translate-x-1/2 -translate-y-[115%]" style={{ left: links }}>
            <svg viewBox="0 0 64 30" className="h-8 w-16">
              <path d="M3 22 L3 18 C3 15 6 14 11 13 L18 12 C22 6 27 4 34 4 L42 4 C48 4 52 8 56 12 L60 13 C62 14 62 16 62 18 L62 22 Z" fill="#e8f320" />
              <circle cx="17" cy="23" r="5.5" fill="#09090a" stroke="#e8f320" strokeWidth="2" />
              <circle cx="49" cy="23" r="5.5" fill="#09090a" stroke="#e8f320" strokeWidth="2" />
            </svg>
          </motion.div>
          <span className="absolute -bottom-3 left-0 text-xs text-muted">Walterschen</span>
          <span className="absolute -bottom-3 left-[26%] -translate-x-1/2 text-xs text-accent">10 km gratis</span>
        </div>

        <ul className="m-0 grid list-none gap-0 border-t border-line p-0">
          {ORTE.map((o, i) => (
            <motion.li
              key={o.ort} className="flex justify-between gap-4 border-b border-line py-4"
              initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <b className="font-semibold">{o.ort}</b>
              <span className="font-semibold whitespace-nowrap text-accent">{o.preis}</span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Lieber selbst vorbeikommen? Hauptstr. 7, 57632 Walterschen.{" "}
          <a href={`${SITE}/hol-und-bringservice/`} className="text-white underline underline-offset-4">So funktioniert der Hol- &amp; Bringservice</a>
        </p>
      </div>
    </section>
  )
}

/* ---------- Team ---------- */

function Team() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"])
  return (
    <section className="pb-20 lg:pb-32">
      <div className={`${wrap} grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
        <motion.div
          ref={ref} className="aspect-[1136/1280] max-h-[620px] w-full overflow-hidden rounded-[22px] bg-ink-3"
          initial={{ clipPath: "inset(12% 12% 12% 12% round 22px)", opacity: 0 }}
          whileInView={{ clipPath: "inset(0% 0% 0% 0% round 22px)", opacity: 1 }}
          viewport={{ once: true, margin: "-15% 0px" }} transition={{ duration: 1, ease: EASE }}
        >
          <motion.img src={team} alt="Alexander und Richy von Carcura" loading="lazy" className="h-[116%] w-full object-cover" style={{ y }} />
        </motion.div>
        <div className="grid gap-5">
          <Reveal><h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Alex &amp; Richy. Inhabergeführt.</h2></Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-[40ch] text-[clamp(1.06rem,1.5vw,1.31rem)] text-muted">
              <span className="font-medium text-white">Jedes Auto machen wir selbst, von Hand.</span> Du weißt vorher, was es kostet, und wir sagen dir, wenn eine günstigere Leistung reicht.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <motion.a href={`${SITE}/ueber-uns/`} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className={`${btn} border border-line text-white`}>Mehr über uns</motion.a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------- FAQ (shadcn Accordion) ---------- */

function Fragen() {
  return (
    <section className="pb-20 lg:pb-32">
      <div className={`${wrap} grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
        <Reveal><h2 className="text-[clamp(2rem,4.2vw,3.25rem)]">Kurz erklärt.</h2></Reveal>
        <Reveal delay={0.1}>
          <Accordion className="border-t border-line">
            {FAQ.map(([f, a]) => (
              <AccordionItem key={f} value={f} className="border-line">
                <AccordionTrigger className="py-5 text-[1.1rem] font-semibold hover:text-accent hover:no-underline **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-accent">{f}</AccordionTrigger>
                <AccordionContent className="max-w-[62ch] pb-5 text-base text-muted">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- Abschluss ---------- */

function Abschluss() {
  return (
    <section className="overflow-clip bg-accent py-20 text-ink lg:py-28">
      <Marquee className="mb-10 p-0 [--duration:26s] [--gap:3rem]" aria-hidden>
        {["Fester Preis vorab", "Von Hand", "Abholung bis 10 km gratis", "Eigene Halle"].map((t) => (
          <span key={t} className="font-display text-[clamp(1.6rem,3.4vw,2.8rem)] font-extrabold whitespace-nowrap opacity-25">{t} ✦</span>
        ))}
      </Marquee>
      <div className={`${wrap} grid items-end gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]`}>
        <Reveal>
          <h2 className="max-w-[14ch] text-[clamp(2rem,4.2vw,3.25rem)]">Schreib uns kurz. Du bekommst einen festen Preis.</h2>
          <p className="mt-4 max-w-[44ch]">Per WhatsApp, Telefon oder Formular. Fotos helfen, sind aber kein Muss.</p>
        </Reveal>
        <Reveal delay={0.15} className="flex flex-wrap gap-3 lg:justify-end">
          <Magnet href={WA_TERMIN} className={`${btn} bg-ink text-accent`}>Foto per WhatsApp</Magnet>
          <motion.a href={`${SITE}/anfragen/`} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className={`${btn} border border-ink/35 text-ink`}>Anfrage senden</motion.a>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- Seite ---------- */

const NAV = [
  ["Leistungen", "/leistungen/"], ["Hol- & Bringservice", "/hol-und-bringservice/"], ["Händler & Firmen", "/firmenkunde/"],
  ["Unsere Partner", "/partner/"], ["Über uns", "/ueber-uns/"],
]
const FUSS = [
  ["Alle Leistungen & Preise", "/leistungen/"], ["Leasingrückgabe", "/leasingrueckgabe-aufbereitung/"], ["Wohnmobil", "/wohnmobil-aufbereitung/"],
  ["Scheinwerfer", "/scheinwerfer-aufbereiten/"], ["Gutschein", "/gutschein/"], ["Händler & Firmen", "/firmenkunde/"],
  ["Fahrzeugaufbereitung Westerwald", "/fahrzeugaufbereitung-westerwald/"], ["Über uns", "/ueber-uns/"],
  ["Impressum & Datenschutz", "/?page_id=122"], ["Verträge hier kündigen", "/kuendigen/"], ["Abo-Bedingungen", "/abo-bedingungen/"],
]

export default function App() {
  const { scrollYProgress } = useScroll()
  const fortschritt = useSpring(scrollYProgress, { stiffness: 120, damping: 26 })
  return (
    <MotionConfig reducedMotion="user">
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-accent" style={{ scaleX: fortschritt }} />

      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className={`${wrap} flex min-h-[68px] items-center justify-between gap-4`}>
          <a href={SITE} className="flex items-center gap-2.5 font-display text-xl font-extrabold text-white no-underline" aria-label="Carcura Startseite">
            <img src={logo} alt="" width={40} height={40} className="h-10 w-10 rounded" />
            <ShinyText text="Carcura" color="#ffffff" shineColor="#e8f320" speed={4} />
          </a>
          <nav className="hidden gap-7 text-sm lg:flex">
            {NAV.map(([t, h]) => (
              <a key={h} href={SITE + h} className="group relative text-muted no-underline transition-colors hover:text-white">
                {t}
                <span className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <motion.a href={`${SITE}/anfragen/`} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className={`${btn} !min-h-[44px] bg-accent !px-5 text-ink`}>Anfragen</motion.a>
        </div>
      </header>

      <main>
        <Hero />
        <Preise />
        <Wege />
        <VorherNachher />
        <Ablauf />
        <Bewertungen />
        <HolBring />
        <Team />
        <Fragen />
        <Abschluss />
      </main>

      <footer className="border-t border-line pt-14 pb-28 text-sm text-muted md:pb-14">
        <div className={`${wrap} grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
          <div>
            <p className="mb-2 font-display text-3xl font-extrabold text-white">Carcura</p>
            <p>Carcura GbR, Hauptstr. 7, 57632 Walterschen<br /><a href="tel:+491706669516" className="text-muted no-underline hover:text-white">+49 170 6669516</a></p>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-6 gap-y-2.5 p-0">
            {FUSS.map(([t, h]) => <li key={h}><a href={SITE + h} className="text-muted no-underline hover:text-white">{t}</a></li>)}
          </ul>
        </div>
      </footer>

      {/* Mobile Leiste */}
      <motion.nav
        aria-label="Schnellkontakt"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-2 border-t border-line bg-ink/95 px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
        initial={{ y: 90 }} animate={{ y: 0 }} transition={{ delay: 1.4, type: "spring", stiffness: 200, damping: 24 }}
      >
        <a href="tel:+491706669516" className={`${btn} !min-h-[48px] border border-line !px-2 !text-[.94rem] text-white`}>Anrufen</a>
        <a href="https://wa.me/491706669516" className={`${btn} !min-h-[48px] border border-line !px-2 !text-[.94rem] text-white`}>WhatsApp</a>
        <a href={`${SITE}/anfragen/`} className={`${btn} !min-h-[48px] bg-accent !px-2 !text-[.94rem] text-ink`}>Anfragen</a>
      </motion.nav>
    </MotionConfig>
  )
}
