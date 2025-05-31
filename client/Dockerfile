# --- Build Stage ---
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Inject build-time env variables if needed (ensure they are prefixed with VITE_)
 ARG VITE_SERVER_URL
 ENV VITE_SERVER_URL=$VITE_SERVER_URL
 ARG VITE_DB_SERVER_URL
 ENV VITE_DB_SERVER_URL=$VITE_DB_SERVER_URL
 ARG VITE_AES_SECRET
 ENV VITE_AES_SECRET=$VITE_AES_SECRET
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (Nginx default)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]