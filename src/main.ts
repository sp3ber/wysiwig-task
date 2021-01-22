const commands = {
	p: { id: "p", format: "formatBlock", value: "p", type: "tag" },
	h1: { id: "h1", format: "formatBlock", value: "h1", type: "tag" },
	h2: { id: "h2", format: "formatBlock", value: "h2", type: "tag" },
	bold: { id: "bold", format: "bold", value: undefined, type: "style" },
	italic: { id: "italic", format: "italic", value: undefined, type: "style" },
} as const;
type Command = typeof commands[keyof typeof commands];
type Settings = {
	controllersInitialized: boolean;
	controllers: Record<Command["id"], boolean>;
};
type State = {
	settings: Settings;
	content: {};
};
type Subscriber = (state: State) => void;
type Reducer = (state: State) => State;
type Store = {
	getState: () => State;
	onChange: (subscriber: Subscriber) => void;
	setState: (reducer: Reducer) => void;
};
type CommandControllers = {
	command: Command;
	button: Element;
};

// функция псевдо-рендера, на данный момент она просто накидывает обработчики, переключает активные классы для контроллов стилей
const render = (store: Store, container: Element): void => {
	const paragraphButton = document.querySelector(".js-paragraph")!;
	const h1Button = document.querySelector(".js-head-1")!;
	const h2Button = document.querySelector(".js-head-2")!;
	const boldButton = document.querySelector(".js-bold")!;
	const italicButton = document.querySelector(".js-italic")!;
	const commandsControllers: CommandControllers[] = [
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

	/* Для Microsoft Office Wold Online приходиться инлайнить стили для сохранения заголовков */
	const patchWithInlineStyles = (container: Element) => {
		const clonedContainer = container.cloneNode(true);
		const divWrapper = document.createElement("div");
		divWrapper.hidden = true;
		divWrapper.appendChild(clonedContainer);
		document.body.appendChild(divWrapper);

		const treewalker = document.createTreeWalker(
			clonedContainer,
			NodeFilter.SHOW_ELEMENT,
			{
				acceptNode: function (node) {
					return NodeFilter.FILTER_ACCEPT;
				},
			}
		);
		while (treewalker.nextNode()) {
			if (treewalker.currentNode.nodeType === Node.ELEMENT_NODE) {
				const element = treewalker.currentNode as HTMLElement;
				if (element.dataset.service) {
					continue;
				}
				const stylesMap = getComputedStyle(element!);
				const styles =
					`font-family: ${stylesMap.getPropertyValue("font-family")}; ` +
					`font-size: ${stylesMap.getPropertyValue("font-size")}; ` +
					`font-weight: ${stylesMap.getPropertyValue("font-weight")}; ` +
					`font-style: ${stylesMap.getPropertyValue("font-style")}; ` +
					`font-variant: ${stylesMap.getPropertyValue("font-variant")}; ` +
					`line-height: ${stylesMap.getPropertyValue("line-height")}; ` +
					`text-decoration: ${stylesMap.getPropertyValue(
						"text-decoration"
					)}; ` +
					`vertical-align: ${stylesMap.getPropertyValue("vertical-align")}; ` +
					`white-space: ${stylesMap.getPropertyValue("white-space")}; ` +
					`color: ${stylesMap.getPropertyValue("color")}; ` +
					`background-color: ${stylesMap.getPropertyValue(
						"background-color"
					)};`;
				const span = document.createElement("span");
				span.setAttribute("style", styles);
				span.setAttribute("data-service", "true");
				span.innerHTML = element.innerHTML;
				element.innerHTML = span.outerHTML;
			}
		}
		document.body.removeChild(divWrapper);
		return (clonedContainer as HTMLElement).innerHTML;
	};

	const normalizeSelection = (selection: Selection) => {
		const range = selection.getRangeAt(0);
		var clonedSelection = range.cloneContents();
		var div = document.createElement("div");
		div.appendChild(clonedSelection);
		return patchWithInlineStyles(div);
	};

	const initCommands = (store: Store) => {
		const starSyncCommandStateAndStoreState = () => {
			const handler = () => {
				// синхронизируем контроллы команд
				commandsControllers
					.filter(
						(commandsController) => commandsController.command.type === "style"
					)
					.forEach((commandController) => {
						const enabled = document.queryCommandState(
							commandController.command.format
						);
						store.setState((state) => {
							return {
								...state,
								settings: {
									...state.settings,
									controllers: {
										...state.settings.controllers,
										[commandController.command.id]: enabled,
									},
								},
							};
						});
					});
				// синхронизируем настройки и контент редактора с моделью
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

		const initCutCopy = () => {
			const copy = (event: ClipboardEvent) => {
				event.preventDefault();
				const selection = document.getSelection()!;
				const html = normalizeSelection(selection);
				event.clipboardData?.clearData();
				event.clipboardData?.setData("text/html", html);
			};
			const cut = (event: ClipboardEvent) => {
				event.preventDefault();
				const selection = document.getSelection()!;
				const html = normalizeSelection(selection);
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
		const handleCommandControls = () => {
			commandsControllers.forEach((commandController) => {
				commandController.button.addEventListener("click", (e) => {
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
					if (commandController.command.type === "style") {
						store.setState((state) => {
							return {
								...state,
								settings: {
									...state.settings,
									controllers: {
										...state.settings.controllers,
										[commandController.command.id]: !state.settings.controllers[
											commandController.command.id
										],
									},
								},
							};
						});
					}
				});
			});
		};
		const markCommandsInitialized = () => {
			store.setState((state) => {
				return {
					...state,
					settings: {
						...state.settings,
						controllersInitialized: true,
					},
				};
			});
		};
		if (!store.getState().settings.controllersInitialized) {
			starSyncCommandStateAndStoreState();
			normalizeSeparator();
			handleCommandControls();
			initCutCopy();
			markCommandsInitialized();
		}
	};

	const renderControls = () => {
		commandsControllers.forEach((commandsController) => {
			if (
				store.getState().settings.controllers[commandsController.command.id]
			) {
				commandsController.button.classList.add("active");
			} else {
				commandsController.button.classList.remove("active");
			}
		});
	};

	initCommands(store);
	renderControls();
	//patchWithInlineStyles(container);
};

// redux like store, прямо сейчас используется только для синхронизации кнопок стилизации между моделью и представлением
const createStore = (initialState: State): Store => {
	let currentMutableState = { ...initialState };
	let subscribers: Subscriber[] = [];
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

const run = () => {
	const container = document.querySelector(".js-edit-area");
	const store = createStore({
		settings: {
			controllersInitialized: false,
			controllers: {
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
	((window as unknown) as Window & { __STORE__: Store }).__STORE__ = store;

	if (!container) {
		throw new Error("no container");
	}

	// first render
	render(store, container);

	// render from model
	store.onChange((state) => {
		render(store, container);
	});
};

/* Для тестов - экспортируем, для браузера сразу запускаем */
if (typeof process !== "undefined" && process?.env?.NODE_ENV === "test") {
	module.exports = run;
} else {
	run();
}
