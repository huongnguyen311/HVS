import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { theme } from '../theme';
import HistoryTable from '../components/HistoryTable';
import PlanBoardTable from '../components/PlanBoardTable';
import './board.css';

// The plan board and History are React islands inside app.html: app.js renders the #/board or #/history route
// (header + an empty #board-root, data-view="history" for History) and mounts the island there; the IIFE build
// exposes these as window.HVSBoard.mount / unmount. `opts.toast` is the app's toast(), so messages look the same
// as on every other screen; `opts.notify` adds a push to the app's notification list.
let root = null;

export function mount(el, opts = {}) {
  unmount();
  root = createRoot(el);
  root.render(
    <StrictMode>
      <ConfigProvider theme={theme} locale={enUS}>
        <App>{opts.view === 'history' ? <HistoryTable /> : <PlanBoardTable toast={opts.toast} notify={opts.notify} />}</App>
      </ConfigProvider>
    </StrictMode>
  );
}

export function unmount() {
  if (root) root.unmount();
  root = null;
}
