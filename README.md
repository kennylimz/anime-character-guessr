## 🌎 Translation Project

This repository focuses on translating the, originally chinese, frontend for the anime-character-guessr game made by the legend @kennylimz - [original project](https://github.com/kennylimz/anime-character-guessr/tree/main/client/src/components)

It is hosted on github pages and free to use for everyone!
Check it out here: https://vertikarl.github.io/anime-character-guessr-english/

Original readme (translated to english) attached below:

## 📖 Introduction

Guess the Anime Character – come and give it a try!

- A game to guess anime characters, best played on a desktop browser.
- Inspired by [BLAST.tv](https://blast.tv/counter-strikle), data sourced from [Bangumi](https://bgm.tv/)。
- Player group：467740403
- Developer group：894333602

## 📦 How to Run

### 1. Run locally with npm

Run the following commands in both the `client` and `server` directories：

```
npm install
npm run dev
```

### 2. Run with Docker

Create a new env file in the root directory:

```env
DOMAIN_NAME=http://[your IP]

MONGODB_URI=mongodb://mongo:27017/tags

CLIENT_INTERNAL_PORT=80
SERVER_INTERNAL_PORT=3000
NGINX_EXTERNAL_PORT=80

AES_SECRET=YourSuperSecretKeyChangeMe

SERVER_URL=http://[your IP]:3000
```

Run with the included `docker-compose` file：

```
docker-compose up --build
```

Remove containers:

```
docker-compose down
```

## 🎮 How to Play

- Guess a mysterious anime character. Search for a character, then make a guess.
- After each guess, you’ll get information about the character you picked.
- Green highlight: correct or very close; Yellow highlight: somewhat close.
- "↑": guess higher; "↓": guess lower.

## ✨ Contributing Tags

- Be careful when submitting external tag PRs!
- Organize asset files into folders and place them under client/public/assets.
- Tag data can be placed under client/public/data/extra_tags; the author will review before importing.
- Testing new tags locally but they don’t show up? Check if you added the entry ID to ./client/data/extra_tag_subjects.js.
