# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖 (use --omit=dev for production)
RUN npm install --omit=dev

# 复制源代码
COPY . .

# 暴露端口 (Internal port)
EXPOSE 3000

# 启动命令 (Use start script for production)
CMD ["npm", "start"]