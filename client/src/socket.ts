import { io } from 'socket.io-client';

const URL = import.meta.env.MODE === 'production' ? 'https://four00-cartes.onrender.com' : 'http://localhost:3000';

export const socket = io(URL as string, {
  autoConnect: false
});
