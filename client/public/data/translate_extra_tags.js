import fs from "fs";
const REGION_REGEX = /("|')?[\u4e00-\u9fff]+("|')/g;
const CONTENT_REGEX = /[^\u4e00-\u9fff]/g;

/**
 * This tries to fetch all chinese characters without breaking layout
 * and initialize a table with all values being null, so you can
 * externally translate the words.
 */
function generateTranslationTable() {
  const dir = fs.readdirSync("./extra_tags");

  const map = {};

  dir.forEach((file) => {
    const content = fs.readFileSync("./extra_tags/" + file).toString();

    content.match(REGION_REGEX).forEach((token) => {
      token = token.replaceAll(CONTENT_REGEX, "");
      if (token) map[token] = null;
    });
  });

  const data = JSON.stringify(map, null, 2);

  console.log(map);

  fs.writeFileSync("./translation_table.json", data);
}

/**
 * When you are done translating, just inject the translations back into the files!
 */
function injectTranslations() {
  const content = fs.readFileSync("./translation_table.json");
  const object = JSON.parse(content);

  const dir = fs.readdirSync("./extra_tags");

  dir.forEach((file) => {
    let content = fs.readFileSync("./extra_tags/" + file).toString();
    content.match(REGION_REGEX).forEach((token) => {
      console.log(token, object[token.replaceAll(CONTENT_REGEX, "")]);
      const newToken = token.replaceAll(
        token.replaceAll(CONTENT_REGEX, ""),
        object[token.replaceAll(CONTENT_REGEX, "")]
      );

      content = content.replaceAll(token, newToken);
    });

    fs.writeFileSync("./extra_tags/" + file, content);
  });
}

//injectTranslations();
