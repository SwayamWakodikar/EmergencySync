FROM node:20.20.1-alpine3.22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 10000

CMD ["npm", "run", "render-start"]
