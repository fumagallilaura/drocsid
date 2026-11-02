import type { DesktopBridge } from './desktop.js';
declare global { interface Window { desktop?:DesktopBridge } }
