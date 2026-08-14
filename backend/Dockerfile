FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "src/app.js"]
