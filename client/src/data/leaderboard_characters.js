const leaderboardCharacters = [
  {
    rank: 1,
    name: "Milk Dragon",
    nameCn: "Milk Dragon",
    image: "https://lain.bgm.tv/r/400/pic/crt/l/82/f7/165666_crt_889WX.jpg",
    link: "https://bgm.tv/character/165666",
  },
  {
    rank: 2,
    name: "Hatsune Miku",
    nameCn: "Hatsune Miku",
    image:
      "https://lain.bgm.tv/r/400/pic/crt/l/00/71/10452_crt_UusO7.jpg?r=1625248340",
    link: "https://bgm.tv/character/10452",
  },
  {
    rank: 3,
    name: "Sora Kasugano",
    nameCn: "Sora Kasugano",
    image:
      "https://lain.bgm.tv/r/400/pic/crt/l/2c/78/1152_crt_0L155.jpg?r=1625085358",
    link: "https://bgm.tv/character/1152",
  },
  {
    rank: 4,
    name: "Akari Takamatsu",
    nameCn: "Akari Takamatsu",
    image:
      "https://lain.bgm.tv/pic/crt/g/d8/94/127790_crt_Bky9e.jpg?r=1754976105",
    link: "https://bgm.tv/character/127790",
  },
  {
    rank: 5,
    name: "Elaina",
    nameCn: "Elaina",
    image:
      "https://lain.bgm.tv/pic/crt/g/35/0e/72355_crt_6Z6zM.jpg?r=1602429332",
    link: "https://bgm.tv/character/72355",
  },
  {
    rank: 6,
    name: "Kurisu Makise",
    nameCn: "Kurisu Makise",
    image:
      "https://lain.bgm.tv/pic/crt/g/f7/2a/12393_crt_SS7II.jpg?r=1531372585",
    link: "https://bgm.tv/character/12393",
  },
  {
    rank: 7,
    name: "Makoto Ito",
    nameCn: "Makoto Ito",
    image: "https://lain.bgm.tv/pic/crt/g/28/6a/422_crt_13Cbo.jpg?r=1564727287",
    link: "https://bgm.tv/character/422",
  },
  {
    rank: 8,
    name: "Satoru Gojo",
    nameCn: "Satoru Gojo",
    image:
      "https://lain.bgm.tv/pic/crt/g/12/12/74243_crt_c5h9t.jpg?r=1646562964",
    link: "https://bgm.tv/character/74243",
  },
  {
    rank: 9,
    name: "Tokai Teio",
    nameCn: "Tokai Teio",
    image: "https://lain.bgm.tv/pic/crt/g/6a/83/50578_crt_Y9JG9.jpg",
    link: "https://bgm.tv/character/50578",
  },
  {
    rank: 10,
    name: "Nao Tomori",
    nameCn: "Nao Tomori",
    image:
      "https://lain.bgm.tv/pic/crt/g/a6/39/29511_crt_4hWZh.jpg?r=1432823507",
    link: "https://bgm.tv/character/29511",
  },
  {
    rank: 11,
    name: "Violet Evergarden",
    nameCn: "Violet Evergarden",
    image:
      "https://lain.bgm.tv/pic/crt/g/77/03/37344_crt_QeHnZ.jpg?r=1515695817",
    link: "https://bgm.tv/character/37344",
  },
  {
    rank: 12,
    name: "Asuna (Yuuki Asuna)",
    nameCn: "Asuna (Yuuki Asuna)",
    image:
      "https://lain.bgm.tv/pic/crt/g/58/bd/16490_crt_SBFfb.jpg?r=1606208307",
    link: "https://bgm.tv/character/16490",
  },
  {
    rank: 13,
    name: "Shoko Toyokawa",
    nameCn: "Shoko Toyokawa",
    image:
      "https://lain.bgm.tv/pic/crt/g/ae/84/132476_crt_718yQ.jpg?r=1695456241",
    link: "https://bgm.tv/character/132476",
  },
  {
    rank: 14,
    name: "Zero Two",
    nameCn: "Zero Two",
    image:
      "https://lain.bgm.tv/pic/crt/g/3b/9a/57751_crt_3E3pC.jpg?r=1507738291",
    link: "https://bgm.tv/character/57751",
  },
  {
    rank: 15,
    name: "Mikoto Misaka",
    nameCn: "Mikoto Misaka",
    image:
      "https://lain.bgm.tv/pic/crt/g/c8/f1/3575_crt_F99OI.jpg?r=1559386543",
    link: "https://bgm.tv/character/3575",
  },
  {
    rank: 16,
    name: "Kurumi Tokisaki",
    nameCn: "时崎狂三",
    image:
      "https://lain.bgm.tv/pic/crt/g/49/da/19529_crt_61qzh.jpg?r=1457682259",
    link: "https://bgm.tv/character/19529",
  },
  {
    rank: 16,
    name: "Chihaya Aine",
    nameCn: "千早爱音",
    image: "https://lain.bgm.tv/pic/crt/g/87/3b/127791_crt_AnyE0.jpg",
    link: "https://bgm.tv/character/127791",
  },
  {
    rank: 16,
    name: "Kanade Tachibana",
    nameCn: "Kanade Tachibana",
    image: "https://lain.bgm.tv/pic/crt/g/c0/9f/10609_crt_PrsS5.jpg",
    link: "https://bgm.tv/character/10609",
  },
  {
    rank: 19,
    name: "1",
    nameCn: "No.1",
    image: "https://lain.bgm.tv/pic/crt/g/ca/af/95167_crt_77NQX.jpg",
    link: "https://bgm.tv/character/95167",
  },
  {
    rank: 20,
    name: "Kutori Nota Seniorious",
    nameCn: "Kutori Nota Seniorious",
    image:
      "https://lain.bgm.tv/pic/crt/g/4f/db/51006_crt_jjz0y.jpg?r=1505275300",
    link: "https://bgm.tv/character/51006",
  },
  {
    rank: 21,
    name: "Yanami / Hananami Anna (Yanami Anna)",
    nameCn: "Yanami / Hananami Anna (Yanami Anna)",
    image: "https://lain.bgm.tv/pic/crt/g/87/fc/111328_crt_mW5Z8.jpg",
    link: "https://bgm.tv/character/111328",
  },
  {
    rank: 21,
    name: "Aira",
    nameCn: "Aira",
    image:
      "https://lain.bgm.tv/pic/crt/g/62/6d/29362_crt_A4rOr.jpg?r=1423553804",
    link: "https://bgm.tv/character/29362",
  },
  {
    rank: 23,
    name: "Momo Ayase",
    nameCn: "Momo Ayase",
    image:
      "https://lain.bgm.tv/pic/crt/g/33/64/112127_crt_Zjpk6.jpg?r=1730807214",
    link: "https://bgm.tv/character/112127",
  },
  {
    rank: 23,
    name: "Oguri Cap",
    nameCn: "Oguri Cap",
    image: "https://lain.bgm.tv/pic/crt/g/63/95/50586_crt_Z1KIk.jpg",
    link: "https://bgm.tv/character/50586",
  },
  {
    rank: 25,
    name: "Shiro",
    nameCn: "Shiro",
    image:
      "https://lain.bgm.tv/pic/crt/g/2e/28/23425_crt_weYwF.jpg?r=1398960024",
    link: "https://bgm.tv/character/23425",
  },
  {
    rank: 26,
    name: "Vladilena Milize",
    nameCn: "Vladilena Milize",
    image:
      "https://lain.bgm.tv/pic/crt/g/18/cd/57715_crt_F2zF7.jpg?r=1647963497",
    link: "https://bgm.tv/character/57715",
  },
  {
    rank: 27,
    name: "Sakamoto",
    nameCn: "Sakamoto",
    image: "https://lain.bgm.tv/pic/crt/g/5b/0f/31219_crt_Jar4R.jpg",
    link: "https://bgm.tv/character/31219",
  },
  {
    rank: 28,
    name: "Holo",
    nameCn: "Holo",
    image:
      "https://lain.bgm.tv/pic/crt/g/22/bf/1976_crt_77SyV.jpg?r=1647212485",
    link: "https://bgm.tv/character/1976",
  },
  {
    rank: 28,
    name: "Taiga Aisaka",
    nameCn: "Taiga Aisaka",
    image:
      "https://lain.bgm.tv/pic/crt/g/b7/a0/1762_crt_wgi44.jpg?r=1497968019",
    link: "https://bgm.tv/character/1762",
  },
  {
    rank: 28,
    name: "Inori Yuzuriha",
    nameCn: "Inori Yuzuriha",
    image:
      "https://lain.bgm.tv/pic/crt/g/4a/a2/13178_crt_1IGg0.jpg?r=1417850545",
    link: "https://bgm.tv/character/13178",
  },
];

export default leaderboardCharacters;
