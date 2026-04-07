FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gdal-bin && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]