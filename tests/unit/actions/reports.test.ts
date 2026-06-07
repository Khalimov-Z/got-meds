import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getSupabaseServerClientMock = jest.fn();
const headersMock = jest.fn();

type RpcFunction = (name: string, args?: unknown) => Promise<unknown>;

async function loadReportActions() {
  jest.doMock("@/lib/supabase-server", () => ({
    getSupabaseServerClient: getSupabaseServerClientMock,
  }));
  jest.doMock("next/headers", () => ({
    headers: headersMock,
  }));

  return import("@/lib/actions/reports");
}

describe("submitPharmacyReport", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
    headersMock.mockReset();
  });

  it("возвращает ошибку для невалидного id аптеки без обращения к Supabase", async () => {
    const { submitPharmacyReport } = await loadReportActions();
    const result = await submitPharmacyReport("bad-id", "closed");

    expect(result).toEqual({ success: false, error: "Аптека не найдена." });
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("отправляет жалобу через RPC с IP из forwarded header", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({ data: {}, error: null });
    getSupabaseServerClientMock.mockReturnValue({ rpc });
    headersMock.mockResolvedValue({
      get: (name: string) =>
        name === "x-forwarded-for" ? "203.0.113.7, 10.0.0.1" : null,
    });
    const { submitPharmacyReport } = await loadReportActions();

    const result = await submitPharmacyReport(
      "10000000-0000-4000-8000-000000000001",
      "wrong_number"
    );

    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("gotmeds_submit_pharmacy_report", {
      p_pharmacy_id: "10000000-0000-4000-8000-000000000001",
      p_report_type: "WRONG_NUMBER",
      p_user_ip: "203.0.113.7",
    });
  });

  it("возвращает пользовательское сообщение при повторной жалобе", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({
      data: null,
      error: { message: "Вы уже отправляли отчет по этой аптеке сегодня" },
    });
    getSupabaseServerClientMock.mockReturnValue({ rpc });
    headersMock.mockResolvedValue({
      get: () => null,
    });
    const { submitPharmacyReport } = await loadReportActions();

    const result = await submitPharmacyReport(
      "10000000-0000-4000-8000-000000000001",
      "closed"
    );

    expect(result).toEqual({
      success: false,
      error: "Вы уже отправляли отчет по этой аптеке сегодня.",
    });
  });
});
