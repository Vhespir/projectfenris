FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["node_modules/.bin/vite", "--host", "--port", "3000"]
