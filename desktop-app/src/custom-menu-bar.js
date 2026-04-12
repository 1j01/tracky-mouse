/* global MenuBar, MENU_DIVIDER */

(function () {
	let menuBar = null;

	function loadCustomMenuBarStyles() {
		const stylePaths = [
			'../node_modules/os-gui/build/layout.css',
		];

		for (const href of stylePaths) {
			const alreadyLoaded = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
				.some((linkEl) => linkEl.getAttribute('href') === href);
			if (alreadyLoaded) {
				continue;
			}

			const linkEl = document.createElement('link');
			linkEl.rel = 'stylesheet';
			linkEl.href = href;
			document.head.append(linkEl);
		}
	}

	function buildMenuItems(items) {
		return items.map((item) => {
			if (item.type === 'separator') {
				return MENU_DIVIDER;
			}

			const mapped = {
				label: item.label,
			};

			if (item.accelerator) {
				mapped.shortcutLabel = item.accelerator;
			}
			if (item.enabled === false) {
				mapped.enabled = false;
			}

			if (item.type === 'checkbox') {
				mapped.checkbox = {
					check: () => !!item.checked,
					toggle: () => {
						window.electronAPI.invokeMenuItem(item.id);
					},
				};
			} else if (item.type === 'radio') {
				mapped.checkbox = {
					check: () => !!item.checked,
					toggle: () => {
						window.electronAPI.invokeMenuItem(item.id);
					},
				};
			}

			if (Array.isArray(item.submenu) && item.submenu.length > 0) {
				mapped.submenu = buildMenuItems(item.submenu);
			} else if (item.id) {
				mapped.action = () => {
					window.electronAPI.invokeMenuItem(item.id);
				};
			}

			return mapped;
		});
	}

	function renderCustomMenuBar(model) {
		const container = document.getElementById('custom-menu-bar');
		if (!container || !model?.menus || typeof MenuBar !== 'function') {
			return;
		}

		const menus = {};
		for (const topLevelMenu of model.menus) {
			if (!topLevelMenu?.label || !Array.isArray(topLevelMenu.items)) {
				continue;
			}
			let label = topLevelMenu.label;
			while (Object.prototype.hasOwnProperty.call(menus, label)) {
				label += ' ';
			}
			menus[label] = buildMenuItems(topLevelMenu.items);
		}

		menuBar = MenuBar(menus);
		menuBar.setKeyboardScope(window);
		container.replaceChildren(menuBar.element);
	}

	async function initCustomMenuBar() {
		if (!window.electronAPI || !window.electronAPI.getPlatform) {
			return;
		}
		if (window.electronAPI.getPlatform() !== 'win32') {
			return;
		}

		loadCustomMenuBarStyles();

		const model = await window.electronAPI.getCustomMenuBarModel();
		renderCustomMenuBar(model);

		window.electronAPI.onCustomMenuBarModelUpdated((updatedModel) => {
			renderCustomMenuBar(updatedModel);
		});
	}

	window.initCustomMenuBar = initCustomMenuBar;
})();
