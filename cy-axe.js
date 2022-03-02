export { wcag };

import { AXE_CORE_PATH } from './library/constants.js';

/* global
	 Cypress,
	 cy,
	 describe,
	 beforeEach,
	 it,
	 expect,
*/

const { from, isArray } = Array;
const { assign, create, entries, fromEntries } = Object;

/**
 * @param {Object} object
 * @returns {*}
 */
const dictionary = object => assign(create(null), object);

const FETCH_MAP = Symbol('fetch map');

const WCAG_21_A = ['wcag2a', 'wcag21a'];
const WCAG_21_AA = [...WCAG_21_A, 'wcag2aa', 'wcag21aa'];
const WCAG_21_AAA = [...WCAG_21_AA, 'wcag2aaa', 'wcag21aaa'];

const wcag_presets = dictionary({
	'2.1 A': WCAG_21_A,
	'2.1 AA': WCAG_21_AA,
	'2.1 AAA': WCAG_21_AAA,
});

const axe_options = {
	resultTypes: ['violations'],
	runOnly: null,
};

/**
 * @param {*} value
 * @returns {string}
 */
function type_of(value) {
	if (isArray(value)) {
		return 'array';
	}

	if (value === null) {
		return 'null';
	}

	return typeof value;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
const is_function = value => type_of(value) == 'function';

/**
 * @param {*} value
 * @returns {boolean}
 */
const is_string = value => type_of(value) == 'string';

/**
 * @param {*} value
 * @returns {boolean}
 */
const is_object = value => type_of(value) == 'object';

/**
 * @param {*} value
 * @returns {boolean}
 */
const is_undefined = value => value === undefined;

/**
 * The axe version is read from the window object
 * and passed to the Node.js report task.
 */
let axe_version;

/**
 * Conformance level.
 */
let conformance;

/**
 * Overwrite `inject_axe` so `cy.readFile` is only called once.
 * @param {string} source
 */
function memoize_axe(source) {
	// deno-lint-ignore no-func-assign
	(inject_axe = function () {
		cy.window({ log: false })
			.then(
				/**
				 * @param {Window} test_window
				 */
				function (test_window) {
					test_window.eval(source);
					axe_version = test_window.axe.version;
				}
			);
	})();
}

/**
 * Inject Axe into the test window.
 */
function inject_axe() {
	cy
		.readFile(AXE_CORE_PATH)
		.then(memoize_axe);
}

/**
 * Get a normalized failure message.
 * @param {Array} data
 * @param {string} fallback
 * @returns {string}
 */
function get_failure(data, fallback) {
	if (data.length) {
		const [{ message }] = data;

		return message;
	}

	const defixed = fallback.replace(/^Fix all of the following:/, '').trim();

	return defixed.charAt(0).toUpperCase() + defixed.slice(1);
}

/**
 * All rules log the `html` and `selector` properties.
 * Add formatters for rules that need customization here.
 */
const rule_formatters = dictionary({
	['color-contrast']([{ data }]) {
		const {
			fgColor,
			bgColor,
			fontSize,
			fontWeight,
		} = data;
		const [, size] = /\((\d+(?:\.\d+)?px)\)$/.exec(fontSize);

		return {
			'Actual contrast': `${data.contrastRatio}:1`,
			'Minimum contrast': data.expectedContrastRatio,
			'CSS': {
				color: fgColor,
				'background-color': bgColor,
				'font-size': size,
				'font-weight': fontWeight,
			},
		};
	},
});

/**
 * @param {object} parameter
 * @returns {object}
 */
const violation_formatter = ({
	any,
	failureSummary: failure_summary,
	id,
	prefix,
}) =>
	function format() {
		if (rule_formatters[id]) {
			const formatters = rule_formatters[id](any);
			const toEntry = ([key, value]) => [`${prefix} ${key}`, value];
			const formatted = entries(formatters).map(toEntry);

			return fromEntries(formatted);
		}

		return {
			[`${prefix} message`]: get_failure(any, failure_summary),
		};
	};

/**
 * @param {string} id axe rule identifier
 * @returns {Function} reducer callback
 */
const violation_reducer = id =>
	/**
	 * Instance reducer
	 * @param {object} accumulator
	 * @param {object} node
	 * @param {number} index
	 * @returns {object}
	 */
	function to_violation_instance(accumulator, {
		any,
		failureSummary,
		html,
		target,
	}, index) {
		const prefix = `Node ${index + 1}`;
		const format = violation_formatter({
			any,
			failureSummary,
			id,
			prefix,
		});

		return assign(accumulator, {
			[`${prefix}`]: '👇',
			...format(),
			[`${prefix} selector`]: target.join(),
			[`${prefix} HTML`]: html,
		});
	};

/**
 * @param {object} parameter
 */
function log_violation({
	description,
	id,
	help,
	helpUrl,
	impact,
	nodes,
	tags,
}) {
	const selectors = nodes
		.reduce((accumulator, node) => accumulator.concat(node.target), [])
		.join();
	const wcagTags = tags.filter(tag => tag.startsWith('wcag'));
	const message = `&nbsp;(${impact}|${wcagTags.join('|')})`;

	/**
	 * Command console inspection
	 * @returns {Object}
	 */
	const console_props = () => ({
		description,
		url: helpUrl.split('?')[0],
		impact,
		...nodes.reduce(violation_reducer(id), {}),
	});

	Cypress.log({
		$el: Cypress.$(selectors),
		name: `👉 ${help}`,
		consoleProps: console_props,
		message,
	});
}

/**
 * @see https://www.deque.com/axe/core-documentation/api-documentation/#context-parameter
 * @param {string} [context] Axe context parameter
 */
function run_axe(context) {
	/**
	 * @param {Window} test_window
	 * @returns {Promise}
	 */
	function run(test_window) {
		const argument_list = typeof context === 'string' ?
			[context, axe_options] :
			[axe_options];

		return test_window.axe
			.run(...argument_list)
			.then(result => cy.task('axe_page_report', {
				axe_version,
				conformance,
				result,
			}));
	}

	/**
	 * @param {object} violations
	 * @returns {Promise}
	 */
	function parse(violations) {
		if (violations.length) {
			violations.forEach(log_violation);
		}

		return cy.wrap(violations, { log: false });
	}

	/**
	 * There is only a single assertion for every test:
	 * that there are no violations.
	 * If the assertion fails, the `violations` object itself
	 * can be inspected in the console.
	 * @param {object} violations
	 */
	function assert(violations) {
		function result(word, count) {
			const postfix = (count === 1) ? '' : 's';

			return `${count} ${word}${postfix}`;
		}

		const toTotal = (accumulator, violation) => accumulator + violation.nodes.length;
		const total = violations.reduce(toTotal, 0);
		const { length } = violations;
		const message = `${result('violation', total)} of ${result('rule', length)}`;

		expect(violations, message).to.be.empty;
	}

	cy
		.window({ log: false })
		.then(run)
		.then(parse)
		.then(assert);
}

/**
 * The topmost `beforeEach` handler visits the URL
 * and injects axe into the test window.
 * @param {string} url
 */
const setup = url =>
	function () {
		cy.visit(url);
		inject_axe();
	};

/**
 * Wrapper function: `run_axe` has an optional argument,
 * the callback parameter of `it` is called with `done`.
 */
function audit_static() {
	run_axe();
}

function get_function_name(value) {
	const { name } = value;

	if (name) {
		return name;
	}

	throw new Error('functions must have a name');
}

/**
 * @param {string} action
 * @returns {string}
 */
function get_name(action) {
	if (is_string(action)) {
		return action;
	}

	if (is_object(action)) {
		return FETCH_MAP;
	}

	const type = type_of(action);

	if (type === 'function') {
		return get_function_name(action);
	}

	throw new TypeError(`Unsupported action: ${type}`);
}

/**
 * @param {Array} array
 * @returns {Array}
 */
const dedupe_array = array => from(new Set(array));

/**
 * @param {Function[]} queue
 */
function is_callable_name_unique(queue) {
	const names = queue.map(({ name }) => name);
	const flat = dedupe_array(names);

	if (queue.length !== flat.length) {
		throw new Error('sibling functions must have a unique name');
	}
}

/**
 * @param {string} description
 * @param {Function} action
 * @param {string} fragment
 */
function it_maybe_async(description, action, fragment) {
	it(description, function () {
		action();
		// race condition guard for async tests
		cy.wait(0);
		run_axe(fragment);
	});
}

/**
 * Dictionary of supported type handlers for
 * the dynamic fragment specification object.
 * @type {object}
 */
const fragment_handlers = dictionary({
	/**
	 * @param {Array} actions
	 * @param {string} fragment
	 */
	array(actions, fragment) {
		const callables = actions.filter(action => is_function(action));

		is_callable_name_unique(callables);

		describe(fragment, function () {
			for (const action of actions) {
				const type = type_of(action);
				const name = get_name(action);

				fragment_handlers[type](action, fragment, name);
			}
		});
	},
	/**
	 * @param {Function} action
	 * @param {string} fragment
	 * @param {string} name
	 */
	function(action, fragment, name) {
		const description = name ? `${name}()` : fragment;

		it_maybe_async(description, action, fragment);
	},
	/**
	 * @param {Function} action
	 * @param {string} fragment
	 * @param {string} name
	 */
	object(action, fragment, name) {
		function loop() {
			for (const [selector, pattern] of entries(action)) {
				function action() {
					resource(pattern, selector);
				}

				it_maybe_async(selector, action, fragment);
			}
		}

		if (name === FETCH_MAP) {
			loop();
		} else {
			describe(fragment, loop);
		}
	},
	/**
	 * @param {string} action
	 * @param {string} fragment
	 * @param {string} name
	 */
	string(action, fragment, name) {
		it(name || fragment, function () {
			cy.get(action).click();
			run_axe(fragment);
		});
	},
});

/**
 * Run tests for a dynamic page fragment.
 * @param {Array} parameter
 */
function audit_fragment([selector, trigger]) {
	const type = type_of(trigger);

	fragment_handlers[type](trigger, selector);
}

/**
 * Audit an entire static page and an
 * optional specification of dynamic fragments.
 * @param {Function} _describe
 * @param {string} url
 * @param  {object} [fragments]
 */
function audit_page(_describe, url, fragments = {}) {
	function suite() {
		beforeEach(setup(url));

		it('Static content', audit_static);

		for (const fragment of entries(fragments)) {
			audit_fragment(fragment);
		}
	}

	_describe(`URL: ${url}`, suite);
}

/**
 * Stub all matched URLs for a particular MIME type.
 * @param {Array} parameter
 */
function stub_all([contentType, globs]) {
	function stub(request) {
		request.on('before:response', response => {
			assign(response.headers, {
				['content-type']: contentType,
				['cache-control']: 'no-store',
			});
			response.body = '';
		});
	}

	for (const url of globs) {
		cy.intercept({
			url,
			middleware: true,
		}, stub);
	}
}

/**
 * Interceptor dictionary
 * Key: HTTP content-type
 * Value: URL glob matchers
 * @see https://docs.cypress.io/api/commands/intercept#Glob-Pattern-Matching-URLs
 * @typedef {object.<string, string[]>} Interceptors
 */

/**
 * Stub external URLs with a no-op response.
 * @param {Interceptors} interceptors
 */
function intercept(interceptors) {
	for (const entry of entries(interceptors)) {
		stub_all(entry);
	}
}

/**
 * @todo this should be a string|object union,
 *       but that resolves to any in VSCode
 * @typedef {*} TestQueueItem
 */

/**
 * If a queue item is a string and followed by another string,
 * it can be executed immediately.
 * @param {TestQueueItem} value
 * @param {TestQueueItem} [next]
 * @returns {boolean}
 */
function ready(value, next) {
	return is_string(value) && (is_undefined(next) || is_string(next));
}

/**
 * If a queue item is an object and preceded by a string,
 * both the page and the fragment specification can be executed.
 * @param {TestQueueItem} value
 * @param {TestQueueItem} previous
 * @returns {boolean}
 */
function is_fragment(value, previous) {
	return is_object(value) && is_string(previous);
}

/**
 * Queue items can be strings or objects,
 * objects must be preceded by strings.
 * @param {*} value
 * @param {*} previous
 * @returns {boolean}
 */
function is_supported_queue_shape(value, previous) {
	return is_string(value) || (is_object(value) && is_string(previous));
}
/**
 * Provide feedback if the test queue has a bad shape.
 * @param {*} value
 * @param {*} previous
 * @param {*} next
 */
function validate_queue_item(value, previous) {
	if (!is_supported_queue_shape(value, previous)) {
		throw new TypeError('Bad test queue shape');
	}
}

/**
 * Handle a single test queue item.
 * @param {Function} _describe
 * @param {(string|object)} value
 * @param {TestQueueItem} previous
 * @param {TestQueueItem} next
 */
function handle(_describe, value, previous, next) { // eslint-disable-line max-params
	if (ready(value, next)) {
		audit_page(_describe, value);
	} else if (is_fragment(value, previous)) {
		audit_page(_describe, previous, value);
	} else {
		validate_queue_item(value, previous);
	}
}

/**
 * Audit the test queue with a variable suite function or method.
 * This might be `describe`, `describe.only` or `describe.skip`.
 * @param {function} _describe
 * @param {Array<string|function|function[]} queue
 * @param {object} [interceptors]
 */
function _audit(_describe, queue, interceptors) {
	function setup_interceptors() {
		intercept(interceptors);
	}

	describe(conformance, function () {
		if (interceptors) {
			beforeEach(setup_interceptors);
		}

		for (const [index, value] of queue.entries()) {
			const previous = queue[index - 1];
			const next = queue[index + 1];

			handle(_describe, value, previous, next);
		}
	});
}

/**
 * @param {string} identifier
 */
function set_options(identifier) {
	if (wcag_presets[identifier]) {
		const [version, level] = identifier.split(' ');

		conformance = `WCAG ${version} Level ${level}`;
		axe_options.runOnly = wcag_presets[identifier];
	} else {
		throw new Error(`unsupported conformance: ${identifier}`);
	}
}

/**
 * The test interface can be directly used as a plain function
 * or called as the return value of a higher order function.
 * @param {object} [interceptors]
 * @returns {object}
 */
const get_interface = interceptors => assign(
	/**
	 * @param {Array<string|function|function[]>} queue
	 */
	function audit(queue) {
		_audit(describe, queue, interceptors);
	},
	{
		/**
		 * @param {*} queue
		 */
		only(queue) {
			_audit(describe.only, queue, interceptors);
		},
		/**
		 * @param {*} queue
		 */
		skip(queue) {
			_audit(describe.skip, queue, interceptors);
		},
	},
);

/**
 * Create an audit function with bound interceptors.
 * @param {string} conformance
 * @param {object} [interceptors]
 * @returns
 */
function wcag(scope, interceptors) {
	set_options(scope);

	return get_interface(interceptors);
}

let alias_index = 0;

function resource(url_pattern, selector) {
	const alias = `alias_${alias_index++}`;

	cy.intercept(url_pattern).as(alias);
	cy.get(selector).click();
	cy.wait(`@${alias}`);
}
