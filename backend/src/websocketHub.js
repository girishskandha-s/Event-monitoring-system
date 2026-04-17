export class WebSocketHub {
  constructor() {
    this.clients = new Set();
  }

  add(client) {
    this.clients.add(client);
  }

  remove(client) {
    this.clients.delete(client);
  }

  broadcast(type, payload) {
    const message = JSON.stringify({
      type,
      payload,
      sentAt: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }
}

export const websocketHub = new WebSocketHub();
