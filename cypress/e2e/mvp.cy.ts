describe("GotMeds MVP: поиск, страница препарата и карта", () => {
  it("находит препарат на главной, открывает SEO-страницу и переходит на карту", () => {
    cy.intercept("GET", "/api/search*").as("search");

    cy.visit("/");
    cy.get("#medicine-search").type("нурофен");
    cy.wait("@search");

    cy.contains("Результаты по запросу", { timeout: 10000 }).should("be.visible");
    cy.contains("h3", "Нурофен").click();

    cy.location("pathname").should(
      "match",
      /^\/product\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    cy.contains("h1", "Нурофен").should("be.visible");
    cy.contains("a", "Найти на карте").click();

    cy.location("pathname").should("eq", "/map");
    cy.location("search").should("contain", "q=");
    cy.contains("h1", "Нурофен", { timeout: 10000 }).should("be.visible");
  });

  it("показывает restricted-состояние для препарата социального риска", () => {
    cy.intercept("GET", "/api/search*").as("search");

    cy.visit("/");
    cy.get("#medicine-search").type("диазепам");
    cy.wait("@search");

    cy.contains("Поиск данного препарата ограничен", { timeout: 10000 }).should(
      "be.visible"
    );
  });

  it("открывает карту, список аптек и переключатель открытости", () => {
    cy.visit(`/map?${new URLSearchParams({ q: "Нурофен" }).toString()}`);

    cy.contains("h1", "Нурофен", { timeout: 10000 }).should("be.visible");
    cy.get('section[aria-label="Режим карты"]')
      .contains("button", "Аптеки рядом")
      .click();

    cy.get('section[aria-label="Аптеки рядом"]').should("be.visible");
    cy.contains("Аптека.ру (Гудермес)").should("be.visible");

    cy.contains("label", "Открыто сейчас")
      .find('input[type="checkbox"]')
      .should("be.checked")
      .uncheck({ force: true })
      .should("not.be.checked")
      .check({ force: true })
      .should("be.checked");
  });
});

describe("GotMeds MVP: админский CSV-импорт", () => {
  const adminEmail = Cypress.env("adminEmail") as string | undefined;
  const adminPassword = Cypress.env("adminPassword") as string | undefined;

  before(() => {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        "Для админского E2E задайте GOTMEDS_E2E_ADMIN_EMAIL и GOTMEDS_E2E_ADMIN_PASSWORD"
      );
    }
  });

  it("входит в админку и загружает CSV-прайс Tier 2 аптеки", () => {
    cy.visit("/admin/login");
    cy.get('input[name="email"]').type(adminEmail);
    cy.get('input[name="password"]').type(adminPassword, { log: false });
    cy.contains("button", "Войти в кабинет").click();

    cy.location("pathname", { timeout: 15000 }).should("eq", "/admin");
    cy.contains("h1", "Админ-панель").should("be.visible");
    cy.contains("a", "Загрузка остатков").click();

    cy.location("pathname").should("eq", "/admin/inventory-upload");
    cy.contains("h1", "Загрузка остатков").should("be.visible");
    cy.get('input[type="file"]').selectFile("cypress/fixtures/inventory-price.csv");
    cy.contains("button", "Загрузить").click();

    cy.contains("th", "Всего строк", { timeout: 15000 }).should("be.visible");
    cy.contains("th", "Распознано").should("be.visible");
    cy.contains("th", "Требуют ручного маппинга").should("be.visible");
  });
});
