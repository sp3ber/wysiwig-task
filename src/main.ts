// Список доступных команд в редакторе
const commands = {
	p: { id: "p", format: "formatBlock", value: "p", type: "tag" },
	h1: { id: "h1", format: "formatBlock", value: "h1", type: "tag" },
	h2: { id: "h2", format: "formatBlock", value: "h2", type: "tag" },
	bold: { id: "bold", format: "bold", value: undefined, type: "style" },
	italic: { id: "italic", format: "italic", value: undefined, type: "style" },
} as const;
type Command = typeof commands[keyof typeof commands];
type CommandControls = {
	command: Command;
	button: Element;
};
type State = {
	// кнопки-команды в редакторе и их состояние
	commandControls: {
		initialized: boolean;
		enabled: Record<Command["id"], boolean>;
	};
	// контент редактора, на данный момент не используется
	content: string;
};

/*
	redux like хранилище, прямо сейчас используется только для синхронизации кнопок стилизации между моделью и представлением.
	Без событийной модели, на данный момент достаточно простого setState
*/
type Store = {
	getState: () => State;
	onChange: (subscriber: (state: State) => void) => void;
	setState: (reducer: (state: State) => State) => void;
};

/* При вставке скопированного из редактора в Microsoft Office Wold Online приходится инлайнить стили для сохранения заголовков */
const patchHTMLElementWithInlineStyles = (container: HTMLElement) => {
	const clonedContainer = container.cloneNode(true) as HTMLElement;
	// Чтобы взять конечные стили для последующего инлайнинга - необходимо, чтобы эти элементы находились обязательно в DOM
	const divWrapper = document.createElement("div");
	divWrapper.hidden = true;
	divWrapper.appendChild(clonedContainer);
	document.body.appendChild(divWrapper);

	const treewalker = document.createTreeWalker(
		clonedContainer,
		NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: function () {
				return NodeFilter.FILTER_ACCEPT;
			},
		}
	);
	while (treewalker.nextNode()) {
		if (treewalker.currentNode.nodeType === Node.ELEMENT_NODE) {
			const element = treewalker.currentNode as HTMLElement;
			// Если не будем использовать служебный дата-атрибут для новых html элементов - уйдем в рекурсию
			if (element.dataset.service) {
				continue;
			}
			const computedStyles = getComputedStyle(element);
			const styles = [
				"font-family",
				"font-size",
				"font-weight",
				"font-style",
				"font-variant",
				"line-height",
				"text-decoration",
				"vertical-align",
				"color",
				"background-color",
			]
				.map((prop) => `${prop}: ${computedStyles.getPropertyValue(prop)}`)
				.join(";");
			// добавляем служебный атрибут чтобы различать служебные ноды
			const span = document.createElement("span");
			span.setAttribute("data-service", "true");
			span.setAttribute("style", styles);
			span.innerHTML = element.innerHTML;
			element.innerHTML = span.outerHTML;
		}
	}
	document.body.removeChild(divWrapper);
	return clonedContainer.innerHTML;
};

const createStore = (initialState: State): Store => {
	let currentMutableState = { ...initialState };
	const subscribers: ((state: State) => void)[] = [];
	return {
		getState: () => currentMutableState,
		onChange: (fn) => {
			subscribers.push(fn);
		},
		setState: (reducer) => {
			const newState = {
				...currentMutableState,
				...reducer(currentMutableState),
			};
			currentMutableState = newState;
			subscribers.forEach((subscriber) => {
				subscriber(currentMutableState);
			});
		},
	};
};

// Сеттеры состояния, ближайшая аналогия для рефакторинга - экшоны в редюсере или функции отсылаемся в useReduce
const setCommandControlsInitialized = (state: State) => {
	return {
		...state,
		commandControls: {
			...state.commandControls,
			initialized: true,
		},
	};
};
const setCommandControlEnabledState = (
	commandControlId: Command["id"],
	enabled: boolean
) => (state: State) => {
	return {
		...state,
		commandControls: {
			...state.commandControls,
			enabled: {
				...state.commandControls.enabled,
				[commandControlId]: enabled,
			},
		},
	};
};

/*
	функция отображения из модели в указанный контейнер, на данный момент она просто накидывает обработчики в готовом html,
  переключает активные классы для контролов стилей.
*/
const render = (store: Store, container: Element): void => {
	const paragraphButton = document.querySelector(".js-paragraph");
	const h1Button = document.querySelector(".js-head-1");
	const h2Button = document.querySelector(".js-head-2");
	const boldButton = document.querySelector(".js-bold");
	const italicButton = document.querySelector(".js-italic");
	if (
		!h1Button ||
		!paragraphButton ||
		!h2Button ||
		!boldButton ||
		!italicButton
	) {
		throw new Error("Some controll missed");
	}
	const commandControls: CommandControls[] = [
		{
			command: commands.h1,
			button: h1Button,
		},
		{
			command: commands.p,
			button: paragraphButton,
		},
		{
			command: commands.h2,
			button: h2Button,
		},
		{
			command: commands.bold,
			button: boldButton,
		},
		{
			command: commands.italic,
			button: italicButton,
		},
	];

	// Нормализует выбранный пользователем кусок в редакторе для использования в буфере обмена
	const normalizeSelectionForClipboard = (selection: Selection) => {
		const range = selection.getRangeAt(0);
		const clonedSelection = range.cloneContents();
		const div = document.createElement("div");
		div.appendChild(clonedSelection);
		// Если мы копируем не все, а только кусок текста - то необходимо обернуть его в родительский тег для последующего сохранения стилей
		if (
			Array.from(div.childNodes).some(
				(node) => node.nodeType === Node.TEXT_NODE
			)
		) {
			const tagName = range.startContainer.parentElement?.tagName;
			if (typeof tagName !== "string") {
				throw new Error("no parent element");
			}
			const wrapper = document.createElement(tagName);
			wrapper.appendChild(div);
			return patchHTMLElementWithInlineStyles(wrapper);
		}

		return patchHTMLElementWithInlineStyles(div);
	};

	const initCommands = (store: Store) => {
		const startSyncCommandStateAndStoreState = () => {
			const handler = () => {
				// синхронизируем состояние контроллов команд
				commandControls
					.filter((commandControll) => commandControll.command.type === "style")
					.forEach((commandControl) => {
						const enabled = document.queryCommandState(
							commandControl.command.format
						);
						store.setState(
							setCommandControlEnabledState(commandControl.command.id, enabled)
						);
					});
				// контент редактора с моделью
				store.setState((state) => {
					return {
						...state,
						// пока не используем
						content: container.innerHTML.toString(),
					};
				});
			};
			container.addEventListener("keyup", handler);
			container.addEventListener("mouseup", handler);
			container.addEventListener("click", handler);
		};
		const initCutCopyCapability = () => {
			const copy = (event: ClipboardEvent) => {
				event.preventDefault();
				const selection = document.getSelection();
				if (!selection) {
					return;
				}
				const html = normalizeSelectionForClipboard(selection);
				event.clipboardData?.clearData();
				event.clipboardData?.setData("text/html", html);
			};
			const cut = (event: ClipboardEvent) => {
				event.preventDefault();
				const selection = document.getSelection();
				if (!selection) {
					return;
				}
				const html = normalizeSelectionForClipboard(selection);
				event.clipboardData?.clearData();
				event.clipboardData?.setData("text/html", html);
				selection.deleteFromDocument();
				document.getSelection()?.deleteFromDocument();
			};

			container.addEventListener("copy", copy as EventHandlerNonNull);
			container.addEventListener("cut", cut as EventHandlerNonNull);
		};
		const normalizeSeparator = () => {
			// нормализуем разделители и считаем все, что не заголовок - параграф
			document.execCommand("defaultParagraphSeparator", false, "p");
		};
		const subscribeCommandControls = () => {
			commandControls.forEach((commandController) => {
				commandController.button.addEventListener("click", () => {
					const editor = document.querySelector(".js-edit-area");
					if (!editor) {
						throw new Error(`no control for ${commandController.command}`);
					}
					document.execCommand(
						commandController.command.format,
						false,
						commandController.command.value
					);
					(container as HTMLElement).focus();

					// Переключать на данный момент мы умеем только тип элементов, задающих стилизацию.
					// В дальнейшем можно добавить и переключение контролов тегов
					if (commandController.command.type === "style") {
						store.setState((state) =>
							setCommandControlEnabledState(
								commandController.command.id,
								!state.commandControls.enabled[commandController.command.id]
							)(state)
						);
					}
				});
			});
		};
		// Костыльный способ проверять, что мы уже инициализировали обработчики на контролы команд
		const markCommandsInitialized = () => {
			store.setState(setCommandControlsInitialized);
		};
		if (!store.getState().commandControls.initialized) {
			startSyncCommandStateAndStoreState();
			normalizeSeparator();
			subscribeCommandControls();
			initCutCopyCapability();
			markCommandsInitialized();
		}
	};

	const renderControls = () => {
		const activeClass = "active";
		commandControls.forEach((commandControl) => {
			if (store.getState().commandControls.enabled[commandControl.command.id]) {
				commandControl.button.classList.add(activeClass);
			} else {
				commandControl.button.classList.remove(activeClass);
			}
		});
	};

	initCommands(store);
	renderControls();
};

/* Точка входа для приложения, здесь происходит вся инициализация */
const runApp = () => {
	const container = document.querySelector(".js-edit-area");
	const store = createStore({
		commandControls: {
			initialized: false,
			enabled: {
				h2: false,
				h1: false,
				bold: false,
				italic: false,
				p: false,
			},
		},
		content: "",
	});

	// для удобства отладки
	((window as unknown) as Window & {
		__WYSIWIG_STORE__: Store;
	}).__WYSIWIG_STORE__ = store;

	if (!container) {
		throw new Error("no editor container");
	}

	// first render
	render(store, container);

	// render from model
	store.onChange(() => {
		render(store, container);
	});
};

/* Для тестов - экспортируем, для браузера сразу запускаем. По-хорошему достаточно выделить просто отдельныйф факл,
 * но тогда придется подключать бандлер - так как при наличии импортов "голый" typescript не умеет транспилить/бандлить под браузер.
 * По этой же причине сейчас все в одном файле
 * */
if (typeof process !== "undefined" && process?.env?.NODE_ENV === "test") {
	module.exports = runApp;
} else {
	runApp();
}
