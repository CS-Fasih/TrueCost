import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingDown
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { analyzeProduct, createAlert, getProduct, getRecentProducts } from "./api";
import type { AnalysisResponse, PricePoint, ProductRecord, RetailerOffer, Verdict } from "./types";

const sites = [
  { label: "Amazon", tone: "text-amber-200 border-amber-300/20 bg-amber-300/10" },
  { label: "Shopee", tone: "text-orange-200 border-orange-300/20 bg-orange-300/10" },
  { label: "Lazada", tone: "text-fuchsia-200 border-fuchsia-300/20 bg-fuchsia-300/10" },
  { label: "Flipkart", tone: "text-sky-200 border-sky-300/20 bg-sky-300/10" }
];

function formatMoney(currency: string, amount: number) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: amount > 1000 ? 0 : 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-hidden text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          <Link to="/" className="focus-ring flex items-center gap-3 rounded-full">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-300/25 bg-blue-500/15 text-blue-200 shadow-glow">
              <TrendingDown size={18} />
            </span>
            <span className="text-base font-semibold tracking-normal text-white">TrueCost</span>
          </Link>
          <a
            className="focus-ring hidden items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-300/40 hover:text-white sm:flex"
            href="https://github.com/CS-Fasih/TrueCost"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
        </nav>
        {children}
      </div>
    </main>
  );
}

function HomePage() {
  const [url, setUrl] = useState("");
  const [recent, setRecent] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getRecentProducts()
      .then((response) => setRecent(response.products))
      .catch(() => setRecent([]));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Paste a product link first.");
      return;
    }

    setLoading(true);
    try {
      const analysis = await analyzeProduct(url);
      navigate(`/results/${analysis.product.id}`, { state: { analysis } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "TrueCost could not analyze this link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="flex flex-1 flex-col items-center justify-center pb-16 pt-16 text-center sm:pt-20">
        <div className="animate-fade-in">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm text-blue-100">
            <Sparkles size={16} /> Product price intelligence
          </p>
          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-normal text-white sm:text-6xl lg:text-7xl">
            Is this price actually good?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Paste any product link. Get the truth in seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-3xl animate-fade-in">
          <div className="glass input-glow flex items-center gap-3 rounded-[2rem] p-2 transition hover:border-blue-300/40">
            <Search className="ml-4 shrink-0 text-blue-200" size={22} />
            <input
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500 sm:text-lg"
              placeholder="Paste an Amazon, Shopee, Lazada, or Flipkart URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-label="Product URL"
            />
            <button
              type="submit"
              disabled={loading}
              className="focus-ring grid h-12 min-w-12 place-items-center rounded-full bg-blue-500 px-4 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-32"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <span>Analyze</span>}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        </form>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {sites.map((site) => (
            <span
              key={site.label}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${site.tone}`}
            >
              {site.label}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 pb-10 md:grid-cols-3">
        {[
          ["Paste Link", "Drop in a product URL from a supported retailer."],
          ["We Analyze", "TrueCost checks price history and live comparison offers."],
          ["You Decide", "A verdict badge tells you whether to buy now or wait."]
        ].map(([title, copy], index) => (
          <div key={title} className="glass rounded-lg p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-300/30">
            <div className="mb-6 grid h-10 w-10 place-items-center rounded-lg bg-blue-500/15 text-blue-200">
              {index + 1}
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
          </div>
        ))}
      </section>

      <section className="pb-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent searches</h2>
          <span className="text-sm text-slate-500">Last 6 products</span>
        </div>
        {recent.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((product) => (
              <RecentCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="glass rounded-lg p-8 text-center text-sm text-slate-400">
            Your analyzed products will appear here.
          </div>
        )}
      </section>
    </AppShell>
  );
}

function RecentCard({ product }: { product: ProductRecord }) {
  return (
    <Link
      to={`/results/${product.id}`}
      className="glass focus-ring group flex min-h-36 gap-4 rounded-lg p-4 transition duration-200 hover:-translate-y-1 hover:border-blue-300/30"
    >
      <ProductImage product={product} compact />
      <div className="min-w-0 flex-1 text-left">
        <p className="mb-2 text-xs uppercase tracking-normal text-blue-200">{product.site}</p>
        <h3 className="line-clamp-2 text-sm font-semibold text-white">{product.name}</h3>
        <p className="mt-3 text-lg font-semibold text-white">
          {formatMoney(product.currency, product.currentPrice)}
        </p>
      </div>
    </Link>
  );
}

function ResultsPage() {
  const { id } = useParams();
  const location = useLocation();
  const state = location.state as { analysis?: AnalysisResponse } | null;
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(state?.analysis ?? null);
  const [loading, setLoading] = useState(!state?.analysis);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || analysis) return;
    setLoading(true);
    getProduct(id)
      .then(setAnalysis)
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "This product could not be loaded.")
      )
      .finally(() => setLoading(false));
  }, [id, analysis]);

  if (loading) {
    return (
      <AppShell>
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto animate-spin text-blue-300" size={36} />
            <p className="mt-4 animate-pulse-soft text-sm text-slate-300">Fetching live price intelligence...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !analysis) {
    return (
      <AppShell>
        <div className="grid flex-1 place-items-center">
          <div className="glass max-w-lg rounded-lg p-8 text-center">
            <p className="text-lg font-semibold text-white">That result is unavailable</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">{error ?? "Try analyzing the product again."}</p>
            <Link
              to="/"
              className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400"
            >
              <ArrowLeft size={16} /> Back home
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="animate-fade-in py-10">
        <Link to="/" className="focus-ring mb-6 inline-flex items-center gap-2 rounded-full text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Analyze another product
        </Link>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass rounded-lg p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row">
              <ProductImage product={analysis.product} />
              <div className="min-w-0 flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-normal text-slate-300">
                    {analysis.supportedSite}
                  </span>
                  {analysis.dataQuality.isDemo ? (
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                      Demo data
                    </span>
                  ) : null}
                </div>
                <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  {analysis.product.name}
                </h1>
                <p className="mt-5 text-4xl font-semibold text-white">
                  {formatMoney(analysis.product.currency, analysis.product.currentPrice)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{analysis.verdict.reason}</p>
              </div>
            </div>
          </div>
          <VerdictCard verdict={analysis.verdict} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <PriceHistoryChart history={analysis.history} currency={analysis.product.currency} />
          <InsightPanel analysis={analysis} />
        </div>

        <div className="mt-5">
          <ComparisonTable offers={analysis.offers} currency={analysis.product.currency} />
        </div>

        <div className="mt-5">
          <AlertSignup product={analysis.product} />
        </div>
      </section>
    </AppShell>
  );
}

function ProductImage({ product, compact = false }: { product: ProductRecord; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = compact ? "h-24 w-24" : "h-44 w-full sm:h-48 sm:w-48";

  if (!product.imageUrl || failed) {
    return (
        <div className={`${size} grid shrink-0 place-items-center rounded-lg border border-white/10 bg-slate-900/80 text-blue-200`}>
        <Store size={compact ? 24 : 34} />
      </div>
    );
  }

  return (
    <img
      className={`${size} shrink-0 rounded-lg border border-white/10 object-cover`}
      src={product.imageUrl}
      alt={product.name}
      onError={() => setFailed(true)}
    />
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const tone = {
    great: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    fair: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    overpriced: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    wait: "border-blue-300/25 bg-blue-400/10 text-blue-100"
  }[verdict.tone];

  return (
    <aside className={`glass flex flex-col justify-between rounded-lg p-6 ${tone}`}>
      <div>
        <p className="text-sm text-slate-300">Smart verdict</p>
        <div className="mt-4 inline-flex rounded-full border border-current/20 px-4 py-2 text-xl font-semibold">
          {verdict.label}
        </div>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-3 text-sm">
        <Metric label="Low" value={verdict.rangeLow} />
        <Metric label="Average" value={verdict.averagePrice} />
        <Metric label="High" value={verdict.rangeHigh} />
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{Math.round(value).toLocaleString()}</p>
    </div>
  );
}

function PriceHistoryChart({ history, currency }: { history: PricePoint[]; currency: string }) {
  const data = useMemo(
    () =>
      history.map((point) => ({
        date: new Date(point.observedAt).toLocaleDateString("en", { month: "short", year: "2-digit" }),
        price: point.price,
        source: point.source
      })),
    [history]
  );

  return (
    <section className="glass rounded-lg p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Price history</h2>
          <p className="mt-1 text-sm text-slate-400">
            {history.length < 4 ? "Limited snapshots available so far." : "Observed trend over recent months."}
          </p>
        </div>
        <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-sm text-blue-100">
          {history.length} point{history.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
            <XAxis dataKey="date" stroke="#94A3B8" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value) => formatMoney(currency, Number(value))}
            />
            <Tooltip
              contentStyle={{
                background: "#0F172A",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: 14,
                color: "#fff"
              }}
              formatter={(value) => [formatMoney(currency, Number(value)), "Price"]}
            />
            <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function InsightPanel({ analysis }: { analysis: AnalysisResponse }) {
  return (
    <section className="glass rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white">Signal quality</h2>
      <div className="mt-5 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-blue-200" size={20} />
          <div>
            <p className="font-medium text-white">{analysis.dataQuality.historyQuality} history</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {analysis.dataQuality.historyQuality === "rich"
                ? "Enough observations are available for a stronger verdict."
                : "TrueCost will improve this product as more snapshots are collected."}
            </p>
          </div>
        </div>
        {analysis.dataQuality.messages.map((message) => (
          <div key={message} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
            {message}
          </div>
        ))}
      </div>
    </section>
  );
}

function ComparisonTable({ offers, currency }: { offers: RetailerOffer[]; currency: string }) {
  return (
    <section className="glass rounded-lg p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <Store className="text-blue-200" size={20} />
        <h2 className="text-xl font-semibold text-white">Cross-retailer comparison</h2>
      </div>
      {offers.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-left">
            <thead className="text-sm text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Retailer</th>
                <th className="px-4 py-2 font-medium">Listing</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={`${offer.retailer}-${offer.url}`} className="bg-white/[0.03] text-sm">
                  <td className="rounded-l-lg px-4 py-4 font-semibold text-white">{offer.retailer}</td>
                  <td className="max-w-sm px-4 py-4 text-slate-300">{offer.title}</td>
                  <td className="px-4 py-4 font-semibold text-white">{formatMoney(offer.currency || currency, offer.price)}</td>
                  <td className="rounded-r-lg px-4 py-4">
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex items-center gap-2 rounded-full border border-blue-300/20 px-3 py-2 text-blue-100 hover:border-blue-300/50"
                    >
                      Open <ArrowUpRight size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          Live retailer comparison is unavailable right now.
        </p>
      )}
    </section>
  );
}

function AlertSignup({ product }: { product: ProductRecord }) {
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState(() => Math.max(1, Math.round(product.currentPrice * 0.92)));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createAlert(product.id, email, targetPrice);
      setMessage("Alert saved. TrueCost will email you when the price drops.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The alert could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass rounded-lg p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <Bell className="text-blue-200" size={20} />
        <h2 className="text-xl font-semibold text-white">Price drop alert</h2>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_14rem_auto]">
        <input
          className="focus-ring h-12 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-white outline-none placeholder:text-slate-500"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="focus-ring h-12 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-white outline-none"
          type="number"
          min="1"
          step="0.01"
          value={targetPrice}
          onChange={(event) => setTargetPrice(Number(event.target.value))}
          required
          aria-label="Target price"
        />
        <button
          type="submit"
          disabled={loading}
          className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
          Save alert
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/results/:id" element={<ResultsPage />} />
    </Routes>
  );
}
