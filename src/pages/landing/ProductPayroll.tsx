import { ProductPageTemplate } from '@/components/landing/ProductPageTemplate';
import { productPayroll } from '@/data/landing/productData';

export default function ProductPayroll() {
  return <ProductPageTemplate config={productPayroll} />;
}
