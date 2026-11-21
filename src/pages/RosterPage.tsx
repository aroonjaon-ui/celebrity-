import React, { useMemo, useState } from 'react';
import { ArrowUpRight, MessageSquare, Search } from 'lucide-react';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { TalentCategory } from '../types.ts';

const CATEGORIES: Array<'All' | TalentCategory> = [
  'All',
  'Film & Television',
  'Music & Recording',
  'Culinary & Hospitality',
  'Creative Direction',
  'Athletics & Keynote',
];

export const RosterPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const { talents, availability, threads, navigate } = usePlatform();
  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<'All' | TalentCategory>('All');
  const [sortBy, setSortBy] = useState<'name' | 'rate-asc' | 'rate-desc'>('name');

  React.useEffect(() => {
    if (initialQuery !== undefined) {
      setSearch(initialQuery);
      if (initialQuery.trim()) {
        setSelectedCategory('All');
      }
    }
  }, [initialQuery]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const matchesSearchQuery = (t: (typeof talents)[number], rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = [
      t.name,
      t.category,
      t.location,
      t.tagline,
      t.biography,
      t.representationManager,
      ...t.engagementTypes,
      ...t.experience.map((e) => `${e.role} ${e.organization} ${e.description}`),
    ]
      .join(' ')
      .toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  };

  const allSearchMatchesCount = useMemo(
    () => talents.filter((t) => matchesSearchQuery(t, search)).length,
    [talents, search]
  );

  const filtered = useMemo(() => {
    const list = talents.filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) return false;
      return matchesSearchQuery(t, search);
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'rate-asc') return a.dailyRate - b.dailyRate;
      if (sortBy === 'rate-desc') return b.dailyRate - a.dailyRate;
      return a.name.localeCompare(b.name);
    });
  }, [talents, search, selectedCategory, sortBy]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
            Talent Roster
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Verified biographies, uploaded portfolios, and real-time booking availability across {talents.length}{' '}
            principals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search talent, city, engagement..."
              className="pl-9 pr-8 py-2 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 w-64"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-950 cursor-pointer"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'rate-asc' | 'rate-desc')}
            className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-xl text-zinc-700 focus:outline-none focus:border-zinc-950"
            aria-label="Sort roster"
          >
            <option value="name">Sort: Alphabetical</option>
            <option value="rate-asc">Rate: Low to High</option>
            <option value="rate-desc">Rate: High to Low</option>
          </select>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 border border-zinc-200/70 rounded-xl w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-950">No principals match your filter criteria.</p>
          <p className="text-xs text-zinc-500">
            {selectedCategory !== 'All' && allSearchMatchesCount > 0
              ? `${allSearchMatchesCount} match${allSearchMatchesCount === 1 ? '' : 'es'} found across other categories.`
              : 'Reset search terms or choose another category.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {selectedCategory !== 'All' && allSearchMatchesCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Show All Category Matches ({allSearchMatchesCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
          {filtered.map((talent) => {
            const bookedCount = availability.filter(
              (s) => s.talentId === talent.id && s.date >= today && s.status !== 'available'
            ).length;

            return (
              <article
                key={talent.id}
                onClick={() => navigate(`/talent/${talent.slug}`)}
                className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-zinc-950 transition-colors cursor-pointer"
              >
                <div>
                  <div className="relative h-40 sm:h-52 overflow-hidden bg-zinc-100">
                    <SafeImage
                      src={talent.portraitUrl}
                      alt={`${talent.name} portrait`}
                      fallbackText={talent.name}
                      className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-zinc-950/85 via-zinc-950/35 to-transparent text-white">
                      <p className="text-[10px] sm:text-[11px] text-zinc-300 truncate">
                        {talent.category}
                        <span className="hidden sm:inline">
                          {' '}
                          <span aria-hidden="true">·</span> {talent.location}
                        </span>
                      </p>
                      <h2 className="mt-0.5 font-display text-sm sm:text-lg font-bold tracking-tight truncate">
                        {talent.name}
                      </h2>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 space-y-1 sm:space-y-1.5">
                    <p className="text-xs text-zinc-600 leading-relaxed line-clamp-1">{talent.tagline}</p>
                    <p className="hidden sm:block text-[11px] text-zinc-500">
                      {talent.yearsActive} yrs experience <span aria-hidden="true">·</span> {talent.portfolio.length}{' '}
                      works <span aria-hidden="true">·</span> {bookedCount} scheduled holds
                    </p>
                  </div>
                </div>

                <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-mono tabular-nums text-xs font-semibold text-zinc-950 truncate">
                      ${talent.dailyRate.toLocaleString('en-US')}
                      <span className="font-sans text-[11px] font-normal text-zinc-500"> / day</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const existing = threads.find((t) => t.talentId === talent.id);
                        navigate(existing ? `/messages/${existing.id}` : `/messages/talent/${talent.id}`);
                      }}
                      aria-label={`Message ${talent.name}'s manager`}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-950 hover:text-zinc-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Message</span>
                    </button>
                    <span className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 text-[11px] font-semibold text-zinc-950 bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-white rounded-lg transition-colors whitespace-nowrap">
                      <span>Book</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
