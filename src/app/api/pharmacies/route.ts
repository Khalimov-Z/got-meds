import { NextRequest, NextResponse } from "next/server";
import { getPharmaciesByProduct } from "@/lib/actions/products";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const productId = searchParams.get("productId") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const openNow = searchParams.get("openNow");

  const result = await getPharmaciesByProduct(
    productId,
    lat ? Number(lat) : undefined,
    lng ? Number(lng) : undefined,
    openNow !== "false"
  );

  const status = result.success ? 200 : 400;
  return NextResponse.json(result, { status });
}
