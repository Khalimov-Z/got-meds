"use server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const REQUEST_TYPES = ["add", "edit", "delete"] as const;
type PartnerRequestType = (typeof REQUEST_TYPES)[number];
type PartnerRequestTypeDb = "ADD" | "EDIT" | "DELETE";

const REQUEST_TYPE_MAP: Record<PartnerRequestType, PartnerRequestTypeDb> = {
  add: "ADD",
  edit: "EDIT",
  delete: "DELETE",
};

export interface SubmitPartnerRequestData {
  requestType: string;
  pharmacyName: string;
  address: string;
  representativeName: string;
  contactPhone: string;
  message?: string;
}

export interface SubmitPartnerRequestResponse {
  success: boolean;
  error?: string;
}

function isRequestType(value: string): value is PartnerRequestType {
  return (REQUEST_TYPES as readonly string[]).includes(value);
}

function getErrorMessage(error: { message?: string } | null) {
  if (!error?.message) {
    return "Не удалось отправить заявку. Попробуйте позже.";
  }
  const msg = error.message;
  if (msg.includes("Could not find the function") || msg.includes("schema cache")) {
    return "Функция базы данных не найдена. Пожалуйста, убедитесь, что SQL-миграция была успешно запущена в панели Supabase.";
  }
  return msg;
}

export async function submitPartnerRequestAction(
  data: SubmitPartnerRequestData
): Promise<SubmitPartnerRequestResponse> {
  try {
    const requestType = data.requestType?.trim().toLowerCase();
    const pharmacyName = data.pharmacyName?.trim();
    const address = data.address?.trim();
    const representativeName = data.representativeName?.trim();
    const contactPhone = data.contactPhone?.trim();
    const message = data.message?.trim() || "";

    if (!requestType || !isRequestType(requestType)) {
      return { success: false, error: "Выберите корректный тип запроса." };
    }

    if (!pharmacyName) {
      return { success: false, error: "Укажите название аптеки." };
    }

    if (!address) {
      return { success: false, error: "Укажите адрес аптеки." };
    }

    if (!representativeName) {
      return { success: false, error: "Укажите имя представителя." };
    }

    if (!contactPhone) {
      return { success: false, error: "Укажите контактный телефон." };
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.rpc("gotmeds_submit_partner_request", {
      p_pharmacy_name: pharmacyName,
      p_address: address,
      p_representative_name: representativeName,
      p_contact_phone: contactPhone,
      p_request_type: REQUEST_TYPE_MAP[requestType],
      p_message: message || null,
    });

    if (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Ошибка при отправке заявки партнера:", error);
    return {
      success: false,
      error: "Не удалось отправить заявку. Попробуйте позже.",
    };
  }
}
