import fs from "fs";

// 1. Read the file
const wodehouse = fs.readFileSync("wodehouse.txt", "utf-8");

// 2. Split into words
function stem(word: string) {
  word = word.toLowerCase().replaceAll(/[^a-z]/g, "");
  if (word.endsWith("ing") && word.length > 4) {
    word = word.slice(0, -3);
  } else if (word.endsWith("ed") && word.length > 3) {
    word = word.slice(0, -2);
  } else if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) {
    word = word.slice(0, -1);
  } else if (word.endsWith("ly") && word.length > 3) {
    word = word.slice(0, -2);
  } else if (word.endsWith("er") && word.length > 4) {
    word = word.slice(0, -2);
  } else if (word.endsWith("est") && word.length > 4) {
    word = word.slice(0, -3);
  }
  return word;
}

function toWords(text: string): string[] {
  return text
    .split(" ")
    .map(stem)
    .filter((w) => w);
}

// 3. Get exact counts
function countWords(words: string[]): { [w: string]: number } {
  const result: { [w: string]: number } = {};
  for (const word of words) {
    result[word] = (result[word] || 0) + 1;
  }
  return result;
}

const exactCounts = countWords(toWords(wodehouse));

console.log("> exactCounts", exactCounts);

// 4. Create a sketch
type Sketch = {
  rows: number;
  columns: number;
  buckets: Uint32Array;
};

function createSketch({
  rows,
  columns,
}: {
  rows: number;
  columns: number;
}): Sketch {
  return { rows, columns, buckets: new Uint32Array(rows * columns) };
}

const sketch = createSketch({ rows: 2, columns: 5 });

console.log("created:", sketch);

function add({ rows, columns, buckets }: Sketch, word: string) {
  for (let hashIdx = 0; hashIdx < rows; hashIdx++) {
    const hash = Bun.hash.xxHash3(word, BigInt(hashIdx));
    const columnIdx = Number(hash % BigInt(columns));
    const globalIdx = hashIdx * columns + columnIdx;
    buckets[globalIdx]!++;
  }
}

add(sketch, "castle");
console.log("after castle", sketch);

function check({ rows, columns, buckets }: Sketch, word: string): number {
  let approx = Infinity;
  for (let hashIdx = 0; hashIdx < rows; hashIdx++) {
    const hash = Bun.hash.xxHash3(word, BigInt(hashIdx));
    const columnIdx = Number(hash % BigInt(columns));
    const globalIdx = hashIdx * columns + columnIdx;
    approx = Math.min(approx, buckets[globalIdx]!);
  }
  return approx;
}

console.log("check castle", check(sketch, "castle"));
