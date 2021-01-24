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
// Список доступных команд в редакторе
var commands = {
    p: { id: "p", format: "formatBlock", value: "p", type: "tag" },
    h1: { id: "h1", format: "formatBlock", value: "h1", type: "tag" },
    h2: { id: "h2", format: "formatBlock", value: "h2", type: "tag" },
    bold: { id: "bold", format: "bold", value: undefined, type: "style" },
    italic: { id: "italic", format: "italic", value: undefined, type: "style" }
};
/* При вставке скопированного из редактора в Microsoft Office Wold Online приходится инлайнить стили для сохранения заголовков */
var patchHTMLElementWithInlineStyles = function (container) {
    var clonedContainer = container.cloneNode(true);
    // Чтобы взять конечные стили для последующего инлайнинга - необходимо, чтобы эти элементы находились обязательно в DOM
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
// Сеттеры состояния, ближайшая аналогия для рефакторинга - экшоны в редюсере или функции отсылаемся в useReduce
var setCommandControlsInitialized = function (state) {
    return __assign(__assign({}, state), { commandControls: __assign(__assign({}, state.commandControls), { initialized: true }) });
};
var setCommandControlEnabledState = function (commandControlId, enabled) { return function (state) {
    var _a;
    return __assign(__assign({}, state), { commandControls: __assign(__assign({}, state.commandControls), { enabled: __assign(__assign({}, state.commandControls.enabled), (_a = {}, _a[commandControlId] = enabled, _a)) }) });
}; };
/*
    функция отображения из модели в указанный контейнер, на данный момент она просто накидывает обработчики в готовом html,
  переключает активные классы для контролов стилей.
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
    // Нормализует выбранный пользователем кусок в редакторе для использования в буфере обмена
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
            return patchHTMLElementWithInlineStyles(wrapper);
        }
        return patchHTMLElementWithInlineStyles(div);
    };
    var initCommands = function (store) {
        var startSyncCommandStateAndStoreState = function () {
            var handler = function () {
                // синхронизируем состояние контроллов команд
                commandControls
                    .filter(function (commandControll) { return commandControll.command.type === "style"; })
                    .forEach(function (commandControl) {
                    var enabled = document.queryCommandState(commandControl.command.format);
                    store.setState(setCommandControlEnabledState(commandControl.command.id, enabled));
                });
                // контент редактора с моделью
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
        var initCutCopyCapability = function () {
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
        var subscribeCommandControls = function () {
            var toolkitContainer = document.querySelector(".js-toolkit");
            if (!toolkitContainer) {
                throw new Error("no toolkit container");
            }
            toolkitContainer.addEventListener("click", function (e) {
                if (!(e.target instanceof HTMLElement)) {
                    return;
                }
                var button = e.target.closest("button");
                if (!button) {
                    return;
                }
                var commandControl = commandControls.find(function (commandControl) { return commandControl.button === button; });
                if (!commandControl) {
                    return;
                }
                var editor = document.querySelector(".js-edit-area");
                if (!editor) {
                    throw new Error("no control for " + commandControl.command);
                }
                document.execCommand(commandControl.command.format, false, commandControl.command.value);
                container.focus();
                // Переключать на данный момент мы умеем только тип элементов, задающих стилизацию.
                // В дальнейшем можно добавить и переключение контролов тегов
                if (commandControl.command.type === "style") {
                    store.setState(function (state) {
                        return setCommandControlEnabledState(commandControl.command.id, !state.commandControls.enabled[commandControl.command.id])(state);
                    });
                }
            });
        };
        // Костыльный способ проверять, что мы уже инициализировали обработчики на контролы команд
        var markCommandsInitialized = function () {
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
    var renderControls = function () {
        var activeClass = "active";
        commandControls.forEach(function (commandControl) {
            if (store.getState().commandControls.enabled[commandControl.command.id]) {
                commandControl.button.classList.add(activeClass);
            }
            else {
                commandControl.button.classList.remove(activeClass);
            }
        });
    };
    initCommands(store);
    renderControls();
};
/* Точка входа для приложения, здесь происходит вся инициализация */
var runApp = function () {
    var container = document.querySelector(".js-edit-area");
    var store = createStore({
        commandControls: {
            initialized: false,
            enabled: {
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
    window.__WYSIWIG_STORE__ = store;
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
/* Для тестов - экспортируем, для браузера сразу запускаем. По-хорошему достаточно выделить просто отдельныйф факл,
 * но тогда придется подключать бандлер - так как при наличии импортов "голый" typescript не умеет транспилить/бандлить под браузер.
 * По этой же причине сейчас все в одном файле
 * */
if (typeof process !== "undefined" && ((_a = process === null || process === void 0 ? void 0 : process.env) === null || _a === void 0 ? void 0 : _a.NODE_ENV) === "test") {
    module.exports = runApp;
}
else {
    runApp();
}
