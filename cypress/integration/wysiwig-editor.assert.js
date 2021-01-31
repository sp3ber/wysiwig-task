context("Wysiwig редактор", () => {
	beforeEach(() => {
		cy.visit("../../index.html");
	});

	it("Выделяемый текст корректно форматируется", () => {
		cy.get(`[data-testid=edit-area]`).type(
			"Test header{enter}Test header 2{enter}Test italic and bold"
		);
		cy.get(`[data-testid=edit-area]`).setSelection("Test header");
		cy.get(`[data-testid=head-1]`).click();
		cy.get(`[data-testid=edit-area]`).setSelection("Test header 2");
		cy.get(`[data-testid=head-2]`).click();
		cy.get(`[data-testid=edit-area]`).setSelection("italic");
		cy.get(`[data-testid=italic]`).click();
		cy.get(`[data-testid=edit-area]`).setSelection("bold");
		cy.get(`[data-testid=bold]`).click();
		cy.get("[data-testid=edit-area]").toMatchImageSnapshot({
			threshold: 0.01,
		});
	});
	it("Можно комбинировать стили", () => {
		cy.get(`[data-testid=edit-area]`).type("Test italic header");
		cy.get(`[data-testid=edit-area]`).setSelection("italic header");
		cy.get(`[data-testid=italic]`).click();

		cy.get(`[data-testid=edit-area]`).type("{selectAll}");
		cy.get(`[data-testid=head-1]`).click();
		cy.get("[data-testid=edit-area]").toMatchImageSnapshot({
			threshold: 0.01,
		});
	});
});
