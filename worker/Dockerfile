FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install -g npm@latest --no-audit --no-fund && npm install --no-audit --no-fund

COPY . .

CMD ["npm", "run", "dev"]
