import colors from 'picocolors';

/**
 * @typedef {Object} DiffLine
 * @property {'-' | '+' | ' '} type
 * @property {string} content
 * @property {number} [oldLineNo]
 * @property {number} [newLineNo]
 */

/**
 * Compute the difference between two strings line by line.
 * Uses an LCS (Longest Common Subsequence) based algorithm.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {DiffLine[]}
 */
export function computeDiff(oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const oldLen = oldLines.length;
  const newLen = newLines.length;

  const dp = Array.from({ length: oldLen + 1 }, () =>
    Array.from({ length: newLen + 1 }, () => 0),
  );

  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  /** @type {DiffLine[]} */
  const diff = [];
  let i = oldLen;
  let j = newLen;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: ' ',
        content: oldLines[i - 1],
        oldLineNo: i,
        newLineNo: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: '+',
        content: newLines[j - 1],
        newLineNo: j,
      });
      j--;
    } else if (i > 0) {
      diff.unshift({
        type: '-',
        content: oldLines[i - 1],
        oldLineNo: i,
      });
      i--;
    }
  }

  return diff;
}

/**
 * Format diff output with context lines and separators for unchanged regions.
 *
 * @param {DiffLine[]} diff
 * @param {number} contextLines
 * @returns {string}
 */
export function formatDiff(diff, contextLines = 3) {
  /** @type {Array<{ type: 'hunk' | 'separator', content: string }>} */
  const result = [];
  let hunkStart = -1;
  let unchangedCount = 0;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];

    if (line.type !== ' ') {
      if (hunkStart === -1) {
        hunkStart = Math.max(0, i - contextLines);
        unchangedCount = 0;
      }
      unchangedCount = 0;
    } else if (hunkStart !== -1) {
      unchangedCount++;
      if (unchangedCount > contextLines * 2) {
        const hunkEnd = i - unchangedCount + contextLines + 1;
        result.push({
          type: 'hunk',
          content: formatHunk(diff, hunkStart, hunkEnd),
        });
        hunkStart = -1;
        unchangedCount = 0;
      }
    }
  }

  if (hunkStart !== -1) {
    result.push({
      type: 'hunk',
      content: formatHunk(diff, hunkStart, diff.length),
    });
  }

  return result.map((r) => r.content).join('\n---\n');
}

/**
 * Format a single hunk of the diff.
 *
 * @param {DiffLine[]} diff
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function formatHunk(diff, start, end) {
  const firstLine = diff[start];
  const lastLine = diff[end - 1];

  let oldStart = firstLine.oldLineNo ?? 1;
  let newStart = firstLine.newLineNo ?? 1;
  const oldEnd = lastLine.oldLineNo ?? oldStart;
  const newEnd = lastLine.newLineNo ?? newStart;

  let oldCount = oldEnd - oldStart + 1;
  let newCount = newEnd - newStart + 1;

  for (let i = 0; i < start; i++) {
    const diffLine = diff[i];
    if (
      diffLine &&
      diffLine.oldLineNo != null &&
      diffLine.oldLineNo < oldStart
    ) {
      oldCount++;
    }
    if (
      diffLine &&
      diffLine.newLineNo != null &&
      diffLine.newLineNo < newStart
    ) {
      newCount++;
    }
  }

  const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
  const lines = diff.slice(start, end).map((line) => {
    const prefix = line.type;
    const content = line.content;
    if (line.type === '+') {
      return (
        prefix + (colors.isColorSupported ? colors.green(content) : content)
      );
    } else if (line.type === '-') {
      return prefix + (colors.isColorSupported ? colors.red(content) : content);
    }
    return prefix + content;
  });

  return [header, ...lines].join('\n');
}

/**
 * Generate a complete diff string between two texts.
 *
 * @param {string} oldText
 * @param {string} newText
 * @param {string} [filename]
 * @param {number} [contextLines]
 * @returns {string}
 */
export function generateDiff(oldText, newText, filename, contextLines = 3) {
  const diff = computeDiff(oldText, newText);

  if (diff.every((line) => line.type === ' ')) {
    return '';
  }

  const header = filename ? `--- ${filename}\n+++ ${filename}` : '--- a\n+++ b';

  const formatted = formatDiff(diff, contextLines);

  if (!formatted) {
    return '';
  }

  return `${header}\n${formatted}`;
}
