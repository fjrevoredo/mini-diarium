import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const pdfModule = ts.transpileModule(
  readFileSync(resolve("src/lib/pdf.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

test("raster-derived PDF boundary does not intersect rendered text", async ({
  page,
}) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      #content {
        position: absolute;
        width: 650px;
        background: white;
        font: 16px/1.6 Georgia, serif;
      }
      p { margin: 8px 0; }
    </style>
    <div id="content">
      ${Array.from(
        { length: 30 },
        (_, index) =>
          `<p>Paragraph ${index}: ${"rendered words ".repeat(35)}</p>`,
      ).join("")}
    </div>
  `);
  await page.addScriptTag({
    type: "module",
    content: `${pdfModule}\nwindow.__findSafeRasterSplit = findSafeRasterSplit;`,
  });
  await page.addScriptTag({
    path: resolve("node_modules/html2canvas/dist/html2canvas.min.js"),
  });

  const result = await page.evaluate(async () => {
    const content = document.querySelector<HTMLElement>("#content")!;
    const candidate = await (
      window as typeof window & {
        html2canvas: (
          element: HTMLElement,
          options: Record<string, unknown>,
        ) => Promise<HTMLCanvasElement>;
      }
    ).html2canvas(content, {
      scale: 2,
      logging: false,
      width: 650,
      height: 930,
    });
    const context = candidate.getContext("2d")!;
    const findSafeRasterSplit = (
      window as typeof window & {
        __findSafeRasterSplit: (
          pixels: Uint8ClampedArray,
          width: number,
          height: number,
          minRow: number,
          forbiddenRows: [],
        ) => number | undefined;
      }
    ).__findSafeRasterSplit;
    const splitRow = findSafeRasterSplit(
      context.getImageData(0, 0, candidate.width, candidate.height).data,
      candidate.width,
      candidate.height,
      candidate.height / 2,
      [],
    )!;
    const boundaryPixels = context.getImageData(
      0,
      splitRow,
      candidate.width,
      1,
    ).data;
    let darkBoundaryPixels = 0;
    for (let i = 0; i < boundaryPixels.length; i += 4) {
      if (
        boundaryPixels[i + 3] > 0 &&
        (boundaryPixels[i] < 245 ||
          boundaryPixels[i + 1] < 245 ||
          boundaryPixels[i + 2] < 245)
      ) {
        darkBoundaryPixels++;
      }
    }

    return { splitRow, canvasHeight: candidate.height, darkBoundaryPixels };
  });

  expect(result.splitRow).toBeGreaterThan(result.canvasHeight / 2);
  expect(result.darkBoundaryPixels).toBe(0);
});
