# Eve Pingboard
An application combining and extending the functionality of the [Ping App](https://github.com/bravecollective/ping-app) and [Timerboard](https://github.com/bravecollective/neucore-timerboard), built on top of [Neucore](https://github.com/bravecollective/neucore).

## Building and Running the Application
### Dependencies
The only dependencies to run the application are [Node.js](https://nodejs.org/) and [yarn](https://yarnpkg.com/).

### Development
This app was build with [VS Code](https://code.visualstudio.com/).
It is recommended you install the [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
(for code style hints inside the editor) and [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs)
(for support of [yarn's PnP installation strategy](https://yarnpkg.com/features/pnp)) extensions.
When opening the project, Code should ask if you want to install the recommended extensions automatically.

To install all required dev dependencies, run `yarn install`.
Afterwards, run `yarn dev` to start the application in dev mode (which includes automatic restarts on code changes).

You can run code style checks with `yarn lint`. To fix automatically fixable issues, run `yarn lint:fix`.

### Production
For running in production, run these commands:
```sh
# Install all dev dependencies
yarn install
# Build the project
yarn build
# Run the application
yarn start
```

To clean the built `.js` files, run `yarn clean`.

### Docker
Building and running the application as a Docker image is as simple as running
```sh
docker build --tag pingboard:latest -f Dockerfile ../../ 
docker run --rm -it -p3000:3000 pingboard:latest
```
(Note that the Docker build context has to be the root of the project)

You can then access the application on http://localhost:3000/.
To stop the application, press `ctrl + c`.

## Configuration
The application can be configured using the following environment variables.
Default values are specified if available.
If the variable doesn't have default value, you *must* set it or the application will fail to launch, except when stated otherwise.

### HTTP Server configuration
```sh
# The environment the application runs in. Should be either "development" or "production".
# All other values are assumed to be equal to "production" as well.
NODE_ENV=production
# The port for the HTTP server to listen on
PORT=3000
# Key to use to sign and verify session cookies
# Is not required to be set when NODE_ENV is "development".
COOKIE_KEY
# Connection string for connecting with the SQL database (MariaDB/MySQL)
DB_URL
# How long a new session should be valid for (in seconds).
SESSION_TIMEOUT=604800
# Interval in seconds at which an active session should be extended to SESSION_TIMEOUT again.
# If you don't want to extend sessions at all, you may set this to -1.
SESSION_REFRESH_INTERVAL=60
```

### Eve SSO configuration
As obtained via https://developers.eveonline.com/applications
```sh
# The Client ID of the registered Eve application
SSO_CLIENT_ID
# The Client Secret of the registered Eve application
SSO_CLIENT_SECRET
# The redirect URI/Callback URL of the registerd Eve application
# The application listenes for OAuth2 callbacks on /auth/callback.
# During development, this is usually http://localhost:3000/auth/callback, but
# if you mount the application behind a reverse proxy and under a subpath, it
# may also be something like https://example.com/pingboard/auth/callback.
SSO_REDIRECT_URI

# The Eve OAuth2 Token URI (defaults to https://login.eveonline.com/v2/oauth/token)
#SSO_TOKEN_URI
# The Eve OAuth2 Authorization URI (defaults to https://login.eveonline.com/v2/oauth/authorize/)
#SSO_AUTHORIZATION_URI
```

### Slack configuration
As obtained via https://api.slack.com/apps
```sh
# The Slack App's Bot User OAuth Token (starts with xoxb-)
SLACK_TOKEN

# The base URL of Slack's API (defaults to https://slack.com/api/)
#SLACK_API_BASE_URL
```

### Discord configuration
as obtained via https://discord.com/developers/applications
```sh
# Discord Bot Token
DISCORD_TOKEN
# The ID of the Discord server to post events to (remains as backward compatibility for single server setups)
DISCORD_GUILD_ID
# A list of space-separated Discord server IDs to post events to
DISCORD_GUILD_IDS
# Does not need to be set, but can be used to override the default Discord API base URL
DISCORD_API_BASE_URL
```
**Note**: Discord guild IDs can be obtained by rightclicking a server icon in Discord with developer mode enabled
and selecting "Copy Server ID". \
Both the `DISCORD_GUILD_ID` and `DISCORD_GUILD_IDS` are combined and deduplicated to form the final server list.


### Neucore configuration
```sh
# The base URL of the Neucore API to use (e.g. https://account.bravecollective.com/api)
CORE_URL
# The ID of the Neucore application (as obtained from Neucore)
CORE_APP_ID
# The Secret of the Neucore application (as obtained from Neucore)
CORE_APP_TOKEN
# Neucore groups will be cached between requests. This value controls how long the cache 
# hould be valid for in seconds. Groups will always be refreshed on mutation requests.
CORE_GROUP_REFRESH_INTERVAL=60
```

### User Permission/Role configuration
```sh
# A list of space-separated neucore groups that are allowed to read events/timers
GROUPS_READ_EVENTS
# A list of space-separated neucore groups that are allowed to add/edit/delete events/timers
GROUPS_WRITE_EVENTS
```

## Database setup
The application supports both MariaDB and MySQL (via [mysql2](https://www.npmjs.com/package/mysql2) and [knex.js](https://www.npmjs.com/package/knex)).

During development, you can use `docker-compose -f docker-compose.dev.yml up` (run from the project's root directory) to start a local MariaDB instance.
The database, user and password are all `pingboard`.

**Note**: The following `yarn migrate:*` and `yarn seed` commands require that you specify the database connection string using the `DB_URL` environment variable!

### Migrations
Before starting the application, you should make sure the database schema is up to date.
To run all database migrations, use `yarn migrate:latest`.
You can also use `yarn migrate:up` to run migrations one by one, and `yarn migrate:down` to roll back the latest migration.

### Database Seeding
Additional to running the database migrations, you should also seed the database before  first using the application using `yarn seed`.

If you only want to run certain seed scripts from the `seeds` directory, you can use `yarn seed --specific [seedFileName]` (e.g. `yarn seed --specific solar-systems.ts`).
