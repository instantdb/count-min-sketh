import fs from "fs";

// 1. Read the file
const wodehouse = fs.readFileSync("wodehouse.txt", "utf-8");

// 2. Split into words
function toWords(text: string): string[] {
  return text.split(" ").map((w) => w.trim().toLowerCase());
}

// 3. Exact counts
function countWords(words: string[]): { [w: string]: number } {
  const result: { [w: string]: number } = {};
  for (const word of words) {
    result[word] = (result[word] || 0) + 1;
  }
  return result;
}

console.log("> exact counts", countWords(toWords(wodehouse)));
