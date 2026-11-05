import { Highlight, themes, type Language } from 'prism-react-renderer';
import { FileCode2 } from 'lucide-react';
import { cn, CopyButton, formatInteger } from './ui';

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  yml: 'yaml',
  ps1: 'powershell',
  cmd: 'batch',
  bat: 'batch',
  sh: 'bash',
  rs: 'rust',
  cpp: 'cpp',
  h: 'c',
  md: 'markdown',
  html: 'markup',
  css: 'css',
  sql: 'sql',
  json: 'json',
  txt: 'text',
};

export function languageFor(language: string | null | undefined): string {
  if (!language) return 'text';
  return LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase();
}

export function CodeViewer({
  code,
  language,
  path,
  bytes,
  maxHeight = '68vh',
}: {
  code: string;
  language?: string | null;
  path?: string;
  bytes?: number | null;
  maxHeight?: string;
}) {
  const resolved = languageFor(language);
  return (
    <div className="code-card">
      <div className="code-head">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 size={15} className="shrink-0 text-slate-400" aria-hidden />
          <span className="truncate font-mono text-xs text-slate-700">{path ?? 'file'}</span>
          <span className="code-chip">{resolved}</span>
          {typeof bytes === 'number' ? (
            <span className="font-mono text-[10px] text-slate-400">{formatInteger(bytes)} bytes</span>
          ) : null}
        </div>
        <CopyButton value={code} />
      </div>
      {code.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">This file is empty.</p>
      ) : (
        <div className="code-scroll" style={{ maxHeight }} tabIndex={0} aria-label={`Code for ${path ?? 'file'}`}>
          <Highlight theme={themes.github} code={code} language={resolved as Language}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre className={cn(className, 'code-pre')} style={{ ...style, background: 'transparent' }}>
                {tokens.map((line, lineIndex) => (
                  <div {...getLineProps({ line })} key={lineIndex} className="code-line">
                    <span className="code-line-number" aria-hidden>
                      {lineIndex + 1}
                    </span>
                    <span className="code-line-content">
                      {line.map((token, tokenIndex) => (
                        <span {...getTokenProps({ token })} key={tokenIndex} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      )}
    </div>
  );
}
