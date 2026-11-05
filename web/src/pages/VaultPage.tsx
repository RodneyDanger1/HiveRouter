import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderTree, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getVaultFile, getVaultTree } from '../api';
import type { VaultNode } from '../api-types';
import { useApiResource } from '../hooks/useApi';
import {
  Card,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  Spinner,
} from '../components/ui';

export function VaultPage() {
  const tree = useApiResource(getVaultTree);
  const [selected, setSelected] = useState<string | null>(null);
  const [fileNonce, setFileNonce] = useState(0);
  const nodes = tree.data ?? [];
  const refreshVault = () => {
    tree.reload();
    setFileNonce((value) => value + 1);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Obsidian-compatible output"
        title="Vault"
        description="Run logs and blueprints are written as Markdown with a system index. This browser reads the vault through the API; it never writes it."
        actions={
          <button type="button" className="btn btn-secondary" onClick={refreshVault} disabled={tree.loading}>
            {tree.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
          </button>
        }
      />

      {tree.loading ? (
        <LoadingPanel label="Loading vault tree…" />
      ) : tree.error ? (
        <ErrorPanel error={tree.error} onRetry={tree.reload} title="Vault unavailable" />
      ) : nodes.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No vault entries"
          body="The API returned an empty tree. Logs appear after a run reaches finalize; this page does not fabricate an index."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          <Card className="p-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="font-mono-ui text-[10px] uppercase tracking-widest text-slate-400">Vault index</span>
              <span className="text-xs text-slate-400">{nodes.length} roots</span>
            </div>
            <div className="vault-tree">
              {nodes.map((node) => (
                <VaultNodeView key={node.path} node={node} selected={selected} onSelect={setSelected} depth={0} />
              ))}
            </div>
          </Card>

          <Card className="min-h-[420px] p-6">
            {selected ? (
              <VaultFile path={selected} refreshToken={fileNonce} />
            ) : (
              <EmptyState
                icon={FileText}
                title="Select a vault file"
                body="Choose a Markdown file from the tree. Content is rendered as data; raw HTML is not enabled."
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function VaultNodeView({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: VaultNode;
  selected: string | null;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Boolean(node.children?.length);
  if (node.type === 'dir') {
    return (
      <div>
        <button type="button" className="vault-row" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <Folder size={14} aria-hidden />
          <span>{node.name}</span>
        </button>
        {open
          ? node.children?.map((child) => (
              <VaultNodeView key={child.path} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
            ))
          : null}
        {!hasChildren ? <p className="vault-empty" style={{ paddingLeft: 30 + depth * 14 }}>Empty folder</p> : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`vault-row ${selected === node.path ? 'vault-row-active' : ''}`}
      style={{ paddingLeft: 30 + depth * 14 }}
      onClick={() => onSelect(node.path)}
    >
      <FileText size={14} aria-hidden />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function VaultFile({ path, refreshToken }: { path: string; refreshToken: number }) {
  const file = useApiResource((signal) => getVaultFile(path, signal), [path, refreshToken]);
  if (file.loading) return <LoadingPanel label="Loading vault file…" />;
  if (file.error) return <ErrorPanel error={file.error} onRetry={file.reload} title="Vault file unavailable" />;
  if (!file.data) return <EmptyState title="Empty file" body="The file exists but has no content." />;
  return (
    <article className="prose-nds">
      <p className="mb-4 font-mono text-xs text-slate-400">{path}</p>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.data}</ReactMarkdown>
    </article>
  );
}
