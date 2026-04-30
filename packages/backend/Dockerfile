# Image that is only used to build the application
FROM node:20-alpine as build
WORKDIR /app
# Copy files in the order of least changed to most often changed to reduce
# number of layers to build when changing something
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY tsconfig.json ./
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/backend/tsconfig.json ./packages/backend/
COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/backend/package.json ./packages/backend/
COPY yarn.lock ./
# Install all dependencies (including devDependencies)
RUN yarn workspaces focus @ping-board/backend
# The source code is copied after installing the dependencies so we don't
# run the install process every time we change something in the code without
# touching the dependencies
COPY packages/common packages/common
COPY packages/backend packages/backend
RUN yarn workspace @ping-board/backend build


# This is the actual application image
FROM node:20-alpine
RUN adduser -D app
WORKDIR /app
RUN chown app /app
USER app
# Copy files in the order of least changed to most often changed to reduce
# number of layers to build when changing something
COPY .yarnrc.yml ./
COPY --chown=app .yarn ./.yarn
COPY tsconfig.json ./
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/backend/tsconfig.json ./packages/backend/
COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/backend/package.json ./packages/backend/
COPY yarn.lock ./
# Only install dependencies used in production (exclude devDependencies)
RUN yarn workspaces focus --production @ping-board/backend
# The built application code is copied after installing the dependencies so we
# don't run the install process every time we change something in the code
# without touching the dependencies
COPY --from=build /app/packages/common/build ./packages/common/build
COPY --from=build /app/packages/backend/build ./packages/backend/build
CMD ["node", "-r", "./.pnp.cjs", "./packages/backend/build/index.js"]
