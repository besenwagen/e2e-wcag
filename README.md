# `fruit-keg`

> Test automation for catching low-hanging WCAG errors with
  _Cypress_ and _axe-core_ in containerized environments.

- WCAG 2.1
    - Level A
    - Level AA
    - Level AAA

## Manual installation

Add this repository to your existing Cypress project:

```shell
git subtree add \
  --prefix vendor \
  git@github.com:besenwagen/fruit-keg.git \
  main --squash
```

Create a `reports` directory. The directory structure should now be:

- `./cypress/`
- `./reports/`
- `./vendor/`
- `./cypress.json`

Add the reporter plugin to your Cypress configuration file:

```js
const { defineConfig } = require('cypress');
const { queue, flush } = require('./vendor/cy-axe-report');

module.exports = defineConfig({
	e2e: {
		setupNodeEvents(on) {
			on('task', queue);
			on('after:run', flush);
		},
		// your other e2e settings
	},
});
```

If you use HTTP basic access authentication for your staging server,
you can provide credentials with the environment variables
`CYPRESS_USERNAME` and `CYPRESS_PASSWORD` and add the following to
`./cypress/support/e2e.js`:

```js
import "../../vendor/cy-visit.js";
```

Note: without the environment variables, that import does nothing.
