import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getSupabaseServerClientMock = jest.fn();

type RpcFunction = (name: string, args?: unknown) => Promise<unknown>;

async function loadPartnerActions() {
  jest.doMock("@/lib/supabase-server", () => ({
    getSupabaseServerClient: getSupabaseServerClientMock,
  }));

  return import("@/lib/actions/partner");
}

describe("submitPartnerRequestAction", () => {
  beforeEach(() => {
    jest.resetModules();
    getSupabaseServerClientMock.mockReset();
  });

  it("возвращает ошибку, если обязательные поля не заполнены", async () => {
    const { submitPartnerRequestAction } = await loadPartnerActions();
    const result = await submitPartnerRequestAction({
      requestType: "add",
      pharmacyName: "",
      address: "test address",
      representativeName: "test rep",
      contactPhone: "12345",
    });

    expect(result).toEqual({ success: false, error: "Укажите название аптеки." });
    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("отправляет заявку через RPC с корректными параметрами", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({ data: {}, error: null });
    getSupabaseServerClientMock.mockReturnValue({ rpc });
    const { submitPartnerRequestAction } = await loadPartnerActions();

    const result = await submitPartnerRequestAction({
      requestType: "edit",
      pharmacyName: "Тестовая Аптека",
      address: "ул. Ленина, 10",
      representativeName: "Иван",
      contactPhone: "+79001112233",
      message: "Тестовое сообщение",
    });

    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("gotmeds_submit_partner_request", {
      p_pharmacy_name: "Тестовая Аптека",
      p_address: "ул. Ленина, 10",
      p_representative_name: "Иван",
      p_contact_phone: "+79001112233",
      p_request_type: "EDIT",
      p_message: "Тестовое сообщение",
    });
  });

  it("возвращает ошибку при ошибке выполнения RPC", async () => {
    const rpc = jest.fn<RpcFunction>().mockResolvedValue({
      data: null,
      error: { message: "Ошибка базы данных" },
    });
    getSupabaseServerClientMock.mockReturnValue({ rpc });
    const { submitPartnerRequestAction } = await loadPartnerActions();

    const result = await submitPartnerRequestAction({
      requestType: "delete",
      pharmacyName: "Удаляемая Аптека",
      address: "пр. Мира, 1",
      representativeName: "Петр",
      contactPhone: "88005553535",
    });

    expect(result).toEqual({
      success: false,
      error: "Ошибка базы данных",
    });
  });
});
