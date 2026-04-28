import { GameEngine } from './GameEngine.js';

const players = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
  { id: '3', name: 'C' },
  { id: '4', name: 'D' },
];

const game = new GameEngine(players);
game.startNewRound();

game.players[0].hand = [ { suit: 'hearts', value: 'A', rank: 14 } ];
game.players[1].hand = [ { suit: 'spades', value: '2', rank: 2 } ];
game.players[2].hand = [ { suit: 'diamonds', value: '3', rank: 3 } ];
game.players[3].hand = [ { suit: 'hearts', value: '2', rank: 2 }, { suit: 'clubs', value: '4', rank: 4 } ];

console.log(game.handleBid(game.players[game.currentPlayerIndex].id, 3));
console.log(game.handleBid(game.players[game.currentPlayerIndex].id, 3));
console.log(game.handleBid(game.players[game.currentPlayerIndex].id, 3));
console.log(game.handleBid(game.players[game.currentPlayerIndex].id, 3));

console.log("Phase:", game.phase);

game.currentPlayerIndex = 0; // Force to 0 for test

console.log(game.playCard('1', { suit: 'hearts', value: 'A' }));
console.log(game.playCard('2', { suit: 'spades', value: '2' }));
console.log(game.playCard('3', { suit: 'diamonds', value: '3' }));
console.log(game.playCard('4', { suit: 'clubs', value: '4' }));
