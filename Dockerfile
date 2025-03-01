# Use an official Node.js runtime as a parent image
FROM node:21.6.1-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
# Install curl for wait-for-it
RUN apk add --no-cache curl

# Install bash in the Alpine image
RUN apk add --no-cache bash

# Expose port 5006 for the Node.js server
EXPOSE 5006

COPY . .

# Add wait-for-it script to the container
COPY ./wait-for-it.sh /usr/src/app/wait-for-it.sh
RUN chmod +x /usr/src/app/wait-for-it.sh

# Install dependencies, including sequelize and sequelize-cli
RUN npm install && npm install -g sequelize-cli

# Ensure .env.test is present
# (Assuming it's already copied with COPY . .)

# Run migrations and start the server using a shell
#CMD ["sh", "-c", "./wait-for-it.sh 45.90.58.22:5432 -- npx sequelize-cli db:migrate --config ./config/config.js && npm run start"]
