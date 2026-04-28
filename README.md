# Eve Pingboard
Tool for Eve Online, combining and extending the functionality of Brave's [timer board](https://github.com/bravecollective/neucore-timerboard) and [ping tool](https://github.com/bravecollective/ping-app).
Designed for use with [Neucore](https://github.com/bravecollective/neucore).

## Running Eve Pingboard
Eve Pingboard is split in two parts:
- Frontend: web application written using React
- Backend: Node.js server taking care of logging in users and providing the API used by the frontend

No matter how you plan on running Pingboard, you at least need to create a new Eve Online Application and a running Neucore instance.

### Create a new Eve Online Application
1. Log into https://developers.eveonline.com/applications
2. Create a new application:
    - Choose a name and description to your liking
    - Leave the Connection Type as "Authentication Only"
    - The Callback URL must match the domain that you're planning on running Eve Pingboard on and its path must equal "/auth/callback", e.g. "https://example.com/auth/callback"
3. Click "Create Application" and write down the application's client ID and secret key.
   You'll need them when configuring the backend server.

### Create a new Slack Application
1.  Go to https://api.slack.com/apps
2.  Click the "Create New App" button
3.  Select "From Scratch"
4.  Enter a name for your app (this will also be the name displayed as the sender of pings on Slack)
5.  Select the workspace you want to use the App in (you'll need to be logged into the workspace first for this to work)
6.  Click "Create App"
7.  In the menu on the left, select "OAuth & Permissions"
8.  Scroll down to the "Scopes" section and under "Bot Token Scopes", click "Add an OAuth Scope"
9.  Add the `channels:read`, `chat:write` and `chat:write.public` scopes.
    Those are required to list all public channels, list private channels the app is invited to and to send posts to those channels.
10. Scroll back up and click the "Install to Workspace" button.
    This will take you to your workspace and asks you to grant the scopes you just configured.
11. Click "Allow"
12. You are redirected back to the "OAuth & Permissions" page of your App. Write down the "Bot User OAuth Token" (starting with `xoxb-`).

### Create a new Discord Application
1. Go to https://discord.com/developers/applications
2. Click the "New Application" button
3. Enter a name for your application and click "Create"
4. Click the "Bot" tab on the left
5. Click "Add Bot" and confirm the dialog
6. Click the "Copy" button next to the "Token" field to copy the bot's token. You'll need it when configuring the backend server.
7. Click the "OAuth2" tab on the left
8. Click "URL Generator" and select the "bot" scope
9. Select `Administrator` as the required permission for the bot (TODO: figure out minimal permissions required). 
10. Copy the generated URL and open it in a new tab. You'll be asked to authorize the bot to access your Discord account. 
11. Copy the generated invite URL and use it to invite the bot to your server. 
12. In your discord server, right-click on the server name and select the "Copy ID" button.

### Create a Neucore Application
1. As an admin, log into your Neucore instance
2. Click the Plus icon on the Administration → Apps page
3. Enter a name for your Eve Pingboard app and click "Create"
4. Under the Managers tab, add all characters that should be able to change the application secret.
   If in doubt, just add yourself.
5. Under the Groups tab, add all groups that you want the backend to use for access control
    - if you don't have any groups set up, or if you want to add new ones, you can manage them on the Administration → Groups page
6. Under the Roles tab, add the `app-groups` role
7. As one of the app's managers you just added, go to Management → Apps and select the Pingboard application you just created from the list on the left
8. Click "Generate new secret" and write down the generated secret.
   You will not be able to see it again once you leave the page.
9. Also write down the numerical ID of your Neucore app

### Prepare the Database
The backend contains scripts for creating the necessary database tables and for seeding them with data.
If you have node.js and yarn set up on your machine, you can run those scripts using the following commands.

Note: if you're using the example `docker-compose.yml` file as described in the next section, you'll want to run these commands *after* you ran `docker-compose up`, as the example includes a database instance.
Use `mysql://pingboard:pingboard@localhost/pingboard` as the connection string in that case.

```sh
DB_URL="your database connection string" yarn workspace @ping-board/backend migrate:latest
DB_URL="your database connection string" yarn workspace @ping-board/backend seed
```

### Run Eve Pingboard

#### Using Docker
Check out the `docker-compose.yml` file for an example on how to run Pingboard with Docker.

The example uses [traefik](https://traefik.io/traefik/) as a reverse proxy.
It routes the `/api` and `/auth` requests to the backend.
Everything else is sent to the frontend.

Note that the `docker-compose.yml` does not include a Neucore service.
You'll have to set it up separately.
Check out [the Neucore documentation](https://github.com/bravecollective/neucore#getting-started) on how to do this.

To configure and launch the example, you can use the following command.
Replace all values with your configuration.
```sh
SSO_CLIENT_ID="the Eve application's client ID" \
SSO_CLIENT_SECRET="the Eve application's secret key" \
SSO_REDIRECT_URI="the Eve application's callback URL" \
SLACK_TOKEN="the Slack App's Bot User OAuth Token" \
DISCORD_TOKEN="Discord bot token" \
DISCORD_GUILD_ID="Discord guild ID" \
DISCORD_API_BASE_URL="(optional) Discord API base URL" \
CORE_URL="the URL where your Neucore instance can be reached by the backend" \
CORE_APP_ID="the Neucore app's numerical ID" \
CORE_APP_TOKEN="the Neucore app's secret token" \
GROUPS_READ_EVENTS="a space-separated list of Neucore groups who's members should be granted read access to events/timers" \
GROUPS_WRITE_EVENTS="a space-separated list of Neucore groups who's members should be granted write access to events/timers" \
docker-compose up
```

##### Running in production
The example `docker-compose.yml` is not fit to run in production:
- You might want to consider using a non-dockerized database.
  In that case, set the `DB_URL` environment variable of the backend service to a connection string pointing to your database instance.
- Set the `COOKIE_KEY` environment variable of the backend service to an adequately long random string.
- The configuration of the traefik service publicly exposes its interface without requiring authentication.
  Check out the [traefik documentation](https://doc.traefik.io/traefik/) or consult your favorite search engine on how to change that.

#### Without Docker
For running without Docker, you need to set up a reverse proxy for serving the frontend files and for routing all requests to `/auth` and `/api` to the Node.js backend server.

##### Running the Backend
The built version of the backend includes all required dependencies, so you only need Node.js (≥14) installed on your system.
To configure and start the backend server, download [the latest backend release](https://github.com/cmd-johnson/eve-pingboard/releases), unzip the contents and run the following command:

```sh
NODE_ENV="production" \
COOKIE_KEY="an adequately long random string for signing the session cookie" \
DB_URL="your database connection string" \
SSO_CLIENT_ID="the Eve application's client ID" \
SSO_CLIENT_SECRET="the Eve application's secret key" \
SSO_REDIRECT_URI="the Eve application's callback URL" \
SLACK_TOKEN="the Slack App's Bot User OAuth Token" \
DISCORD_TOKEN="Discord bot token" \
DISCORD_GUILD_ID="Discord guild ID" \
DISCORD_API_BASE_URL="(optional) Discord API base URL" \
CORE_URL="the URL where your Neucore instance can be reached by the backend" \
CORE_APP_ID="the Neucore app's numerical ID" \
CORE_APP_TOKEN="the Neucore app's secret token" \
GROUPS_READ_EVENTS="a space-separated list of Neucore groups who's members should be granted read access to events/timers" \
GROUPS_WRITE_EVENTS="a space-separated list of Neucore groups who's members should be granted write access to events/timers" \
node -r ./.pnp.cjs packages/backend/build/index.js
```

The backend server listens for connections on port 3000 by default.
You can change this by specifying the `PORT` environment variable.
Remember to update the port used in yout revere proxy configuration as well.

##### Serving the Frontend and Proxying the Backend
If you're using nginx, you could use or adapt the following configuration.
It passes through all requests to `/auth/*` and `/api/*` to the Node.js backend server and takes care of serving the frontend files.
This configuration expects the built frontend files to be located in `/usr/share/nginx/pingboard`.

```nginx
#/etc/nginx/nginx.conf
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    server {
        include mime.types;
        listen 80;
        location / {
            root /usr/share/nginx/pingboard;
            index index.html;
            try_files $uri $uri/ /index.html =404;
        }

        location ~ /(auth|api) {
            proxy_pass http://localhost:3000;
        }
    }
}
```
