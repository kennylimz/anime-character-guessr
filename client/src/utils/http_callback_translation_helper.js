import fs from "fs";
import http from "http";

const PORT = 4000;

const map = {};

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    const tags = JSON.parse(body);
    tags.forEach((tag) => {
      console.log(tag.name);
      map[tag.name] = null;
    });

    res.writeHead(200);
    res.end();
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const regex = /[\u4E00-\u9FFF]+/g;

process.on("SIGINT", () => {
  console.log("Received SIGINT, saving to disk...");
  let object = JSON.parse(fs.readFileSync("./tag_list.json"));
  for (let key in map) {
    if (!key.match(regex)) continue;

    if (!object[key] || object[key] === null) {
      console.log("Adding key", key);
      object[key] = map[key];
    }
  }

  fs.writeFileSync("./tag_list.json", JSON.stringify(object, null, 2));
  console.log("Finished saving, bye!");
  process.exit(0);
});
