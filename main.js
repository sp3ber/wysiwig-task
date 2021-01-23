var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a;
var commands = {
    p: { id: "p", format: "formatBlock", value: "p", type: "tag" },
    h1: { id: "h1", format: "formatBlock", value: "h1", type: "tag" },
    h2: { id: "h2", format: "formatBlock", value: "h2", type: "tag" },
    bold: { id: "bold", format: "bold", value: undefined, type: "style" },
    italic: { id: "italic", format: "italic", value: undefined, type: "style" }
};
/* Для Microsoft Office Wold Online приходиться инлайнить стили для сохранения заголовков */
var patchWithInlineStyles = function (container) {
    var clonedContainer = container.cloneNode(true);
    /* Чтобы взять конечные стили для последующего инлайнинга - необходимо, чтобы эти элементы находились обязательно в DOM
     */
    var divWrapper = document.createElement("div");
    divWrapper.hidden = true;
    divWrapper.appendChild(clonedContainer);
    document.body.appendChild(divWrapper);
    var treewalker = document.createTreeWalker(clonedContainer, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function () {
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    var _loop_1 = function () {
        if (treewalker.currentNode.nodeType === Node.ELEMENT_NODE) {
            var element = treewalker.currentNode;
            // Если не будем использовать служебный дата-атрибут для новых html элементов - уйдем в рекурсию
            if (element.dataset.service) {
                return "continue";
            }
            var computedStyles_1 = getComputedStyle(element);
            var styles = [
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
                .map(function (prop) { return prop + ": " + computedStyles_1.getPropertyValue(prop); })
                .join(";");
            // добавляем служебный атрибут чтобы различать служебные ноды
            var span = document.createElement("span");
            span.setAttribute("data-service", "true");
            span.setAttribute("style", styles);
            span.innerHTML = element.innerHTML;
            element.innerHTML = span.outerHTML;
        }
    };
    while (treewalker.nextNode()) {
        _loop_1();
    }
    document.body.removeChild(divWrapper);
    return clonedContainer.innerHTML;
};
/*
    функция рендера, на данный момент она просто накидывает обработчики,
  переключает активные классы для контроллов стилей.
*/
var render = function (store, container) {
    var paragraphButton = document.querySelector(".js-paragraph");
    var h1Button = document.querySelector(".js-head-1");
    var h2Button = document.querySelector(".js-head-2");
    var boldButton = document.querySelector(".js-bold");
    var italicButton = document.querySelector(".js-italic");
    if (!h1Button ||
        !paragraphButton ||
        !h2Button ||
        !boldButton ||
        !italicButton) {
        throw new Error("Some controll missed");
    }
    var commandControls = [
        {
            command: commands.h1,
            button: h1Button
        },
        {
            command: commands.p,
            button: paragraphButton
        },
        {
            command: commands.h2,
            button: h2Button
        },
        {
            command: commands.bold,
            button: boldButton
        },
        {
            command: commands.italic,
            button: italicButton
        },
    ];
    // Нормализует выбранный кусок в области редактирования для использования в буфере обмена
    var normalizeSelectionForClipboard = function (selection) {
        var _a;
        var range = selection.getRangeAt(0);
        var clonedSelection = range.cloneContents();
        var div = document.createElement("div");
        div.appendChild(clonedSelection);
        // Если мы копируем не все, а только кусок текста - то необходимо обернуть его в родительский тег для последующего сохранения стилей
        if (Array.from(div.childNodes).some(function (node) { return node.nodeType === Node.TEXT_NODE; })) {
            var tagName = (_a = range.startContainer.parentElement) === null || _a === void 0 ? void 0 : _a.tagName;
            if (typeof tagName !== "string") {
                throw new Error("no parent element");
            }
            var wrapper = document.createElement(tagName);
            wrapper.appendChild(div);
            return patchWithInlineStyles(wrapper);
        }
        return patchWithInlineStyles(div);
    };
    var initCommands = function (store) {
        var starSyncCommandStateAndStoreState = function () {
            var handler = function () {
                // синхронизируем контроллы команд
                commandControls
                    .filter(function (commandsController) { return commandsController.command.type === "style"; })
                    .forEach(function (commandController) {
                    var enabled = document.queryCommandState(commandController.command.format);
                    store.setState(function (state) {
                        var _a;
                        return __assign(__assign({}, state), { settings: __assign(__assign({}, state.settings), { controllers: __assign(__assign({}, state.settings.controllers), (_a = {}, _a[commandController.command.id] = enabled, _a)) }) });
                    });
                });
                // синхронизируем настройки и контент редактора с моделью
                store.setState(function (state) {
                    return __assign(__assign({}, state), { 
                        // пока не используем
                        content: container.innerHTML.toString() });
                });
            };
            container.addEventListener("keyup", handler);
            container.addEventListener("mouseup", handler);
            container.addEventListener("click", handler);
        };
        var initCutCopy = function () {
            var copy = function (event) {
                var _a, _b;
                event.preventDefault();
                var selection = document.getSelection();
                if (!selection) {
                    return;
                }
                var html = normalizeSelectionForClipboard(selection);
                (_a = event.clipboardData) === null || _a === void 0 ? void 0 : _a.clearData();
                (_b = event.clipboardData) === null || _b === void 0 ? void 0 : _b.setData("text/html", html);
            };
            var cut = function (event) {
                var _a, _b, _c;
                event.preventDefault();
                var selection = document.getSelection();
                if (!selection) {
                    return;
                }
                var html = normalizeSelectionForClipboard(selection);
                (_a = event.clipboardData) === null || _a === void 0 ? void 0 : _a.clearData();
                (_b = event.clipboardData) === null || _b === void 0 ? void 0 : _b.setData("text/html", html);
                selection.deleteFromDocument();
                (_c = document.getSelection()) === null || _c === void 0 ? void 0 : _c.deleteFromDocument();
            };
            container.addEventListener("copy", copy);
            container.addEventListener("cut", cut);
        };
        var normalizeSeparator = function () {
            // нормализуем разделители и считаем все, что не заголовок - параграф
            document.execCommand("defaultParagraphSeparator", false, "p");
        };
        var handleCommandControls = function () {
            commandControls.forEach(function (commandController) {
                commandController.button.addEventListener("click", function () {
                    var editor = document.querySelector(".js-edit-area");
                    if (!editor) {
                        throw new Error("no control for " + commandController.command);
                    }
                    document.execCommand(commandController.command.format, false, commandController.command.value);
                    container.focus();
                    if (commandController.command.type === "style") {
                        store.setState(function (state) {
                            var _a;
                            return __assign(__assign({}, state), { settings: __assign(__assign({}, state.settings), { controllers: __assign(__assign({}, state.settings.controllers), (_a = {}, _a[commandController.command.id] = !state.settings.controllers[commandController.command.id], _a)) }) });
                        });
                    }
                });
            });
        };
        var markCommandsInitialized = function () {
            store.setState(function (state) {
                return __assign(__assign({}, state), { settings: __assign(__assign({}, state.settings), { controllersInitialized: true }) });
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
    var renderControls = function () {
        commandControls.forEach(function (commandsController) {
            if (store.getState().settings.controllers[commandsController.command.id]) {
                commandsController.button.classList.add("active");
            }
            else {
                commandsController.button.classList.remove("active");
            }
        });
    };
    initCommands(store);
    renderControls();
    //patchWithInlineStyles(container);
};
/*
    создает redux like хранилище, прямо сейчас используется только для синхронизации кнопок стилизации между моделью и представлением.
    Без событийной модели, на данный момент достаточно простого setState
*/
var createStore = function (initialState) {
    var currentMutableState = __assign({}, initialState);
    var subscribers = [];
    return {
        getState: function () { return currentMutableState; },
        onChange: function (fn) {
            subscribers.push(fn);
        },
        setState: function (reducer) {
            var newState = __assign(__assign({}, currentMutableState), reducer(currentMutableState));
            currentMutableState = newState;
            subscribers.forEach(function (subscriber) {
                subscriber(currentMutableState);
            });
        }
    };
};
/* Точка входа для приложения, здесь происходит вся инициализация */
var runApp = function () {
    var container = document.querySelector(".js-edit-area");
    var store = createStore({
        settings: {
            controllersInitialized: false,
            controllers: {
                h2: false,
                h1: false,
                bold: false,
                italic: false,
                p: false
            }
        },
        content: ""
    });
    // для удобства отладки
    window.__STORE__ = store;
    if (!container) {
        throw new Error("no editor container");
    }
    // first render
    render(store, container);
    // render from model
    store.onChange(function () {
        render(store, container);
    });
};
/* Для тестов - экспортируем, для браузера сразу запускаем */
if (typeof process !== "undefined" && ((_a = process === null || process === void 0 ? void 0 : process.env) === null || _a === void 0 ? void 0 : _a.NODE_ENV) === "test") {
    module.exports = runApp;
}
else {
    runApp();
}
