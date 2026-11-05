import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  Bot,
  Boxes,
  FlaskConical,
  FolderTree,
  Home,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useUi } from '../context';
import { cn, InlineNotice } from './ui';

const NAV = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/agents', label: 'Agents', icon: Bot, end: false },
  { to: '/runs', label: 'Runs', icon: Boxes, end: false },
  { to: '/vault', label: 'Vault', icon: FolderTree, end: false },
  { to: '/learning', label: 'Learning', icon: FlaskConical, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { meta, metaError, health, healthError, reloadHealth } = useUi();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const learningOff = meta?.features.learning === false;
  const apiOnline = !healthError && health !== null;
  const stage = meta?.phase ?? (metaError ? 'unreported' : '…');

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-brand">
          <button
            type="button"
            className="icon-button topbar-menu"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
          <Link to="/" className="brand" aria-label="HiveRouter overview">
            <span className="brand-mark font-display">Hive</span>
            <span className="brand-word font-mono-ui">ROUTER</span>
          </Link>
          <span className="topbar-divider" aria-hidden />
          <span className="topbar-sub font-mono-ui">AI AGENT CODING ROUTER</span>
        </div>
        <div className="topbar-right">
          <span className={cn('status-pill', apiOnline ? 'status-online' : 'status-offline')}>
            <span className="status-dot" aria-hidden />
            {healthError ? 'API offline' : health ? 'API online' : 'Checking API'}
          </span>
          <span className="stage-chip font-mono-ui" title="Release stage reported by /api/meta">
            STAGE {stage}
          </span>
          {meta?.features.routing === false ? (
            <span className="stage-chip stage-chip-muted" title="Decision-intelligence tabs are a later phase">
              B1 OFF
            </span>
          ) : null}
          {meta?.features.learning === false ? (
            <span className="stage-chip stage-chip-muted" title="Learning is disabled for this stage">
              B2 OFF
            </span>
          ) : null}
        </div>
      </header>

      <div className="shell-body">
        <aside id="primary-navigation" className={cn('sidebar', mobileOpen && 'sidebar-open')} aria-label="Primary navigation">
          <nav className="nav-list">
            {NAV.map((item) => {
              const Icon = item.icon;
              const disabled = item.to === '/learning' && learningOff;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
                  onClick={() => setMobileOpen(false)}
                  title={disabled ? 'Learning is disabled in this release stage' : undefined}
                >
                  <Icon size={17} aria-hidden />
                  <span>{item.label}</span>
                  {disabled ? <span className="nav-chip">Off</span> : null}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <p className="font-display text-lg italic">Screening-grade by design.</p>
            <p className="mt-1 text-xs text-slate-500">
              Local, single-user factory. No learned routing. No generated-code execution. No provider key in the browser.
            </p>
          </div>
          <div className="sidebar-foot">
            <span className="font-mono-ui">HIVEROUTER v{meta?.version ?? '—'}</span>
            <Link to="/settings" className="inline-flex items-center gap-1 text-xs">
              <ShieldCheck size={12} aria-hidden /> Trust &amp; status
            </Link>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <main id="main-content" className="main-content">
          {healthError ? (
            <div className="mb-5">
              <InlineNotice tone="error">
                The HiveRouter API is unreachable. This screen shows only what the API has returned; no cached or
                fabricated data is displayed.{' '}
                <button type="button" className="link-button" onClick={reloadHealth}>
                  Retry connection <RefreshCw size={12} aria-hidden />
                </button>
              </InlineNotice>
            </div>
          ) : null}
          {metaError ? (
            <div className="mb-5">
              <InlineNotice tone="warn">
                Stage and feature metadata are unavailable ({metaError.code}). Feature-gated surfaces will state
                their dependency instead of pretending to be enabled.
              </InlineNotice>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <footer className="app-footer">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1">
            <Activity size={13} aria-hidden /> Local factory · 127.0.0.1
          </span>
          <span>Independent local tool. Not affiliated with the U.S. Government or the National Design Studio.</span>
        </div>
        <span className="font-mono-ui">NO AUTO-PROMOTION · NO SHELL · NO GENERATED-CODE EXECUTION</span>
      </footer>
    </div>
  );
}
