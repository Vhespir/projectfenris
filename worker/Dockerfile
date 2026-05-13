FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

CMD ["npm", "run", "dev"]
