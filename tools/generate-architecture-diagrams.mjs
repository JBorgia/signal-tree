#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(
  root,
  'apps/demo/src/app/pages/architecture-overview/architecture-diagrams.ts'
);
const outputDirectory = resolve(root, 'apps/demo/public/architecture');
const checkOnly = process.argv.includes('--check');

const xml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const compileSpecifications = () => {
  const source = readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics ?? [];
  if (diagnostics.length > 0) {
    throw new Error(
      diagnostics
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        )
        .join('\n')
    );
  }

  const module = { exports: {} };
  vm.runInNewContext(
    result.outputText,
    { exports: module.exports, module },
    {
      filename: sourcePath,
    }
  );

  const diagrams = Object.entries(module.exports)
    .filter(
      ([name, value]) =>
        name.endsWith('_DIAGRAM') && value && typeof value === 'object'
    )
    .map(([, value]) => value)
    .sort((left, right) => left.eyebrow.localeCompare(right.eyebrow));

  if (diagrams.length === 0) {
    throw new Error('No architecture diagram specifications were exported.');
  }

  return { diagrams, source };
};

const connect = (from, to) => {
  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;
  const deltaX = toCenterX - fromCenterX;
  const deltaY = toCenterY - fromCenterY;
  const fromScale = Math.min(
    Math.abs(deltaX) > 0 ? from.width / 2 / Math.abs(deltaX) : Infinity,
    Math.abs(deltaY) > 0 ? from.height / 2 / Math.abs(deltaY) : Infinity
  );
  const toScale = Math.min(
    Math.abs(deltaX) > 0 ? to.width / 2 / Math.abs(deltaX) : Infinity,
    Math.abs(deltaY) > 0 ? to.height / 2 / Math.abs(deltaY) : Infinity
  );
  const startX = fromCenterX + deltaX * fromScale;
  const startY = fromCenterY + deltaY * fromScale;
  const endX = toCenterX - deltaX * toScale;
  const endY = toCenterY - deltaY * toScale;

  return {
    path: `M ${startX} ${startY} L ${endX} ${endY}`,
    midpoint: [(startX + endX) / 2, (startY + endY) / 2],
    start: [startX, startY],
    end: [endX, endY],
  };
};

const crossesInterior = (start, end, target) => {
  for (let step = 1; step < 100; step += 1) {
    const progress = step / 100;
    const x = start[0] + (end[0] - start[0]) * progress;
    const y = start[1] + (end[1] - start[1]) * progress;
    if (
      x > target.x + 1 &&
      x < target.x + target.width - 1 &&
      y > target.y + 1 &&
      y < target.y + target.height - 1
    ) {
      return true;
    }
  }

  return false;
};

const validateLayouts = (diagrams) => {
  for (const diagram of diagrams) {
    for (const viewport of ['desktop', 'mobile']) {
      const nodes = new Map(
        diagram.nodes.map((current) => [current.id, current.position[viewport]])
      );
      for (const current of diagram.edges) {
        const from = nodes.get(current.from);
        const to = nodes.get(current.to);
        if (!from || !to) {
          throw new Error(
            `${diagram.id}/${viewport}: unknown edge ${current.from} -> ${current.to}`
          );
        }
        const connection = connect(from, to);
        for (const [nodeId, target] of nodes) {
          if (nodeId === current.from || nodeId === current.to) {
            continue;
          }
          if (crossesInterior(connection.start, connection.end, target)) {
            throw new Error(
              `${diagram.id}/${viewport}: edge ${current.id} crosses node ${nodeId}`
            );
          }
        }
      }
    }
  }
};

const validateExplanations = (diagrams) => {
  const fields = ['plainLanguage', 'realWorldExample', 'financialImpact'];

  for (const diagram of diagrams) {
    for (const field of fields) {
      if (typeof diagram[field] !== 'string' || diagram[field].trim() === '') {
        throw new Error(`${diagram.id}: missing ${field}`);
      }
    }
  }
};

const svgStyles = `
  :root {
    --st-ink: #17211a;
    --st-muted: #55615a;
    --st-surface: #fbfcf8;
    --st-grid: rgba(23, 33, 26, 0.055);
    --st-line: #526158;
    --st-application: #fff0c7;
    --st-framework: #dbe8ff;
    --st-kernel: #d9f66f;
    --st-authored: #d9f0df;
    --st-external: #ffe0d5;
    --st-restoration: #f8d66d;
    --st-identity: #d6eee9;
    --st-projection: #e9e0f7;
    --st-neutral: #edf0eb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --st-ink: #eef4e9;
      --st-muted: #b6c1b8;
      --st-surface: #17211a;
      --st-grid: rgba(238, 244, 233, 0.055);
      --st-line: #a9b6ac;
      --st-application: #544a2d;
      --st-framework: #30435f;
      --st-kernel: #4c641f;
      --st-authored: #31513a;
      --st-external: #653f35;
      --st-restoration: #624f1e;
      --st-identity: #31534c;
      --st-projection: #493d5c;
      --st-neutral: #303a33;
    }
  }
  text { fill: var(--st-ink); }
  .group-box { fill: color-mix(in srgb, var(--st-neutral) 55%, transparent); stroke: var(--st-line); stroke-width: 1.5; }
  .group-box--projection { fill: color-mix(in srgb, var(--st-projection) 42%, transparent); }
  .dashed { stroke-dasharray: 8 7; }
  .group-label, .node-detail { fill: var(--st-muted); }
  .group-label, .node-title, .edge-label { font-family: 'Space Grotesk', 'Avenir Next', sans-serif; }
  .group-label { font-size: 12px; font-weight: 700; }
  .edge { fill: none; stroke: var(--st-line); stroke-width: 2; }
  .edge-label-group { pointer-events: none; }
  .edge-label-plate { fill: var(--st-surface); stroke: color-mix(in srgb, var(--st-line) 42%, transparent); stroke-width: 1; }
  .edge-label { fill: var(--st-ink); font-size: 11px; font-weight: 700; }
  .node { outline: none; }
  .node rect { stroke: color-mix(in srgb, var(--st-ink) 42%, transparent); stroke-width: 1.4; transition: stroke-width 180ms ease; }
  .node:hover rect { stroke-width: 2.5; }
  .node--application rect { fill: var(--st-application); }
  .node--framework rect { fill: var(--st-framework); }
  .node--kernel rect { fill: var(--st-kernel); }
  .node--authored rect { fill: var(--st-authored); }
  .node--external rect { fill: var(--st-external); }
  .node--restoration rect { fill: var(--st-restoration); }
  .node--identity rect { fill: var(--st-identity); }
  .node--projection rect { fill: var(--st-projection); }
  .node--neutral rect { fill: var(--st-neutral); }
  .node-title { font-size: 16px; font-weight: 730; }
  .node-detail { font-family: 'IBM Plex Sans', 'Avenir Next', sans-serif; font-size: 12px; font-weight: 520; }
  .node-detail--code { font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace; font-size: 10.5px; }
  .slide-title { font: 700 62px 'Space Grotesk', 'Avenir Next', sans-serif; }
  .slide-takeaway { fill: var(--st-muted); font: 500 28px 'IBM Plex Sans', 'Avenir Next', sans-serif; }
  .notes { box-sizing: border-box; height: 100%; padding: 22px 28px; color: var(--st-ink); border: 1px solid var(--st-line); background: var(--st-neutral); font: 15px/1.5 'IBM Plex Sans', 'Avenir Next', sans-serif; }
  .notes-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 32px; }
  .notes h2 { margin: 0 0 8px; font-size: 15px; text-transform: uppercase; }
  .notes p { margin: 0; }
  .notes ul { margin: 0; padding-left: 20px; }
  .notes code { font-size: 13px; overflow-wrap: anywhere; }
  .story-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--st-line); background: var(--st-line); gap: 1px; }
  .story-item { min-width: 0; padding: 14px 16px; background: var(--st-surface); }
  .story-item--plain { background: var(--st-authored); }
  .story-item--example { background: var(--st-framework); }
  .story-item--money { background: var(--st-restoration); }
  .story-item h2 { margin-bottom: 6px; font-size: 12px; }
  .story-item p { font-size: 14px; line-height: 1.45; }
  .slide-story { box-sizing: border-box; height: 100%; color: var(--st-ink); font: 18px/1.4 'IBM Plex Sans', 'Avenir Next', sans-serif; }
  .slide-story .story-item { padding: 16px 18px; }
  .slide-story .story-item h2 { font-size: 13px; }
  @media (prefers-reduced-motion: reduce) { .node rect { transition: none; } }
`;

const renderTspans = (lines, x, lineHeight) =>
  lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${xml(
          line
        )}</tspan>`
    )
    .join('');

const wrapWords = (text, maxCharacters) => {
  const lines = [];
  let currentLine = '';

  for (const word of text.split(/\s+/)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && candidate.length > maxCharacters) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
};

const layoutEdgeLabel = (label, centerX, centerY, viewport) => {
  const fontSize = viewport === 'mobile' ? 10 : 11;
  const lineHeight = viewport === 'mobile' ? 13 : 14;
  const maxCharacters = viewport === 'mobile' ? 18 : 24;
  const lines = label
    .split(/\s+·\s+/)
    .flatMap((part) => wrapWords(part, maxCharacters));
  const longestLine = Math.max(...lines.map((line) => line.length));
  const width = Math.max(
    84,
    Math.ceil(longestLine * fontSize * 0.62 + 18)
  );
  const height = lines.length * lineHeight + 10;

  return {
    lines,
    lineHeight,
    x: centerX,
    textY:
      centerY - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34,
    plateX: centerX - width / 2,
    plateY: centerY - height / 2,
    width,
    height,
  };
};

const renderBody = (diagram, viewport, markerId, includeDetails = true) => {
  const nodes = diagram.nodes.map((source) => {
    const position = source.position[viewport];
    const title =
      viewport === 'mobile' ? source.mobileTitle ?? source.title : source.title;
    const details = includeDetails
      ? viewport === 'mobile'
        ? source.mobileDetail ?? source.detail ?? []
        : source.detail ?? []
      : [];
    const titleHeight = title.length * 22;
    const detailHeight = details.length * 18;
    const contentHeight = titleHeight + (detailHeight ? detailHeight + 8 : 0);
    const titleY = position.y + (position.height - contentHeight) / 2 + 17;

    return {
      ...source,
      title,
      ...position,
      centerX: position.x + position.width / 2,
      titleY,
      detailY: titleY + titleHeight + 3,
      details,
    };
  });
  const nodesById = new Map(nodes.map((current) => [current.id, current]));

  const groups = (diagram.groups ?? [])
    .map((group) => {
      const position = group.position[viewport];
      const labelOffset = viewport === 'mobile' ? [12, 18] : [16, 22];
      const classes = [
        'group-box',
        `group-box--${group.tone}`,
        group.dashed ? 'dashed' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<g><rect class="${classes}" x="${position.x}" y="${
        position.y
      }" width="${position.width}" height="${
        position.height
      }" rx="0"/><text class="group-label" x="${
        position.x + labelOffset[0]
      }" y="${position.y + labelOffset[1]}">${xml(group.label)}</text></g>`;
    })
    .join('');

  const edges = diagram.edges
    .map((current) => {
      const from = nodesById.get(current.from);
      const to = nodesById.get(current.to);
      if (!from || !to) {
        throw new Error(
          `Unknown diagram edge: ${current.from} -> ${current.to}`
        );
      }
      const connection = connect(from, to);
      const [offsetX = 0, offsetY = -8] = current.labelOffset?.[viewport] ?? [];
      const markerStart =
        current.direction === 'both' ? ` marker-start="url(#${markerId})"` : '';
      const markerEnd =
        current.direction !== 'none' ? ` marker-end="url(#${markerId})"` : '';
      const classes = ['edge', current.dashed ? 'dashed' : '']
        .filter(Boolean)
        .join(' ');
      const label = current.label
        ? (() => {
            const layout = layoutEdgeLabel(
              current.label,
              connection.midpoint[0] + offsetX,
              connection.midpoint[1] + offsetY,
              viewport
            );
            return `<g class="edge-label-group"><rect class="edge-label-plate" x="${layout.plateX}" y="${layout.plateY}" width="${layout.width}" height="${layout.height}" rx="0"/><text class="edge-label" x="${layout.x}" y="${layout.textY}" text-anchor="middle">${renderTspans(
              layout.lines,
              layout.x,
              layout.lineHeight
            )}</text></g>`;
          })()
        : '';
      return {
        path: `<path class="${classes}" d="${connection.path}"${markerStart}${markerEnd}/>`,
        label,
      };
    });
  const edgePaths = edges.map((current) => current.path).join('');
  const edgeLabels = edges.map((current) => current.label).join('');

  const renderedNodes = nodes
    .map((current) => {
      const detail = current.details.length
        ? `<text class="node-detail${
            current.code ? ' node-detail--code' : ''
          }" x="${current.centerX}" y="${
            current.detailY
          }" text-anchor="middle">${renderTspans(
            current.details,
            current.centerX,
            18
          )}</text>`
        : '';
      const accessibleLabel = [...current.title, ...current.details].join(' ');
      return `<g class="node node--${current.tone}"><title>${xml(
        accessibleLabel
      )}</title><rect x="${current.x}" y="${current.y}" width="${
        current.width
      }" height="${current.height}" rx="0"/><text class="node-title" x="${
        current.centerX
      }" y="${current.titleY}" text-anchor="middle">${renderTspans(
        current.title,
        current.centerX,
        22
      )}</text>${detail}</g>`;
    })
    .join('');

  return `${groups}<g class="edge-paths">${edgePaths}</g><g class="nodes">${renderedNodes}</g><g class="edge-labels">${edgeLabels}</g>`;
};

const parseViewBox = (value) => value.split(' ').map(Number);

const renderDefinitions = (id) => `<defs>
  <marker id="${id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--st-line)"/></marker>
  <pattern id="${id}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--st-grid)" stroke-width="1"/></pattern>
</defs>`;

const renderStandardSvg = (diagram, viewport, variant) => {
  const viewBox =
    viewport === 'desktop' ? diagram.desktopViewBox : diagram.mobileViewBox;
  const [, , width, height] = parseViewBox(viewBox);
  const id = `${diagram.id}-${variant}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="${viewBox}" role="img" aria-labelledby="${id}-title ${id}-description" data-diagram="${
    diagram.id
  }" data-variant="${variant}">
  <title id="${id}-title">${xml(diagram.title)}</title>
  <desc id="${id}-description">${xml(
    `${diagram.description} In plain words: ${diagram.plainLanguage} Real app example: ${diagram.realWorldExample} Why money cares: ${diagram.financialImpact}`
  )}</desc>
  <style>${svgStyles}</style>
  ${renderDefinitions(id)}
  <rect width="${width}" height="${height}" fill="var(--st-surface)"/>
  <rect width="${width}" height="${height}" fill="url(#${id}-grid)"/>
  ${renderBody(diagram, viewport, `${id}-arrow`)}
</svg>
`;
};

const renderDocsSvg = (diagram) => {
  const [, , width, diagramHeight] = parseViewBox(diagram.desktopViewBox);
  const notesHeight = 430;
  const height = diagramHeight + notesHeight;
  const id = `${diagram.id}-docs`;
  const checks = diagram.checks
    .map((check) => `<li>${xml(check)}</li>`)
    .join('');
  const evidence = diagram.evidence
    .map((source) => `<li><code>${xml(source)}</code></li>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-description" data-diagram="${
    diagram.id
  }" data-variant="docs">
  <title id="${id}-title">${xml(diagram.title)}</title>
  <desc id="${id}-description">${xml(diagram.description)}</desc>
  <style>${svgStyles}</style>
  ${renderDefinitions(id)}
  <rect width="${width}" height="${height}" fill="var(--st-surface)"/>
  <rect width="${width}" height="${diagramHeight}" fill="url(#${id}-grid)"/>
  ${renderBody(diagram, 'desktop', `${id}-arrow`)}
  <foreignObject x="24" y="${diagramHeight + 18}" width="${
    width - 48
  }" height="${notesHeight - 36}">
    <section xmlns="http://www.w3.org/1999/xhtml" class="notes">
      <div class="story-grid"><div class="story-item story-item--plain"><h2>In plain words</h2><p>${xml(
        diagram.plainLanguage
      )}</p></div><div class="story-item story-item--example"><h2>Real app example</h2><p>${xml(
        diagram.realWorldExample
      )}</p></div><div class="story-item story-item--money"><h2>Why money cares</h2><p>${xml(
        diagram.financialImpact
      )}</p></div></div>
      <div class="notes-grid"><div><h2>Semantic checks</h2><ul>${checks}</ul></div><div><h2>Code evidence</h2><ul>${evidence}</ul></div></div>
    </section>
  </foreignObject>
</svg>
`;
};

const renderSlideSvg = (diagram) => {
  const [, , sourceWidth, sourceHeight] = parseViewBox(diagram.desktopViewBox);
  const scale = Math.min(1680 / sourceWidth, 540 / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (1920 - renderedWidth) / 2;
  const offsetY = 220 + (540 - renderedHeight) / 2;
  const id = `${diagram.id}-slide`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="${id}-title ${id}-description" data-diagram="${
    diagram.id
  }" data-variant="slide">
  <title id="${id}-title">${xml(diagram.title)}</title>
  <desc id="${id}-description">${xml(diagram.description)}</desc>
  <style>${svgStyles}</style>
  ${renderDefinitions(id)}
  <rect width="1920" height="1080" fill="var(--st-surface)"/>
  <rect width="1920" height="1080" fill="url(#${id}-grid)"/>
  <text class="slide-title" x="120" y="120">${xml(diagram.title)}</text>
  <text class="slide-takeaway" x="120" y="180">${xml(diagram.takeaway)}</text>
  <g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${renderBody(
    diagram,
    'desktop',
    `${id}-arrow`,
    false
  )}</g>
  <foreignObject x="120" y="790" width="1680" height="220">
    <section xmlns="http://www.w3.org/1999/xhtml" class="slide-story">
      <div class="story-grid"><div class="story-item story-item--plain"><h2>In plain words</h2><p>${xml(
        diagram.plainLanguage
      )}</p></div><div class="story-item story-item--example"><h2>Real app example</h2><p>${xml(
        diagram.realWorldExample
      )}</p></div><div class="story-item story-item--money"><h2>Why money cares</h2><p>${xml(
        diagram.financialImpact
      )}</p></div></div>
    </section>
  </foreignObject>
</svg>
`;
};

const { diagrams, source } = compileSpecifications();
validateExplanations(diagrams);
validateLayouts(diagrams);
const sourceHash = createHash('sha256').update(source).digest('hex');
const outputs = new Map();

outputs.set(
  'semantic-spec.json',
  `${JSON.stringify(
    {
      schemaVersion: 1,
      source:
        'apps/demo/src/app/pages/architecture-overview/architecture-diagrams.ts',
      sourceSha256: sourceHash,
      diagrams,
    },
    null,
    2
  )}\n`
);

for (const diagram of diagrams) {
  outputs.set(
    `${diagram.id}.web.svg`,
    renderStandardSvg(diagram, 'desktop', 'web')
  );
  outputs.set(
    `${diagram.id}.mobile.svg`,
    renderStandardSvg(diagram, 'mobile', 'mobile')
  );
  outputs.set(`${diagram.id}.docs.svg`, renderDocsSvg(diagram));
  outputs.set(`${diagram.id}.slide.svg`, renderSlideSvg(diagram));
}

outputs.set(
  'README.md',
  `# SignalTree architecture diagrams\n\nGenerated from the audited semantic source at \`apps/demo/src/app/pages/architecture-overview/architecture-diagrams.ts\`. Do not edit generated files by hand.\n\nEach concept includes:\n\n- \`*.web.svg\` — responsive, themeable desktop composition\n- \`*.mobile.svg\` — recomposed narrow-screen layout\n- \`*.docs.svg\` — detailed visual with plain-language guidance, a real app example, financial impact, semantic checks, and evidence\n- \`*.slide.svg\` — 1920 x 1080 presentation composition with a compact teaching strip\n- \`semantic-spec.json\` — nodes, edges, groups, copy, accessibility description, and source evidence\n\nRegenerate with \`pnpm architecture:assets\`; verify drift with \`pnpm architecture:assets:check\`.\n`
);

const mismatches = [];
for (const [name, content] of outputs) {
  const path = resolve(outputDirectory, name);
  if (checkOnly) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      mismatches.push(name);
    }
    continue;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

if (mismatches.length > 0) {
  console.error(`Architecture assets are stale: ${mismatches.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(
    checkOnly
      ? `Architecture assets are current (${outputs.size} files).`
      : `Generated ${outputs.size} architecture assets.`
  );
}
