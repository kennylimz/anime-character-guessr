[中文](README.md) | [English](README.en.md)

## 📖 Overview
Anime Character Guessr — have some fun guessing anime characters!

- A game where you guess anime characters. Best experienced on a desktop browser.
- Inspired by [BLAST.tv](https://blast.tv/counter-strike), data sourced from [Bangumi](https://bgm.tv/).
- We have a [Translation Project](https://github.com/vertiKarl/anime-character-guessr-english) by vertiKarl: [Weblink](https://vertikarl.github.io/anime-character-guessr-english)

## 📦 How to Run

### 1. Run locally with npm

In both the `client` and `server` directories, run:
```bash
npm install
npm run dev
```

### 2. Run with Docker

Create an `.env` file in the project root:
```env
DOMAIN_NAME=http://[your IP]

MONGODB_URI=mongodb://mongo:27017/tags

CLIENT_INTERNAL_PORT=80
SERVER_INTERNAL_PORT=3000
NGINX_EXTERNAL_PORT=80

AES_SECRET=YourSuperSecretKeyChangeMe

SERVER_URL=http://[your IP]:3000
```

Start everything using the provided `docker-compose` file:
```bash
docker-compose up --build
```

Tear down containers:
```bash
docker-compose down
```

## 🎮 How to Play

- Guess a hidden anime character. Search for a character and make a guess.
- After each guess, you’ll get information about the character you guessed.
- Green highlight: correct or very close; Yellow highlight: somewhat close.
- "↑": guess higher; "↓": guess lower.

## ✨ Contributing Tags

- Please note when submitting PRs for external tags!
- Place assets in organized folders under `client/public/assets`.
- Put tag data into `client/public/data/extra_tags`. The maintainer will review and import.
- New tags not loading locally? Ensure the entry IDs are added to `./client/data/extra_tag_subjects.js`.


