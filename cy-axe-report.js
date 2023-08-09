// This module is executed in the Node.js runtime
// @see https://www.deque.com/axe/core-documentation/api-documentation/#user-content-results-object

/* global module */

module.exports = {
	// @see https://docs.cypress.io/api/commands/task
	queue: {
		axe_page_report({ axe_version, conformance, result }) {
			assign(axe_report, { axe_version, conformance });
			axe_report.queue.push(result);

			return result.violations;
		},
	},
	// @see https://docs.cypress.io/api/plugins/after-run-api
	flush({
		browserName: browser,
		config: {
			baseUrl,
		},
		cypressVersion: cypress,
		endedTestsAt: end,
		startedTestsAt: start,
		totalDuration: duration,
		totalFailed: failed,
		totalPassed: passed,
	}) {
		const html = create_axe_report({
			baseUrl,
			browser,
			cypress,
			duration,
			end,
			failed,
			passed,
			start,
		});

		writeFile(REPORT_FILE, html);
	},
};

const { writeFile } = require('fs/promises');
const {
	AXE_CORE_URL,
	CYPRESS_URL,
	PROJECT_URL,
	REPORT_FILE,
	WCAG21_SUCCESS_CRITERIA,
	WCAG21_URL,
} = require('./library/constants');
const css = require('./library/cy-axe-report-css');

const { assign, values } = Object;

let aria_index = 0;

/**
 * create naive ids for aria relations (good enough for a self-contained page)
 * @returns {string} relation ID
 */
const get_id = () => `RELATION_${++aria_index}`;

/**
 * Accumulator for all integration suites
 * @see module.exports.task
 */
const axe_report = {
	axe_version: 'N/A',
	queue: [],
};

const emoji_map = new Map([
	[true, '🍏'],
	[false, '🍎'],
]);

/**
 * Get the favicon emoji based on result
 * @param {number} failures number of violations
 * @returns {string} status emoji
 */
const favicon = failures => emoji_map.get(!failures);

/**
 * Create the HTML report
 * @see https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html
 * @param {object} options template variables
 * @param {string} options.emoji
 * @param {string} options.heading
 * @param {string} options.sections
 * @param {string} options.footer
 * @returns {string} HTML page source
 */
const template = ({
	emoji,
	heading,
	summary,
	sections,
	footer,
}) => /* html */ `
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${axe_report.conformance} report</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>">
<style>${css}</style>
<script type="module">
const match = element => (
	typeof element.matches == 'function'
	&& element.matches('textarea[readonly]')
);

function on_focusin({ target }) {
	if (match(target)) {
		target.select();
	}
}

document.addEventListener('focusin', on_focusin);
</script>
</head>
<body>
<h1>${heading}</h1>
<main>
	${summary}
	${sections}
</main>
<footer>
	${footer}
</footer>
</body>
</html>
`.trimLeft();

/**
 * Naive plural formatter
 * @param {string} word
 * @param {number} amount
 * @returns {string}
 */
function count(word, amount) {
	const suffix = (amount === 1) ? '' : 's';

	return `<strong>${amount}</strong> ${word}${suffix}`;
}

/**
 * Resolve the Axe-core criterion tag to the proper success criterion
 * @param {string} tag
 * @returns {string}
 */
function get_success_criterion(tag) {
	const [, principle, guideline, criterion] = /^wcag(\d)(\d)(\d+)$/.exec(tag);

	return `${principle}.${guideline}.${criterion}`;
}

/**
 * @param {string} input
 * @returns {string}
 */
const escape_html = input => input.replace(/</gm, '&lt;');

/**
 * @param {string} name
 * @param {Array} solutions
 * @returns {string}
 */
function format_solutions(name, solutions) {
	const to_item = ({ message }) => `<li>${escape_html(message)}</li>`;

	return [
		'\t\t<details>',
		`\t\t\t<summary>Fix ${name} of the following</summary>`,
		'\t\t\t<ul>',
		'\t\t\t\t' + solutions.map(to_item).join('\n\t\t\t\t'),
		'\t\t\t</ul>',
		'\t\t</details>',
	].join('\n');
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function fieldset(label, value) {
	const id = get_id();

	return [
		'\t\t\t\t<fieldset>',
		`\t\t\t\t\t<legend id="${id}">${label}</legend>`,
		`\t\t\t\t\t<textarea aria-labelledby="${id}" readonly>${value}</textarea>`,
		'\t\t\t\t</fieldset>',
	].join('\n');
}

/**
 * Create a violation list item for a rule section
 * @param {object} parameter
 * @returns {string}
 */
const to_violation_instance = ({
	html,
	target,
}) => [
	'\t\t\t<li>',
	fieldset('Selector', target.join()),
	fieldset('HTML', html),
	'\t\t\t</li>',
].join('\n');

/**
 * @param {string} tags
 * @returns {string}
 */
function get_rule_tag(tags) {
	const [alias] = tags.filter(tag => /^wcag\d+$/.test(tag));
	const criterion = get_success_criterion(alias);
	const fragment = WCAG21_SUCCESS_CRITERIA[criterion];

	return `<a href="${WCAG21_URL}#${fragment}" class="tag"> SC ${criterion}</a>`;
}

function get_rule_position(data, item) {
	const run = data.findIndex(array => array.includes(item));

	if (data.length > 1) {
		return run > 0 ?
			`Page fragment <strong> ${run}</strong> of ${data.length - 1}: ` :
			'Static page content: ';
	}

	return '';
}

function get_rule_html({
	help,
	helpUrl,
	impact,
	nodes,
	tags,
}, position) {
	const tag = get_rule_tag(tags);
	const href = helpUrl.split('?')[0];
	const [{ any, all }] = nodes;
	const message = any.length ?
		format_solutions('any', any) :
		format_solutions('all', all);

	return [
		`\t\t<h3>${position} <a href="${href}">${escape_html(help)}</a> ${tag}</h3>`,
		`\t\t<p>Rule summary: ${count('violation', nodes.length)} with <strong>${impact}</strong> impact</p>`,
		message,
		'\t\t<ol>',
		...nodes.map(to_violation_instance),
		'\t\t</ol>',
	];
}

/**
 * Create a rule section for a page section
 * @param {Array} data
 * @returns {string}
 */
function category(data) {
	const html = [];

	for (const item of data.flat()) {
		const position = get_rule_position(data, item);
		const rule_fragment = get_rule_html(item, position);

		html.push(...rule_fragment);
	}

	return html.join('\n');
}

/**
 * Page violations reducer
 * @param {number} total
 * @param {object} violation
 * @returns {number}
 */
const to_total = (total, {
	nodes: {
		length,
	},
}) => total + length;

/**
 * @param {Array} violations
 * @returns {Array}
 */
function get_rule_count(violations) {
	const ids = violations.map(({ id }) => id);

	return [...new Set(ids)].length;
}

/**
 * Create the page summary with the total
 * number of violations and rules.
 * @param {object} violations
 * @returns {string}
 */
function page_summary(violations) {
	const flat = violations.flat();

	return [
		'<p>Page summary:',
		count('violation', flat.reduce(to_total, 0)),
		' of ',
		count('rule', get_rule_count(flat)),
		'</p>\n',
		category(violations),
	].join('');
}

/**
 * Create a page report section
 * @param {object} options
 * @returns {string}
 */
function section({
	url,
	violations,
}) {
	const id = get_id();
	const flat = violations.flat();
	const page_violation_report = flat.length ?
		page_summary(violations) :
		'';
	const [status, tag] = flat.length ?
		['fail', '<strong class="tag">Fail</strong>'] :
		['pass', '<strong class="tag">Pass</strong>'];

	return [
		`<section aria-labelledby="${id}">\n\t\t`,
		`<h2 id="${id}" class="${status}">`,
		tag,
		`<a href="${url.href}">URL: <code>${url.label}</code></a>`,
		'</h2>\n',
		page_violation_report ? page_violation_report + '\n' : '',
		'\t</section>',
	].join('');
}

/**
 * Accumulate test suites that run tests multiple times on the same URL.
 * The subject of the first run should be the entire static page content,
 * the subjects of subsequent runs should be fragments that are only
 * available as a result of user interaction.
 * @param {Array} pageReports
 * @returns {Array}
 */
function merge_page_reports(pageReports) {
	function to_site_map(accumulator, { url, violations }) {
		if (accumulator[url]) {
			accumulator[url].violations.push(violations);
		} else {
			accumulator[url] = {
				url,
				violations: [violations],
			};
		}

		return accumulator;
	}

	const map = pageReports.reduce(to_site_map, {});

	return values(map);
}

/**
 * @param {Array} pages
 * @returns {Array}
 */
function errors_first(pages) {
	const get_flat_length = ({ violations }) => violations.flat().length;

	return [
		...pages.filter(get_flat_length),
		...pages.filter(item => !get_flat_length(item)),
	];
}

/**
 * Get the primary page heading
 * @param {string} base_url
 * @returns {string}
 */
const get_heading = base_url =>
	`<strong>${axe_report.conformance}</strong> report for <code><a href="${base_url}">${base_url}</a></code>`;

/**
 * Violation reducer
 * @param {object} accumulator
 * @param {object} report
 * @param {object[]} report.violations
 * @returns {object}
 */
function to_summary(accumulator, { violations }) {
	const flat = violations.flat();

	if (flat.length) {
		accumulator.pages += 1;
	}

	for (const {
		id,
		nodes: {
			length,
		},
	} of flat) {
		accumulator.violations += length;
		accumulator.rules.add(id);
	}

	return accumulator;
}

/**
 * Create the site summary with the total
 * number of violations, rules and pages
 * @param {Array} page_reports
 * @returns {string}
 */
function get_summary(page_reports) {
	const {
		violations,
		rules,
		pages,
	} = page_reports.reduce(to_summary, {
		violations: 0,
		rules: new Set(),
		pages: 0,
	});

	const stats = violations ? [
		count('violation', violations),
		'of',
		count('rule', rules.size),
		'in',
		count('page', pages),
	].join(' ') : 'No violations found 🎉';

	return `<p>Site summary: ${stats.trim()}</p>`;
}

/**
 * Get the page sections
 * @param {object} report
 * @param {string} queue
 * @returns {string}
 */
function get_sections(base_url, page_reports) {
	function to_section({ url, violations }) {
		const label = url.replace(base_url, '') || '/';

		return section({
			url: {
				label,
				href: url,
			},
			violations,
		});
	}

	return errors_first(page_reports).map(to_section).join('\n\t');
}

/**
 * Get the page footer
 * @param {string} timestamp
 * @param {string} cypress_version
 * @param {string} axe_version
 * @returns {string}
 */
function get_footer(timestamp, cypress_version, axe_version) {
	// TODO better date formatting
	const date_time = timestamp
		.replace(/T/, '<small>T</small>')
		.replace(/\.\d{3}Z$/, '<small>Z</small>');

	return [
		'<a href="',
		PROJECT_URL,
		'">Fruit Keg</a> | <a href="',
		CYPRESS_URL,
		`">Cypress</a> ${cypress_version} &amp; <a href="`,
		AXE_CORE_URL,
		`">axe-core</a> ${axe_version} | <time>${date_time}</time>`,
	].join('');
}

/**
 * Create the report sections and pass them to the template
 * @param {string} report cypress report data
 * @return {string}
 */
function create_axe_report({
	baseUrl: base_url,
	cypress,
	end,
	failed,
}) {
	const { axe_version, queue } = axe_report;
	const page_reports = merge_page_reports(queue);

	return template({
		emoji: favicon(failed),
		heading: get_heading(base_url),
		summary: get_summary(page_reports),
		sections: get_sections(base_url, page_reports),
		footer: get_footer(end, cypress, axe_version),
	});
}
