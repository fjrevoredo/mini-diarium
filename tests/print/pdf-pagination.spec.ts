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
const html2canvasPath = resolve("node_modules/html2canvas/dist/html2canvas.min.js");

test("PDF snap points never bisect mixed-format visual lines", async ({
  page,
}) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      #root {
        position: fixed;
        top: 0;
        left: 0;
        width: 650px;
        font-family: Georgia, serif;
        font-size: 16px;
        line-height: 1.6;
      }
      .md-print-entry-content p { margin: 0.5em 0; }
    </style>
    <div id="root">
      <div class="md-print-entry-content">
        <p>
          ${"normal words ".repeat(15)}
          <span style="font-size: 8px">tiny words</span>
          ${"more words ".repeat(15)}
          <strong style="font-size: 24px">large words</strong>
          ${"ending words ".repeat(15)}
        </p>
      </div>
    </div>
  `);
  await page.addScriptTag({
    type: "module",
    content: `${pdfModule}\nwindow.__collectSnapPoints = collectSnapPoints;`,
  });

  const result = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#root")!;
    const paragraph = document.querySelector<HTMLElement>("p")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const fragments = [...range.getClientRects()];
    const collectSnapPoints = (
      window as typeof window & {
        __collectSnapPoints: (
          element: HTMLElement,
          elementTopPx: number,
          cssToMm: number,
        ) => number[];
      }
    ).__collectSnapPoints;
    const points = collectSnapPoints(root, root.getBoundingClientRect().top, 1);

    return {
      points,
      unsafePoints: points.filter((point) =>
        fragments.some(
          (fragment) => point > fragment.top && point < fragment.bottom,
        ),
      ),
    };
  });

  expect(result.points.length).toBeGreaterThan(1);
  expect(result.unsafePoints).toEqual([]);
});

test("PDF splits use html2canvas clone geometry rather than live DOM geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      #root {
        position: fixed;
        top: 0;
        left: 0;
        width: 650px;
        background: white;
        font: 16px/1.6 Georgia, serif;
      }
      .md-print-entry-content p { margin: 0.5em 0; }
      @media (max-width: 700px) {
        .md-print-entry-content { font-size: 24px; line-height: 2; }
      }
    </style>
    <div id="root">
      <div class="md-print-entry-content">
        ${Array.from(
          { length: 80 },
          (_, index) => `<p>Paragraph ${index}: ${"words ".repeat(45)}</p>`,
        ).join("")}
      </div>
    </div>
  `);
  await page.addScriptTag({
    type: "module",
    content: `${pdfModule}\nwindow.__collectSnapPoints = collectSnapPoints;\nwindow.__computePageSplits = computePageSplits;`,
  });
  await page.addScriptTag({ path: html2canvasPath });

  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#root")!;
    const api = window as typeof window & {
      html2canvas: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => Promise<HTMLCanvasElement>;
      __collectSnapPoints: (
        element: HTMLElement,
        elementTopPx: number,
        cssToMm: number,
      ) => number[];
      __computePageSplits: (
        totalHeightMm: number,
        imageBoundsMm: [],
        snapPointsMm: number[],
      ) => number[];
    };
    const windowWidth = root.scrollWidth;
    const windowHeight = root.scrollHeight;
    let cloneSnapPoints: number[] = [];
    let cloneWidth = 0;
    let cloneHeight = 0;
    const prepareClone = (clone: HTMLElement) => {
      clone.style.position = "absolute";
      clone.style.top = "0";
      clone.style.left = "0";
    };
    await api.html2canvas(root, {
      scale: 1,
      logging: false,
      windowWidth,
      windowHeight,
      scrollX: 0,
      scrollY: 0,
      width: 1,
      height: 1,
      onclone: (_document: Document, clone: HTMLElement) => {
        prepareClone(clone);
        const rect = clone.getBoundingClientRect();
        cloneWidth = rect.width;
        cloneHeight = rect.height;
        cloneSnapPoints = api.__collectSnapPoints(clone, rect.top, 180 / rect.width);
      },
    });

    const cssToMm = 180 / cloneWidth;
    const splits = api.__computePageSplits(cloneHeight * cssToMm, [], cloneSnapPoints);
    const pageResults = [];
    for (let i = 0; i < splits.length - 1; i++) {
      const topPx = splits[i] / cssToMm;
      const heightPx = (splits[i + 1] - splits[i]) / cssToMm;
      const canvas = await api.html2canvas(root, {
        scale: 2,
        logging: false,
        windowWidth,
        windowHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: topPx,
        width: cloneWidth,
        height: heightPx,
        onclone: (_document: Document, clone: HTMLElement) => prepareClone(clone),
      });
      const context = canvas.getContext("2d")!;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let darkPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 245 || pixels[i + 1] < 245 || pixels[i + 2] < 245) darkPixels++;
      }
      const bottomRows = context.getImageData(0, canvas.height - 3, canvas.width, 3).data;
      let darkBottomPixels = 0;
      for (let i = 0; i < bottomRows.length; i += 4) {
        if (bottomRows[i] < 245 || bottomRows[i + 1] < 245 || bottomRows[i + 2] < 245) {
          darkBottomPixels++;
        }
      }
      pageResults.push({ height: canvas.height, darkPixels, darkBottomPixels });
    }

    return { splitCount: splits.length, pageResults };
  });

  expect(result.splitCount).toBeGreaterThan(2);
  expect(result.pageResults.every(({ height }) => height < 4_000)).toBe(true);
  expect(result.pageResults.every(({ darkPixels }) => darkPixels > 0)).toBe(true);
  expect(result.pageResults.slice(0, -1).every(({ darkBottomPixels }) => darkBottomPixels === 0)).toBe(
    true,
  );
});
