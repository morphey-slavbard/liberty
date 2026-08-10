import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { imageToBase64 } from '../utils/imageToBase64';
import { useVisualSearch, VisualSearchInput } from '../hooks/useVisualSearch';
import { ScoreInfo } from './ScoreInfoIcon';
import { useConfig } from '../context/ConfigContext';

interface VisualSearchOverlayProps {
  productImageUrl?: string;
  onClose: () => void;
}

export const VisualSearchOverlay: React.FC<VisualSearchOverlayProps> = ({
  productImageUrl,
  onClose,
}) => {
  const { config } = useConfig();
  const [selectedImage, setSelectedImage] = useState<string | null>(productImageUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useMode, setUseMode] = useState<'product' | 'upload'>(productImageUrl ? 'product' : 'upload');
  const [searchPayload, setSearchPayload] = useState<VisualSearchInput | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualSliderRef = useRef<HTMLDivElement>(null);

  const { results, totalResults, loading: isSearching, error: searchError } = useVisualSearch(searchPayload);
  const currency = (config.currency || 'PLN').toUpperCase();

  const widgetItems = results.slice(0, 20);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setConversionError('Please select a valid image file');
      return;
    }

    setSelectedFile(file);
    setSelectedImage(URL.createObjectURL(file));
    setUseMode('upload');
    setSearchPayload(null);
    setConversionError(null);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  };

  const runVisualSearch = async () => {
    setIsConverting(true);
    setConversionError(null);

    try {
      if (useMode === 'product' && productImageUrl) {
        setSearchPayload({ imageUrl: productImageUrl });
        return;
      }

      if (useMode === 'upload' && selectedFile) {
        const base64 = await imageToBase64(selectedFile);
        setSearchPayload({ imageBase64: base64 });
        return;
      }

      setConversionError('No image selected');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to prepare image for visual search';
      setConversionError(errorMsg);
      console.error('[Visual Search] Conversion error:', errorMsg);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSwitchMode = (mode: 'product' | 'upload') => {
    setUseMode(mode);
    setSearchPayload(null);
    setConversionError(null);

    if (mode === 'product') {
      setSelectedImage(productImageUrl || null);
    } else {
      setSelectedImage(selectedFile ? URL.createObjectURL(selectedFile) : null);
    }
  };

  const scrollVisualSlider = (direction: 'left' | 'right') => {
    const node = visualSliderRef.current;
    if (!node) {
      return;
    }

    const shift = 360;
    node.scrollBy({ left: direction === 'left' ? -shift : shift, behavior: 'smooth' });
  };

  const currentDisplayImage = useMode === 'product' ? productImageUrl : selectedImage;
  const canSearch = currentDisplayImage && !isConverting && !isSearching;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={onClose}
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
      >
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-white shadow-2xl border-l border-black/10 flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              <Camera size={20} className="text-black" />
              <h2 className="text-lg font-bold uppercase tracking-wider">Visual Search</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 p-4 md:p-5 overflow-y-auto">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 min-h-full xl:min-h-0">
              <div className="space-y-4 xl:col-span-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Select Image
                </h3>

                <div className="flex gap-2">
                  {productImageUrl && (
                    <button
                      onClick={() => handleSwitchMode('product')}
                      className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                        useMode === 'product'
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-black hover:bg-gray-200'
                      }`}
                    >
                      Product Image
                    </button>
                  )}
                  <button
                    onClick={() => handleSwitchMode('upload')}
                    className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                      useMode === 'upload'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-black hover:bg-gray-200'
                    }`}
                  >
                    Upload Image
                  </button>
                </div>

                {/* Image Preview */}
                {currentDisplayImage ? (
                  <div className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                    <img
                      src={currentDisplayImage}
                      alt="Selected"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/400x400?text=Image+Error';
                      }}
                    />
                  </div>
                ) : null}

                {useMode === 'upload' && !selectedImage && (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-gray-100 transition-all"
                  >
                    <Upload size={32} className="text-gray-400 mb-2" />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Drag & drop image here
                    </p>
                    <p className="text-xs text-gray-400 mt-1">or click to select</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                  aria-label="Upload image"
                />

                {useMode === 'upload' && selectedImage && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 bg-gray-100 text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-200 transition-all"
                  >
                    Change Image
                  </button>
                )}

                {conversionError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                    {conversionError}
                  </div>
                )}

                {searchError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                    {searchError}
                  </div>
                )}

                <button
                  onClick={runVisualSearch}
                  disabled={!canSearch}
                  className={`w-full px-4 py-3 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                    canSearch
                      ? 'bg-black text-white hover:bg-gray-900'
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {isConverting || isSearching ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block animate-spin">⋯</span>
                      Searching...
                    </span>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>

              <div className="flex flex-col min-h-72 xl:min-h-0 xl:col-span-2 rounded border border-gray-100 bg-[#fafafa]">
                <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Results {totalResults > 0 ? `(${totalResults})` : results.length > 0 ? `(${results.length})` : ''}
                  </h3>
                </div>

                {isSearching ? (
                  <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                    <div className="text-center">
                      <div className="animate-spin text-4xl mb-4">⋯</div>
                      <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">
                        Searching...
                      </p>
                    </div>
                  </div>
                ) : searchPayload ? (
                  results.length === 0 ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                      <div className="text-center">
                        <Camera size={32} className="text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">
                          No results found
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 custom-scrollbar space-y-4">
                      <section className="rounded border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
                            Recommended similar products
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => scrollVisualSlider('left')}
                              className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:border-black"
                              aria-label="Slide left"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => scrollVisualSlider('right')}
                              className="h-6 w-6 rounded border border-gray-200 bg-white flex items-center justify-center hover:border-black"
                              aria-label="Slide right"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>

                        <div
                          ref={visualSliderRef}
                          className="overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <div className="flex gap-3 min-w-max">
                            {widgetItems.map((item: any, idx: number) => (
                              <article
                                key={`${item.id || item.sku || idx}`}
                                className="relative w-52 border border-gray-100 rounded bg-white shadow-sm hover:shadow transition-shadow"
                              >
                                <div className="absolute top-2 left-2 z-10">
                                  <ScoreInfo item={item} />
                                </div>

                                <div className="aspect-4/5 overflow-hidden rounded-t bg-gray-100">
                                  <img
                                    src={
                                      item.image_url ||
                                      item.image_url_small ||
                                      item.imageUrl ||
                                      item.productData?.image_url ||
                                      item.productData?.imageUrl ||
                                      'https://placehold.co/280x360?text=No+Image'
                                    }
                                    alt={item.name || item.productData?.name || 'Product'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://placehold.co/280x360?text=No+Image';
                                    }}
                                  />
                                </div>

                                <div className="p-3">
                                  <p className="text-xs font-bold line-clamp-2 h-9">
                                    {item.name || item.productData?.name || 'Unknown'}
                                  </p>
                                  <p className="text-sm font-semibold text-black/60 mt-1">
                                    {currency} {item.price || item.dy_display_price || item.productData?.dy_display_price || 'N/A'}
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      </section>
                    </div>
                  )
                ) : (
                  <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                    <div className="text-center text-gray-500">
                      <Camera size={32} className="mx-auto mb-4" />
                      <p className="text-sm uppercase tracking-wider font-medium">
                        Select or upload an image to begin visual search.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
};
