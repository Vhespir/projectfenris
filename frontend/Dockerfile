FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev

COPY . .

EXPOSE 3000

CMD ["node_modules/.bin/vite", "--host", "--port", "3000"]
