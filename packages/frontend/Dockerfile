# Image that is only used to build the React application
FROM node:20-alpine as build
WORKDIR /app
# Copy files in the order of least changed to most often changed to reduce
# number of layers to build when changing something
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY tsconfig.json ./
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/frontend/tsconfig.json packages/frontend/.yarnrc.yml ./packages/frontend/
COPY .eslintrc.json ./
COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/frontend/package.json ./packages/frontend/
COPY yarn.lock ./
# Install all dependencies
RUN yarn workspaces focus ping-board @ping-board/frontend
# The source code is copied after installing the dependencies so we don't
# run the install process every time we change something in the code without
# touching the dependencies
COPY packages/common packages/common
COPY packages/frontend packages/frontend
RUN yarn workspace @ping-board/frontend build


# Image for serving the built files
FROM nginx:1.21-alpine
# Copy nginx configuration
COPY packages/frontend/.docker/nginx.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
# Remove default files
RUN rm -rf ./*
# Copy output files of the build step
COPY --from=build /app/packages/frontend/build .
CMD ["nginx", "-g", "daemon off;"]
