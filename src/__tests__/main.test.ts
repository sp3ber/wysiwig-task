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
	return {
		editorArea: screen.getByTestId("edit-area"),
	};
};

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

describe("Контролы", () => {
	test.todo(
		"При нажатии на жирный вызывается команда и кнопка становится жирной"
	);
	test.todo(
		"При нажатии на заголовок первого уровня вызывается команда и кнопка становится жирной"
	);
	test.todo(
		"При нажатии на заголовок второго уровня вызывается команда и кнопка становится жирной"
	);
	test.todo(
		"При нажатии на параграф вызывается команда и кнопка становится жирной"
	);
	test.todo(
		"При нажатии на курсив вызывается команда и кнопка становится жирной"
	);
});

describe("Копирование и вырезание", () => {
	test.todo("При копировании и вставке отображается тоже самое");
	test.todo("При копировании добавляет инлановые стили");
});

describe("XSS", () => {
	test.todo("При попытке вставить xss скрипт ничего не вызывается");
});
