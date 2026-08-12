import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, ChevronDown, Heart, ShoppingBag, User, X, Camera, MessageCircle } from 'lucide-react';
import { useDYSearch } from './hooks/useDYSearch';
import { useConfig } from './context/ConfigContext';
import { extractDyPayload } from './utils/dyResponseAdapter';
import { ProductCard } from './components/ProductCard';
import { ConfigPanel } from './components/ConfigPanel';
import { VisualSearchOverlay } from './components/VisualSearchOverlay';
import { MuseChatOverlay } from './components/MuseChatOverlay';
import { PersonaSwitcher } from './components/PersonaSwitcher';
import { motion, AnimatePresence } from 'framer-motion';
import debounce from 'lodash/debounce';

export default function App() {
  const { config } = useConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<any[]>([]);
  const [logoError, setLogoError] = useState(false);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [productImageForSearch, setProductImageForSearch] = useState<string | undefined>();
  const [showMuseChat, setShowMuseChat] = useState(false);
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  const breadcrumbParts = config.categoryPath
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  // Debounce search input
  const updateSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearch(value);
      setOffset(0);
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    updateSearch(e.target.value);
  };

  useEffect(() => {
    setLogoError(false);
  }, [config.logoUrl]);

  const { data, isLoading, isFetching, isError, error, failureCount } = useDYSearch(debouncedSearch, offset, selectedFilters);
  const { items, facets, totalNumResults } = extractDyPayload(data);
  const isFallback = data?.isFallback ?? false;

  const toggleFilter = (field: string, value: string) => {
    setSelectedFilters(prev => {
      const existing = prev.find(f => f.field === field);
      if (existing) {
        const newValues = existing.values.includes(value)
          ? existing.values.filter((v: string) => v !== value)
          : [...existing.values, value];
        
        if (newValues.length === 0) {
          return prev.filter(f => f.field !== field);
        }
        return prev.map(f => f.field === field ? { ...f, values: newValues } : f);
      }
      return [...prev, { field, values: [value] }];
    });
    setOffset(0);
  };

  return (
    <div
      className="min-h-screen harrods-page text-harrods-text transition-colors duration-500"
      style={{ '--brand-accent': config.brandColor } as React.CSSProperties}
    >
      <AnimatePresence>
        {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
      </AnimatePresence>

      {/* Not-configured banner */}
      {!config.feedId && (
        <div className="harrods-banner px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-harrods-green text-xs font-medium">
            <span className="font-bold">Feed ID not configured.</span> Open settings to enter your Feed ID for section {config.sectionId}.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="harrods-banner-button shrink-0 px-4 py-1.5 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Brand Header */}
      <header className="sticky top-0 z-50 harrods-header">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {logoError ? (
            <div className="relative group">
              <div className="text-3xl font-bold cursor-pointer select-none text-white tracking-tight uppercase">
                Ajax
              </div>
              <div className="absolute top-full left-0 -translate-y-3 pt-3 w-44 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                <div className="bg-white border border-gray-100 shadow-lg rounded-sm">
                  <a href="/benchmark" className="flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-600 hover:text-harrods-green hover:bg-harrods-cream transition-colors">
                    Search Benchmark
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative group">
              <img src={config.logoUrl || '/logo.png'} alt="Ajax" className="h-8 cursor-pointer select-none box-content" onError={() => setLogoError(true)} />
              <div className="absolute top-full left-0 -translate-y-3 pt-3 w-44 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                <div className="bg-white border border-gray-100 shadow-lg rounded-sm">
                  <a href="/benchmark" className="flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-600 hover:text-harrods-green hover:bg-harrods-cream transition-colors">
                    Search Benchmark
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 max-w-xl flex items-center gap-2">
            <div className="relative flex-1">
              <input 
                type="text"
                value={searchTerm}
                placeholder="Search kits, boots, and fanwear..."
                className="w-full harrods-search-input rounded-sm py-2.5 px-12 text-sm transition-all outline-none"
                onChange={handleSearchChange}
              />
              <Search className="absolute left-4 top-3.5 text-[#8b8b8b] transition-colors" size={18} />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(''); updateSearch(''); }}
                  className="absolute right-3.5 top-3.5 text-[#8b8b8b] hover:text-harrods-green"
                >
                  <X size={18} />
                </button>
              )}
              <button
                onClick={() => {
                  setProductImageForSearch(undefined);
                  setShowVisualSearch(true);
                }}
                className="absolute right-12 top-3.5 text-[#8b8b8b] hover:text-harrods-green transition-colors"
                title="Visual search"
                aria-label="Visual search"
              >
                <Camera size={18} />
              </button>
            </div>
            <button
              onClick={() => setShowMuseChat(true)}
              className="h-10 px-4 ajax-inverse-button transition-colors rounded-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap"
              aria-label="Ask Muse"
            >
              <MessageCircle size={14} />
              Ask Muse
            </button>
          </div>

          <div className="flex items-center gap-7">
            <div className="hidden md:flex items-center gap-6">
              <User size={24} strokeWidth={1.5} className="cursor-pointer text-white hover:scale-110 hover:opacity-80 transition-transform" />
              <div className="relative">
                <Heart size={24} strokeWidth={1.5} className="cursor-pointer text-white hover:scale-110 hover:opacity-80 transition-transform" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-harrods-green text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center">0</span>
              </div>
            </div>
            <div className="relative">
              <ShoppingBag size={24} strokeWidth={1.5} className="cursor-pointer text-white hover:scale-110 hover:opacity-80 transition-transform" />
              <span className="absolute -top-1.5 -right-1.5 bg-white text-harrods-green text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center">0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-10">
        {/* Page Title and Sort - High Density Layout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 border-b border-[#ececec] pb-6">
          <div>
            <nav className="flex items-center gap-2 text-[10px] text-[#777] uppercase tracking-[0.2em] mb-3">
              {breadcrumbParts.length > 0 ? (
                breadcrumbParts.map((part, idx) => (
                  <React.Fragment key={`${part}-${idx}`}>
                    <span className={idx === breadcrumbParts.length - 1 ? 'text-harrods-green font-bold' : 'hover:text-harrods-green cursor-pointer'}>
                      {part}
                    </span>
                    {idx < breadcrumbParts.length - 1 ? <span>/</span> : null}
                  </React.Fragment>
                ))
              ) : (
                <span className="text-harrods-green font-bold">Search</span>
              )}
            </nav>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[0.12em] flex flex-wrap items-center gap-4 text-[#121212] uppercase">
              {debouncedSearch ? `Search Results: ${debouncedSearch}` : 'New Arrivals'}
              <span className="text-xs text-[#666] font-semibold normal-case tracking-normal">
                ({totalNumResults || 0} items{isFallback && <span className="text-red-500 text-[10px] ml-0.5" title="Showing fallback results (affinity profile returned no results)">f</span>})
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666]">
            <span className="hidden sm:inline">Sort by:</span>
            <div className="relative group cursor-pointer border-b border-transparent hover:border-harrods-green transition-all">
              <button className="flex items-center gap-1.5 text-harrods-green py-1">
                Recommended <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-10">
          {/* DY Dynamic Facets Sidebar */}
          <aside className="hidden lg:block w-60 shrink-0 space-y-9 h-fit sticky top-20 pr-4">
            {isLoading || isFetching ? (
              Array(4).fill(0).map((_, i) => <SkeletonFilter key={i} />)
            ) : (
              facets.map((facet) => (
                <div key={facet.key} className="border-t border-[#ececec] pt-7 first:border-t-0 first:pt-0">
                  <h4 className="text-[11px] font-bold uppercase harrods-filter-title mb-5 flex justify-between items-center group cursor-pointer">
                    {facet.title}
                    <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
                  </h4>
                  <div className="space-y-3.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {facet.options && facet.options.length > 0 ? (
                      facet.options.map((opt) => (
                        <label 
                          key={opt.value} 
                          className="flex items-center gap-3 text-[13px] text-[#1a1a1a] hover:text-black cursor-pointer group transition-colors"
                        >
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              className="peer h-4 w-4 border-[#bdbdbd] rounded-none checked:bg-harrods-green checked:border-harrods-green transition-all appearance-none border" 
                              checked={selectedFilters.some(f => f.field === facet.key && f.values.includes(opt.value))}
                              onChange={() => toggleFilter(facet.key, opt.value)}
                            />
                            <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none text-white transition-opacity">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                          <span className="group-hover:translate-x-0.5 transition-transform">{opt.value}</span>
                          <span className="ml-auto text-[10px] text-[#666] font-medium">{opt.count != null ? `(${opt.count})` : ''}</span>
                        </label>
                      ))
                    ) : facet.type === 'number' ? (
                      <div className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">
                        {facet.min != null || facet.max != null ? `${facet.min ?? '-'} – ${facet.max ?? '-'}` : 'No values available'}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">No options available</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </aside>

          {/* Product Grid - 4 Columns Responsive */}
          <div className="flex-1">
            {/* Subtle retrying indicator */}
            {failureCount > 0 && isFetching && (
              <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-4 animate-pulse">Retrying…</p>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-7 gap-y-12">
              {isLoading || isFetching ? (
                Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)
              ) : (
                items.map((item, idx) => (
                  <ProductCard 
                    key={`${(item as any)?.sku ?? (item as any)?.id ?? (item as any)?.group_id ?? String(idx)}-${idx}`} 
                    item={item}
                    onVisualSearch={(imageUrl) => {
                      setProductImageForSearch(imageUrl);
                      setShowVisualSearch(true);
                    }}
                  />
                ))
              )}
            </div>

            {/* Empty / Error State — always shows "No products found" to the end user;
                error detail is hidden behind a click for debugging during demos */}
            {!isLoading && !isFetching && items.length === 0 && (() => {
              console.warn('Rendering: Zero valid items extracted', { data, isError, error });
              return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-[#ecf2ee] rounded-full flex items-center justify-center mb-6">
                    <Search size={32} className="text-[#7a8d84]" />
                  </div>
                  <h3 className="text-3xl font-semibold tracking-tight mb-2 text-harrods-green">No products found</h3>
                  <p className="text-[#4f4f4f] max-w-sm text-sm">
                    We couldn't find anything matching your search. Try different keywords or adjust your filters.
                  </p>
                  <button
                    onClick={() => { setSearchTerm(''); updateSearch(''); setSelectedFilters([]); }}
                    className="mt-8 px-8 py-3 harrods-pill-button text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Clear all filters
                  </button>
                  {isError && (
                    <div className="mt-6">
                      <button
                        onClick={() => setShowErrorDetail(v => !v)}
                        className="text-[10px] text-[#767676] hover:text-[#4f4f4f] uppercase tracking-widest transition-colors"
                      >
                        {showErrorDetail ? 'Hide detail' : 'Details'}
                      </button>
                      {showErrorDetail && (
                        <p className="mt-2 text-[11px] text-[#646464] max-w-sm font-mono break-all">
                          {error instanceof Error ? error.message : String(error)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            {!isLoading && !isFetching && totalNumResults > 0 && (
              <div className="mt-20 flex justify-center items-center gap-4">
                <button 
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - config.itemsPerPage))}
                  className="px-6 py-2 harrods-subtle-button text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <span className="text-[11px] font-bold text-[#777]">
                  Page {Math.floor(offset / config.itemsPerPage) + 1} / {Math.ceil(totalNumResults / config.itemsPerPage)}
                </span>
                <button 
                  disabled={offset + config.itemsPerPage >= totalNumResults}
                  onClick={() => setOffset(offset + config.itemsPerPage)}
                  className="px-6 py-2 harrods-subtle-button text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Filter Sticky Toggle */}
      <div className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <button 
          onClick={() => setIsMobileFilterOpen(true)}
          className="flex items-center gap-3 harrods-pill-button px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          <SlidersHorizontal size={18} /> Filter & Sort
        </button>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {isMobileFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-60 backdrop-blur-sm"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-70 p-6 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b">
                <h2 className="text-2xl font-bold tracking-[0.08em] text-black uppercase">Filters</h2>
                <button onClick={() => setIsMobileFilterOpen(false)} className="p-2"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-8 pr-2">
                {facets.map((facet) => (
                  <div key={facet.key}>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-harrods-green mb-5">{facet.title}</h4>
                    {facet.options && facet.options.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {facet.options.map((opt) => (
                          <button 
                            key={opt.value} 
                            onClick={() => toggleFilter(facet.key, opt.value)}
                            className={`text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest border transition-all ${
                              selectedFilters.some(f => f.field === facet.key && f.values.includes(opt.value))
                                ? 'bg-harrods-green text-white border-harrods-green'
                                : 'bg-white text-[#1a1a1a] border-[#d9d9d9]'
                            }`}
                          >
                            {opt.value}
                          </button>
                        ))}
                      </div>
                    ) : facet.type === 'number' ? (
                      <div className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">
                        {facet.min != null || facet.max != null ? `${facet.min ?? '-'} – ${facet.max ?? '-'}` : 'No values available'}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 uppercase tracking-[0.2em]">No options available</div>
                    )}
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsMobileFilterOpen(false)}
                className="mt-6 w-full harrods-pill-button py-4 font-bold uppercase text-xs tracking-widest rounded-sm"
              >
                Show Results
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Visual Search Overlay */}
      <AnimatePresence>
        {showVisualSearch && (
          <VisualSearchOverlay
            productImageUrl={productImageForSearch}
            onClose={() => setShowVisualSearch(false)}
          />
        )}
      </AnimatePresence>

      {/* Shopping Muse Overlay */}
      <AnimatePresence>
        {showMuseChat && (
          <MuseChatOverlay onClose={() => setShowMuseChat(false)} />
        )}
      </AnimatePresence>

      {/* Settings FAB + Persona Switcher */}
      <PersonaSwitcher onOpenSettings={() => setShowConfig(true)} />
    </div>
  );
}

// --- Skeleton Components ---

const SkeletonCard = () => (
  <div className="animate-pulse">
    <div className="aspect-3/4 bg-gray-100 rounded-sm mb-4" />
    <div className="h-2 bg-gray-100 w-1/4 rounded-full mb-2" />
    <div className="h-3.5 bg-gray-100 w-3/4 rounded-full mb-3" />
    <div className="h-4 bg-gray-100 w-1/2 rounded-full" />
  </div>
);

const SkeletonFilter = () => (
  <div className="animate-pulse">
    <div className="h-3 bg-gray-100 w-1/2 rounded-full mb-6" />
    <div className="space-y-4">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-4 bg-gray-100 rounded-none" />
          <div className="h-2.5 bg-gray-100 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
