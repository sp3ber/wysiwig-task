import "@testing-library/jest-dom/extend-expect";
import { screen } from "@testing-library/dom";
import { readFileSync } from "fs";
import { resolve } from "path";
import cheerio from "cheerio";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import run from "../main";
import userEvent from "@testing-library/user-event";

// Рендерим html из index.html и исполняем в его контексте программу
const bootstrapHtml = () => {
	const execCommand = jest.fn();
	const queryCommandState = jest.fn();
	(global.document as Document & {
		execCommand: () => void;
	}).execCommand = execCommand;
	(global.document as Document & {
		queryCommandState: () => void;
	}).queryCommandState = queryCommandState;
	const $ = cheerio.load(readFileSync(resolve(__dirname, "../../index.html")));
	const html = $(".container").toString();
	document.body.innerHTML = html;
	run();
	execCommand.mockReset(); // ресетим, так как есть служебные вызовы в начале
	return {
		editorArea: screen.getByTestId("edit-area"),
		h1: screen.getByTestId("head-1"),
		h2: screen.getByTestId("head-2"),
		p: screen.getByTestId("paragraph"),
		b: screen.getByTestId("bold"),
		i: screen.getByTestId("italic"),
		execCommand,
		queryCommandState,
	};
};

// Данные базовый набор тестов проходит уже на стадии использования атрибута contentEditable, но может быть полезен
// при переходе на другую архитектуру (например, на designMode)
describe("simple wysiwig editor", () => {
	test("Введенный текст отображается", async () => {
		const { editorArea } = bootstrapHtml();
		userEvent.type(editorArea, "hello world");
		await screen.findByText(/hello world/);
	});
	test("Удаленный и новый введенный текст отображаются", async () => {
		const { editorArea } = bootstrapHtml();
		userEvent.type(editorArea, "hello world");
		userEvent.type(
			editorArea,
			"{backspace}{backspace}{backspace}{backspace}{backspace}"
		);
		userEvent.type(editorArea, "misha");
		await screen.findByText(/hello misha/);
	});
	test("Текст с зажатым shift отображается в верхнем регистре", async () => {
		const { editorArea } = bootstrapHtml();
		userEvent.type(editorArea, "hello MISHA");
		await screen.findByText(/hello MISHA/);
	});
	test("Текст корректно вырезается", async () => {
		const { editorArea } = bootstrapHtml();
		userEvent.type(editorArea, "hello MISHA");
		await screen.findByText(/hello MISHA/);
	});
	test("Текст корректно вставляется", async () => {
		const { editorArea } = bootstrapHtml();
		userEvent.type(editorArea, "hello MISHA");
		await screen.findByText(/hello MISHA/);
	});
});

// Данные тесты достаточно сильно завязаны на реализацию (documentExec и класс active), однако позволяют проводить
// некоторый рефакторинг
describe("Контролы", () => {
	test("При нажатии на заголовок первого уровня вызывается команда и кнопка становится жирной", () => {
		const { editorArea, h1, execCommand } = bootstrapHtml();
		expect(execCommand).not.toHaveBeenCalled();
		userEvent.type(editorArea, "hello MISHA");
		userEvent.click(h1);
		expect(execCommand).toHaveBeenCalledWith("formatBlock", false, "h1");
	});
	test("При нажатии на заголовок второго уровня вызывается команда", () => {
		const { editorArea, h2, execCommand } = bootstrapHtml();
		expect(execCommand).not.toHaveBeenCalled();
		userEvent.type(editorArea, "hello MISHA");
		userEvent.click(h2);
		expect(execCommand).toHaveBeenCalledWith("formatBlock", false, "h2");
	});
	test("При нажатии на параграф вызывается команда", () => {
		const { editorArea, p, execCommand } = bootstrapHtml();
		expect(execCommand).not.toHaveBeenCalled();
		userEvent.type(editorArea, "hello MISHA");
		userEvent.click(p);
		expect(execCommand).toHaveBeenCalledWith("formatBlock", false, "p");
	});
	test("При нажатии и отжатии на жирный вызываются соответствующие команды и меняется активность кнопки", () => {
		const { editorArea, b, execCommand } = bootstrapHtml();

		// Проверяем изначальное состояния
		expect(execCommand).not.toHaveBeenCalled();
		expect(b).not.toHaveClass("active");

		// Включаем
		userEvent.type(editorArea, "hello MISHA");
		userEvent.click(b);

		// Проверяем
		expect(execCommand).toHaveBeenCalledWith("bold", false, undefined);
		expect(b).toHaveClass("active");

		// Сбрасываем моки
		execCommand.mockReset();

		// Выключаем
		userEvent.click(b);

		// Проверяем
		expect(execCommand).toHaveBeenCalledWith("bold", false, undefined);
		expect(b).not.toHaveClass("active");
	});
	test("При нажатии и отжатии на курсив вызываются соответствующие команды и меняется активность кнопки", () => {
		const { editorArea, i, execCommand } = bootstrapHtml();

		// Проверяем изначальное состояние
		expect(execCommand).not.toHaveBeenCalled();
		expect(i).not.toHaveClass("active");

		// Включаем
		userEvent.type(editorArea, "hello MISHA");
		userEvent.click(i);

		// Проверяем
		expect(execCommand).toHaveBeenCalledWith("italic", false, undefined);
		expect(i).toHaveClass("active");

		// Сбрасываем моки
		execCommand.mockReset();

		// Отключаем
		userEvent.click(i);

		// Проверяем
		expect(execCommand).toHaveBeenCalledWith("italic", false, undefined);
		expect(i).not.toHaveClass("active");
	});
});

describe("Копирование и вырезание", () => {
	test.todo("При копировании и вставке отображается тоже самое");
	test.todo("При копировании добавляет инлановые стили");
});

describe("XSS", () => {
	test.todo("При попытке вставить xss скрипт ничего не вызывается");
});
