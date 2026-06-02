import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getSupabaseServerClientMock = jest.fn();

type RpcFunction = (name: string, args?: unknown) => Promise<unknown>;
type RpcMock = jest.MockedFunction<RpcFunction>;

type SupabaseMock = {
  rpc: RpcMock;
  from: jest.MockedFunction<(table: string) => unknown>;
};

function useSupabaseMock(mock: SupabaseMock) {
  getSupabaseServerClientMock.mockReturnValue(mock);
}

function createRpcSupabaseMock(
  rpc: RpcMock = jest.fn<RpcFunction>()
): SupabaseMock {
  return {
    rpc,
    from: jest.fn(),
  };
}

async function loadSearchActions() {
  jest.doMock("@/lib/supabase-server", () => ({
    getSupabaseServerClient: getSupabaseServerClientMock,
  }));

  return import("@/lib/actions/search");
}

describe("searchProducts", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("возвращает пустой список для пустого запроса без обращения к Supabase", async () => {
    const { searchProducts } = await loadSearchActions();
    const result = await searchProducts("   ");

    expect(result).toEqual({ success: true, data: [] });
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("маппит успешный fuzzy/alias-ответ RPC в публичный контракт поиска", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({
      data: {
        items: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            name: "Нурофен",
            category: "MEDICINE",
            is_prescription: false,
            image_url: null,
            price_estimate: 250,
            similarity_score: "0.834",
          },
        ],
      },
      error: null,
    });
    useSupabaseMock(createRpcSupabaseMock(rpc));
    const { searchProducts } = await loadSearchActions();

    const result = await searchProducts("Нуроф таб 200мг");

    expect(rpc).toHaveBeenCalledWith("gotmeds_search_products", {
      p_query: "Нуроф таб 200мг",
      p_similarity_threshold: 0.15,
      p_limit: 20,
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          name: "Нурофен",
          category: "medicine",
          is_prescription: false,
          image_url: "",
          price_estimate: 250,
          similarity_score: 0.83,
          restricted: false,
        },
      ],
    });
  });

  it("возвращает restricted-флаг без выдачи аптек для социального риска", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({
      data: {
        restricted: true,
        restricted_product_name: "Диазепам",
        items: [],
      },
      error: null,
    });
    useSupabaseMock(createRpcSupabaseMock(rpc));
    const { searchProducts } = await loadSearchActions();

    const result = await searchProducts("диазепам");

    expect(result).toEqual({
      success: true,
      data: [],
      restricted: true,
      restricted_product_name: "Диазепам",
    });
  });

  it("возвращает пользовательскую ошибку при сбое RPC", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({
      data: null,
      error: new Error("RPC недоступен"),
    });
    useSupabaseMock(createRpcSupabaseMock(rpc));
    const { searchProducts } = await loadSearchActions();

    const result = await searchProducts("нурофен");

    expect(result).toEqual({
      success: false,
      error: "Произошла ошибка при поиске. Попробуйте позже.",
    });
  });
});

describe("logZeroResultSearch", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("не записывает короткий поисковый запрос в аналитику", async () => {
    const { logZeroResultSearch } = await loadSearchActions();
    const result = await logZeroResultSearch("аб", "00000000-0000-4000-8000-000000000001");

    expect(result).toEqual({ success: true });
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("проверяет активный город и записывает нулевую выдачу", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000001" },
      error: null,
    });
    const insert = jest.fn().mockResolvedValue({ error: null });
    const cityQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle,
    };
    const logsQuery = { insert };
    const from = jest.fn((table: string) => {
      if (table === "cities") {
        return cityQuery;
      }

      return logsQuery;
    });
    useSupabaseMock({
      rpc: jest.fn<RpcFunction>(),
      from,
    });
    const { logZeroResultSearch } = await loadSearchActions();

    const result = await logZeroResultSearch(
      "редкий препарат",
      "00000000-0000-4000-8000-000000000001",
      43.3517,
      Number.NaN
    );

    expect(result).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith("cities");
    expect(cityQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(cityQuery.eq).toHaveBeenCalledWith("is_active", true);
    expect(from).toHaveBeenCalledWith("search_logs");
    expect(insert).toHaveBeenCalledWith({
      search_term: "редкий препарат",
      city_id: "00000000-0000-4000-8000-000000000001",
      user_latitude: 43.3517,
      user_longitude: null,
      results_count: 0,
    });
  });

  it("возвращает ошибку, если активный город не найден", async () => {
    const cityQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = jest.fn(() => cityQuery);
    useSupabaseMock({
      rpc: jest.fn<RpcFunction>(),
      from,
    });
    const { logZeroResultSearch } = await loadSearchActions();

    const result = await logZeroResultSearch(
      "редкий препарат",
      "00000000-0000-4000-8000-000000000001"
    );

    expect(result).toEqual({ success: false, error: "Город не найден" });
  });
});
