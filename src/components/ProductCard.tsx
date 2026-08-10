import { useState } from 'react';
import { Heart, ShoppingBag, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScoreInfo } from './ScoreInfoIcon';
import { useConfig } from '../context/ConfigContext';

interface ProductCardProps {
  item: any;
  onVisualSearch?: (imageUrl: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ item, onVisualSearch }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { config } = useConfig();

  if (!item) return null;

  const title = item.name || item.productName || 'Unknown Product';
  
  // Use priority list from config to find first valid price
  let price = '0.00';
  for (const priceField of config.mapping.price) {
    const value = item[priceField];
    if (typeof value === 'number' && value > 0) {
      price = String(value);
      break;
    }
    if (typeof value === 'string' && value.trim()) {
      price = value.trim();
      break;
    }
  }
  const imageUrl = item.image_url || item.image_url_small || item.imageUrl || '';
  const productUrl = item.url || item.product_url || '#';
  const brand = typeof item.brand === 'string' ? item.brand.trim() : '';
  const secondaryImageUrl = item.image_url_secondary || imageUrl;
  const currency = (config.currency || 'PLN').toUpperCase();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => productUrl !== '#' && window.open(productUrl, '_blank')}
    >
      <div className="relative aspect-3/4 bg-[#f6f6f6] overflow-hidden">
        {imageUrl ? (
          <img 
            src={isHovered ? (secondaryImageUrl || imageUrl) : imageUrl} 
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/400x600?text=No+Image';
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-300">
            <ShoppingBag size={48} strokeWidth={1} />
          </div>
        )}
        
        {/* Score Info Icon */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <ScoreInfo item={item} />
        </div>
        
        {item.on_sale && (
          <div className="absolute top-3 left-3 bg-harrods-green text-white text-[10px] font-bold px-2.5 py-1 tracking-[0.14em] uppercase">
            SALE
          </div>
        )}

        {/* ECO Badge */}
        {item.eco_aware && (
          <div className="absolute bottom-2 left-2 bg-green-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
            ECO AWARE
          </div>
        )}

        {/* Wishlist Button */}
        <button className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors border border-[#e2e2e2]">
          <Heart size={17} className="text-harrods-green" />
        </button>

        {onVisualSearch && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const selectedImageUrl = imageUrl || item.image_url_small || item.imageUrl || '';
              if (selectedImageUrl) {
                onVisualSearch(selectedImageUrl);
              }
            }}
            className="absolute bottom-3 right-3 bg-white/90 border border-[#dcdcdc] p-2 hover:bg-white transition-colors"
            title="Search with this product image"
          >
            <Camera size={14} className="text-harrods-green" />
          </button>
        )}
      </div>

      {/* Info Container */}
      <div className="mt-3 space-y-1 text-center">
        {brand ? <p className="text-[10px] text-[#777] uppercase tracking-[0.15em] font-bold">{brand}</p> : null}
        <h3 className="text-[13px] font-medium text-[#171717] line-clamp-2 leading-snug">{title}</h3>
        <div className="flex flex-wrap items-baseline justify-center gap-2">
          {item.discount_percentage ? (
            <>
              <p className="text-[14px] font-bold text-[#111]">{currency} {price}</p>
              <p className="text-[12px] text-[#999] line-through">{currency} {(Number(price) * 1.3).toFixed(2)}</p>
            </>
          ) : (
            <p className="text-[14px] font-bold text-[#111]">{currency} {price}</p>
          )}
        </div>
        <button className="text-[10px] uppercase tracking-[0.16em] text-[#555] hover:text-harrods-green transition-colors pt-1 inline-flex items-center justify-center gap-1">
          <ShoppingBag size={12} /> Add to bag
        </button>
      </div>
    </motion.div>
  );
};
