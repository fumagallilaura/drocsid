import { createApp } from './app.ts';
import { migrate } from './db.ts';

const port = Number(process.env.PORT ?? 3001);

await migrate();
createApp().listen(port, () => console.log(`Drocsid server em http://localhost:${port}`));
