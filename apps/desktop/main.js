import { app, BrowserWindow, Menu, Tray, desktopCapturer, nativeImage, session, shell } from 'electron';

const APP_URL = process.env.DROCSID_URL ?? 'http://localhost:5173';

// Ícone da bandeja: círculo verde 16x16 gerado em memória (BGRA), sem arquivo de imagem.
function trayIcon() {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x - 7.5) ** 2 + (y - 7.5) ** 2 > 56) continue;
      pixels.set([0x5c, 0x9b, 0x1a, 0xff], (y * size + x) * 4);
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let tray;
let quitting = false;

function show() {
  win.show();
  win.focus();
}

app.setAppUserModelId('com.drocsid.app');
app.on('second-instance', show);
app.on('before-quit', () => (quitting = true));

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 940, minHeight: 500, title: 'Drocsid', autoHideMenuBar: true });

  // Links externos abrem no navegador; a janela nunca sai do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== new URL(APP_URL).origin) e.preventDefault();
  });

  // Fechar esconde na bandeja, como o Discord.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

  // ponytail: compartilha sempre a primeira tela; um seletor de janelas exige UI própria.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const [screen] = await desktopCapturer.getSources({ types: ['screen'] });
    callback(screen ? { video: screen } : {});
  });

  tray = new Tray(trayIcon());
  tray.setToolTip('Drocsid');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Drocsid', click: show },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
  tray.on('click', show);

  win.loadURL(APP_URL);
});
