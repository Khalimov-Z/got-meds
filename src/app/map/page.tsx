import { searchProducts } from "@/lib/actions/search";
import {
  getPharmaciesByProduct,
  getProductDetails,
  type PharmaciesByProductResponse,
  type ProductDetails,
} from "@/lib/actions/products";
import { MapExperience } from "@/components/map/map-experience";

type MapPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  let product: ProductDetails | null = null;
  let pharmacies: PharmaciesByProductResponse["data"] = [];
  let initialError = "";
  let initialRestrictedSearch = false;

  if (query) {
    const searchResult = await searchProducts(query);
    const foundProduct = searchResult.success ? searchResult.data?.[0] : null;

    if (searchResult.restricted) {
      initialRestrictedSearch = true;
    } else if (foundProduct) {
      const productResult = await getProductDetails(foundProduct.id);

      if (productResult.success && productResult.data) {
        product = productResult.data;
        const pharmaciesResult = await getPharmaciesByProduct(product.id, undefined, undefined, true);
        pharmacies = pharmaciesResult.data ?? [];
        initialError = pharmaciesResult.error ?? "";
      }
    } else {
      initialError = searchResult.error ?? "Препарат не найден";
    }
  }

  return (
    <MapExperience
      key={query}
      query={query}
      initialProduct={product}
      initialPharmacies={pharmacies ?? []}
      initialError={initialError}
      initialRestrictedSearch={initialRestrictedSearch}
    />
  );
}
