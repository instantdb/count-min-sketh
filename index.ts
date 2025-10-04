import fs from "fs";

// Read the file
const wodehouse = fs.readFileSync("wodehouse.txt", "utf-8");

// Split into words
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
    .split("\n")
    .flatMap((line) => line.split(" "))
    .map(stem)
    .filter((w) => w);
}

// Get exact counts
function countWords(words: string[]): { [w: string]: number } {
  const result: { [w: string]: number } = {};
  for (const word of words) {
    result[word] = (result[word] || 0) + 1;
  }
  return result;
}

const exactCounts = countWords(toWords(wodehouse));

console.log("exactCounts", exactCounts);

// Create a sketch
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

// Implement add
function add({ rows, columns, buckets }: Sketch, word: string) {
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const hash = Bun.hash.xxHash3(word, BigInt(rowIdx));
    const columnIdx = Number(hash % BigInt(columns));
    const globalIdx = rowIdx * columns + columnIdx;
    buckets[globalIdx]!++;
  }
}

add(sketch, stem("castle"));
console.log("after castle", sketch);

// Implement check
function check({ rows, columns, buckets }: Sketch, word: string): number {
  let approx = Infinity;
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const hash = Bun.hash.xxHash3(word, BigInt(rowIdx));
    const columnIdx = Number(hash % BigInt(columns));
    const globalIdx = rowIdx * columns + columnIdx;
    approx = Math.min(approx, buckets[globalIdx]!);
  }
  return approx;
}

console.log("check castle", check(sketch, stem("castle")));

// Get exact counts for _all_ of wodehouse!

const allWodehouse = fs.readFileSync("wodehouse-full.txt", "utf-8");
const allWords = toWords(allWodehouse);
const allExactCounts = countWords(allWords);

console.log("exact beetle", allExactCounts[stem("beetle")]);

// Now let's try out our sketches!

const allSketch = createSketch({ rows: 10, columns: 4000 });
for (const word of allWords) {
  add(allSketch, stem(word));
}

console.log("allSketch beetle", check(allSketch, stem("beetle")));

// Let's use errorRate and confidence

function sketchWithBounds({
  errorRate,
  confidence,
}: {
  errorRate: number;
  confidence: number;
}): Sketch {
  const columns = Math.ceil(2 / errorRate);
  const rows = Math.ceil(Math.log(1 - confidence) / Math.log(0.5));
  return createSketch({ rows, columns });
}

const withBounds = sketchWithBounds({
  errorRate: 0.0001,
  confidence: 0.99,
});

console.log("withBounds", withBounds.columns, withBounds.rows);

// Let's try compression

console.log("numBuckets", withBounds.buckets.length);

const compressed = await Bun.zstdCompress(withBounds.buckets);

console.log(
  "original size",
  withBounds.buckets.byteLength,
  "compressed size",
  compressed.byteLength,
);

// Let's create a PNG representation of our sketch

import { PNG } from "pngjs";

function createPNG({
  width,
  buffer,
}: {
  width: number;
  buffer: Buffer;
}): Buffer {
  const bytesPerPixel = 4; // RGBA
  const height = Math.ceil(buffer.length / (width * bytesPerPixel));
  const png = new PNG({
    width,
    height,
    colorType: 6, // RGBA
  });

  for (let i = 0; i < png.data.length; i++) {
    png.data[i] = buffer[i] ?? 0;
  }

  return PNG.sync.write(png);
}

const compressedSketch = await Bun.zstdCompress(allSketch.buckets);

console.log("allSketchCompressed", compressedSketch.byteLength);

fs.writeFileSync(
  "compressedSketch.png",
  createPNG({ width: 100, buffer: compressedSketch }),
);

// Let's save some results, so we can see how they look
fs.writeFileSync(
  "allExactCounts.json",
  JSON.stringify(allExactCounts, null, 2),
);

fs.writeFileSync(
  "allSketch.json",
  JSON.stringify([...allSketch.buckets], null, 2),
);
