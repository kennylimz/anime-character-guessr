/**
 * Collection of game tags
 * Add the tag categories and optional values you need here.
 * Once collected, remove the corresponding tags.
 * Work in progress.
 * Format:
 * {
 *   subjectId: 'integer',  // Game entry ID
 *   sections: [
 *     {
 *       sectionName: string,    // Tag category name
 *       type: string,           // Tag type: 'defined', 'custom', 'mixed'
 *       maxNum: integer,        // Maximum number of tags allowed
 *       values: [string, ...]   // Optional tag values
 *     }
 *   ]
 * }
 */

export const tagsFetching = [
  {
    subjectId: 194792, // 王者荣耀
    sections: [
      {
        sectionName: "Tags",
        type: "defined",
        maxNum: 2,
        values: ["Solo Lane", "Jungle", "Mid Lane", "Carry Lane", "Roaming"],
      },
    ],
  },
];
