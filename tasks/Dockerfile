FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app files
COPY . .

# Compile TypeScript
RUN npm run build

# Expose port
EXPOSE 8080


# Run the built app
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
