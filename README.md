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

Update `./cypress/support/index.js`:

```js
import "../../vendor/cy-axe.js";
import "../../vendor/cy-visit.js";
```

Update `./cypress/plugins/index.js`:

```js
const { queue, flush } = require("../../vendor/cy-axe-report");

module.exports = function (on) {
  on("task", queue);
  on("after:run", flush);
};
```
