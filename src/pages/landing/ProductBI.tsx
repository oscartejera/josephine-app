import { ProductPageTemplate } from '@/components/landing/ProductPageTemplate';
import { productBI } from '@/data/landing/productData';

export default function ProductBI() {
  return <ProductPageTemplate config={productBI} />;
}
