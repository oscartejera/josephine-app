import { ProductPageTemplate } from '@/components/landing/ProductPageTemplate';
import { productInventory } from '@/data/landing/productData';

export default function ProductInventory() {
  return <ProductPageTemplate config={productInventory} />;
}
