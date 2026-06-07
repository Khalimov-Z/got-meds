import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getSupabaseServerClientMock = jest.fn();
const PRODUCT_ID = "20000000-0000-4000-8000-000000000010";

type RpcFunction = (name: string, args?: unknown) => Promise<unknown>;

function useRpcQueue(...responses: unknown[]) {
  const rpc = jest.fn<RpcFunction>();
  for (const response of responses) {
    rpc.mockResolvedValueOnce(response);
  }

  getSupabaseServerClientMock.mockReturnValue({
    rpc,
  });

  return rpc;
}

async function loadProductActions() {
  jest.doMock("@/lib/supabase-server", () => ({
    getSupabaseServerClient: getSupabaseServerClientMock,
  }));

  return import("@/lib/actions/products");
}

function productDetailsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    name: "Но-Шпа",
    category: "MEDICINE",
    active_ingredient: "Дротаверин",
    form: "таблетки",
    dosage: "40мг",
    is_prescription: false,
    price_estimate: 230,
    description: "Спазмолитическое средство.",
    image_url: null,
    ...overrides,
  };
}

describe("getProductDetails", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("отклоняет невалидный идентификатор без обращения к Supabase", async () => {
    const { getProductDetails } = await loadProductActions();
    const result = await getProductDetails("not-a-uuid");

    expect(result).toEqual({
      success: false,
      status: "not_found",
      error: "Препарат не найден",
    });
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("отличает отсутствие препарата от временной ошибки Supabase", async () => {
    useRpcQueue({ data: [], error: null });
    const { getProductDetails } = await loadProductActions();

    const result = await getProductDetails(PRODUCT_ID);

    expect(result).toEqual({
      success: false,
      status: "not_found",
      error: "Препарат не найден",
    });
  });

  it("возвращает временную ошибку, если Supabase не отдал данные препарата", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    useRpcQueue({
      data: null,
      error: { message: "Connection timeout" },
    });
    const { getProductDetails } = await loadProductActions();

    const result = await getProductDetails(PRODUCT_ID);

    expect(result).toEqual({
      success: false,
      status: "temporary_error",
      error: "Не удалось получить данные препарата. Попробуйте позже.",
    });
    consoleErrorSpy.mockRestore();
  });

  it("маппит строку RPC в публичный контракт SEO-страницы препарата", async () => {
    const rpc = useRpcQueue({
      data: [productDetailsRow({ category: "VITAMINS", image_url: "/vitamin.png" })],
      error: null,
    });
    const { getProductDetails } = await loadProductActions();

    const result = await getProductDetails(PRODUCT_ID);

    expect(rpc).toHaveBeenCalledWith("gotmeds_get_product_details", {
      p_product_id: PRODUCT_ID,
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: PRODUCT_ID,
        name: "Но-Шпа",
        category: "vitamins",
        active_ingredient: "Дротаверин",
        form: "таблетки",
        dosage: "40мг",
        is_prescription: false,
        price_estimate: 230,
        description: "Спазмолитическое средство.",
        image_url: "/vitamin.png",
      },
    });
  });
});

describe("getAnalogs", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("возвращает ошибку, если исходный препарат не найден", async () => {
    useRpcQueue({ data: [], error: null });
    const { getAnalogs } = await loadProductActions();

    const result = await getAnalogs(PRODUCT_ID);

    expect(result).toEqual({ success: false, error: "Препарат не найден" });
  });

  it("возвращает аналоги с той же публичной формой категорий и пустым image_url по умолчанию", async () => {
    const rpc = useRpcQueue(
      { data: [productDetailsRow()], error: null },
      {
        data: [
          {
            id: "20000000-0000-4000-8000-000000000016",
            name: "Дротаверин",
            category: "MEDICINE",
            active_ingredient: "Дротаверин",
            form: "таблетки",
            dosage: "40мг",
            image_url: null,
          },
        ],
        error: null,
      }
    );
    const { getAnalogs } = await loadProductActions();

    const result = await getAnalogs(PRODUCT_ID);

    expect(rpc).toHaveBeenNthCalledWith(2, "gotmeds_get_product_analogs", {
      p_product_id: PRODUCT_ID,
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "20000000-0000-4000-8000-000000000016",
          name: "Дротаверин",
          category: "medicine",
          active_ingredient: "Дротаверин",
          form: "таблетки",
          dosage: "40мг",
          image_url: "",
        },
      ],
    });
  });
});

describe("getPharmaciesByProduct", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("передает координаты и фильтр открытости в RPC", async () => {
    const rpc = useRpcQueue(
      { data: [productDetailsRow()], error: null },
      {
        data: [
          {
            pharmacy_id: "10000000-0000-4000-8000-000000000003",
            name: "Аптека.ру (Гудермес)",
            address: "ул. Грозненская, 7",
            latitude: 43.3525,
            longitude: 46.105,
            tier: "Chain",
            distance_meters: 420,
            status: "in_stock",
            working_hours: { mon: "00:00-23:59" },
            is_24_7: true,
            is_open_now: true,
            phone: "+7 (800) 777-88-99",
            whatsapp: null,
          },
        ],
        error: null,
      }
    );
    const { getPharmaciesByProduct } = await loadProductActions();

    const result = await getPharmaciesByProduct(PRODUCT_ID, 43.3517, 46.1003, false);

    expect(rpc).toHaveBeenNthCalledWith(2, "gotmeds_get_pharmacies_by_product", {
      p_product_id: PRODUCT_ID,
      p_lat: 43.3517,
      p_lng: 46.1003,
      p_is_open_now: false,
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          pharmacy_id: "10000000-0000-4000-8000-000000000003",
          name: "Аптека.ру (Гудермес)",
          address: "ул. Грозненская, 7",
          coordinates: { lat: 43.3525, lng: 46.105 },
          tier: "Chain",
          distance_meters: 420,
          status: "in_stock",
          working_hours: { mon: "00:00-23:59" },
          is_24_7: true,
          is_open_now: true,
          phone: "+7 (800) 777-88-99",
          whatsapp: null,
        },
      ],
    });
  });

  it("передает null вместо невалидных координат и нормализует неизвестные tier/status", async () => {
    const rpc = useRpcQueue(
      { data: [productDetailsRow()], error: null },
      {
        data: [
          {
            pharmacy_id: "10000000-0000-4000-8000-000000000002",
            name: "Фармация Плюс",
            address: "пр. Исаева, 42",
            latitude: 43.353,
            longitude: 46.102,
            tier: "TIER_2",
            distance_meters: null,
            status: "IN_STOCK",
            working_hours: null,
            is_24_7: false,
            is_open_now: false,
            phone: null,
            whatsapp: "+79284445566",
          },
        ],
        error: null,
      }
    );
    const { getPharmaciesByProduct } = await loadProductActions();

    const result = await getPharmaciesByProduct(PRODUCT_ID, Number.NaN, 46.1003);

    expect(rpc).toHaveBeenNthCalledWith(2, "gotmeds_get_pharmacies_by_product", {
      p_product_id: PRODUCT_ID,
      p_lat: null,
      p_lng: null,
      p_is_open_now: true,
    });
    expect(result.data?.[0]).toMatchObject({
      tier: "2",
      status: "unknown",
    });
  });
});
