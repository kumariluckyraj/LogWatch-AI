FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV WATCHPACK_POLLING=true
EXPOSE 3000
CMD ["npm", "start"]
