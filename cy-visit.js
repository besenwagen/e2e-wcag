/* global Cypress */

/**
 * Credentials are passed at runtime with the environment variables
 * CYPRESS_USERNAME and CYPRESS_PASSWORD and mapped to the
 * `auth` option of the `visit` command
 */
const credentials = ['username', 'password'];

const { assign } = Object;

/**
 * Get a Cypress environment variable value
 * @param {string} name
 * @returns {string}
 */
const value = name => Cypress.env(name.toUpperCase());

/**
 * Map names to values
 * @param {Object} auth
 * @param {string} key
 * @returns {Object}
 */
const toAuth = (auth, key) => assign(auth, {
	[key]: value(key),
});

/**
 * Create auth options from environment variables
 * @param  {...string} properties
 * @returns {Object}
 */
const getEnv = properties => properties.reduce(toAuth, {});

/**
 * Get the auth options or merge them with passed options
 * @param {Object} [options]
 * @returns {Object}
 */
function getOptions(options) {
	const auth = {
		auth: getEnv(credentials),
	};

	if (options) {
		return assign(options, auth);
	}

	return auth;
}

/**
 * Add HTTP basic authentication to all requests
 * @see https://docs.cypress.io/api/commands/visit#Add-basic-auth-headers
 * @param {function} original
 * @param {string} url
 * @param {Object} [options]
 * @returns {function}
 */
const visit = (original, url, options) => original(url, getOptions(options));

if (credentials.every(value)) {
	Cypress.Commands.overwrite('visit', visit);
}
