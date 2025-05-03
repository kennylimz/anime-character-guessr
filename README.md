## 📖 简介
二次元笑传之猜猜呗，快来弗/灯一把吧！

- 一个猜动漫角色的游戏, 建议使用桌面端浏览器游玩。
- 灵感来源 [BLAST.tv](https://blast.tv/counter-strikle), 数据来源 [Bangumi](https://bgm.tv/)。

## 📦 运行教程

### 1. 本地 npm 运行

分别在 `client` 和 `server` 目录下执行以下命令：
```
npm install
npm run dev
```

### 2. docker 运行

在根目录下新建env文件
```env
DOMAIN_NAME=http://[你的 IP]

MONGODB_URI=mongodb://mongo:27017/tags

CLIENT_INTERNAL_PORT=80
SERVER_INTERNAL_PORT=3000
DATA_SERVER_INTERNAL_PORT=3001
NGINX_EXTERNAL_PORT=80

AES_SECRET=YourSuperSecretKeyChangeMe


SERVER_URL=http://[你的 IP]:3000
```
使用项目中的 `docker-compose` 文件一键运行：
```
docker-compose up --build
```
删除容器：
```
docker-compose down
```

## 🎮 游戏玩法

- 猜一个神秘动漫角色。搜索角色，然后做出猜测。
- 每次猜测后，你会获得你猜的角色的信息。
- 绿色高亮：正确或非常接近；黄色高亮：有点接近。
- "↑"：应该往高了猜；"↓"：应该往低了猜

## ✨ 贡献标签

- 提交外部标签PR的时候请注意！
- 素材文件分好文件夹，可以直接放到client/public/assets下。
- 标签数据请先放到最外边的external_tags/extracted_data下，作者会看一下再合并。
