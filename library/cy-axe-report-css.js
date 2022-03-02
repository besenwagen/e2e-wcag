/* global module */

module.exports = /* css */ `

:root {
	--primary-color: #ED436A;
	--dimmed-background: #e5e0de;
	--pass-color: #008800;
	--fail-color: #cc0000;
}

body {
	margin: 0;
	padding: 0;
	color: #000;
	background: var(--dimmed-background);
	font: 1.1em/1.5 sans-serif;
}

h1,
footer {
	padding: 0.75em 2em;
	box-shadow: 0 0 1.5em #aaa;
	color: #333;
	background: #fff;
}

h1 {
	margin: 0;
	text-align: center;
	font-weight: normal;
	font-size: 1em;
}

h1 code {
	white-space: nowrap;
	font-weight: bold;
}

footer {
	text-align: center;
}

footer time {
	display: inline-flex;
	align-items: center;
}

footer small {
	display: inline-block;
	box-sizing: border-box;
	width: 1.5em;
	margin: 0 0.2em;
	box-shadow: inset 0 0 0.25em #999 ;
	background: var(--dimmed-background);
	text-align: center;
	font-size: 0.6em;
}

main {
	padding: 1.5em 2em;
}
main > p:first-child {
	margin-top: 0;
	text-align: center;
}

h2 {
	position: relative;
	margin: 0;
	font-size: 1em;
}

h2 a[href] {
	font-weight: normal;
}

h2 code {
	font-weight: bold;
}

h2.pass .tag {
	color: #fff;
	background: var(--pass-color);
}

h2.pass a[href] {
	border-color: var(--pass-color);
	color: var(--pass-color);
	background: transparent;
}


h2.fail .tag {
	color: #fff;
	background: var(--fail-color);
}

h2.fail a[href] {
	border-color: var(--fail-color);
	color: var(--fail-color);
	background: transparent;
}

h3 {
	margin: 0 -2em 0 -3em;
	border-top: 2px solid #d4d0cd;
	padding: 1.5em 2em 0 3em;
	font-size: 1em;
}

h3 strong {
	color: var(--fail-color);
	background: transparent;
}

p {
	margin: 1.5em 0;
}

h1 + p,
h2 + p,
h3 + p {
	font-style: italic;
}

ol {
	margin: 1.5em 0;
	padding: 0;
}

ol > li::marker {
	font-weight: bold;
}

ol > li + li {
	margin-top: 1.5em;
}

ul {
	margin: 0 0 0 0.85em;
	padding: 0;
}

summary {
	cursor: pointer;
}

main > section {
	max-width: 56em;
	margin: 1.5em auto;
	padding: 1.5em 2em 1.5em 3em;
	box-shadow: 0 0 1.5em #aaa;
	color: #333;
	background: #fff;
}

fieldset {
	color: #333;
	background: #f8f8f8;
	margin: 0.75em 0;
	border: 2px solid #bbb;
	border-radius: 5px 5px 0 5px;
	padding: 0;
}

fieldset:focus-within {
	border-color: #000;
}

fieldset:focus-within textarea {
	outline: 2px solid transparent;
}

legend {
	margin: 0 0 0 0.5em;
	padding: 0 0.3em;
	font-weight: bold;
}

textarea {
	display: block;
	box-sizing: border-box;
	width: 100%;
	height: 2.2em;
	min-height: 2.2em;
	resize: vertical;
	margin: 0;
	border: none;
	border-radius: 5px 5px 0 5px;
	padding: 1px 1em;
	color: inherit;
	background: transparent;
}

pre {
	box-sizing: border-box;
	width: 100%;
	overflow-x: auto;
	margin: 0;
	border: 1px dashed #ccc;
	box-shadow: inset 0 0 1em #eee;
	padding: 0.5em 1em;
	color: #333;
	background: #fcfcfc;
	font: inherit;
}

code,
textarea,
.tag  {
	font: 0.85em/1.5 Menlo, monospace;
}

a[href] {
	border-bottom: 1px solid #000;
	color: #000;
	background: transparent;
	text-decoration: none;
}

a[href].tag {
	border: none;
	color: #eee;
	background: #333;
}

h2 .tag {
	margin-right: 0.5em;
}

h3 .tag {
	margin-left:0.5em;
}

.tag {
	/* prevent FF line break for padding-left area */
	display: inline-block;
	margin: 0;
	padding: 0.2em 0.75em;
	border-radius: 0.5em;
	white-space: nowrap;
	text-transform: uppercase;
}

a[href]:focus-visible,
summary:focus-visible {
	outline: 2px solid #000;
	outline-offset: 2px;
	border-bottom: none;
}

`;
