FROM node:20.20.1-alpine3.22

RUN apk update && apk add postgresql postgresql-contrib sudo bash


WORKDIR /app

COPY package*.json ./

RUN npm install
COPY . .
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 5000
# RUN npm run seed
CMD ["/start.sh"]
