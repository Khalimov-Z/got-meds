import React from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const PRODUCT_ID = "20000000-0000-4000-8000-000000000010";
const getProductDetailsMock = jest.fn();
const getAnalogsMock = jest.fn();
const notFoundMock = jest.fn();

async function loadProductPage() {
  jest.doMock("@/lib/actions/products", () => ({
    getProductDetails: getProductDetailsMock,
    getAnalogs: getAnalogsMock,
  }));

  jest.doMock("next/navigation", () => ({
    notFound: notFoundMock,
  }));

  return import("@/app/product/[id]/page");
}

describe("ProductPage", () => {
  beforeEach(() => {
    jest.resetModules();
    getProductDetailsMock.mockReset();
    getAnalogsMock.mockReset();
    notFoundMock.mockReset();
  });

  it("не вызывает notFound при временной ошибке Supabase", async () => {
    getProductDetailsMock.mockResolvedValue({
      success: false,
      status: "temporary_error",
      error: "Не удалось получить данные препарата. Попробуйте позже.",
    });
    getAnalogsMock.mockResolvedValue({ success: false, error: "Ошибка аналогов" });
    const { default: ProductPage } = await loadProductPage();

    const result = await ProductPage({
      params: Promise.resolve({ id: PRODUCT_ID }),
    });

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(React.isValidElement(result)).toBe(true);
  });

  it("вызывает notFound только для отсутствующего препарата", async () => {
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    getProductDetailsMock.mockResolvedValue({
      success: false,
      status: "not_found",
      error: "Препарат не найден",
    });
    getAnalogsMock.mockResolvedValue({ success: false, error: "Ошибка аналогов" });
    const { default: ProductPage } = await loadProductPage();

    await expect(
      ProductPage({
        params: Promise.resolve({ id: PRODUCT_ID }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
