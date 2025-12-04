FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080

# load instrumentation BEFORE app code
# https://docs.cloud.google.com/trace/docs/setup/nodejs-ot#config-preload
CMD ["node", "--experimental-specifier-resolution=node", "--require", "./dist/instrumentation.js", "dist/index.js"]
